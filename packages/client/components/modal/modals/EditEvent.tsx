// CUSTOM: 予定編集モーダル
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, createSignal, onMount } from "solid-js";
import { styled } from "styled-system/jsx";

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

  // CUSTOM: 該当するメンバーの選択(作成者は常に含まれるため一覧には出さない)。
  // 1人(作成者のみ)ならトレードカラー表示、2人以上ならグレーの共有予定になる。
  const otherMembers = () =>
    client().serverMembers.filter(
      (member) => member.id.server === props.serverId && member.id.user !== myId,
    );
  const [selectedMemberIds, setSelectedMemberIds] = createSignal<Set<string>>(
    new Set(props.event.memberIds.filter((id) => id !== props.event.createdBy)),
  );

  function toggleMember(userId: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

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
        memberIds: Array.from(selectedMemberIds()),
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
      {/* CUSTOM: IME変換確定のEnterで暗黙的にフォームがsubmitされ、入力途中で
          更新されてしまう不具合の対策。送信は実際にはDialogのアクション
          ボタンが直接onSubmit()を呼ぶため、フォーム自体のEnter submitは不要 */}
      <form onSubmit={submit} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}>
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

          {/* CUSTOM: 該当するメンバー。2人以上選んだ場合は予定の色がグレーになる */}
          <div>
            <MemberPickerLabel>該当するメンバー</MemberPickerLabel>
            <MemberPickerList>
              <MemberPickerRow>
                <input type="checkbox" checked disabled />
                <span>自分</span>
              </MemberPickerRow>
              <For each={otherMembers()}>
                {(member) => (
                  <MemberPickerRow>
                    <input
                      type="checkbox"
                      checked={selectedMemberIds().has(member.id.user)}
                      onChange={() => toggleMember(member.id.user)}
                    />
                    <span>{member.user?.username ?? member.id.user}</span>
                  </MemberPickerRow>
                )}
              </For>
            </MemberPickerList>
          </div>

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

const MemberPickerLabel = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    marginBottom: "var(--gap-xs)",
  },
});

const MemberPickerList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    maxHeight: "160px",
    overflowY: "auto",
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: "var(--borderRadius-sm)",
    padding: "var(--gap-sm)",
  },
});

const MemberPickerRow = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    fontSize: "13px",
    cursor: "pointer",
  },
});
