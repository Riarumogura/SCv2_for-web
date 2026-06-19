// CUSTOM: ストレージエクスプローラーコンポーネント
import { For, Show, createSignal, onMount } from "solid-js";
import { styled } from "styled-system/jsx";

import { useStorageApi, StorageEntry } from "../../../api/storage";

interface StorageExplorerProps {
  serverId: string;
  storageId: string;
}

/**
 * ストレージエクスプローラーコンポーネント
 */
export function StorageExplorer(props: StorageExplorerProps) {
  const storageApi = useStorageApi();
  const [entries, setEntries] = createSignal<StorageEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [currentPath, setCurrentPath] = createSignal<string>("");
  const [searchQuery, setSearchQuery] = createSignal("");
  let fileInput: HTMLInputElement | undefined;

  // ファイル/フォルダ一覧を取得
  const loadFiles = async (path?: string) => {
    try {
      setLoading(true);
      const entryList = await storageApi.listFiles(
        props.serverId,
        props.storageId,
        path
      );
      // フォルダを先に、各グループ内は名前順に表示
      entryList.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(entryList);
      setCurrentPath(path || "");
    } catch (error) {
      console.error("ファイル一覧の取得に失敗しました:", error);
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時にファイル一覧を取得
  onMount(() => {
    loadFiles();
  });

  // パンくずリストのパスを分割
  const breadcrumbs = () => {
    if (!currentPath()) return [];
    return currentPath().split("/").filter(Boolean);
  };

  // エントリの絶対パスを組み立て
  const entryPath = (entry: StorageEntry) =>
    currentPath() ? `${currentPath()}/${entry.name}` : entry.name;

  // フォルダ/拡張子に基づくアイコンを取得
  const getEntryIcon = (entry: StorageEntry) => {
    if (entry.type === "folder") return "folder";
    const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
    if (["mp4", "webm", "mov", "mkv"].includes(ext)) return "movie";
    if (ext === "pdf") return "picture_as_pdf";
    if (["txt", "md", "json", "log"].includes(ext)) return "description";
    return "insert_drive_file";
  };

  // ファイルサイズを人間が読みやすい形式に変換
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // 日付をフォーマット
  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 検索フィルター
  const filteredEntries = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return entries();
    return entries().filter((entry) =>
      entry.name.toLowerCase().includes(query)
    );
  };

  // フォルダを開く / ファイルをクリックしたときの処理
  const openEntry = (entry: StorageEntry) => {
    if (entry.type === "folder") {
      loadFiles(entryPath(entry));
    }
  };

  // 新規フォルダを作成
  const handleCreateFolder = async () => {
    const name = window.prompt("新しいフォルダの名前を入力してください");
    if (!name) return;

    try {
      await storageApi.createFolder(
        props.serverId,
        props.storageId,
        currentPath() ? `${currentPath()}/${name}` : name
      );
      await loadFiles(currentPath());
    } catch (error) {
      console.error("フォルダの作成に失敗しました:", error);
      window.alert("フォルダの作成に失敗しました");
    }
  };

  // ファイル選択ダイアログを開く
  const handleUploadClick = () => {
    fileInput?.click();
  };

  // 選択されたファイルをアップロード
  const handleFileSelected = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const destination = currentPath() ? `${currentPath()}/${file.name}` : file.name;

    try {
      setLoading(true);
      await storageApi.uploadFile(props.serverId, props.storageId, file, destination);
      await loadFiles(currentPath());
    } catch (error) {
      console.error("ファイルのアップロードに失敗しました:", error);
      window.alert("ファイルのアップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // ドラッグ&ドロップでのアップロード
  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    const destination = currentPath() ? `${currentPath()}/${file.name}` : file.name;

    try {
      setLoading(true);
      await storageApi.uploadFile(props.serverId, props.storageId, file, destination);
      await loadFiles(currentPath());
    } catch (error) {
      console.error("ファイルのアップロードに失敗しました:", error);
      window.alert("ファイルのアップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // ファイルをダウンロード
  const handleDownload = async (entry: StorageEntry) => {
    try {
      const { url, filename } = await storageApi.downloadFile(
        props.serverId,
        props.storageId,
        entryPath(entry)
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("ファイルのダウンロードに失敗しました:", error);
      window.alert("ファイルのダウンロードに失敗しました");
    }
  };

  // ファイルを削除
  const handleDelete = async (entry: StorageEntry) => {
    if (!window.confirm(`「${entry.name}」を削除しますか?`)) return;

    try {
      await storageApi.deleteFile(props.serverId, props.storageId, entryPath(entry));
      await loadFiles(currentPath());
    } catch (error) {
      console.error("ファイルの削除に失敗しました:", error);
      window.alert("ファイルの削除に失敗しました");
    }
  };

  return (
    <ExplorerContainer>
      {/* ヘッダーセクション */}
      <ExplorerHeader>
        <PathNavigation>
          <PathBreadcrumbs>
            <PathItem onClick={() => loadFiles()}>ルート</PathItem>
            <For each={breadcrumbs()}>
              {(crumb, index) => (
                <>
                  <PathSeparator>/</PathSeparator>
                  <PathItem
                    onClick={() => {
                      const path = breadcrumbs()
                        .slice(0, index() + 1)
                        .join("/");
                      loadFiles(path);
                    }}
                  >
                    {crumb}
                  </PathItem>
                </>
              )}
            </For>
          </PathBreadcrumbs>
        </PathNavigation>

        <ActionBar>
          <SearchBox>
            <input
              type="text"
              placeholder="ファイルを検索..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </SearchBox>
          <ActionButtons>
            <button onClick={() => loadFiles(currentPath())}>
              更新
            </button>
            <button onClick={handleCreateFolder}>
              新規フォルダ
            </button>
            <button onClick={handleUploadClick}>
              アップロード
            </button>
            <input
              ref={fileInput}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileSelected}
            />
          </ActionButtons>
        </ActionBar>
      </ExplorerHeader>

      {/* ファイル一覧 */}
      <FileListContainer
        onDragOver={(e: DragEvent) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Show
          when={!loading()}
          fallback={
            <LoadingState>
              <div>読み込み中...</div>
            </LoadingState>
          }
        >
          <Show
            when={filteredEntries().length > 0}
            fallback={
              <EmptyState>
                <div>ファイルがありません</div>
                <div style={{ "font-size": "12px", "margin-top": "var(--gap-sm)" }}>
                  ファイルをドラッグ&ドロップ、またはアップロードボタンから追加してください
                </div>
              </EmptyState>
            }
          >
            <FileTable>
              <FileTableHeader>
                <FileTableRow>
                  <FileTableHeaderCell>名前</FileTableHeaderCell>
                  <FileTableHeaderCell>サイズ</FileTableHeaderCell>
                  <FileTableHeaderCell>更新日時</FileTableHeaderCell>
                  <FileTableHeaderCell>操作</FileTableHeaderCell>
                </FileTableRow>
              </FileTableHeader>
              <FileTableBody>
                <For each={filteredEntries()}>
                  {(entry) => (
                    <FileTableRow>
                      <FileTableCell
                        onClick={() => openEntry(entry)}
                        style={{ cursor: entry.type === "folder" ? "pointer" : "default" }}
                      >
                        <FileIcon>
                          <span class="material-symbols-outlined">
                            {getEntryIcon(entry)}
                          </span>
                        </FileIcon>
                        <FileName>{entry.name}</FileName>
                      </FileTableCell>
                      <FileTableCell>
                        {entry.type === "folder" ? "-" : formatFileSize(entry.size)}
                      </FileTableCell>
                      <FileTableCell>
                        {entry.type === "folder" ? "-" : formatDate(entry.lastModified)}
                      </FileTableCell>
                      <FileTableCell>
                        <Show when={entry.type === "file"}>
                          <FileActions>
                            <button onClick={() => handleDownload(entry)}>
                              ダウンロード
                            </button>
                            <button onClick={() => handleDelete(entry)}>
                              削除
                            </button>
                          </FileActions>
                        </Show>
                      </FileTableCell>
                    </FileTableRow>
                  )}
                </For>
              </FileTableBody>
            </FileTable>
          </Show>
        </Show>
      </FileListContainer>

      {/* フッターセクション */}
      <ExplorerFooter>
        <StorageInfo>
          <div>項目数: {entries().length}</div>
          <div>パス: {currentPath() || "/"}</div>
        </StorageInfo>
      </ExplorerFooter>
    </ExplorerContainer>
  );
}

// スタイル定義
const ExplorerContainer = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    padding: "var(--gap-md)",
  },
});

const ExplorerHeader = styled("div", {
  base: {
    marginBottom: "var(--gap-md)",
  },
});

const PathNavigation = styled("div", {
  base: {
    marginBottom: "var(--gap-sm)",
  },
});

const PathBreadcrumbs = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
  },
});

