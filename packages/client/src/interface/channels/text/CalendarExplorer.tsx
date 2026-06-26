// CUSTOM: 共有カレンダーコンポーネント
// FullCalendarにはSolidJS用の公式アダプタが存在しないため、@fullcalendar/coreの
// CalendarクラスをonMount/onCleanupで直接インスタンス化する命令的な統合方式を採る。
import { onCleanup, onMount } from "solid-js";
import { styled } from "styled-system/jsx";

import { Calendar, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { IconButton, Tooltip, useSnackbar } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useCalendarApi, CalendarEvent } from "../../../api/calendar";
import { EVENT_COLOR_HEX, REMINDER_LABELS } from "./calendarColors";

// CUSTOM: Web Push未対応のため、パネル表示中のみ定期ポーリングでアプリ内通知を出す
const REMINDER_POLL_INTERVAL_MS = 30_000;

interface CalendarExplorerProps {
  serverId: string;
}

/**
 * 共有カレンダーコンポーネント(月表示・週表示・日表示)
 */
export function CalendarExplorer(props: CalendarExplorerProps) {
  const calendarApi = useCalendarApi();
  const { openModal } = useModals();
  const snackbar = useSnackbar();
  const client = useClient();
  const myId = client().user!.id;

  // CUSTOM: editPermissionが'creator_only'の予定は作成者本人しか編集・削除できない
  const canEdit = (event: CalendarEvent) =>
    event.createdBy === myId || event.editPermission === "anyone";

  let containerRef: HTMLDivElement | undefined;
  let calendar: Calendar | undefined;
  let reminderPollInterval: ReturnType<typeof setInterval> | undefined;

  // CUSTOM: eventClick/eventContentで渡されるのはFullCalendar用に変換した
  // 軽量なEventInputのため、元のCalendarEvent(色・繰り返し等)をidで引けるようにしておく
  const eventsById = new Map<string, CalendarEvent>();

  const fetchEvents = async (start: Date, end: Date) => {
    try {
      const events = await calendarApi.getEvents(props.serverId, start, end);
      eventsById.clear();
      events.forEach((event) => eventsById.set(event.id, event));

      return events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startAt,
        end: event.endAt,
        backgroundColor: EVENT_COLOR_HEX[event.color],
        borderColor: EVENT_COLOR_HEX[event.color],
      }));
    } catch (error) {
      console.error("予定一覧の取得に失敗しました:", error);
      return [];
    }
  };

  const refresh = () => calendar?.refetchEvents();

  const openCreateModal = (initialDate?: string) =>
    openModal({
      type: "create_event",
      serverId: props.serverId,
      initialDate,
      onCreated: refresh,
    });

  const openEditModal = (event: CalendarEvent) =>
    openModal({
      type: "edit_event",
      serverId: props.serverId,
      event,
      onUpdated: refresh,
    });

  const openDeleteModal = (event: CalendarEvent) =>
    openModal({
      type: "delete_event",
      serverId: props.serverId,
      eventId: event.id,
      eventTitle: event.title,
      onDeleted: refresh,
    });

  onMount(() => {
    if (!containerRef) return;

    calendar = new Calendar(containerRef, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: "dayGridMonth",
      locale: "ja",
      height: "100%",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      buttonText: {
        today: "今日",
        month: "月",
        week: "週",
        day: "日",
      },
      events: (
        info: EventSourceFuncArg,
        successCallback: (events: EventInput[]) => void,
        failureCallback: (error: Error) => void,
      ) => {
        fetchEvents(info.start, info.end).then(successCallback, failureCallback);
      },
      dateClick: (info) => openCreateModal(info.dateStr),
      eventClick: (info) => {
        const event = eventsById.get(info.event.id);
        if (!event) return;
        if (!canEdit(event)) {
          snackbar.show({
            message: "この予定は作成者のみ編集できます",
            autoCloseDelay: 5000,
            closeable: true,
          });
          return;
        }
        openEditModal(event);
      },
      eventContent: (arg) => {
        const container = document.createElement("div");
        container.className = "sc-calendar-event-content";

        const title = document.createElement("span");
        title.className = "sc-calendar-event-title";
        title.textContent = arg.event.title;
        container.appendChild(title);

        const event = eventsById.get(arg.event.id);
        if (event && canEdit(event)) {
          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "sc-calendar-event-delete";
          deleteButton.textContent = "×";
          deleteButton.title = "削除";
          deleteButton.addEventListener("click", (clickEvent) => {
            clickEvent.stopPropagation();
            const target = eventsById.get(arg.event.id);
            if (target) openDeleteModal(target);
          });
          container.appendChild(deleteButton);
        }

        return { domNodes: [container] };
      },
    });

    calendar.render();

    const pollDueReminders = async () => {
      try {
        const due = await calendarApi.getDueReminders(props.serverId);
        for (const { event, minutesBefore } of due) {
          snackbar.show({
            message: `予定「${event.title}」が${REMINDER_LABELS[minutesBefore]}の通知です`,
            autoCloseDelay: 8000,
            closeable: true,
          });
        }
      } catch (error) {
        console.error("リマインダーの確認に失敗しました:", error);
      }
    };

    pollDueReminders();
    reminderPollInterval = setInterval(pollDueReminders, REMINDER_POLL_INTERVAL_MS);
  });

  onCleanup(() => {
    calendar?.destroy();
    if (reminderPollInterval) clearInterval(reminderPollInterval);
  });

  return (
    <Container>
      <Toolbar>
        <Tooltip content="予定を作成" placement="top">
          <IconButton
            size="xs"
            variant="standard"
            onPress={() => openCreateModal()}
          >
            <Symbol size={16}>add</Symbol>
          </IconButton>
        </Tooltip>
      </Toolbar>
      <CalendarMount ref={containerRef} />
    </Container>
  );
}

const Container = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minHeight: 0,
  },
});

const Toolbar = styled("div", {
  base: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "var(--gap-xs) var(--gap-sm)",
  },
});

// CUSTOM: FullCalendarが自身でDOMを書き換えるマウント先。Solidの仮想DOM管理対象外にするため
// flex: 1で残り領域を占有させるだけのシンプルなコンテナにしている。イベント行のレイアウト
// (タイトル+削除ボタン)はFullCalendarの.fc-event内に挿入されるためグローバルCSSで定義する。
const CalendarMount = styled("div", {
  base: {
    flex: "1 1 auto",
    minHeight: 0,
    padding: "var(--gap-sm)",

    "& .sc-calendar-event-content": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "4px",
      width: "100%",
      overflow: "hidden",
    },
    "& .sc-calendar-event-title": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& .sc-calendar-event-delete": {
      flexShrink: 0,
      border: "none",
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      fontSize: "12px",
      lineHeight: 1,
      padding: 0,
    },
  },
});
