// CUSTOM: Minecraftサーバーの展開済みファイルを操作するエクスプローラー(StorageExplorer.tsxと
// 同じ構造)。オンラインストレージとの違いはテキスト編集機能と、world/mods等のフォルダを
// zipで一括置換えできる機能。サーバー起動中は変更系操作(削除・アップロード・フォルダ作成・
// リネーム・zip展開・テキスト保存)をすべて無効化する(データ損壊防止、バックエンドも409で拒否する)。
import { For, Show, createEffect, createSignal, on } from "solid-js";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";
import { IconButton, Tooltip } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useMinecraftApi, McFileEntry, McServerStatus } from "../../../api/minecraft";

const TEXT_EDITABLE_EXTENSIONS = new Set([
  "properties",
  "json",
  "yml",
  "yaml",
  "toml",
  "txt",
  "cfg",
  "conf",
  "ini",
  "log",
]);

function isTextEditable(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EDITABLE_EXTENSIONS.has(ext);
}

function getEntryIcon(entry: McFileEntry): string {
  if (entry.type === "folder") return "folder";
  if (isTextEditable(entry.name)) return "description";
  return "insert_drive_file";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MinecraftFileExplorerProps {
  serverId: string;
  mcId: string;
  status: () => McServerStatus;
}

const RUNNING_LIKE = new Set<McServerStatus>(["RUNNING", "STARTING", "STOPPING"]);

export function MinecraftFileExplorer(props: MinecraftFileExplorerProps) {
  const minecraftApi = useMinecraftApi();
  const { openModal } = useModals();

  const [entries, setEntries] = createSignal<McFileEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [currentPath, setCurrentPath] = createSignal("");
  let fileInput: HTMLInputElement | undefined;

  const canMutate = () => !RUNNING_LIKE.has(props.status());

  const sortEntries = (list: McFileEntry[]) =>
    [...list].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const loadFiles = async (path = "") => {
    try {
      setLoading(true);
      const list = await minecraftApi.listFiles(props.serverId, props.mcId, path);
      setEntries(sortEntries(list));
      setCurrentPath(path);
    } catch (error) {
      console.error("ファイル一覧の取得に失敗しました:", error);
    } finally {
      setLoading(false);
    }
  };

  createEffect(
    on(
      () => props.mcId,
      () => {
        setCurrentPath("");
        loadFiles();
      },
    ),
  );

  const breadcrumbs = () => (currentPath() ? currentPath().split("/").filter(Boolean) : []);
  const entryPath = (entry: McFileEntry) => (currentPath() ? `${currentPath()}/${entry.name}` : entry.name);

  const openEntry = (entry: McFileEntry) => {
    const path = entryPath(entry);
    if (entry.type === "folder") {
      loadFiles(path);
      return;
    }
    if (isTextEditable(entry.name)) {
      openModal({
        type: "minecraft_text_editor",
        serverId: props.serverId,
        mcId: props.mcId,
        path,
        name: entry.name,
        readOnly: !canMutate(),
        onSaved: () => loadFiles(currentPath()),
      });
    }
  };

  const handleDownload = async (entry: McFileEntry) => {
    try {
      const blob = await minecraftApi.fetchFileBlob(props.serverId, props.mcId, entryPath(entry));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = entry.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("ダウンロードに失敗しました:", error);
      window.alert("ダウンロードに失敗しました");
    }
  };

  const handleDelete = async (entry: McFileEntry) => {
    if (!window.confirm(`「${entry.name}」を削除しますか?この操作は取り消せません。`)) return;
    try {
      await minecraftApi.deleteFileEntry(props.serverId, props.mcId, entryPath(entry));
      await loadFiles(currentPath());
    } catch (error) {
      console.error("削除に失敗しました:", error);
      window.alert((error as Error).message || "削除に失敗しました");
    }
  };

  const handleRename = async (entry: McFileEntry) => {
    const newName = window.prompt("新しい名前を入力してください", entry.name);
    if (!newName || newName === entry.name) return;
    const newPath = currentPath() ? `${currentPath()}/${newName}` : newName;
    try {
      await minecraftApi.renameFileEntry(props.serverId, props.mcId, entryPath(entry), newPath);
      await loadFiles(currentPath());
    } catch (error) {
      console.error("名前の変更に失敗しました:", error);
      window.alert((error as Error).message || "名前の変更に失敗しました");
    }
  };

  const handleCreateFolder = async () => {
    const name = window.prompt("新しいフォルダの名前を入力してください");
    if (!name) return;
    try {
      await minecraftApi.createMcFolder(props.serverId, props.mcId, currentPath() ? `${currentPath()}/${name}` : name);
      await loadFiles(currentPath());
    } catch (error) {
      console.error("フォルダの作成に失敗しました:", error);
      window.alert((error as Error).message || "フォルダの作成に失敗しました");
    }
  };

  const handleUploadClick = () => fileInput?.click();

  const handleFileSelected = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const destination = currentPath() ? `${currentPath()}/${file.name}` : file.name;
    try {
      setLoading(true);
      await minecraftApi.uploadFile(props.serverId, props.mcId, destination, file);
      await loadFiles(currentPath());
    } catch (error) {
      console.error("アップロードに失敗しました:", error);
      window.alert((error as Error).message || "アップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const openUploadZipModal = () => {
    openModal({
      type: "upload_zip_to_folder",
      serverId: props.serverId,
      mcId: props.mcId,
      initialPath: currentPath(),
      onUploaded: () => loadFiles(currentPath()),
    });
  };

  return (
    <ExplorerContainer>
      <ExplorerHeader>
        <PathBreadcrumbs>
          <PathItem onClick={() => loadFiles()}>ルート</PathItem>
          <For each={breadcrumbs()}>
            {(crumb, index) => (
              <>
                <PathSeparator>/</PathSeparator>
                <PathItem
                  onClick={() => loadFiles(breadcrumbs().slice(0, index() + 1).join("/"))}
                >
                  {crumb}
                </PathItem>
              </>
            )}
          </For>
        </PathBreadcrumbs>

        <Show when={!canMutate()}>
          <RunningNotice>サーバー起動中は変更操作(削除・アップロード・フォルダ作成・編集)を行えません</RunningNotice>
        </Show>

        <ActionBar>
          <Tooltip content="更新" placement="top">
            <IconButton variant="filled" onPress={() => loadFiles(currentPath())}>
              <Symbol>refresh</Symbol>
            </IconButton>
          </Tooltip>
          <Tooltip content="新規フォルダ" placement="top">
            <IconButton variant="filled" isDisabled={!canMutate()} onPress={handleCreateFolder}>
              <Symbol>create_new_folder</Symbol>
            </IconButton>
          </Tooltip>
          <Tooltip content="アップロード" placement="top">
            <IconButton variant="filled" isDisabled={!canMutate()} onPress={handleUploadClick}>
              <Symbol>upload</Symbol>
            </IconButton>
          </Tooltip>
          <Tooltip content="zipをアップロードして展開(フォルダを置換え)" placement="top">
            <IconButton variant="filled" isDisabled={!canMutate()} onPress={openUploadZipModal}>
              <Symbol>folder_zip</Symbol>
            </IconButton>
          </Tooltip>
          <input ref={fileInput} type="file" style={{ display: "none" }} onChange={handleFileSelected} />
        </ActionBar>
      </ExplorerHeader>

      <FileListContainer>
        <Show
          when={!loading()}
          fallback={<LoadingState>読み込み中...</LoadingState>}
        >
          <Show
            when={entries().length > 0}
            fallback={<EmptyState>ファイルがありません</EmptyState>}
          >
            <For each={entries()}>
              {(entry) => (
                <FileRow>
                  <FileMain onClick={() => openEntry(entry)} title={entry.name}>
                    <Symbol size={18}>{getEntryIcon(entry)}</Symbol>
                    <FileNameColumn>
                      <FileName>{entry.name}</FileName>
                      <FileMeta>
                        {entry.type === "folder" ? "-" : formatFileSize(entry.size)} ・{" "}
                        {formatDate(entry.lastModified)}
                      </FileMeta>
                    </FileNameColumn>
                  </FileMain>
                  <FileActions>
                    <Show when={entry.type === "file"}>
                      <Tooltip content="ダウンロード" placement="top">
                        <IconButton size="xs" variant="standard" onPress={() => handleDownload(entry)}>
                          <Symbol size={14}>download</Symbol>
                        </IconButton>
                      </Tooltip>
                    </Show>
                    <Show when={canMutate()}>
                      <Tooltip content="名前を変更" placement="top">
                        <IconButton size="xs" variant="standard" onPress={() => handleRename(entry)}>
                          <Symbol size={14}>edit</Symbol>
                        </IconButton>
                      </Tooltip>
                      <Tooltip content="削除" placement="top">
                        <IconButton size="xs" variant="standard" onPress={() => handleDelete(entry)}>
                          <Symbol size={14}>delete</Symbol>
                        </IconButton>
                      </Tooltip>
                    </Show>
                  </FileActions>
                </FileRow>
              )}
            </For>
          </Show>
        </Show>
      </FileListContainer>
    </ExplorerContainer>
  );
}

const ExplorerContainer = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
});

