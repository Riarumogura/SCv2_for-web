// CUSTOM: ストレージエクスプローラーコンポーネント
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";
import { StorageEntryContextMenu } from "@revolt/app";
import { IconButton } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import {
  useStorageApi,
  getFileKind,
  StorageEntry,
  StorageSearchEntry,
  StorageConfig,
} from "../../../api/storage";

// 通常のフォルダ一覧表示・検索結果表示のどちらでも扱える共通型
type DisplayEntry = StorageEntry | StorageSearchEntry;

// 検索結果(パス付き)かどうかを判定
const hasPath = (entry: DisplayEntry): entry is StorageSearchEntry =>
  "path" in entry;

interface StorageExplorerProps {
  serverId: string;
  storageId: string;
}

/**
 * ストレージエクスプローラーコンポーネント
 */
export function StorageExplorer(props: StorageExplorerProps) {
  const storageApi = useStorageApi();
  const { openModal } = useModals();
  const [entries, setEntries] = createSignal<StorageEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [currentPath, setCurrentPath] = createSignal<string>("");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<StorageSearchEntry[]>([]);
  const [storageInfo, setStorageInfo] = createSignal<StorageConfig | null>(null);
  let fileInput: HTMLInputElement | undefined;

  // フォルダを先に、各グループ内は名前順に並べる
  const sortEntries = <T extends DisplayEntry>(list: T[]) =>
    [...list].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  // 検索中かどうか
  const isSearchMode = () => searchQuery().trim().length > 0;

  // 表示対象のエントリ一覧(検索中はストレージ全体の検索結果、それ以外は現在のフォルダ一覧)
  const displayEntries = (): DisplayEntry[] =>
    isSearchMode() ? searchResults() : entries();

  // エントリの絶対パスを組み立て(検索結果はpathを持っているのでそれを使う)
  const getEntryFullPath = (entry: DisplayEntry) =>
    hasPath(entry) ? entry.path : entryPath(entry);

  // ストレージ全体を再帰的に検索
  const runSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const results = await storageApi.searchFiles(props.serverId, props.storageId, trimmed);
      setSearchResults(sortEntries(results));
    } catch (error) {
      console.error("ストレージの検索に失敗しました:", error);
    } finally {
      setLoading(false);
    }
  };

  // 検索クエリ入力後、少し待ってから検索を実行(デバウンス)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    const query = searchQuery();
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => runSearch(query), 300);
  });
  onCleanup(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  });

  // 現在の表示モードに応じて一覧を再取得
  const refresh = async () => {
    if (isSearchMode()) {
      await runSearch(searchQuery());
    } else {
      await loadFiles(currentPath());
    }
  };

  // ストレージの容量・使用量情報を取得
  const loadStorageInfo = async () => {
    try {
      const info = await storageApi.getStorage(props.serverId, props.storageId);
      setStorageInfo(info);
    } catch (error) {
      console.error("ストレージ情報の取得に失敗しました:", error);
    }
  };

  // ファイル/フォルダ一覧を取得
  const loadFiles = async (path?: string) => {
    try {
      setLoading(true);
      const entryList = await storageApi.listFiles(
        props.serverId,
        props.storageId,
        path
      );
      setEntries(sortEntries(entryList));
      setCurrentPath(path || "");
    } catch (error) {
      console.error("ファイル一覧の取得に失敗しました:", error);
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時にファイル一覧・ストレージ情報を取得
  onMount(() => {
    loadFiles();
    loadStorageInfo();
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
  const getEntryIcon = (entry: DisplayEntry) => {
    switch (getFileKind(entry.name, entry.type)) {
      case "folder":
        return "folder";
      case "image":
        return "image";
      case "movie":
        return "movie";
      case "pdf":
        return "picture_as_pdf";
      case "text":
        return "description";
      default:
        return "insert_drive_file";
    }
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

  // フォルダを開く / ファイルをクリックしたときの処理(プレビュー表示)
  const openEntry = (entry: DisplayEntry) => {
    const path = getEntryFullPath(entry);
    if (entry.type === "folder") {
      setSearchQuery("");
      loadFiles(path);
    } else {
      openModal({
        type: "storage_preview",
        serverId: props.serverId,
        storageId: props.storageId,
        path,
        name: entry.name,
      });
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
      await loadStorageInfo();
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
      await loadStorageInfo();
    } catch (error) {
      console.error("ファイルのアップロードに失敗しました:", error);
      window.alert("ファイルのアップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // ファイルをダウンロード
  const handleDownload = async (entry: DisplayEntry) => {
    try {
      const { url, filename } = await storageApi.downloadFile(
        props.serverId,
        props.storageId,
        getEntryFullPath(entry)
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
  const handleDelete = async (entry: DisplayEntry) => {
    if (!window.confirm(`「${entry.name}」を削除しますか?`)) return;

    try {
      await storageApi.deleteFile(props.serverId, props.storageId, getEntryFullPath(entry));
      await refresh();
      await loadStorageInfo();
    } catch (error) {
      console.error("ファイルの削除に失敗しました:", error);
      window.alert("ファイルの削除に失敗しました");
    }
  };

  // フォルダの名前を変更
  const handleRenameFolder = async (entry: DisplayEntry) => {
    const newName = window.prompt("新しいフォルダ名を入力してください", entry.name);
    if (!newName || newName === entry.name) return;

    const oldPath = getEntryFullPath(entry);
    const parentPath = oldPath.split("/").slice(0, -1).join("/");
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    try {
      await storageApi.renameFolder(props.serverId, props.storageId, oldPath, newPath);
      await refresh();
    } catch (error) {
      console.error("フォルダの名前変更に失敗しました:", error);
      window.alert("フォルダの名前変更に失敗しました");
    }
  };

  // フォルダを別の場所へ移動
  const handleMoveFolder = (entry: DisplayEntry) => {
    const oldPath = getEntryFullPath(entry);

    openModal({
      type: "select_folder",
      serverId: props.serverId,
      storageId: props.storageId,
      onSelect: async (destinationPath) => {
        const newPath = destinationPath ? `${destinationPath}/${entry.name}` : entry.name;
        if (newPath === oldPath) return;

        try {
          await storageApi.renameFolder(props.serverId, props.storageId, oldPath, newPath);
          await refresh();
        } catch (error) {
          console.error("フォルダの移動に失敗しました:", error);
          window.alert("フォルダの移動に失敗しました(移動先がフォルダ自身の中になっていないか確認してください)");
        }
      },
    });
  };

  // フォルダを削除
  const handleDeleteFolder = async (entry: DisplayEntry) => {
    if (!window.confirm(`「${entry.name}」とその中身をすべて削除しますか?`)) return;

    try {
      await storageApi.deleteFolder(props.serverId, props.storageId, getEntryFullPath(entry));
      await refresh();
      await loadStorageInfo();
    } catch (error) {
      console.error("フォルダの削除に失敗しました:", error);
      window.alert("フォルダの削除に失敗しました");
    }
  };

  // バイト数を読みやすい容量表記に変換
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 GB";
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
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

        <Show when={storageInfo()}>
          {(info) => (
            <CapacityBar>
              <CapacityBarTrack>
                <CapacityBarFill
                  style={{
                    width: `${Math.min(100, (info().usedSize / info().sizeLimit) * 100)}%`,
                  }}
                />
              </CapacityBarTrack>
              <CapacityBarLabel>
                {formatBytes(info().usedSize)} / {formatBytes(info().sizeLimit)} (
                {Math.round((info().usedSize / info().sizeLimit) * 100)}%) ・{info().fileCount}件
              </CapacityBarLabel>
            </CapacityBar>
          )}
        </Show>

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
            <IconButton
              variant="filled"
              onPress={() => loadFiles(currentPath())}
              use:floating={{ tooltip: { placement: "top", content: "更新" } }}
            >
              <Symbol>refresh</Symbol>
            </IconButton>
            <IconButton
              variant="filled"
              onPress={handleCreateFolder}
              use:floating={{ tooltip: { placement: "top", content: "新規フォルダ" } }}
            >
              <Symbol>create_new_folder</Symbol>
            </IconButton>
            <IconButton
              variant="filled"
              onPress={handleUploadClick}
              use:floating={{ tooltip: { placement: "top", content: "アップロード" } }}
            >
              <Symbol>upload</Symbol>
            </IconButton>
            <input
              ref={fileInput}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileSelected}
            />
          </ActionButtons>
        </ActionBar>

        <Show when={isSearchMode()}>
          <SearchModeNotice>
            「{searchQuery()}」の検索結果({searchResults().length}件、ストレージ全体を対象)
          </SearchModeNotice>
        </Show>
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
            when={displayEntries().length > 0}
            fallback={
              <EmptyState>
                <div>{isSearchMode() ? "検索結果がありません" : "ファイルがありません"}</div>
                <Show when={!isSearchMode()}>
                  <div style={{ "font-size": "12px", "margin-top": "var(--gap-sm)" }}>
                    ファイルをドラッグ&ドロップ、またはアップロードボタンから追加してください
                  </div>
                </Show>
              </EmptyState>
            }
          >
            <FileTable>
              <FileTableHeader>
                <FileTableRow>
                  <FileTableHeaderCell>名前</FileTableHeaderCell>
                  <FileTableHeaderCell>サイズ</FileTableHeaderCell>
                  <FileTableHeaderCell>更新日時</FileTableHeaderCell>
                </FileTableRow>
              </FileTableHeader>
              <FileTableBody>
                <For each={displayEntries()}>
                  {(entry) => (
                    <FileTableRow>
                      <FileTableCell onClick={() => openEntry(entry)} style={{ padding: 0 }}>
                        {/* CUSTOM: use:floatingはネイティブDOM要素にしか効かないため、styled
                            コンポーネントのFileTableCellではなく素のdivに配線する。
                            右クリックでファイル/フォルダの操作メニューを表示する。 */}
                        <div
                          style={{
                            display: "flex",
                            "align-items": "center",
                            padding: "var(--gap-sm)",
                            cursor: "pointer",
                          }}
                          use:floating={{
                            contextMenu: () => (
                              <StorageEntryContextMenu
                                type={entry.type}
                                onDownload={
                                  entry.type === "file"
                                    ? () => handleDownload(entry)
                                    : undefined
                                }
                                onRename={
                                  entry.type === "folder"
                                    ? () => handleRenameFolder(entry)
                                    : undefined
                                }
                                onMove={
                                  entry.type === "folder"
                                    ? () => handleMoveFolder(entry)
                                    : undefined
                                }
                                onDelete={() =>
                                  entry.type === "folder"
                                    ? handleDeleteFolder(entry)
                                    : handleDelete(entry)
                                }
                              />
                            ),
                          }}
                        >
                          <FileIcon>
                            <span class="material-symbols-outlined">
                              {getEntryIcon(entry)}
                            </span>
                          </FileIcon>
                          <FileName>{entry.name}</FileName>
                          <Show when={hasPath(entry)}>
                            <FilePathHint>
                              {(entry as StorageSearchEntry).path}
                            </FilePathHint>
                          </Show>
                        </div>
                      </FileTableCell>
                      <FileTableCell>
                        {entry.type === "folder" ? "-" : formatFileSize(entry.size)}
                      </FileTableCell>
                      <FileTableCell>
                        {entry.type === "folder" ? "-" : formatDate(entry.lastModified)}
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

const CapacityBar = styled("div", {
  base: {
    marginBottom: "var(--gap-md)",
  },
});

const CapacityBarTrack = styled("div", {
  base: {
    width: "100%",
    height: "6px",
    borderRadius: "3px",
    background: "var(--md-sys-color-surface-container-highest)",
    overflow: "hidden",
    marginBottom: "var(--gap-xs)",
  },
});

const CapacityBarFill = styled("div", {
  base: {
    height: "100%",
    background: "var(--md-sys-color-primary)",
    borderRadius: "3px",
  },
});

const CapacityBarLabel = styled("div", {
  base: {
    fontSize: "12px",
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

const SearchModeNotice = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    marginTop: "var(--gap-xs)",
  },
});

const ActionButtons = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
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

const FilePathHint = styled("div", {
  base: {
    fontSize: "11px",
    color: "var(--md-sys-color-on-surface-variant)",
    marginLeft: "calc(20px + var(--gap-sm))",
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