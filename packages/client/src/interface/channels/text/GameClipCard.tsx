// CUSTOM: GameClips投稿1件分のカード。ヘッダー(投稿者・本人のみ編集/削除)+詳細文+
// 添付ファイルグリッド+メンションチップ+アクションバー(いいね/コメント)を表示する。
import { Accessor, For, Show, createEffect, createResource, createSignal } from "solid-js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { IconButton, Tooltip } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { GameClip, GameClipComment, useGameClipsApi } from "../../../api/gameclips";
import { GameClipWsEvent } from "../../../api/gameClipsSocket";
import { GameClipMediaGrid } from "./GameClipMediaGrid";

const MAX_COMMENT_LENGTH = 500;

export interface GameClipCardProps {
  serverId: string;
  gameClip: GameClip;
  wsEvent: Accessor<GameClipWsEvent | undefined>;
  onChanged?: () => void;
}

/**
 * GameClips投稿1件分のカード
 */
export function GameClipCard(props: GameClipCardProps) {
  const gameClipsApi = useGameClipsApi();
  const client = useClient();
  const { openModal, showError } = useModals();
  const myId = client().user!.id;

  const [likedByMe, setLikedByMe] = createSignal(props.gameClip.likedByMe);
  const [likeCount, setLikeCount] = createSignal(props.gameClip.likeCount);
  const [commentCount, setCommentCount] = createSignal(props.gameClip.commentCount);
  const [commentsOpen, setCommentsOpen] = createSignal(false);
  const [commentBody, setCommentBody] = createSignal("");
  const [isSubmittingComment, setIsSubmittingComment] = createSignal(false);

  const [comments, { mutate: mutateComments }] = createResource(commentsOpen, (open) =>
    open ? gameClipsApi.listComments(props.serverId, props.gameClip.id) : Promise.resolve([] as GameClipComment[]),
  );

  // CUSTOM: 他閲覧者の操作をWebSocket経由で受け取り、自分の画面にも反映する。
  // 自分の操作はAPIレスポンスで即時反映済みのため、受信値で単純に上書きする(冪等)。
  createEffect(() => {
    const event = props.wsEvent();
    if (!event || event.gameClipId !== props.gameClip.id) return;

    if (event.type === "like_updated") {
      setLikeCount(event.likeCount);
    } else if (event.type === "comment_added") {
      setCommentCount(event.commentCount);
      if (commentsOpen()) {
        mutateComments((prev) => [
          ...(prev ?? []),
          {
            id: event.comment.id,
            gameClipId: props.gameClip.id,
            serverId: props.serverId,
            body: event.comment.body,
            createdBy: event.comment.createdBy,
            createdAt: event.comment.createdAt,
          },
        ]);
      }
    }
  });

  async function toggleLike() {
    try {
      const result = await gameClipsApi.toggleLike(props.serverId, props.gameClip.id);
      setLikedByMe(result.liked);
      setLikeCount(result.likeCount);
    } catch (error) {
      showError(error);
    }
  }

  async function submitComment() {
    const body = commentBody().trim();
    if (!body) return;

    setIsSubmittingComment(true);
    try {
      const comment = await gameClipsApi.addComment(props.serverId, props.gameClip.id, body);
      mutateComments((prev) => [...(prev ?? []), comment]);
      setCommentCount((prev) => prev + 1);
      setCommentBody("");
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmittingComment(false);
    }
  }

  function openEdit() {
    openModal({
      type: "edit_gameclip",
      serverId: props.serverId,
      gameClip: props.gameClip,
      onUpdated: () => props.onChanged?.(),
      onDeleted: () => props.onChanged?.(),
    });
  }

  const isCreator = () => props.gameClip.createdBy === myId;
  const createdByName = () => client().users.get(props.gameClip.createdBy)?.username ?? props.gameClip.createdBy;

  return (
    <Card>
      <CardHeader>
        <Author>{createdByName()}</Author>
        <Show when={isCreator()}>
          <Tooltip content="編集" placement="top">
            <IconButton size="xs" variant="standard" onPress={openEdit}>
              <Symbol size={16}>edit</Symbol>
            </IconButton>
          </Tooltip>
        </Show>
      </CardHeader>

      <Show when={props.gameClip.description}>
        <Description>{props.gameClip.description}</Description>
      </Show>

      <GameClipMediaGrid files={props.gameClip.files} />

      <Show when={props.gameClip.mentionedUserIds.length > 0}>
        <MentionRow>
          <For each={props.gameClip.mentionedUserIds}>
            {(userId) => (
              <MentionChip>@{client().users.get(userId)?.username ?? userId}</MentionChip>
            )}
          </For>
        </MentionRow>
      </Show>

      <ActionBar>
        <ActionButton onClick={toggleLike}>
          <Symbol size={20} fill={likedByMe()} color={likedByMe() ? "var(--md-sys-color-error)" : undefined}>
            favorite
          </Symbol>
          <span>{likeCount()}</span>
        </ActionButton>

        <Show
          when={props.gameClip.allowComments}
          fallback={
            <ActionButton data-disabled="true">
              <Symbol size={20}>chat_bubble</Symbol>
              <Symbol size={14}>close</Symbol>
            </ActionButton>
          }
        >
          <ActionButton onClick={() => setCommentsOpen((prev) => !prev)}>
            <Symbol size={20}>chat_bubble</Symbol>
            <span>{commentCount()}</span>
          </ActionButton>
        </Show>
      </ActionBar>

      <Show when={commentsOpen() && props.gameClip.allowComments}>
        <CommentsSection>
          <For each={comments()}>
            {(comment) => (
              <CommentRow>
                <CommentAuthor>
                  {client().users.get(comment.createdBy)?.username ?? comment.createdBy}
                </CommentAuthor>
                <CommentBody>{comment.body}</CommentBody>
              </CommentRow>
            )}
          </For>
          <CommentInputRow>
            <CommentInput
              maxlength={MAX_COMMENT_LENGTH}
              placeholder="コメントを入力"
              value={commentBody()}
              onInput={(e) => setCommentBody((e.currentTarget as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.isComposing) submitComment();
              }}
              disabled={isSubmittingComment()}
            />
            <IconButton size="xs" variant="standard" onPress={submitComment} isDisabled={isSubmittingComment()}>
              <Symbol size={18}>send</Symbol>
            </IconButton>
          </CommentInputRow>
        </CommentsSection>
      </Show>
    </Card>
  );
}

