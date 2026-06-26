// CUSTOM: アルバム削除モーダル
// CUSTOM: lingui(<Trans>)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうため
// 日本語をハードコードしている(storage系モーダルの既知バグと同種)
import { createSignal } from "solid-js";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useAlbumApi } from "../../../src/api/album";

/**
 * Modal to delete an album
 */
export function DeleteAlbumModal(
  props: DialogProps & Modals & { type: "delete_album" },
) {
  const { showError } = useModals();
  const albumApi = useAlbumApi();
  const [isDeleting, setIsDeleting] = createSignal(false);

  async function onDelete() {
    try {
      setIsDeleting(true);
      await albumApi.deleteAlbum(props.serverId, props.albumId);

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
      title={`${props.albumTitle}を削除しますか?`}
      actions={[
        { text: "キャンセル" },
        {
          text: "削除",
          onClick: onDelete,
        },
      ]}
      isDisabled={isDeleting()}
    >
      このアルバムと、アルバム内のすべての写真・動画を削除します。この操作は取り消せません。
    </Dialog>
  );
}
