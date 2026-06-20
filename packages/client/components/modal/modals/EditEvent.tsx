// CUSTOM: 予定編集モーダル
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, onMount } from "solid-js";

import { useClient } from "@revolt/client";
import { Column, Dialog, DialogProps, Form2, MenuItem } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import {
  useCalendarApi,
  REPEAT_OPTIONS,
  REMINDER_MINUTES_OPTIONS,
  EDIT_PERMISSIONS,
  RepeatOption,
  ReminderMinutes,
  EditPermission,
} from "../../../src/api/calendar";
import {
  toDatetimeLocalValue,
  REPEAT_LABELS,
  REMINDER_LABELS,
  EDIT_PERMISSION_LABELS,
} from "../../../src/interface/channels/text/calendarColors";

const NO_REMINDER = "none";

/**
 * Modal to edit an existing calendar event
 */
export function EditEventModal(
  props: DialogProps & Modals & { type: "edit_event" },
) {
  const { showError } = useModals();
  const calendarApi = useCalendarApi();
  const client = useClient();
  const myId = client().user!.id;
  const isCreator = () => props.event.createdBy === myId;

  const group = createFormGroup({
    title: createFormControl(props.event.title, { required: true }),
    startAt: createFormControl(toDatetimeLocalValue(new Date(props.event.startAt)), {
      required: true,
    }),
    endAt: createFormControl(toDatetimeLocalValue(new Date(props.event.endAt)), {
      required: true,
    }),
    description: createFormControl(props.event.description ?? ""),
    location: createFormControl(props.event.location ?? ""),
    repeat: createFormControl<RepeatOption>(props.event.repeat),
    editPermission: createFormControl<EditPermission>(props.event.editPermission),
    reminder: createFormControl<string>(NO_REMINDER),
  });

  // CUSTOM: 現在設定済みのリマインダーは別エンドポイントなので非同期で取得してフォームに反映
  onMount(async () => {
    try {
      const minutesBefore = await calendarApi.getReminder(props.serverId, props.event.id);
      if (minutesBefore !== null) {
        group.controls.reminder.setValue(String(minutesBefore));
      }
    } catch (error) {
      console.error("リマインダー設定の取得に失敗しました:", error);
    }
  });

  async function onSubmit() {
    try {
      const startAt = new Date(group.controls.startAt.value);
      const endAt = new Date(group.controls.endAt.value);

      if (endAt < startAt) {
        showError("終了日時は開始日時より後にしてください");
        return;
      }

      await calendarApi.updateEvent(props.serverId, props.event.id, {
        title: group.controls.title.value,
        description: group.controls.description.value || undefined,
        location: group.controls.location.value || undefined,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        repeat: group.controls.repeat.value,
        // CUSTOM: 編集権限の変更は作成者のみ送信する(バックエンドも作成者以外を403にするが、
        // 作成者でない場合はそもそも値を変えていないので送らなくてよい)
        ...(isCreator() ? { editPermission: group.controls.editPermission.value } : {}),
      });

      if (group.controls.reminder.value === NO_REMINDER) {
        await calendarApi.deleteReminder(props.serverId, props.event.id);
      } else {
        await calendarApi.setReminder(
          props.serverId,
          props.event.id,
          Number(group.controls.reminder.value) as ReminderMinutes,
        );
      }

      props.onUpdated?.();
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
      title="予定を編集"
      actions={[
        { text: "キャンセル" },
        {
          text: "保存",
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

          <Form2.Select label="繰り返し" control={group.controls.repeat}>
            <For each={REPEAT_OPTIONS}>
              {(option) => <MenuItem value={option}>{REPEAT_LABELS[option]}</MenuItem>}
            </For>
          </Form2.Select>

          {/* CUSTOM: 編集権限自体の変更は作成者のみ(他者は閲覧のみ、変更不可) */}
          <Show
            when={isCreator()}
            fallback={
              <div style={{ "font-size": "12px", color: "var(--md-sys-color-on-surface-variant)" }}>
                他のユーザーの編集: {EDIT_PERMISSION_LABELS[group.controls.editPermission.value]}
                (作成者のみ変更可能)
              </div>
            }
          >
            <Form2.Select label="他のユーザーの編集を許可" control={group.controls.editPermission}>
              <For each={EDIT_PERMISSIONS}>
                {(option) => <MenuItem value={option}>{EDIT_PERMISSION_LABELS[option]}</MenuItem>}
              </For>
            </Form2.Select>
          </Show>

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
