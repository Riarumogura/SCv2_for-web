// CUSTOM: 予定作成モーダル
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, createResource } from "solid-js";

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
 * Modal to create a new calendar event
 */
export function CreateEventModal(
  props: DialogProps & Modals & { type: "create_event" },
) {
  const { showError } = useModals();
  const calendarApi = useCalendarApi();
  const client = useClient();
  const myId = client().user!.id;

  // CUSTOM: 予定の色は作成者のトレードカラーから自動的に決まるため、
  // 未設定のユーザーには先に設定してもらう必要がある(サイドバーの歯車アイコンから設定)
  const [tradeColors] = createResource(() => calendarApi.getTradeColors(props.serverId));
  const myTradeColor = () => tradeColors()?.find((a) => a.userId === myId)?.color ?? null;
  const hasTradeColor = () => tradeColors() !== undefined && myTradeColor() !== null;

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
    repeat: createFormControl<RepeatOption>("none"),
    editPermission: createFormControl<EditPermission>("creator_only"),
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
        repeat: group.controls.repeat.value,
        editPermission: group.controls.editPermission.value,
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
          isDisabled: !Form2.canSubmit(group) || !hasTradeColor(),
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Column>
          <Show when={tradeColors() !== undefined && !hasTradeColor()}>
            <div style={{ color: "var(--md-sys-color-error)", "font-size": "13px" }}>
              予定を作成する前にトレードカラーを設定してください(サイドバーの「カレンダー」横の歯車アイコンから設定できます)
            </div>
          </Show>

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

          <Form2.Select label="繰り返し" control={group.controls.repeat}>
            <For each={REPEAT_OPTIONS}>
              {(option) => <MenuItem value={option}>{REPEAT_LABELS[option]}</MenuItem>}
            </For>
          </Form2.Select>

          <Form2.Select label="他のユーザーの編集を許可" control={group.controls.editPermission}>
            <For each={EDIT_PERMISSIONS}>
              {(option) => <MenuItem value={option}>{EDIT_PERMISSION_LABELS[option]}</MenuItem>}
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
