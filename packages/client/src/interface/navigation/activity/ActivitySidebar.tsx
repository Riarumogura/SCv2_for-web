import { For, Show, createMemo } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useState } from "@revolt/state";
import { Avatar, MenuButton, OverflowingText, typography } from "@revolt/ui";

import { SidebarBase } from "../channels/common";

/**
 * Display a simple cross-server feed of unread mentions.
 *
 * This is the Phase 1 "simple" implementation described in the app-menu
 * redesign: a realtime, non-persisted aggregate of `server.mentions.length`
 * across all servers. Read-state management and a richer notification
 * center are out of scope until Phase 3.
 */
export const ActivitySidebar = () => {
  const client = useClient();
  const state = useState();

  const serversWithMentions = createMemo(() =>
    state.ordering
      .orderedServers(client())
      .filter((server) => server.mentions.length > 0),
  );

  return (
    <SidebarBase>
      <div use:invisibleScrollable>
        <List>
          <SidebarTitle>
            <Trans>Activity</Trans>
          </SidebarTitle>

          <Show
            when={serversWithMentions().length}
            fallback={
              <EmptyState>
                <Trans>You&apos;re all caught up.</Trans>
              </EmptyState>
            }
          >
            <For each={serversWithMentions()}>
              {(server) => (
                <a href={state.layout.getLastActiveServerPath(server.id)}>
                  <MenuButton
                    size="normal"
                    icon={
                      <Avatar
                        size={32}
                        src={server.iconURL}
                        fallback={server.name}
                      />
                    }
                    alert={server.mentions.length}
                  >
                    <ButtonTitle>
                      <OverflowingText>{server.name}</OverflowingText>
                    </ButtonTitle>
                  </MenuButton>
                </a>
              )}
            </For>
          </Show>
        </List>
      </div>
    </SidebarBase>
  );
};

/**
 * Sidebar title
 */
const SidebarTitle = styled("p", {
  base: {
    paddingBlock: "calc(var(--gap-md) + 15px)",
    paddingInline: "var(--gap-md)",

    ...typography.raw({ class: "title" }),
  },
});

/**
 * Button title
 */
const ButtonTitle = styled("div", {
  base: {
    gap: "var(--gap-md)",
    height: "100%",
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },
});

const EmptyState = styled("p", {
  base: {
    padding: "var(--gap-md)",
    color: "var(--md-sys-color-outline)",

    ...typography.raw({ class: "label", size: "small" }),
  },
});

/**
 * Inner scrollable list
 * We fix the width in order to prevent scrollbar from moving stuff around
 */
const List = styled("div", {
  base: {
    paddingLeft: "var(--gap-md)",
    width: "var(--layout-width-channel-sidebar)",
  },
});
