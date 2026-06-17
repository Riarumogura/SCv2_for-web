// CUSTOM: ストレージ作成モーダル
import { createFormControl, createFormGroup } from "solid-forms";
import { Show } from "solid-js";

import { Trans, useLingui } from "@lingui-solid/solid/macro";

import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useStorageApi } from "../../../src/api/storage";

/**
 * Modal to create a new storage
 */
export function CreateStorageModal(
  props: DialogProps & Modals & { type: "create_storage" },
) {
  const { t } = useLingui();
  const { showError } = useModals();
  const storageApi = useStorageApi();

  const group = createFormGroup({
    name: createFormControl("", { required: true }),
    sizeLimit: createFormControl("256", { required: true }),
  });

  async function onSubmit() {
    try {
      await storageApi.createStorage(props.serverId, {
        name: group.controls.name.value,
        sizeLimit: parseInt(group.controls.sizeLimit.value) * 1024 * 1024 * 1024, // GB to bytes
      });

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
      title={<Trans>Create Storage</Trans>}
      actions={[
        { text: <Trans>Close</Trans> },
        {
          text: <Trans>Create</Trans>,
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
            placeholder={t`e.g. Project Files`}
          />

          <Form2.TextField
            type="number"
            min={1}
            max={1024}
            name="sizeLimit"
            control={group.controls.sizeLimit}
            label={t`Size Limit (GB)`}
          />

          <Show when={group.controls.sizeLimit.value}>
            <div style={{ "font-size": "12px", color: "var(--md-sys-color-on-surface-variant)" }}>
              <Trans>Server-wide capacity limit: 256 GB (configurable)</Trans>
            </div>
          </Show>

          <div style={{ "margin-top": "var(--gap-md)", "font-size": "12px", color: "var(--md-sys-color-on-surface-variant)" }}>
            <div><Trans>• Storage name cannot be changed after creation</Trans></div>
            <div><Trans>• Size limit can be changed later</Trans></div>
            <div><Trans>• Files in storage are accessible to all server members</Trans></div>
          </div>
        </Column>
      </form>
    </Dialog>
  );
}