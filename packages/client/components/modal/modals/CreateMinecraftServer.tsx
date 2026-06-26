// CUSTOM: Minecraftサーバー作成モーダル(新規作成 / 既存ファイルのzipアップロード)
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, createSignal } from "solid-js";
import { styled } from "styled-system/jsx";

import { Column, Dialog, DialogProps, Form2, MenuItem } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useModals } from "..";
import { Modals } from "../types";
import { useMinecraftApi, MC_SERVER_TYPES, McServerType } from "../../../src/api/minecraft";

const TYPE_LABELS: Record<McServerType, string> = {
  VANILLA: "Vanilla",
  FORGE: "Forge",
  FABRIC: "Fabric",
  NEOFORGE: "NeoForge",
  PAPER: "Paper",
};

// CUSTOM: 選択済みファイルのサイズを読みやすい単位で表示する
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

type CreateMode = "new" | "upload";

/**
 * Modal to create a new Minecraft server, either freshly downloaded or from an uploaded zip
 */
export function CreateMinecraftServerModal(
  props: DialogProps & Modals & { type: "create_minecraft_server" },
) {
  const { showError, openModal } = useModals();
  const minecraftApi = useMinecraftApi();

  const [mode, setMode] = createSignal<CreateMode>("new");
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  // CUSTOM: ネイティブのfile inputは見た目がOSデフォルトのままで目立たないため非表示にし、
  // 代わりにこのボタンクリックでダイアログを開く(StorageExplorer.tsxのアップロードボタンと同じ手法)
  let fileInputRef: HTMLInputElement | undefined;

  const group = createFormGroup({
    name: createFormControl("", { required: true }),
    version: createFormControl("1.20.1", { required: true }),
    type: createFormControl<McServerType>("VANILLA", { required: true }),
    memory: createFormControl("2G", { required: true }),
    port: createFormControl("25565", { required: true }),
  });

  async function onSubmitNew() {
    await minecraftApi.createServer(props.serverId, {
      name: group.controls.name.value,
      version: group.controls.version.value,
      type: group.controls.type.value,
      memory: group.controls.memory.value,
      port: parseInt(group.controls.port.value),
    });
    props.onCreated?.();
    props.onClose();
  }

  async function onSubmitUpload() {
    const file = selectedFile();
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const created = await minecraftApi.uploadServer(
        props.serverId,
        {
          name: group.controls.name.value,
          type: group.controls.type.value,
          memory: group.controls.memory.value,
          port: parseInt(group.controls.port.value),
          file,
        },
        (percent) => setUploadProgress(percent),
      );

      props.onCreated?.();
      props.onClose();

      // CUSTOM: 起動jarの候補が複数あった場合、続けて選択モーダルを開く
      if (created.status === "PENDING_JAR_SELECTION" && created.pendingJarCandidates) {
        openModal({
          type: "select_minecraft_jar",
          serverId: props.serverId,
          mcId: created.mcId,
          serverName: created.name,
          candidates: created.pendingJarCandidates,
          onSelected: props.onCreated,
        });
      }
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit() {
    try {
      if (mode() === "upload") {
        await onSubmitUpload();
      } else {
        await onSubmitNew();
      }
    } catch (error) {
      showError(error);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  const canSubmit = () =>
    mode() === "upload"
      ? Boolean(selectedFile()) && !uploading() && Boolean(group.controls.name.value)
      : Form2.canSubmit(group);

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title="Minecraftサーバーを作成"
      actions={[
        { text: "キャンセル" },
        {
          text: mode() === "upload" ? "アップロード&作成" : "作成",
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !canSubmit(),
        },
      ]}
      isDisabled={group.isPending || uploading()}
    >
      <form onSubmit={submit} onKeyDown={Form2.preventComposingSubmit}>
        <Column>
          <ModeToggle>
            <ModeButton type="button" data-active={mode() === "new"} onClick={() => setMode("new")}>
              新規作成
            </ModeButton>
            <ModeButton type="button" data-active={mode() === "upload"} onClick={() => setMode("upload")}>
              既存ファイルをアップロード
            </ModeButton>
          </ModeToggle>

          <Form2.TextField
            minlength={1}
            maxlength={50}
            counter
            name="name"
            control={group.controls.name}
            label="サーバー名"
            placeholder="例: サバイバルサーバー"
          />

          <Show when={mode() === "new"}>
            <Form2.TextField
              name="version"
              control={group.controls.version}
              label="Minecraftバージョン"
              placeholder="例: 1.20.1"
            />
          </Show>

          <Form2.Select label="サーバータイプ" control={group.controls.type}>
            <For each={MC_SERVER_TYPES}>
              {(option) => <MenuItem value={option}>{TYPE_LABELS[option]}</MenuItem>}
            </For>
          </Form2.Select>

          <Form2.Select label="割り当てメモリ" control={group.controls.memory}>
            <For each={["1G", "2G", "4G", "6G", "8G"]}>
              {(option) => <MenuItem value={option}>{option}</MenuItem>}
            </For>
          </Form2.Select>

          <Form2.TextField
            type="number"
            min={1024}
            max={65535}
            name="port"
            control={group.controls.port}
            label="ポート番号"
          />

          <Show
            when={mode() === "upload"}
            fallback={
              <div
                style={{
                  "margin-top": "var(--gap-md)",
                  "font-size": "12px",
                  color: "var(--md-sys-color-on-surface-variant)",
                }}
              >
                <div>• 作成後は停止状態です。一覧から起動してください</div>
                <div>• 複数のサーバーを作成する場合はポート番号を重複させないでください</div>
                <div>• 初回起動時にサーバーファイルのダウンロードが行われるため少し時間がかかります</div>
              </div>
            }
          >
            <FileFieldLabel>サーバーファイル(zip)</FileFieldLabel>
            <FilePickerButton
              type="button"
              disabled={uploading()}
              onClick={() => fileInputRef?.click()}
            >
              <Symbol size={18}>upload_file</Symbol>
              <Show when={selectedFile()} fallback={<span>ファイルを選択...</span>}>
                {(file) => (
                  <FileNameText>
                    {file().name} ({formatFileSize(file().size)})
                  </FileNameText>
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

            <div
              style={{
                "margin-top": "var(--gap-md)",
                "font-size": "12px",
                color: "var(--md-sys-color-on-surface-variant)",
              }}
            >
              <div>• 既存のサーバーファイル一式(jar・world・mods等)をzip形式でまとめてアップロードしてください</div>
              <div>• 最大10GBまで対応しています</div>
              <div>• 起動jarが複数見つかった場合は、アップロード後に選択画面が表示されます</div>
            </div>
          </Show>
        </Column>
      </form>
    </Dialog>
  );
}

const ModeToggle = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-xs)",
    marginBottom: "var(--gap-sm)",
  },
});

const ModeButton = styled("button", {
  base: {
    flex: 1,
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
    color: "inherit",
    cursor: "pointer",
    fontSize: "13px",

    '&[data-active="true"]': {
      background: "var(--md-sys-color-primary)",
      color: "var(--md-sys-color-on-primary)",
      borderColor: "var(--md-sys-color-primary)",
    },
  },
});

const FileFieldLabel = styled("span", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
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

const FileNameText = styled("span", {
  base: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const ProgressTrack = styled("div", {
  base: {
    height: "4px",
    borderRadius: "2px",
    background: "var(--md-sys-color-surface-container-highest)",
    overflow: "hidden",
    marginTop: "var(--gap-xs)",
  },
});

const ProgressFill = styled("div", {
  base: {
    height: "100%",
    background: "var(--md-sys-color-primary)",
    transition: "width 0.2s ease",
  },
});
