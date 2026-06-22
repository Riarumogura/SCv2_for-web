// CUSTOM: Minecraftサーバー作成モーダル
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { createFormControl, createFormGroup } from "solid-forms";
import { For } from "solid-js";

import { Column, Dialog, DialogProps, Form2, MenuItem } from "@revolt/ui";

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

/**
 * Modal to create a new Minecraft server
 */
export function CreateMinecraftServerModal(
  props: DialogProps & Modals & { type: "create_minecraft_server" },
) {
  const { showError } = useModals();
  const minecraftApi = useMinecraftApi();

  const group = createFormGroup({
    name: createFormControl("", { required: true }),
    version: createFormControl("1.20.1", { required: true }),
    type: createFormControl<McServerType>("VANILLA", { required: true }),
    memory: createFormControl("2G", { required: true }),
    port: createFormControl("25565", { required: true }),
  });

  async function onSubmit() {
    try {
      await minecraftApi.createServer(props.serverId, {
        name: group.controls.name.value,
        version: group.controls.version.value,
        type: group.controls.type.value,
        memory: group.controls.memory.value,
        port: parseInt(group.controls.port.value),
      });

      props.onCreated?.();
      props.onClose();
    } catch (error) {
      showError(error);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title="Minecraftサーバーを作成"
      actions={[
        { text: "キャンセル" },
        {
          text: "作成",
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !Form2.canSubmit(group),
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Column>
          <Form2.TextField
            minlength={1}
            maxlength={50}
            counter
            name="name"
            control={group.controls.name}
            label="サーバー名"
            placeholder="例: サバイバルサーバー"
          />

          <Form2.TextField
            name="version"
            control={group.controls.version}
            label="Minecraftバージョン"
            placeholder="例: 1.20.1"
          />

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
        </Column>
      </form>
    </Dialog>
  );
}
