// CUSTOM: ストレージ削除モーダル
import { createSignal } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useStorageApi } from "../../../src/api/storage";

/**
 * Modal to delete a storage and all of its files
 */
export function DeleteStorageModal(
  props: DialogProps & Modals & { type: "delete_storage" },
) {
  const { showError } = useModals();
  const storageApi = useStorageApi();
  const [isDeleting, setIsDeleting] = createSignal(false);

  async function onDelete() {
    try {
      setIsDeleting(true);
      await storageApi.deleteStorage(props.serverId, props.storageId);

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
      title={<Trans>Delete {props.storageName}?</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Delete</Trans>,
          onClick: onDelete,
        },
      ]}
      isDisabled={isDeleting()}
    >
      <Trans>
        This will permanently delete all files in this storage. Once it's
        deleted, there's no going back.
      </Trans>
    </Dialog>
  );
}
