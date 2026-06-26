// CUSTOM: スタンプのプレビュー+削除モーダル(EmojiPreview.tsxと同じ構造)
import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useStampApi } from "../../../src/api/stamp";

export function StampPreviewModal(
  props: DialogProps & Modals & { type: "stamp_preview" },
) {
  const { showError } = useModals();
  const stampApi = useStampApi();

  async function onDelete() {
    try {
      await stampApi.deleteStamp(props.serverId, props.stamp.id);
      props.onDeleted?.();
      props.onClose();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={props.stamp.name}
      actions={[
        {
          text: "削除",
          onClick: onDelete,
        },
        { text: "閉じる" },
      ]}
    >
      <img
        src={props.stamp.url}
        alt={props.stamp.name}
        style={{ "max-width": "100%", "max-height": "240px" }}
      />
    </Dialog>
  );
}
