// CUSTOM: GameClipsパネル本体。上部にカテゴリタブ(横スクロール、+でカテゴリ作成)、
// 「投稿する」ボタン、その下に投稿フィード(縦スクロール、新着順)を配置する。
// AlbumExplorer.tsxの構成パターンを踏襲しているが、検索フォームの代わりにカテゴリタブを使う。
import { For, Show, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";
import { IconButton, Tooltip } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useGameClipsApi, GameClipCategory } from "../../../api/gameclips";
import { connectGameClipsSocket, GameClipWsEvent } from "../../../api/gameClipsSocket";
import { GameClipCard } from "./GameClipCard";

export interface GameClipsExplorerProps {
  serverId: string;
}

/**
 * GameClipsパネル本体
 */
export function GameClipsExplorer(props: GameClipsExplorerProps) {
  const gameClipsApi = useGameClipsApi();
  const { openModal } = useModals();

  const [selectedCategoryId, setSelectedCategoryId] = createSignal<string>();
  const [categories, { mutate: mutateCategories }] = createResource(() =>
    gameClipsApi.listCategories(props.serverId),
  );
  const [gameClips, { refetch: refetchGameClips }] = createResource(
    () => selectedCategoryId(),
    (categoryId) => gameClipsApi.listGameClips(props.serverId, categoryId),
  );

  const [wsEvent, setWsEvent] = createSignal<GameClipWsEvent>();

  onMount(() => {
    const disconnect = connectGameClipsSocket(props.serverId, setWsEvent);
    onCleanup(disconnect);
  });

  function openCreateCategory() {
    openModal({
      type: "create_gameclip_category",
      serverId: props.serverId,
      onCreated: (category: GameClipCategory) => {
        mutateCategories((prev) => [...(prev ?? []), category]);
        setSelectedCategoryId(category.id);
      },
    });
  }

  function openCreate() {
    openModal({
      type: "create_gameclip",
      serverId: props.serverId,
      categoryId: selectedCategoryId(),
      onCreated: () => refetchGameClips(),
    });
  }

  return (
    <Container>
      <CategorySection>
        <CategoryTabs>
          <CategoryTab data-active={selectedCategoryId() === undefined} onClick={() => setSelectedCategoryId(undefined)}>
            すべて
          </CategoryTab>
          <For each={categories()}>
            {(category) => (
              <CategoryTab
                data-active={selectedCategoryId() === category.id}
                onClick={() => setSelectedCategoryId(category.id)}
              >
                {category.name}
              </CategoryTab>
            )}
          </For>
          <Tooltip content="ゲームカテゴリを作成" placement="top">
            <IconButton size="xs" variant="standard" onPress={openCreateCategory}>
              <Symbol size={16}>add</Symbol>
            </IconButton>
          </Tooltip>
        </CategoryTabs>
        <CreateButton onClick={openCreate}>+ 投稿する</CreateButton>
      </CategorySection>

      <Feed>
        <Show
          when={(gameClips()?.length ?? 0) > 0}
          fallback={<EmptyHint>投稿がまだありません</EmptyHint>}
        >
          <For each={gameClips()}>
            {(gameClip) => (
              <GameClipCard
                serverId={props.serverId}
                gameClip={gameClip}
                wsEvent={wsEvent}
                onChanged={refetchGameClips}
              />
            )}
          </For>
        </Show>
      </Feed>
    </Container>
  );
}

const Container = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  },
});

const CategorySection = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    padding: "var(--gap-md)",
    borderBottom: "1px solid var(--md-sys-color-outline-variant)",
  },
});

const CategoryTabs = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-xs)",
    overflowX: "auto",
  },
});

const CategoryTab = styled("button", {
  base: {
    flexShrink: 0,
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontSize: "12px",
    cursor: "pointer",
    whiteSpace: "nowrap",

    "&[data-active='true']": {
      background: "var(--md-sys-color-primary-container)",
      borderColor: "var(--md-sys-color-primary)",
    },
  },
});

const CreateButton = styled("button", {
  base: {
    padding: "var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-primary-container)",
    color: "inherit",
    font: "inherit",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
});

const Feed = styled("div", {
  base: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    padding: "var(--gap-md)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
  },
});

const EmptyHint = styled("div", {
  base: {
    fontSize: "13px",
    color: "var(--md-sys-color-on-surface-variant)",
    padding: "var(--gap-md)",
  },
});
