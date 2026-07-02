import { Accessor, For, JSX, Show, createMemo, createSignal } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";
import { Channel, Server, User } from "stoat.js";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { CONFIGURATION } from "@revolt/common";
import { KeybindAction, createKeybind } from "@revolt/keybinds";
import { useModals } from "@revolt/modal";
import { useNavigate, useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar, Column, Text, Time, Unreads, UserStatus } from "@revolt/ui";

import MdAdd from "@material-design-icons/svg/filled/add.svg?component-solid";
import MdChat from "@material-design-icons/svg/filled/chat.svg?component-solid";
import MdExplore from "@material-design-icons/svg/filled/explore.svg?component-solid";
import MdHome from "@material-design-icons/svg/filled/home.svg?component-solid";
import MdNotifications from "@material-design-icons/svg/filled/notifications.svg?component-solid";
import MdSearch from "@material-design-icons/svg/filled/search.svg?component-solid";
import MdSettings from "@material-design-icons/svg/filled/settings.svg?component-solid";

import { Tooltip } from "../../../../components/ui/components/floating";
import { Draggable } from "../../../../components/ui/components/utils/Draggable";
import { requestOpenSearch } from "../../../api/textSearchSignal";

import { UserMenu } from "./UserMenu";

/**
 * Which top-level rail section is currently active.
 * "server" means a workspace (server) is selected; disambiguating which one
 * is done separately via `selectedServer`.
 */
export type RailSection = "home" | "dms" | "activity" | "server";

interface Props {
  /**
   * Ordered server list
   */
  orderedServers: Server[];

  /**
   * Set server ordering
   * @param ids List of IDs
   */
  setServerOrder: (ids: string[]) => void;

  /**
   * Unread conversations list (used for the DM rail badge)
   */
  unreadConversations: Channel[];

  /**
   * Current logged in user
   */
  user: User;

  /**
   * Selected server id
   */
  selectedServer: Accessor<string | undefined>;

  /**
   * Currently active rail section (Home / DMs / Activity / a server)
   */
  activeSection: Accessor<RailSection>;

  /**
   * Create or join server
   */
  onCreateOrJoinServer(): void;

  /**
   * Menu generator
   */
  menuGenerator: (target: Server | Channel) => JSX.Directives["floating"];
}

/**
 * App rail: fixed Home/DM/Activity/Search entries, followed by the
 * server (workspace) switcher.
 *
 * Rail items are defined as data (icon/label/href/badge) rather than
 * hardcoded markup so the same definitions can later be reused to render
 * a mobile drawer/sheet (Phase 4) without duplicating logic.
 */
