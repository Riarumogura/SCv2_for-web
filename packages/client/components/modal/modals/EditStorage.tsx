// CUSTOM: ストレージ編集モーダル(名前・容量上限の変更)
import { createFormControl, createFormGroup } from "solid-forms";

import { Trans, useLingui } from "@lingui-solid/solid/macro";

import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useStorageApi } from "../../../src/api/storage";

/**
 * Modal to edit an existing storage's name and size limit
 */
export function EditStorageModal(
  props: DialogProps & Modals & { type: "edit_storage" },
) {
  const { t } = useLingui();
  const { showError } = useModals();
  const storageApi = useStorageApi();

  /* eslint-disable solid/reactivity */
  const group = createFormGroup({
    name: createFormControl(props.storage.name, { required: true }),
    sizeLimit: createFormControl(
      String(Math.round(props.storage.sizeLimit / 1024 / 1024 / 1024)),
      { required: true },
    ),
  });
  /* eslint-enable solid/reactivity */

  async function onSubmit() {
    try {
      await storageApi.updateStorage(props.serverId, props.storage.id, {
        name: group.controls.name.value,
        sizeLimit: parseInt(group.controls.sizeLimit.value) * 1024 * 1024 * 1024,
      });

      props.onUpdated?.();
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
      title={<Trans>Edit Storage</Trans>}
      actions={[
        { text: <Trans>Close</Trans> },
        {
          text: <Trans>Save</Trans>,
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
            label={t`Storage Name`}
          />

          <Form2.TextField
            type="number"
            min={1}
            max={1024}
            name="sizeLimit"
            control={group.controls.sizeLimit}
            label={t`Size Limit (GB)`}
          />
        </Column>
      </form>
    </Dialog>
  );
}