const PathItem = styled("button", {
  base: {
    background: "none",
    border: "none",
    color: "var(--md-sys-color-primary)",
    cursor: "pointer",
    fontSize: "14px",
    padding: "var(--gap-xs) var(--gap-sm)",
    "&:hover": {
      textDecoration: "underline",
    },
  },
});

const PathSeparator = styled("span", {
  base: {
    margin: "0 var(--gap-xs)",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const ActionBar = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "var(--gap-md)",
  },
});

const SearchBox = styled("div", {
  base: {
    flex: 1,
    marginRight: "var(--gap-md)",
    "& input": {
      width: "100%",
      padding: "var(--gap-sm)",
      border: "1px solid var(--md-sys-color-outline)",
      borderRadius: "var(--borderRadius-sm)",
      fontSize: "14px",
    },
  },
});

const ActionButtons = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-sm)",
    "& button": {
      padding: "var(--gap-sm) var(--gap-md)",
      background: "var(--md-sys-color-primary)",
      color: "white",
      border: "none",
      borderRadius: "var(--borderRadius-sm)",
      cursor: "pointer",
      fontSize: "14px",
      "&:hover": {
        opacity: 0.9,
      },
    },
  },
});

const FileListContainer = styled("div", {
  base: {
    flex: 1,
    overflow: "auto",
    background: "var(--md-sys-color-surface-container-low)",
    borderRadius: "var(--borderRadius-sm)",
    padding: "var(--gap-md)",
  },
});

