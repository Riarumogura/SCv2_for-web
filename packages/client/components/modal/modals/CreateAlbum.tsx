// CUSTOM: アルバム作成モーダル
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { createFormControl, createFormGroup } from "solid-forms";
import { ErrorBoundary, For, Show, createResource, createSignal } from "solid-js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Column, Dialog, DialogProps, Form2, IconButton, MenuItem, Row, Tooltip } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useModals } from "..";
import { Modals } from "../types";
import {
  useAlbumApi,
  AlbumCategory,
  ViewPermission,
  EditPermission,
  VIEW_PERMISSIONS,
  EDIT_PERMISSIONS,
} from "../../../src/api/album";
import {
  VIEW_PERMISSION_LABELS,
  EDIT_PERMISSION_LABELS,
  toDateInputValue,
} from "../../../src/interface/channels/text/albumLabels";

/**
 * Modal to create a new album
 */
export function CreateAlbumModal(
  props: DialogProps & Modals & { type: "create_album" },
) {
  const { showError, openModal } = useModals();
  const albumApi = useAlbumApi();
  const client = useClient();
  const myId = client().user!.id;

  const [categories, { mutate: mutateCategories }] = createResource(() =>
    albumApi.listCategories(props.serverId),
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = createSignal<Set<string>>(new Set());

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreateCategory() {
    openModal({
      type: "create_album_category",
      serverId: props.serverId,
      onCreated: (category: AlbumCategory) => {
        mutateCategories((prev) => [...(prev ?? []), category]);
        toggleCategory(category.id);
      },
    });
  }

  const otherMembers = () =>
    client().serverMembers.filter(
      (member) => member.id.server === props.serverId && member.id.user !== myId,
    );
  const [selectedViewMemberIds, setSelectedViewMemberIds] = createSignal<Set<string>>(new Set());
  const [selectedEditMemberIds, setSelectedEditMemberIds] = createSignal<Set<string>>(new Set());

  function toggleMember(
    setSignal: typeof setSelectedViewMemberIds,
    userId: string,
  ) {
    setSignal((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const group = createFormGroup({
    title: createFormControl("", { required: true }),
    date: createFormControl(
      props.initialDate ?? toDateInputValue(new Date()),
      { required: true },
    ),
    viewPermission: createFormControl<ViewPermission>("anyone"),
    editPermission: createFormControl<EditPermission>("creator_only"),
  });

  async function onSubmit() {
    try {
      const album = await albumApi.createAlbum(props.serverId, {
        title: group.controls.title.value,
        date: group.controls.date.value,
        categoryIds: Array.from(selectedCategoryIds()),
        viewPermission: group.controls.viewPermission.value,
        viewMemberIds: Array.from(selectedViewMemberIds()),
        editPermission: group.controls.editPermission.value,
        editMemberIds: Array.from(selectedEditMemberIds()),
      });

      props.onCreated?.(album);
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
      title="アルバムを作成"
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
            maxlength={200}
            counter
            name="title"
            control={group.controls.title}
            label="タイトル"
            placeholder="例: 6月のキャンプ"
          />

          <Form2.TextField
            type="date"
            name="date"
            control={group.controls.date}
            label="日付"
          />

          <div>
            <Row align style={{ "justify-content": "space-between" }}>
              <PickerLabel>カテゴリ</PickerLabel>
              <Tooltip content="カテゴリを作成" placement="top">
                <IconButton size="xs" variant="standard" onPress={openCreateCategory}>
                  <Symbol size={16}>add</Symbol>
                </IconButton>
              </Tooltip>
            </Row>
            {/* CUSTOM: categories()(createResource)はエラー時に読み取ると例外をre-throwするため、
                カテゴリ取得に失敗してもモーダル全体が壊れないようにErrorBoundaryで止める */}
            <ErrorBoundary fallback={<EmptyHint>カテゴリの取得に失敗しました</EmptyHint>}>
            <PickerList>
              <Show
                when={(categories()?.length ?? 0) > 0}
                fallback={<EmptyHint>カテゴリがありません</EmptyHint>}
              >
                <For each={categories()}>
                  {(category) => (
                    <PickerRow>
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds().has(category.id)}
                        onChange={() => toggleCategory(category.id)}
                      />
                      <ColorDot style={{ background: category.color }} />
                      <span>{category.name}</span>
                    </PickerRow>
                  )}
                </For>
              </Show>
            </PickerList>
            </ErrorBoundary>
          </div>

          <Form2.Select label="閲覧権限" control={group.controls.viewPermission}>
            <For each={VIEW_PERMISSIONS}>
              {(option) => <MenuItem value={option}>{VIEW_PERMISSION_LABELS[option]}</MenuItem>}
            </For>
          </Form2.Select>

          <Show when={group.controls.viewPermission.value === "members"}>
            <div>
              <PickerLabel>閲覧可能なメンバー</PickerLabel>
              <PickerList>
                <PickerRow>
                  <input type="checkbox" checked disabled />
                  <span>自分</span>
                </PickerRow>
                <For each={otherMembers()}>
                  {(member) => (
                    <PickerRow>
                      <input
                        type="checkbox"
                        checked={selectedViewMemberIds().has(member.id.user)}
                        onChange={() => toggleMember(setSelectedViewMemberIds, member.id.user)}
                      />
                      <span>{member.user?.username ?? member.id.user}</span>
                    </PickerRow>
                  )}
                </For>
              </PickerList>
            </div>
          </Show>

          <Form2.Select label="編集権限" control={group.controls.editPermission}>
            <For each={EDIT_PERMISSIONS}>
              {(option) => <MenuItem value={option}>{EDIT_PERMISSION_LABELS[option]}</MenuItem>}
            </For>
          </Form2.Select>

          <Show when={group.controls.editPermission.value === "members"}>
            <div>
              <PickerLabel>編集可能なメンバー</PickerLabel>
              <PickerList>
                <PickerRow>
                  <input type="checkbox" checked disabled />
                  <span>自分</span>
                </PickerRow>
                <For each={otherMembers()}>
                  {(member) => (
                    <PickerRow>
                      <input
                        type="checkbox"
                        checked={selectedEditMemberIds().has(member.id.user)}
                        onChange={() => toggleMember(setSelectedEditMemberIds, member.id.user)}
                      />
                      <span>{member.user?.username ?? member.id.user}</span>
                    </PickerRow>
                  )}
                </For>
              </PickerList>
            </div>
          </Show>
        </Column>
      </form>
    </Dialog>
  );
}

const PickerLabel = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    marginBottom: "var(--gap-xs)",
  },
});

const PickerList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    maxHeight: "160px",
    overflowY: "auto",
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: "var(--borderRadius-sm)",
    padding: "var(--gap-sm)",
  },
});

const PickerRow = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    fontSize: "13px",
    cursor: "pointer",
  },
});

const EmptyHint = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    padding: "var(--gap-xs)",
  },
});

const ColorDot = styled("span", {
  base: {
    display: "inline-block",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
  },
});