const ExplorerHeader = styled("div", {
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
    fontSize: "13px",
    padding: "var(--gap-xs) var(--gap-xs)",
    "&:hover": { textDecoration: "underline" },
  },
});

const PathSeparator = styled("span", {
  base: {
    margin: "0 2px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const RunningNotice = styled("div", {
  base: {
    fontSize: "11px",
    color: "var(--md-sys-color-error)",
    marginTop: "var(--gap-xs)",
  },
});

const ActionBar = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-xs)",
    marginTop: "var(--gap-sm)",
  },
});

const FileListContainer = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    background: "var(--md-sys-color-surface-container-low)",
    borderRadius: "var(--borderRadius-sm)",
    padding: "var(--gap-sm)",
  },
});

const LoadingState = styled("div", {
  base: {
    textAlign: "center",
    padding: "var(--gap-lg)",
    color: "var(--md-sys-color-on-surface-variant)",
    fontSize: "13px",
  },
});

const EmptyState = styled("div", {
  base: {
    textAlign: "center",
    padding: "var(--gap-lg)",
    color: "var(--md-sys-color-on-surface-variant)",
    fontSize: "13px",
  },
});

const FileRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },
  },
});

const FileMain = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-xs)",
    flexGrow: 1,
    minWidth: 0,
    cursor: "pointer",
  },
});

const FileNameColumn = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    flexGrow: 1,
  },
});

const FileName = styled("span", {
  base: {
    fontSize: "13px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const FileMeta = styled("span", {
  base: {
    fontSize: "11px",
    color: "var(--md-sys-color-on-surface-variant)",
    whiteSpace: "nowrap",
  },
});

const FileActions = styled("div", {
  base: {
    display: "flex",
    gap: "2px",
    flexShrink: 0,
  },
});