const LoadingState = styled("div", {
  base: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "200px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const EmptyState = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "200px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const FileTable = styled("table", {
  base: {
    width: "100%",
    borderCollapse: "collapse",
  },
});

const FileTableHeader = styled("thead", {
  base: {
    borderBottom: "1px solid var(--md-sys-color-outline)",
  },
});

const FileTableHeaderCell = styled("th", {
  base: {
    textAlign: "left",
    padding: "var(--gap-sm)",
    fontSize: "12px",
    fontWeight: "bold",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const FileTableBody = styled("tbody", {
  base: {},
});

const FileTableRow = styled("tr", {
  base: {
    borderBottom: "1px solid var(--md-sys-color-outline-variant)",
    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },
  },
});

const FileTableCell = styled("td", {
  base: {
    padding: "var(--gap-sm)",
    fontSize: "14px",
  },
});

const FileIcon = styled("div", {
  base: {
    display: "inline-block",
    marginRight: "var(--gap-sm)",
    verticalAlign: "middle",
  },
});

const FileName = styled("span", {
  base: {
    verticalAlign: "middle",
  },
});

const FileActions = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-xs)",
    "& button": {
      padding: "var(--gap-xs) var(--gap-sm)",
      background: "var(--md-sys-color-surface-container-highest)",
      border: "1px solid var(--md-sys-color-outline)",
      borderRadius: "var(--borderRadius-sm)",
      cursor: "pointer",
      fontSize: "12px",
      "&:hover": {
        background: "var(--md-sys-color-surface-container-high)",
      },
    },
  },
});

const ExplorerFooter = styled("div", {
  base: {
    marginTop: "var(--gap-md)",
    paddingTop: "var(--gap-md)",
    borderTop: "1px solid var(--md-sys-color-outline)",
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const StorageInfo = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
  },
});