export const ServerList = (props: Props) => {
  const state = useState();
  const client = useClient();
  const navigate = useNavigate();
  const smartParams = useSmartParams();
  const { openModal } = useModals();

  const navigateServer = (byOffset: number) => {
    const serverId = props.selectedServer();
    if (serverId == null && props.orderedServers.length) {
      if (byOffset === 1) {
        navigate(`/server/${props.orderedServers[0].id}`);
      } else {
        navigate(
          `/server/${props.orderedServers[props.orderedServers.length - 1].id}`,
        );
      }
      return;
    }

    const currentServerIndex = props.orderedServers.findIndex(
      (server) => server.id === serverId,
    );

    const nextIndex = currentServerIndex + byOffset;

    if (nextIndex === -1) {
      return navigate("/app");
    }

    // this will wrap the index around
    const nextServer = props.orderedServers.at(
      nextIndex % props.orderedServers.length,
    );

    if (nextServer) {
      navigate(`/server/${nextServer.id}`);
    }
  };

  createKeybind(KeybindAction.NAVIGATION_SERVER_UP, () => navigateServer(-1));
  createKeybind(KeybindAction.NAVIGATION_SERVER_DOWN, () => navigateServer(1));

  const homeNotifications = createMemo(() => {
    return client().users.filter((user) => user.relationship === "Incoming")
      .length;
  });

  const dmNotifications = createMemo(() => props.unreadConversations.length);

  // Realtime, non-persisted aggregate across all servers (Phase 1 "simple
  // feed" — no read-state management, see ActivitySidebar)
  const activityNotifications = createMemo(() =>
    props.orderedServers.reduce(
      (sum, server) => sum + server.mentions.length,
      0,
    ),
  );

  /**
   * Fixed, global rail entries (Home / DM / Activity)
   */
  const railItems: Array<{
    key: RailSection;
    href: string;
    tooltip: string;
    icon: JSX.Element;
    notifications: Accessor<number>;
  }> = [
    {
      key: "home",
      href: "/app",
      tooltip: "Home",
      icon: <MdHome />,
      notifications: homeNotifications,
    },
    {
      key: "dms",
      href: "/dms",
      tooltip: "Direct Messages",
      icon: <MdChat />,
      notifications: dmNotifications,
    },
    {
      key: "activity",
      href: "/activity",
      tooltip: "Activity",
      icon: <MdNotifications />,
      notifications: activityNotifications,
    },
  ];

  // Ref for floating menu
  const [menuButton, setMenuButton] = createSignal<HTMLDivElement>();

  return (
    <ServerListBase>
      <div use:invisibleScrollable={{ direction: "y", class: listBase() }}>
        <For each={railItems}>
          {(item) => (
            <a
              class={entryContainer({
                indicator:
                  props.activeSection() === item.key ? "selected" : undefined,
              })}
              href={item.href}
              use:floating={{
                tooltip: {
                  content: item.tooltip,
                  placement: "right",
                },
              }}
            >
              <Avatar
                size={42}
                fallback={item.icon}
                holepunch={item.notifications() ? "top-right" : undefined}
                overlay={
                  <Show when={item.notifications()}>
                    <Unreads.Graphic
                      unread={item.notifications() !== 0}
                      count={item.notifications()}
                    />
                  </Show>
                }
              />
            </a>
          )}
        </For>
        <a
          class={entryContainer()}
          onClick={() => {
            // Only meaningful when a channel is currently open; there is
            // nothing to search otherwise.
            if (smartParams().channelId) {
              requestOpenSearch();
            }
          }}
          use:floating={{
            tooltip: {
              content: "Search",
              placement: "right",
            },
          }}
        >
          <Avatar size={42} fallback={<MdSearch />} />
        </a>
        <Tooltip
          placement="right"
          content={() => (
            <Column>
              <span>{props.user.username}</span>
              <Text class="label" size="small">
                {props.user.presence}
              </Text>
            </Column>
          )}
          aria={props.user.username}
        >
          <a ref={setMenuButton} class={entryContainer()}>
            <Avatar
              size={42}
              src={props.user.avatarURL}
              holepunch={"bottom-right"}
              overlay={<UserStatus.Graphic status={props.user.presence} />}
              interactive
            />
          </a>
          <UserMenu anchor={menuButton} />
        </Tooltip>
        <LineDivider />
        <Draggable
          type="servers"
          items={props.orderedServers}
          onChange={props.setServerOrder}
        >
          {(entry) => (
            <Tooltip
              placement="right"
              content={() => (
                <Column>
                  <Text class="label" size="large">
                    {entry.item.name}
                  </Text>{" "}
                  <Show when={state.notifications.isMuted(entry.item)}>
                    <Text class="label" size="small">
                      <Show
                        when={
                          state.notifications.getServerMute(entry.item)!.until
                        }
                        fallback={<Trans>Muted</Trans>}
                      >
                        <Trans>
                          Muted until{" "}
                          <Time
                            format="datetime"
                            value={
                              state.notifications.getServerMute(entry.item)!
                                .until
                            }
                          />
                        </Trans>
                      </Show>
                    </Text>
                  </Show>
                </Column>
              )}
              aria={entry.item.name}
            >
              <div
                class={entryContainer({
                  indicator:
                    props.activeSection() === "server" &&
                    props.selectedServer() === entry.item.id
                      ? "selected"
                      : entry.item.unread &&
                          !state.notifications.isMuted(entry.item)
                        ? "alert"
                        : undefined,
                })}
                use:floating={props.menuGenerator(entry.item)}
              >
                <a href={state.layout.getLastActiveServerPath(entry.item.id)}>
                  <Avatar
                    size={42}
                    src={entry.item.iconURL}
                    holepunch={
                      entry.item.mentions.length ? "top-right" : "none"
                    }
                    overlay={
                      <>
                        <Show
                          when={
                            entry.item.mentions
                              .length /* as opposed to item.unread */
                          }
                        >
                          <Unreads.Graphic
                            count={entry.item.mentions.length}
                            unread
                          />
                        </Show>
                      </>
                    }
                    fallback={entry.item.name}
                    interactive
                  />
                </a>
              </div>
            </Tooltip>
          )}
        </Draggable>
        <Tooltip placement="right" content={"Create or join a server"}>
          <a
            class={entryContainer()}
            onClick={() => props.onCreateOrJoinServer()}
          >
            <Avatar size={42} fallback={<MdAdd />} />
          </a>
        </Tooltip>
        <Show when={CONFIGURATION.IS_STOAT}>
          <Tooltip placement="right" content={"Find new servers to join"}>
            <a
              href={state.layout.getLastActiveDiscoverPath()}
              class={entryContainer()}
            >
              <Avatar size={42} fallback={<MdExplore />} />
            </a>
          </Tooltip>
        </Show>
      </div>
      <Shadow>
        <div />
      </Shadow>
      <Tooltip placement="right" content="Settings">
        <a
          class={entryContainer()}
          onClick={() => openModal({ type: "settings", config: "user" })}
        >
          <Avatar size={42} fallback={<MdSettings />} interactive />
        </a>
      </Tooltip>
    </ServerListBase>
  );
};

/**
 * Server list container
 */
const ServerListBase = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    width: "var(--layout-width-app-rail)",

    fill: "var(--md-sys-color-on-surface)",
  },
});

/**
 * Container around list of servers
 */
const listBase = cva({
  base: {
    flexGrow: 1,
  },
});

/**
 * Server entries
 */
const entryContainer = cva({
  base: {
    width: "var(--layout-width-app-rail)",
    height: "56px",
    position: "relative",
    display: "grid",
    flexShrink: 0,
    placeItems: "center",

    "&:before": {
      content: "' '",
      position: "absolute",
      width: "12px",
      height: "0px",
      transition: "var(--transitions-fast) all",
      left: "-8px",
      borderRadius: "4px",
      background: "var(--md-sys-color-on-surface)",
    },

    "&:hover:before": {
      height: "16px",
    },
  },
  variants: {
    indicator: {
      selected: {
        "&:before": {
          height: "32px !important",
          background: "var(--brand-primary)",
        },
      },
      alert: {
        "&:before": {
          height: "8px",
          background: "var(--brand-primary)",
        },
      },
    },
  },
});

/**
 * Divider line between two lists
 */
const LineDivider = styled("div", {
  base: {
    height: "1px",
    flexShrink: 0,
    margin: "6px auto",
    width: "calc(100% - 24px)",
    background: "var(--md-sys-color-outline-variant)",
  },
});

/**
 * Shadow at the bottom of the list
 */
const Shadow = styled("div", {
  base: {
    height: 0,
    zIndex: 1,
    position: "relative",

    "& div": {
      height: "12px",
      marginTop: "-12px",
      position: "absolute",
      background:
        "linear-gradient(to bottom, transparent, var(--md-sys-color-surface-container-highest))",
    },
  },
});
