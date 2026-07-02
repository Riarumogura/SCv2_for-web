import { BiLogosGithub } from "solid-icons/bi";
import { JSX } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";
import { defineKeyframes } from "@pandacss/dev";
import { styled } from "styled-system/jsx";

import { Titlebar } from "@revolt/app/interface/desktop/Titlebar";
import { useState } from "@revolt/state";
import { IconButton, iconSize } from "@revolt/ui";

import MdDarkMode from "@material-design-icons/svg/filled/dark_mode.svg?component-solid";

import background from "./background.jpg";
import { FlowBase } from "./flows/Flow";
import bluesky from "./flows/bluesky.svg";

/**
 * Slow-moving brand mesh — the app's one deliberate "marketing moment".
 * See .company/engineering/docs/design.md for the reasoning behind
 * scoping this treatment to the auth page only.
 */
const meshShift = defineKeyframes({
  shift: {
    "0%": { backgroundPosition: "0% 50%" },
    "50%": { backgroundPosition: "100% 50%" },
    "100%": { backgroundPosition: "0% 50%" },
  },
});

/**
 * Authentication page layout
 */
const Base = styled("div", {
  base: {
    width: "100%",
    height: "100%",
    padding: "40px 35px",

    userSelect: "none",
    overflowY: "scroll",

    color: "#ffffff",
    background: "var(--brand-gradient-mesh)",
    backgroundSize: "400% 400%",
    animationName: meshShift,
    animationDuration: "18s",
    animationTimingFunction: "ease",
    animationIterationCount: "infinite",

    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",

    mdDown: {
      padding: "30px 20px",
    },
  },
});

/**
 * Top and bottom navigation bars
 */
const Nav = styled("div", {
  base: {
    height: "32px",
    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",

    textDecoration: "none",
  },
});

/**
 * Navigation items
 */
const NavItems = styled("div", {
  base: {
    gap: "10px",
    display: "flex",
    alignItems: "center",

    fontSize: "0.9em",
  },
  variants: {
    variant: {
      default: {},
      stack: {
        md: {
          flexDirection: "column",
        },
      },
      hide: {
        md: {
          display: "none",
        },
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

/**
 * Link with an icon inside
 */
const LinkWithIcon = styled("a", {
  base: { height: "24px" },
});

/**
 * Middot-like bullet
 */
const Bullet = styled("div", {
  base: {
    height: "5px",
    width: "5px",
    background: "rgba(255, 255, 255, 0.6)",
    borderRadius: "50%",

    md: {
      display: "none",
    },
  },
});

/**
 * Authentication page
 */
export function AuthPage(props: { children: JSX.Element }) {
  const state = useState();

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
      }}
    >
      <Titlebar />
      <Base
        style={{ "--url": `url('${background}')` }}
        css={{ scrollbar: "hidden" }}
      >
        <Nav>
          <div />
          <IconButton
            variant="tonal"
            onPress={() =>
              state.theme.setMode(
                state.theme.activeTheme.darkMode ? "light" : "dark",
              )
            }
          >
            <MdDarkMode {...iconSize("24px")} />
          </IconButton>
        </Nav>
        <FlowBase>{props.children}</FlowBase>
        <Nav>
          <NavItems variant="stack">
            <NavItems>
              <LinkWithIcon href="https://github.com/stoatchat" target="_blank">
                <BiLogosGithub size={24} />
              </LinkWithIcon>
              <LinkWithIcon
                href="https://bsky.app/profile/stoat.chat"
                target="_blank"
              >
                <img
                  src={bluesky}
                  style={{ height: "22px", "padding-top": "3px" }}
                />
              </LinkWithIcon>
            </NavItems>
          </NavItems>
          <NavItems variant="hide">
            <Trans>Image by {"@fakurian"}</Trans>
            <Bullet />
            <a href="https://unsplash.com/" target="_blank" rel="noreferrer">
              unsplash.com
            </a>
          </NavItems>
        </Nav>
      </Base>
    </div>
  );
}
