// CUSTOM: GameClips専用カテゴリ作成モーダル。Albumのカテゴリと異なり色分け表示の
// 要件がないため、名前のみ入力する(CreateAlbumCategory.tsxから色入力を除いた版)。
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { createFormControl, createFormGroup } from "solid-forms";

import { Column, Dialog, DialogProps, Form2 } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useGameClipsApi } from "../../../src/api/gameclips";

/**
 * Modal to create a new GameClips category
 */
export function CreateGameClipCategoryModal(
  props: DialogProps & Modals & { type: "create_gameclip_category" },
) {
  const { showError } = useModals();
  const gameClipsApi = useGameClipsApi();

  const group = createFormGroup({
    name: createFormControl("", { required: true }),
  });

  async function onSubmit() {
    try {
      const category = await gameClipsApi.createCategory(props.serverId, {
        name: group.controls.name.value,
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
      title="ゲームカテゴリを作成"
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
            placeholder="例: Apex Legends"
          />
        </Column>
      </form>
    </Dialog>
  );
}
