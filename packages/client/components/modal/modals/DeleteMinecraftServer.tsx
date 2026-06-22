// CUSTOM: Minecraftサーバー削除モーダル
// CUSTOM: lingui(<Trans>)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうため
// 日本語をハードコードしている(storage系モーダルの既知バグと同種)
import { createSignal } from "solid-js";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useMinecraftApi } from "../../../src/api/minecraft";

/**
 * Modal to delete a Minecraft server and all of its world data
 */
export function DeleteMinecraftServerModal(
  props: DialogProps & Modals & { type: "delete_minecraft_server" },
) {
  const { showError } = useModals();
  const minecraftApi = useMinecraftApi();
  const [isDeleting, setIsDeleting] = createSignal(false);

  async function onDelete() {
    try {
      setIsDeleting(true);
      await minecraftApi.deleteServer(props.serverId, props.mcId);

      props.onDeleted?.();
      props.onClose();
    } catch (error) {
      showError(error);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={`${props.serverName}を削除しますか?`}
      actions={[
        { text: "キャンセル" },
        {
          text: "削除",
          onClick: onDelete,
        },
      ]}
      isDisabled={isDeleting()}
    >
      このMinecraftサーバーのコンテナとワールドデータをすべて削除します。この操作は取り消せません。
    </Dialog>
  );
}