const Card = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: "var(--borderRadius-md)",
    padding: "var(--gap-md)",
  },
});

const CardHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const Author = styled("div", {
  base: {
    fontWeight: "bold",
    fontSize: "13px",
  },
});

const Description = styled("div", {
  base: {
    fontSize: "13px",
    whiteSpace: "pre-wrap",
  },
});

const MentionRow = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--gap-xs)",
  },
});

const MentionChip = styled("span", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-primary)",
    background: "var(--md-sys-color-primary-container)",
    borderRadius: "var(--borderRadius-sm)",
    padding: "2px 8px",
  },
});

const ActionBar = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-md)",
  },
});

const ActionButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    border: "none",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontSize: "13px",
    cursor: "pointer",
    padding: "2px",

    "&[data-disabled='true']": {
      cursor: "default",
      opacity: 0.5,
    },
  },
});

const CommentsSection = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    borderTop: "1px solid var(--md-sys-color-outline-variant)",
    paddingTop: "var(--gap-sm)",
  },
});

const CommentRow = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-xs)",
    fontSize: "13px",
  },
});

const CommentAuthor = styled("span", {
  base: { fontWeight: "bold" },
});

const CommentBody = styled("span", {
  base: { whiteSpace: "pre-wrap" },
});

const CommentInputRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-xs)",
  },
});

const CommentInput = styled("input", {
  base: {
    flex: "1 1 auto",
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
    color: "inherit",
    font: "inherit",
    fontSize: "13px",
  },
});
