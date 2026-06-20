// CUSTOM: 予定削除モーダル
// CUSTOM: lingui(<Trans>)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうため
// 日本語をハードコードしている(storage系モーダルの既知バグと同種)
import { createSignal } from "solid-js";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useCalendarApi } from "../../../src/api/calendar";

/**
 * Modal to delete a calendar event
 */
export function DeleteEventModal(
  props: DialogProps & Modals & { type: "delete_event" },
) {
  const { showError } = useModals();
  const calendarApi = useCalendarApi();
  const [isDeleting, setIsDeleting] = createSignal(false);

  async function onDelete() {
    try {
      setIsDeleting(true);
      await calendarApi.deleteEvent(props.serverId, props.eventId);

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
      title={`${props.eventTitle}を削除しますか?`}
      actions={[
        { text: "キャンセル" },
        {
          text: "削除",
          onClick: onDelete,
        },
      ]}
      isDisabled={isDeleting()}
    >
      この予定を削除します。この操作は取り消せません。
    </Dialog>
  );
}
