// CUSTOM: アルバム専用カテゴリ作成モーダル
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { createFormControl, createFormGroup } from "solid-forms";

import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useAlbumApi } from "../../../src/api/album";

const DEFAULT_COLOR = "#5865f2";

/**
 * Modal to create a new album category
 */
export function CreateAlbumCategoryModal(
  props: DialogProps & Modals & { type: "create_album_category" },
) {
  const { showError } = useModals();
  const albumApi = useAlbumApi();

  const group = createFormGroup({
    name: createFormControl("", { required: true }),
    color: createFormControl(DEFAULT_COLOR),
  });

  async function onSubmit() {
    try {
      const category = await albumApi.createCategory(props.serverId, {
        name: group.controls.name.value,
        color: group.controls.color.value,
      });

      props.onCreated?.(category);
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
      title="カテゴリを作成"
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
      <form onSubmit={submit} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}>
        <Column>
          <Form2.TextField
            minlength={1}
            maxlength={100}
            counter
            name="name"
            control={group.controls.name}
            label="カテゴリ名"
            placeholder="例: 旅行"
          />

          <div>
            <label
              style={{
                display: "block",
                "font-size": "12px",
                color: "var(--md-sys-color-on-surface-variant)",
                "margin-bottom": "var(--gap-xs)",
              }}
            >
              色
            </label>
            <input
              type="color"
              value={group.controls.color.value}
              onInput={(e) =>
                group.controls.color.setValue((e.currentTarget as HTMLInputElement).value)
              }
              style={{ width: "48px", height: "32px", cursor: "pointer" }}
            />
          </div>
        </Column>
      </form>
    </Dialog>
  );
}
