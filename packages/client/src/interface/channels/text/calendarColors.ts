// CUSTOM: カレンダー機能で使う表示用の定数(色のラベル/16進値、繰り返し・リマインダーのラベル、日時フォーマット変換)
import { EventColor, RepeatOption, ReminderMinutes } from "../../../api/calendar";

export const EVENT_COLOR_LABELS: Record<EventColor, string> = {
  red: "赤",
  orange: "オレンジ",
  yellow: "黄",
  green: "緑",
  blue: "青",
  purple: "紫",
};

export const EVENT_COLOR_HEX: Record<EventColor, string> = {
  red: "#e53935",
  orange: "#fb8c00",
  yellow: "#fbc02d",
  green: "#43a047",
  blue: "#1e88e5",
  purple: "#8e24aa",
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

/**
 * Dateを<input type="datetime-local">の値("YYYY-MM-DDTHH:mm", ローカル時刻)に変換
 */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
