import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { decodeTime, ulid } from "ulid";

import { DraftMessages, Messages } from "@revolt/app";
import { useClient } from "@revolt/client";
import { Keybind, KeybindAction, createKeybind } from "@revolt/keybinds";
import { useNavigate, useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import {
  BelowFloatingHeader,
  Header,
  IconButton,
  NewMessages,
  Text,
  Tooltip,
  TypingIndicator,
  main,
} from "@revolt/ui";
import { VoiceChannelCallCardMount } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { ChannelHeader } from "../ChannelHeader";
import { ChannelPageProps } from "../ChannelPage";

import {
  consumePendingStorageOpen,
  pendingStorageOpen,
} from "../../../api/storageExplorerSignal";
import {
  consumePendingCalendarOpen,
  pendingCalendarOpen,
} from "../../../api/calendarExplorerSignal";
import {
  consumePendingMinecraftOpen,
  pendingMinecraftOpen,
} from "../../../api/minecraftExplorerSignal";

import { MessageComposition } from "./Composition";
import { MemberSidebar } from "./MemberSidebar";
import { TextSearchSidebar } from "./TextSearchSidebar";
import { StorageExplorer } from "./StorageExplorer";
import { CalendarExplorer } from "./CalendarExplorer";
import { MinecraftExplorer } from "./MinecraftExplorer";

/**
 * State of the channel sidebar
 */
export type SidebarState =
  | {
      state: "search";
      query: string;
    }
  | {
      state: "pins";
    }
  | {
      state: "storage";
      storageId: string;
    }
  | {
      state: "calendar";
    }
  | {
      state: "minecraft";
    }
  | {
      state: "default";
    };

/**
 * Channel component
 */
export function TextChannel(props: ChannelPageProps) {
  const state = useState();
  const client = useClient();

  // Last unread message id
  const [lastId, setLastId] = createSignal<string>();

  // Read highlighted message id from parameters
  const params = useSmartParams();
  const navigate = useNavigate();

  /**
   * Message id to be highlighted
   * @returns Message Id
   */
  const highlightMessageId = () => params().messageId;

  const canConnect = () =>
    props.channel.isVoice && props.channel.havePermission("Connect");

  // Get a reference to the message box's load latest function
  let jumpToBottomRef: ((nearby?: string) => void) | undefined;

  // Get a reference to the message list's "end status"
  let atEndRef: (() => boolean) | undefined;

  // Store last unread message id
  createEffect(
    on(
      () => props.channel.id,
      (id) =>
        setLastId(
          props.channel.unread
            ? (client().channelUnreads.get(id)?.lastMessageId as string)
            : undefined,
        ),
    ),
  );

  // Mark channel as read whenever it is marked as unread
  createEffect(
    on(
      // must be at the end of the conversation
      () => props.channel.unread && (atEndRef ? atEndRef() : true),
      (unread) => {
        if (unread) {
          if (document.hasFocus()) {
            // acknowledge the message
            props.channel.ack();
          } else {
            // otherwise mark this location as the last read location
            if (!lastId()) {
              // (taking away one second from the seed)
              setLastId(ulid(decodeTime(props.channel.lastMessageId!) - 1));
            }
          }
        }
      },
    ),
  );

  // Mark as read on re-focus
  function onFocus() {
    if (props.channel.unread && (atEndRef ? atEndRef() : true)) {
      props.channel.ack();
    }
  }

  document.addEventListener("focus", onFocus);
  onCleanup(() => document.removeEventListener("focus", onFocus));

  // Register ack/jump latest
  createKeybind(KeybindAction.CHAT_JUMP_END, () => {
    // Mark channel as read if not already
    if (props.channel.unread) {
      props.channel.ack();
    }

    // Clear the last unread id
    if (lastId()) {
      setLastId(undefined);
    }

    // Scroll to the bottom
    jumpToBottomRef?.();
  });

  // Sidebar scroll target
  let sidebarScrollTargetElement!: HTMLDivElement;

  // Sidebar state
  const [sidebarState, setSidebarState] = createSignal<SidebarState>({
    state: "default",
  });

  // CUSTOM: カレンダーパネルの幅をユーザーがドラッグで調整できるようにする
  const [calendarWidth, setCalendarWidth] = createSignal(640);
  let resizingCalendar = false;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  function onCalendarResizeMove(e: MouseEvent) {
    if (!resizingCalendar) return;
    // パネルは画面右側に固定されているため、左端を左にドラッグするほど幅が増える
    const delta = resizeStartX - e.clientX;
    setCalendarWidth(Math.min(1000, Math.max(360, resizeStartWidth + delta)));
  }

  function onCalendarResizeUp() {
    resizingCalendar = false;
    window.removeEventListener("mousemove", onCalendarResizeMove);
    window.removeEventListener("mouseup", onCalendarResizeUp);
  }

  function onCalendarResizeDown(e: MouseEvent) {
    e.preventDefault();
    resizingCalendar = true;
    resizeStartX = e.clientX;
    resizeStartWidth = calendarWidth();
    window.addEventListener("mousemove", onCalendarResizeMove);
    window.addEventListener("mouseup", onCalendarResizeUp);
  }

  onCleanup(() => {
    window.removeEventListener("mousemove", onCalendarResizeMove);
    window.removeEventListener("mouseup", onCalendarResizeUp);
  });

  // todo: in the future maybe persist per ID?
  createEffect(
    on(
      () => props.channel.id,
      () => setSidebarState({ state: "default" }),
    ),
  );

  // CUSTOM: ServerSidebarのストレージ一覧クリックを受け取り、サイドバーを切り替える
  createEffect(() => {
    const request = pendingStorageOpen();
    if (request && request.serverId === props.channel.serverId) {
      setSidebarState({ state: "storage", storageId: request.storageId });
      consumePendingStorageOpen();
    }
  });

  // CUSTOM: ServerSidebarのカレンダーメニュークリックを受け取り、サイドバーを切り替える
  createEffect(() => {
    const request = pendingCalendarOpen();
    if (request && request.serverId === props.channel.serverId) {
      setSidebarState({ state: "calendar" });
      consumePendingCalendarOpen();
    }
  });

  // CUSTOM: ServerSidebarのMinecraftサーバークリックを受け取り、サイドバーを切り替える
  createEffect(() => {
    const request = pendingMinecraftOpen();
    if (request && request.serverId === props.channel.serverId) {
      setSidebarState({ state: "minecraft" });
      consumePendingMinecraftOpen();
    }
  });

  return (
    <>
      <Header placement="primary">
        <ChannelHeader
          channel={props.channel}
          sidebarState={sidebarState}
          setSidebarState={setSidebarState}
        />
      </Header>
      <Content>
        <main class={main()}>
          <Show
            when={canConnect()}
            fallback={
              <BelowFloatingHeader>
                <div>
                  <NewMessages
                    lastId={lastId}
                    jumpBack={() => navigate(lastId()!)}
                    dismiss={() => setLastId()}
                  />
                </div>
              </BelowFloatingHeader>
            }
          >
            <VoiceChannelCallCardMount channel={props.channel} />
          </Show>

          <Messages
            channel={props.channel}
            lastReadId={lastId}
            pendingMessages={(pendingProps) => (
              <DraftMessages
                channel={props.channel}
                tail={pendingProps.tail}
                sentIds={pendingProps.ids}
              />
            )}
            typingIndicator={
              <TypingIndicator
                users={props.channel.typing}
                ownId={client().user!.id}
              />
            }
            highlightedMessageId={highlightMessageId}
            clearHighlightedMessage={() => navigate(".")}
            atEndRef={(ref) => (atEndRef = ref)}
            jumpToBottomRef={(ref) => (jumpToBottomRef = ref)}
          />

          <MessageComposition
            channel={props.channel}
            onMessageSend={() => jumpToBottomRef?.()}
          />
        </main>
        <Show
          when={
            (state.layout.getSectionState(
              LAYOUT_SECTIONS.MEMBER_SIDEBAR,
              true,
            ) &&
              props.channel.type !== "SavedMessages") ||
            sidebarState().state !== "default"
          }
        >
          <div
            ref={sidebarScrollTargetElement}
            use:scrollable={{
              direction: "y",
              showOnHover: true,
              class: sidebar(),
            }}
            style={{
              // CUSTOM: カレンダーは月表示等を表示するためデフォルトの360pxでは狭すぎるので、
              // ユーザーがドラッグで調整できる幅(calendarWidth)を使う。Minecraftパネルは
              // コンソールログを読みやすくするため固定で480pxにする
              width:
                sidebarState().state === "calendar"
                  ? `${calendarWidth()}px`
                  : sidebarState().state === "minecraft"
                    ? "480px"
                    : sidebarState().state !== "default"
                      ? "360px"
                      : "",
              position: sidebarState().state === "calendar" ? "relative" : undefined,
            }}
          >
            {/* CUSTOM: カレンダーパネルの左端をドラッグして幅を調整するハンドル */}
            <Show when={sidebarState().state === "calendar"}>
              <ResizeHandle onMouseDown={onCalendarResizeDown} />
            </Show>
            <Switch
              fallback={
                <MemberSidebar
                  channel={props.channel}
                  scrollTargetElement={sidebarScrollTargetElement}
                />
              }
            >
              <Match when={sidebarState().state === "search"}>
                <WideSidebarContainer>
                  <SidebarTitle>
                    <Text class="label" size="large">
                      Search Results
                    </Text>
                  </SidebarTitle>
                  <TextSearchSidebar
                    channel={props.channel}
                    query={{
                      query: (sidebarState() as { query: string }).query,
                    }}
                  />
                </WideSidebarContainer>
              </Match>
              <Match when={sidebarState().state === "pins"}>
                <WideSidebarContainer>
                  <SidebarTitle>
                    <Text class="label" size="large">
                      Pinned Messages
                    </Text>
                  </SidebarTitle>
                  <TextSearchSidebar
                    channel={props.channel}
                    query={{ pinned: true, sort: "Latest" }}
                  />
                </WideSidebarContainer>
              </Match>
              <Match when={sidebarState().state === "storage"}>
                <WideSidebarContainer>
                  <SidebarHeaderRow>
                    <Text class="label" size="large">
                      ストレージエクスプローラー
                    </Text>
                    {/* CUSTOM: ストレージを閉じてチャットのみの表示に戻すボタン */}
                    <Tooltip content="ストレージを閉じる" placement="top">
                      <IconButton
                        size="xs"
                        variant="standard"
                        onPress={() => setSidebarState({ state: "default" })}
                      >
                        <Symbol size={16}>close</Symbol>
                      </IconButton>
                    </Tooltip>
                  </SidebarHeaderRow>
                  {/* CUSTOM: ストレージエクスプローラーコンポーネントをここに追加 */}
                  <StorageExplorer
                    serverId={props.channel.serverId}
                    storageId={(sidebarState() as { storageId: string }).storageId}
                  />
                </WideSidebarContainer>
              </Match>
              <Match when={sidebarState().state === "calendar"}>
                {/* CUSTOM: WideSidebarContainerは幅360px固定だが、カレンダーは外側のスクロール
                    コンテナ側でcalendarWidthに広げているため、幅100%で追従させる */}
                <WideSidebarContainer
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    "flex-direction": "column",
                  }}
                >
                  <SidebarHeaderRow>
                    <Text class="label" size="large">
                      カレンダー
                    </Text>
                    {/* CUSTOM: カレンダーを閉じてチャットのみの表示に戻すボタン */}
                    <Tooltip content="カレンダーを閉じる" placement="top">
                      <IconButton
                        size="xs"
                        variant="standard"
                        onPress={() => setSidebarState({ state: "default" })}
                      >
                        <Symbol size={16}>close</Symbol>
                      </IconButton>
                    </Tooltip>
                  </SidebarHeaderRow>
                  <CalendarExplorer serverId={props.channel.serverId} />
                </WideSidebarContainer>
              </Match>
              <Match when={sidebarState().state === "minecraft"}>
                <WideSidebarContainer>
                  <SidebarHeaderRow>
                    <Text class="label" size="large">
                      Minecraftサーバー管理
                    </Text>
                    {/* CUSTOM: Minecraftパネルを閉じてチャットのみの表示に戻すボタン */}
                    <Tooltip content="閉じる" placement="top">
                      <IconButton
                        size="xs"
                        variant="standard"
                        onPress={() => setSidebarState({ state: "default" })}
                      >
                        <Symbol size={16}>close</Symbol>
                      </IconButton>
                    </Tooltip>
                  </SidebarHeaderRow>
                  <MinecraftExplorer serverId={props.channel.serverId} />
                </WideSidebarContainer>
              </Match>
            </Switch>

            <Show when={sidebarState().state !== "default"}>
              <Keybind
                keybind={KeybindAction.CLOSE_SIDEBAR}
                onPressed={() => setSidebarState({ state: "default" })}
              />
            </Show>
          </div>
        </Show>
      </Content>
    </>
  );
}

