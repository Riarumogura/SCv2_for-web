// CUSTOM: アルバム機能で使う表示用の定数(閲覧/編集権限のラベル、日付フォーマット変換)
import { ViewPermission, EditPermission } from "../../../api/album";

export const VIEW_PERMISSION_LABELS: Record<ViewPermission, string> = {
  anyone: "全員",
  members: "メンバーを選ぶ",
};

export const EDIT_PERMISSION_LABELS: Record<EditPermission, string> = {
  anyone: "誰でも編集可",
  creator_only: "作成者のみ編集可",
  members: "編集可能メンバーを選ぶ",
};

/**
 * Dateを<input type="date">の値("YYYY-MM-DD", ローカル日付)に変換
 */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
