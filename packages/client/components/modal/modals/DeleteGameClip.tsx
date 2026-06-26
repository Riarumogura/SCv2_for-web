// CUSTOM: GameClips投稿削除モーダル(DeleteAlbum.tsxと同パターン)
// CUSTOM: lingui(<Trans>)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうため
// 日本語をハードコードしている(storage系モーダルの既知バグと同種)
import { createSignal } from "solid-js";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useGameClipsApi } from "../../../src/api/gameclips";

/**
 * Modal to delete a GameClips post
 */
export function DeleteGameClipModal(
  props: DialogProps & Modals & { type: "delete_gameclip" },
) {
  const { showError } = useModals();
  const gameClipsApi = useGameClipsApi();
  const [isDeleting, setIsDeleting] = createSignal(false);

  async function onDelete() {
    try {
      setIsDeleting(true);
      await gameClipsApi.deleteGameClip(props.serverId, props.gameClipId);

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
      title="この投稿を削除しますか?"
      actions={[
        { text: "キャンセル" },
        {
          text: "削除",
          onClick: onDelete,
        },
      ]}
      isDisabled={isDeleting()}
    >
      この投稿と、投稿内のすべてのコメントを削除します。この操作は取り消せません。
    </Dialog>
  );
}
