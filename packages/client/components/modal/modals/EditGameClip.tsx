// CUSTOM: GameClips投稿編集モーダル(EditAlbum.tsxと同パターン)。ファイルの差し替えは
// 対象外(削除して再作成する想定)。
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { For, Show, createResource, createSignal } from "solid-js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Button, Column, Dialog, DialogProps, IconButton, Row, Text, Tooltip } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useModals } from "..";
import { Modals } from "../types";
import { GameClipCategory, useGameClipsApi } from "../../../src/api/gameclips";

const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Modal to edit an existing GameClips post
 */
export function EditGameClipModal(
  props: DialogProps & Modals & { type: "edit_gameclip" },
) {
  const { showError, openModal } = useModals();
  const gameClipsApi = useGameClipsApi();
  const client = useClient();
  const myId = client().user!.id;

  const [categories, { mutate: mutateCategories }] = createResource(() =>
    gameClipsApi.listCategories(props.serverId),
  );
  const [categoryId, setCategoryId] = createSignal(props.gameClip.categoryId);
  const [description, setDescription] = createSignal(props.gameClip.description);
  const [allowComments, setAllowComments] = createSignal(props.gameClip.allowComments);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const otherMembers = () =>
    client().serverMembers.filter(
      (member) => member.id.server === props.serverId && member.id.user !== myId,
    );
  const [selectedMentionIds, setSelectedMentionIds] = createSignal<Set<string>>(
    new Set(props.gameClip.mentionedUserIds),
  );

  function toggleMention(userId: string) {
    setSelectedMentionIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function openCreateCategory() {
    openModal({
      type: "create_gameclip_category",
      serverId: props.serverId,
      onCreated: (category: GameClipCategory) => {
        mutateCategories((prev) => [...(prev ?? []), category]);
        setCategoryId(category.id);
      },
    });
  }

  async function onSubmit() {
    setIsSubmitting(true);
    try {
      await gameClipsApi.updateGameClip(props.serverId, props.gameClip.id, {
        description: description(),
        categoryId: categoryId(),
        allowComments: allowComments(),
        mentionedUserIds: Array.from(selectedMentionIds()),
      });

      props.onUpdated?.();
      props.onClose();
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function openDelete() {
    openModal({
      type: "delete_gameclip",
      serverId: props.serverId,
      gameClipId: props.gameClip.id,
      onDeleted: () => {
        props.onDeleted?.();
        props.onClose();
      },
    });
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title="投稿を編集"
      actions={[
        { text: "キャンセル" },
        {
          text: "保存",
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: isSubmitting(),
        },
      ]}
      isDisabled={isSubmitting()}
    >
      <Column>
        <div>
          <Row align style={{ "justify-content": "space-between" }}>
            <FieldLabel>カテゴリ</FieldLabel>
            <Tooltip content="カテゴリを作成" placement="top">
              <IconButton size="xs" variant="standard" onPress={openCreateCategory}>
                <Symbol size={16}>add</Symbol>
              </IconButton>
            </Tooltip>
          </Row>
          <select
            value={categoryId()}
            onInput={(e) => setCategoryId((e.currentTarget as HTMLSelectElement).value)}
            style={{ width: "100%", padding: "var(--gap-xs)" }}
          >
            <For each={categories()}>
              {(category) => <option value={category.id}>{category.name}</option>}
            </For>
          </select>
        </div>

        <div>
          <Row align style={{ "justify-content": "space-between" }}>
            <FieldLabel>詳細</FieldLabel>
            <Text class="label" size="small">
              {description().length} / {MAX_DESCRIPTION_LENGTH}
            </Text>
          </Row>
          <DescriptionTextarea
            maxlength={MAX_DESCRIPTION_LENGTH}
            value={description()}
            onInput={(e) =>
              setDescription((e.currentTarget as HTMLTextAreaElement).value.slice(0, MAX_DESCRIPTION_LENGTH))
            }
          />
        </div>

        <div>
          <FieldLabel>メンション</FieldLabel>
          <PickerList>
            <Show
              when={otherMembers().length > 0}
              fallback={<EmptyHint>メンションできるメンバーがいません</EmptyHint>}
            >
              <For each={otherMembers()}>
                {(member) => (
                  <PickerRow>
                    <input
                      type="checkbox"
                      checked={selectedMentionIds().has(member.id.user)}
                      onChange={() => toggleMention(member.id.user)}
                    />
                    <span>{member.user?.username ?? member.id.user}</span>
                  </PickerRow>
                )}
              </For>
            </Show>
          </PickerList>
        </div>

        <PickerRow>
          <input
            type="checkbox"
            checked={allowComments()}
            onChange={(e) => setAllowComments(e.currentTarget.checked)}
          />
          <span>コメントを許可する</span>
        </PickerRow>

        <Button variant="_error" onPress={openDelete}>
          投稿を削除
        </Button>
      </Column>
    </Dialog>
  );
}

const FieldLabel = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    marginBottom: "var(--gap-xs)",
  },
});

const DescriptionTextarea = styled("textarea", {
  base: {
    width: "100%",
    minHeight: "80px",
    resize: "vertical",
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
    color: "inherit",
    font: "inherit",
    fontSize: "13px",
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