/**
 * Main content row layout
 */
const Content = styled("div", {
  base: {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
  },
});

/**
 * Base styles
 */
const sidebar = cva({
  base: {
    flexShrink: 0,
    width: "var(--layout-width-channel-sidebar)",
    // margin: "var(--gap-md)",
    borderRadius: "var(--borderRadius-lg)",
    // color: "var(--colours-sidebar-channels-foreground)",
    // background: "var(--colours-sidebar-channels-background)",
  },
});

/**
 * Container styles
 */
const WideSidebarContainer = styled("div", {
  base: {
    paddingRight: "var(--gap-md)",
    width: "360px",
  },
});

/**
 * Sidebar title
 */
const SidebarTitle = styled("div", {
  base: {
    padding: "var(--gap-md)",
    color: "var(--md-sys-color-on-surface)",
  },
});

// CUSTOM: 閉じるボタンを右端に置くサイドバータイトル行(カレンダー・ストレージで共用)
const SidebarHeaderRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--gap-md)",
    color: "var(--md-sys-color-on-surface)",
  },
});

// CUSTOM: カレンダーパネルの幅をドラッグで調整するハンドル(左端に重ねて配置)
const ResizeHandle = styled("div", {
  base: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: "6px",
    cursor: "col-resize",
    zIndex: 10,
    transition: "var(--transitions-fast) background",

    "&:hover": {
      background: "var(--md-sys-color-outline-variant)",
    },
  },
});