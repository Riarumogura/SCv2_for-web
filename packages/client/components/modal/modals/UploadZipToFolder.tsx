// CUSTOM: zipをアップロードして指定フォルダ(world・mods等)を一括置換えするモーダル
// CUSTOM: lingui(<Trans>)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうため
// 日本語をハードコードしている(storage系モーダルの既知バグと同種)
import { createSignal, Show } from "solid-js";
import { styled } from "styled-system/jsx";

import { Column, Dialog, DialogProps } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useModals } from "..";
import { Modals } from "../types";
import { useMinecraftApi } from "../../../src/api/minecraft";

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Modal to upload a zip and replace the contents of a target folder
 * (e.g. world, mods) inside an extracted Minecraft server
 */
export function UploadZipToFolderModal(
  props: DialogProps & Modals & { type: "upload_zip_to_folder" },
) {
  const { showError } = useModals();
  const minecraftApi = useMinecraftApi();

  const [targetPath, setTargetPath] = createSignal(props.initialPath || "world");
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  let fileInputRef: HTMLInputElement | undefined;

  async function onSubmit() {
    const file = selectedFile();
    if (!file || !targetPath().trim()) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      await minecraftApi.uploadZipToFolder(props.serverId, props.mcId, targetPath().trim(), file, (percent) =>
        setUploadProgress(percent),
      );
      props.onUploaded?.();
      props.onClose();
    } catch (error) {
      showError(error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title="zipをアップロードしてフォルダを置換え"
      actions={[
        { text: "キャンセル" },
        {
          text: "アップロード&置換え",
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !selectedFile() || !targetPath().trim() || uploading(),
        },
      ]}
      isDisabled={uploading()}
    >
      <Column>
        <div
          style={{
            "font-size": "12px",
            color: "var(--md-sys-color-error)",
            "margin-bottom": "var(--gap-sm)",
          }}
        >
          指定フォルダの既存内容はすべて削除され、zipの内容に置き換わります(world・mods・pluginsは置換え前に1世代だけバックアップされます)。
        </div>

        <FileFieldLabel>対象フォルダ</FileFieldLabel>
        <TargetPathInput
          type="text"
          value={targetPath()}
          placeholder="例: world, mods"
          disabled={uploading()}
          onInput={(e) => setTargetPath(e.currentTarget.value)}
        />

        <FileFieldLabel>zipファイル</FileFieldLabel>
        <FilePickerButton type="button" disabled={uploading()} onClick={() => fileInputRef?.click()}>
          <Symbol size={18}>upload_file</Symbol>
          <Show when={selectedFile()} fallback={<span>ファイルを選択...</span>}>
            {(file) => (
              <span>
                {file().name} ({formatFileSize(file().size)})
              </span>
            )}
          </Show>
        </FilePickerButton>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          style={{ display: "none" }}
          disabled={uploading()}
          onChange={(e) => setSelectedFile(e.currentTarget.files?.[0] ?? null)}
        />

        <Show when={uploading()}>
          <ProgressTrack>
            <ProgressFill style={{ width: `${uploadProgress()}%` }} />
          </ProgressTrack>
          <span style={{ "font-size": "12px" }}>アップロード中... {uploadProgress()}%</span>
        </Show>
      </Column>
    </Dialog>
  );
}

const TargetPathInput = styled("input", {
  base: {
    width: "100%",
    padding: "var(--gap-xs) var(--gap-sm)",
    marginTop: "var(--gap-xs)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
    color: "inherit",
    fontSize: "13px",
  },
});

const FileFieldLabel = styled("span", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    marginTop: "var(--gap-md)",
  },
});

const FilePickerButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    width: "100%",
    padding: "var(--gap-sm)",
    marginTop: "var(--gap-xs)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px dashed var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
    color: "inherit",
    cursor: "pointer",
    fontSize: "13px",
    textAlign: "left",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.6,
    },
  },
});

const ProgressTrack = styled("div", {
  base: {
    height: "4px",
    borderRadius: "2px",
    background: "var(--md-sys-color-surface-container-highest)",
    overflow: "hidden",
    marginTop: "var(--gap-sm)",
  },
});

const ProgressFill = styled("div", {
  base: {
    height: "100%",
    background: "var(--md-sys-color-primary)",
    transition: "width 0.2s ease",
  },
});
