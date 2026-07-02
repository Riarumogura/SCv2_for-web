import { Match, Show, Switch, createMemo } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useLocation, useNavigate } from "@revolt/routing";
import { MenuButton, typography } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { SidebarBase } from "./common";

interface Props {
  /**
   * Current channel ID
   */
  channelId?: string;

  /**
   * Open the saved notes channel
   */
  openSavedNotes: (
    navigate?: ReturnType<typeof useNavigate>,
  ) => string | undefined;
}

/**
 * Display home navigation (Friends / Saved Notes)
 */
export const HomeSidebar = (props: Props) => {
  const client = useClient();
  const navigate = useNavigate();
  const location = useLocation();

  const savedNotesChannelId = createMemo(() => props.openSavedNotes());

  const pendingRequests = createMemo(() => {
    return client().users.filter((user) => user.relationship === "Incoming")
      .length;
  });

  return (
    <SidebarBase>
      <div use:invisibleScrollable>
        <List>
          <SidebarTitle>
            <Trans>Home</Trans>
          </SidebarTitle>

          <a href="/app">
            <MenuButton
              size="normal"
              icon={<Symbol>home</Symbol>}
              attention={location.pathname === "/app" ? "selected" : "normal"}
            >
              <ButtonTitle>
                <Trans>Home</Trans>
              </ButtonTitle>
            </MenuButton>
          </a>

          <div style={{ height: "5px" }} />

          <a href="/friends">
            <MenuButton
              size="normal"
              icon={<Symbol>group</Symbol>}
              attention={
                location.pathname === "/friends" ? "selected" : "normal"
              }
            >
              <ButtonTitle>
                <Trans>Friends</Trans>
                <div style={{ flex: "1 1 auto" }} />
                <Show when={pendingRequests()}>
                  <PendingBadge>{pendingRequests()} requests</PendingBadge>
                </Show>
              </ButtonTitle>
            </MenuButton>
          </a>

          <div style={{ height: "5px" }} />

          <Switch
            fallback={
              <MenuButton
                size="normal"
                attention={"normal"}
                icon={<Symbol>note_stack</Symbol>}
                onClick={() => props.openSavedNotes(navigate)}
              >
                <ButtonTitle>
                  <Trans>Saved Notes</Trans>
                </ButtonTitle>
              </MenuButton>
            }
          >
            <Match when={savedNotesChannelId()}>
              <a href={`/channel/${savedNotesChannelId()}`}>
                <MenuButton
                  size="normal"
                  icon={<Symbol>note_stack</Symbol>}
                  attention={
                    props.channelId && savedNotesChannelId() === props.channelId
                      ? "selected"
                      : "normal"
                  }
                >
                  <ButtonTitle>
                    <Trans>Saved Notes</Trans>
                  </ButtonTitle>
                </MenuButton>
              </a>
            </Match>
          </Switch>
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
  },
});

const PendingBadge = styled("div", {
  base: {
    ...typography.raw({ class: "label", size: "small" }),
    padding: "var(--gap-sm) var(--gap-md)",
    color: "var(--md-sys-color-on-error)",
    background: "var(--md-sys-color-error)",
    borderRadius: "var(--borderRadius-md)",
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
