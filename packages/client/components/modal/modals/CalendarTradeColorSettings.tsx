// CUSTOM: 個人のトレードカレンダー色設定モーダル
// lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうので
// (他のカレンダーモーダルと同様の理由)日本語をハードコードしている。
import { For, Show, createResource, createSignal } from "solid-js";

import { useClient } from "@revolt/client";
import { Column, Dialog, DialogProps } from "@revolt/ui";
import { styled } from "styled-system/jsx";

import { useModals } from "..";
import { Modals } from "../types";
import { useCalendarApi, TRADE_COLORS, TradeColor } from "../../../src/api/calendar";
import { TRADE_COLOR_LABELS, TRADE_COLOR_HEX } from "../../../src/interface/channels/text/calendarColors";

/**
 * Modal to set the current user's personal trade color for the shared calendar
 */
export function CalendarTradeColorSettingsModal(
  props: DialogProps & Modals & { type: "calendar_trade_color_settings" },
) {
  const { showError } = useModals();
  const calendarApi = useCalendarApi();
  const client = useClient();
  const myId = client().user!.id;

  const [assignments, { refetch }] = createResource(() => calendarApi.getTradeColors(props.serverId));
  const [saving, setSaving] = createSignal<TradeColor | null>(null);

  const myColor = () => assignments()?.find((a) => a.userId === myId)?.color ?? null;
  const takenByOthers = () =>
    new Set(assignments()?.filter((a) => a.userId !== myId).map((a) => a.color) ?? []);
  // CUSTOM: 「(使用中)」ではなく使用しているユーザー名を表示するため、
  // 色→ユーザー名のマップを作る(既にメンバーとして読み込まれているユーザーのみ解決可能)
  const takenByUsername = (color: TradeColor) => {
    const taken = assignments()?.find((a) => a.color === color && a.userId !== myId);
    if (!taken) return null;
    return client().users.get(taken.userId)?.username ?? taken.userId;
  };

  async function selectColor(color: TradeColor) {
    if (color === myColor() || takenByOthers().has(color)) return;

    try {
      setSaving(color);
      await calendarApi.setMyTradeColor(props.serverId, color);
      await refetch();
      props.onChanged?.();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title="トレードカラー設定"
      actions={[{ text: "閉じる" }]}
    >
      <Column>
        <span>
          自分の予定を識別するための色を選んでください。他のユーザーが使用中の色は選べません。
        </span>

        <ColorGrid>
          <For each={TRADE_COLORS}>
            {(color) => {
              const isMine = () => myColor() === color;
              const isTaken = () => takenByOthers().has(color);
              return (
                <ColorSwatch
                  type="button"
                  disabled={isTaken() || saving() !== null}
                  selected={isMine()}
                  style={{ "background-color": TRADE_COLOR_HEX[color] }}
                  onClick={() => selectColor(color)}
                  title={TRADE_COLOR_LABELS[color]}
                >
                  <Show when={isMine()}>✓</Show>
                </ColorSwatch>
              );
            }}
          </For>
        </ColorGrid>

        <For each={TRADE_COLORS}>
          {(color) => (
            <SwatchLegend>
              <LegendDot style={{ "background-color": TRADE_COLOR_HEX[color] }} />
              <span>
                {TRADE_COLOR_LABELS[color]}
                {takenByOthers().has(color)
                  ? `(${takenByUsername(color)})`
                  : myColor() === color
                    ? "(自分)"
                    : ""}
              </span>
            </SwatchLegend>
          )}
        </For>
      </Column>
    </Dialog>
  );
}

const ColorGrid = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-md)",
    padding: "var(--gap-md) 0",
  },
});

const ColorSwatch = styled("button", {
  base: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    border: "2px solid transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",

    "&:disabled": {
      opacity: 0.3,
      cursor: "not-allowed",
    },
  },
  variants: {
    selected: {
      true: {
        borderColor: "var(--md-sys-color-on-surface)",
      },
    },
  },
});

const SwatchLegend = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const LegendDot = styled("span", {
  base: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
  },
});
