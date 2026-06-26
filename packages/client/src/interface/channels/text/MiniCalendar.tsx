// CUSTOM: アルバムのカレンダー検索用の軽量な自作ミニカレンダー。CalendarExplorer.tsxの
// FullCalendarは月/週/日表示・予定描画など機能過多で検索フォーム(縦幅1/4程度)には重すぎるため、
// 日付選択とカテゴリ色のドット表示だけを行うシンプルな月グリッドをここで実装する。
import { For, createMemo, createSignal, onMount } from "solid-js";
import { styled } from "styled-system/jsx";

import { IconButton } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { toDateInputValue } from "./albumLabels";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export interface MiniCalendarProps {
  selectedDate?: string;
  onSelectDate: (date: string) => void;
  colorsByDate: Record<string, string[]>;
  /** 表示中の月が変わるたびに、その月をカバーする日付範囲を通知する(色情報の再取得用) */
  onVisibleRangeChange: (from: string, to: string) => void;
}

/**
 * 日付選択用の軽量な月表示カレンダー
 */
export function MiniCalendar(props: MiniCalendarProps) {
  const initialMonth = props.selectedDate ? new Date(props.selectedDate) : new Date();
  const [visibleMonth, setVisibleMonth] = createSignal(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  );

  function notifyRangeChange(month: Date) {
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    props.onVisibleRangeChange(toDateInputValue(from), toDateInputValue(to));
  }

  onMount(() => notifyRangeChange(visibleMonth()));

  function goToPreviousMonth() {
    const next = new Date(visibleMonth().getFullYear(), visibleMonth().getMonth() - 1, 1);
    setVisibleMonth(next);
    notifyRangeChange(next);
  }

  function goToNextMonth() {
    const next = new Date(visibleMonth().getFullYear(), visibleMonth().getMonth() + 1, 1);
    setVisibleMonth(next);
    notifyRangeChange(next);
  }

  // CUSTOM: 月の先頭(日曜始まり)から末尾までを6週分(42日)のグリッドにする。
  // 前後月の日付も薄く表示してグリッドの形を保つ
  const days = createMemo(() => {
    const month = visibleMonth();
    const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return {
        date,
        dateStr: toDateInputValue(date),
        inCurrentMonth: date.getMonth() === month.getMonth(),
      };
    });
  });

  return (
    <Container>
      <Header>
        <IconButton size="xs" variant="standard" onPress={goToPreviousMonth}>
          <Symbol size={18}>chevron_left</Symbol>
        </IconButton>
        <MonthLabel>
          {visibleMonth().getFullYear()}年{visibleMonth().getMonth() + 1}月
        </MonthLabel>
        <IconButton size="xs" variant="standard" onPress={goToNextMonth}>
          <Symbol size={18}>chevron_right</Symbol>
        </IconButton>
      </Header>
      <WeekdayRow>
        <For each={WEEKDAY_LABELS}>{(label) => <WeekdayCell>{label}</WeekdayCell>}</For>
      </WeekdayRow>
      <Grid>
        <For each={days()}>
          {(day) => (
            <DayCell
              type="button"
              data-selected={props.selectedDate === day.dateStr}
              data-faded={!day.inCurrentMonth}
              onClick={() => props.onSelectDate(day.dateStr)}
            >
              <DayNumber>{day.date.getDate()}</DayNumber>
              <Dots>
                <For each={(props.colorsByDate[day.dateStr] ?? []).slice(0, 4)}>
                  {(color) => <Dot style={{ background: color }} />}
                </For>
              </Dots>
            </DayCell>
          )}
        </For>
      </Grid>
    </Container>
  );
}

const Container = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
  },
});

const Header = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const MonthLabel = styled("div", {
  base: {
    fontSize: "13px",
    fontWeight: "bold",
  },
});

const WeekdayRow = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
  },
});

const WeekdayCell = styled("div", {
  base: {
    fontSize: "11px",
    textAlign: "center",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gridAutoRows: "minmax(0, 1fr)",
    gap: "2px",
    flex: "1 1 auto",
    minHeight: 0,
  },
});

const DayCell = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1px",
    border: "none",
    background: "transparent",
    borderRadius: "var(--borderRadius-sm)",
    cursor: "pointer",
    padding: "2px 0",
    color: "inherit",
    font: "inherit",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },

    "&[data-faded='true']": {
      opacity: 0.35,
    },

    "&[data-selected='true']": {
      background: "var(--md-sys-color-primary-container)",
    },
  },
});

const DayNumber = styled("span", {
  base: {
    fontSize: "12px",
  },
});

const Dots = styled("div", {
  base: {
    display: "flex",
    gap: "2px",
    height: "6px",
  },
});

const Dot = styled("span", {
  base: {
    display: "inline-block",
    width: "5px",
    height: "5px",
    borderRadius: "50%",
  },
});
