// CUSTOM: ストレージエクスプローラーコンポーネント
import { For, Show, createSignal, onMount } from "solid-js";
import { styled } from "styled-system/jsx";

import { useStorageApi, StorageFile } from "../../../api/storage";

interface StorageExplorerProps {
  serverId: string;
  storageId: string;
}

/**
 * ストレージエクスプローラーコンポーネント
 */
export function StorageExplorer(props: StorageExplorerProps) {
  const storageApi = useStorageApi();
  const [files, setFiles] = createSignal<StorageFile[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [currentPath, setCurrentPath] = createSignal<string>("");
  const [searchQuery, setSearchQuery] = createSignal("");

  // ファイル一覧を取得
  const loadFiles = async (path?: string) => {
    try {
      setLoading(true);
      const fileList = await storageApi.listFiles(
        props.serverId,
        props.storageId,
        path
      );
      setFiles(fileList);
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

  // ファイルタイプに基づくアイコンを取得
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return "image";
    if (fileType.startsWith("video/")) return "movie";
    if (fileType === "application/pdf") return "picture_as_pdf";
    if (fileType.startsWith("text/")) return "description";
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
  const formatDate = (dateString: string) => {
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
  const filteredFiles = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return files();
    return files().filter((file) =>
      file.name.toLowerCase().includes(query)
    );
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
            <button onClick={() => {/* TODO: フォルダ作成モーダルを開く */}}>
              新規フォルダ
            </button>
            <button onClick={() => {/* TODO: ファイルアップロードダイアログを開く */}}>
              アップロード
            </button>
          </ActionButtons>
        </ActionBar>
      </ExplorerHeader>

      {/* ファイル一覧 */}
      <FileListContainer>
        <Show
          when={!loading()}
          fallback={
            <LoadingState>
              <div>読み込み中...</div>
            </LoadingState>
          }
        >
          <Show
            when={filteredFiles().length > 0}
            fallback={
              <EmptyState>
                <div>ファイルがありません</div>
                <div style={{ "font-size": "12px", "margin-top": "var(--gap-sm)" }}>
                  ファイルをアップロードするか、フォルダを作成してください
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
                <For each={filteredFiles()}>
                  {(file) => (
                    <FileTableRow>
                      <FileTableCell>
                        <FileIcon>
                          <span>{getFileIcon(file.type)}</span>
                        </FileIcon>
                        <FileName>{file.name}</FileName>
                      </FileTableCell>
                      <FileTableCell>
                        {formatFileSize(file.size)}
                      </FileTableCell>
                      <FileTableCell>
                        {formatDate(file.lastModified)}
                      </FileTableCell>
                      <FileTableCell>
                        <FileActions>
                          <button onClick={() => {/* TODO: ダウンロード機能 */}}>
                            ダウンロード
                          </button>
                          <button onClick={() => {/* TODO: 削除機能 */}}>
                            削除
                          </button>
                        </FileActions>
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
          <div>ファイル数: {files().length}</div>
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