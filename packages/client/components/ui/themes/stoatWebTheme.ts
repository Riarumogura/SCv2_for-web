import { SelectedTheme } from "@revolt/state/stores/Theme";

/**
 * Generate Stoat for Web variables
 * @param theme Theme
 * @returns CSS Variables
 */
export function createStoatWebVariables(theme: SelectedTheme) {
  return {
    // helper variables
    "--unset-fg": "red",
    "--unset-bg": "linear-gradient(to right, red, blue)",

    // message size
    "--message-size": `${theme.messageSize}px`,
    "--message-group-spacing": `${theme.messageGroupSpacing}px`,

    // emoji size
    "--emoji-size": "1.4em",
    "--emoji-size-medium": "48px",
    "--emoji-size-large": "96px",

    // effects
    "--effects-blur-md": theme.blur ? "blur(20px)" : "unset",
    "--effects-invert-black": theme.darkMode ? "invert(100%)" : "invert(0%)",
    "--effects-invert-light": theme.darkMode ? "invert(0%)" : "invert(1000%)",

    // transitions
    "--transitions-fast": ".1s ease-in-out",
    "--transitions-medium": ".2s ease",

    // brand (presence)
    "--brand-presence-online": "#3ABF7E",
    "--brand-presence-idle": "#F39F00",
    "--brand-presence-busy": "#F84848",
    "--brand-presence-focus": "#4799F0",
    "--brand-presence-invisible": "#A5A5A5",

    // brand (identity — see .company/engineering/docs/design.md)
    "--brand-primary": "#5865F2",
    "--brand-on-primary": "#FFFFFF",
    "--brand-green": "#35ED7E",
    "--brand-on-green": "#000000",
    "--brand-magenta": "#EC48BD",
    "--brand-on-magenta": "#FFFFFF",
    "--brand-link": "#00B0F4",
    "--brand-canvas": "#0A0D3A",
    "--brand-surface-indigo": "#1E2353",
    "--brand-surface-onyx": "#23272A",
    "--brand-surface-black": "#000000",
    "--brand-gradient-mesh":
      "linear-gradient(120deg, #0A0D3A 0%, #5865F2 25%, #4A2E8F 50%, #EC48BD 75%, #0A0D3A 100%)",

    // font
    "--fonts-primary": `"${theme.interfaceFont}", "Inter", sans-serif`,
    "--fonts-monospace": `"${theme.monospaceFont}", "Jetbrains Mono", sans-serif`,

    // load constants
    ...reduceWithPrefix(themeConstants.borderRadius, "--borderRadius-"),
    ...reduceWithPrefix(themeConstants.gap, "--gap-"),
    ...reduceWithPrefix(themeConstants.layout, "--layout-"),
  };
}

/**
 * Add prefix to all keys in an object
 * @param object Object
 * @param prefix Prefix
 * @returns New object
 */
function reduceWithPrefix(object: Record<string, string>, prefix: string) {
  return Object.entries(object).reduce(
    (d, [k, v]) => ({ ...d, [`${prefix}${k}`]: v }),
    {},
  );
}

const themeConstants = {
  borderRadius: {
    // Material 3 Expressive ten-level shape scale
    // https://m3.material.io/styles/shape/corner-radius-scale
    // xs/sm/md nudged to match the brand shape scale (see design.md)
    none: "0px",
    xs: "6px",
    sm: "12px",
    md: "14px",
    lg: "16px",
    li: "20px",
    xl: "28px",
    xli: "32px",
    xxl: "48px",
    jumbo: "120px",
    full: "calc(infinity * 1px)",
    circle: "100%",
  },
  /**
   * @deprecated decide this at a component level
   */
  gap: {
    none: "0",
    xxs: "1px",
    xs: "2px",
    s: "6px",
    sm: "4px",
    md: "8px",
    l: "12px",
    lg: "15px",
    x: "28px",
    xl: "32px",
    xxl: "64px",
  },
  layout: {
    "width-channel-sidebar": "248px",
    "width-app-rail": "56px",
    "width-user-context-menu-truncate": "300px",
    "height-message-box": "32vh",
  },
};
