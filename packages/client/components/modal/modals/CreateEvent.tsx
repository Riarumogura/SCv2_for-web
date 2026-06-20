// CUSTOM: 予定作成モーダル
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { createFormControl, createFormGroup } from "solid-forms";
import { For } from "solid-js";

import { Column, Dialog, DialogProps, Form2, MenuItem } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import {
  useCalendarApi,
  EVENT_COLORS,
  REPEAT_OPTIONS,
  REMINDER_MINUTES_OPTIONS,
  EventColor,
  RepeatOption,
  ReminderMinutes,
} from "../../../src/api/calendar";
import { toDatetimeLocalValue, EVENT_COLOR_LABELS, REPEAT_LABELS, REMINDER_LABELS } from "../../../src/interface/channels/text/calendarColors";

const NO_REMINDER = "none";

/**
 * Modal to create a new calendar event
 */
export function CreateEventModal(
  props: DialogProps & Modals & { type: "create_event" },
) {
  const { showError } = useModals();
  const calendarApi = useCalendarApi();

  const initialStart = props.initialDate
    ? new Date(props.initialDate)
    : new Date();
  const initialEnd = new Date(initialStart.getTime() + 60 * 60 * 1000);

  const group = createFormGroup({
    title: createFormControl("", { required: true }),
    startAt: createFormControl(toDatetimeLocalValue(initialStart), {
      required: true,
    }),
    endAt: createFormControl(toDatetimeLocalValue(initialEnd), {
      required: true,
    }),
    description: createFormControl(""),
    location: createFormControl(""),
    color: createFormControl<EventColor>("blue"),
    repeat: createFormControl<RepeatOption>("none"),
    reminder: createFormControl<string>(NO_REMINDER),
  });

  async function onSubmit() {
    try {
      const startAt = new Date(group.controls.startAt.value);
      const endAt = new Date(group.controls.endAt.value);

      if (endAt < startAt) {
        showError("終了日時は開始日時より後にしてください");
        return;
      }

      const created = await calendarApi.createEvent(props.serverId, {
        title: group.controls.title.value,
        description: group.controls.description.value || undefined,
        location: group.controls.location.value || undefined,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        color: group.controls.color.value,
        repeat: group.controls.repeat.value,
      });

      if (group.controls.reminder.value !== NO_REMINDER) {
        await calendarApi.setReminder(
          props.serverId,
          created.id,
          Number(group.controls.reminder.value) as ReminderMinutes,
        );
      }

      props.onCreated?.();
      props.onClose();
    } catch (error) {
      showError(error);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title="予定を作成"
      actions={[
        { text: "キャンセル" },
        {
          text: "作成",
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !Form2.canSubmit(group),
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Column>
          <Form2.TextField
            minlength={1}
            maxlength={200}
            counter
            name="title"
            control={group.controls.title}
            label="タイトル"
            placeholder="例: チームミーティング"
          />

          <Form2.TextField
            type="datetime-local"
            name="startAt"
            control={group.controls.startAt}
            label="開始日時"
          />

          <Form2.TextField
            type="datetime-local"
            name="endAt"
            control={group.controls.endAt}
            label="終了日時"
          />

          <Form2.TextField
            maxlength={200}
            name="location"
            control={group.controls.location}
            label="場所(任意)"
          />

          <Form2.TextField
            maxlength={2000}
            name="description"
            control={group.controls.description}
            label="説明(任意)"
          />

          <Form2.Select label="カラー" control={group.controls.color}>
            <For each={EVENT_COLORS}>
              {(color) => <MenuItem value={color}>{EVENT_COLOR_LABELS[color]}</MenuItem>}
            </For>
          </Form2.Select>

          <Form2.Select label="繰り返し" control={group.controls.repeat}>
            <For each={REPEAT_OPTIONS}>
              {(option) => <MenuItem value={option}>{REPEAT_LABELS[option]}</MenuItem>}
            </For>
          </Form2.Select>

          <Form2.Select label="リマインダー(アプリ内通知)" control={group.controls.reminder}>
            <MenuItem value={NO_REMINDER}>通知しない</MenuItem>
            <For each={REMINDER_MINUTES_OPTIONS}>
              {(minutes) => (
                <MenuItem value={String(minutes)}>{REMINDER_LABELS[minutes]}</MenuItem>
              )}
            </For>
          </Form2.Select>
        </Column>
      </form>
    </Dialog>
  );
}
