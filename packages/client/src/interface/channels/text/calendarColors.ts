// CUSTOM: カレンダー機能で使う表示用の定数(色のラベル/16進値、繰り返し・リマインダー・
// 編集権限のラベル、日時フォーマット変換)
import { TradeColor, EventColor, RepeatOption, ReminderMinutes, EditPermission } from "../../../api/calendar";

export const TRADE_COLOR_LABELS: Record<TradeColor, string> = {
  red: "赤",
  orange: "オレンジ",
  yellow: "黄",
  green: "緑",
  blue: "青",
  purple: "紫",
};

export const TRADE_COLOR_HEX: Record<TradeColor, string> = {
  red: "#e53935",
  orange: "#fb8c00",
  yellow: "#fbc02d",
  green: "#43a047",
  blue: "#1e88e5",
  purple: "#8e24aa",
};

// CUSTOM: 予定の表示色はトレードカラー6色に加えて、該当メンバーが複数(または0人)の
// 共有予定を示す固定グレーも取りうるため、こちらはEventColor用の別マップにしている
export const EVENT_COLOR_HEX: Record<EventColor, string> = {
  ...TRADE_COLOR_HEX,
  gray: "#9e9e9e",
};

export const REPEAT_LABELS: Record<RepeatOption, string> = {
  none: "なし",
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
};

export const REMINDER_LABELS: Record<ReminderMinutes, string> = {
  5: "5分前",
  15: "15分前",
  30: "30分前",
  60: "1時間前",
  1440: "1日前",
};

export const EDIT_PERMISSION_LABELS: Record<EditPermission, string> = {
  anyone: "全員編集可",
  creator_only: "作成者のみ編集可",
};

/**
 * Dateを<input type="datetime-local">の値("YYYY-MM-DDTHH:mm", ローカル時刻)に変換
 */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
