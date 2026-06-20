// CUSTOM: ServerSidebar(カレンダーメニュー)からTextChannel(チャンネルサイドバー)へ、
// 「カレンダーを開く」ことを伝えるための小さな共有シグナル。storageExplorerSignal.tsと同じ理由
// (ServerSidebarはTextChannelの兄弟コンポーネントのため、ローカルなsidebarStateを直接呼べない)。
import { createSignal } from "solid-js";

export interface OpenCalendarRequest {
  serverId: string;
}

const [pendingCalendarOpen, setPendingCalendarOpenInternal] =
  createSignal<OpenCalendarRequest | null>(null);

export { pendingCalendarOpen };

/**
 * カレンダーを開くようリクエストする
 */
export function requestOpenCalendar(request: OpenCalendarRequest) {
  setPendingCalendarOpenInternal(request);
}

/**
 * リクエストを消費(TextChannel側で処理した後に呼ぶ)
 */
export function consumePendingCalendarOpen() {
  setPendingCalendarOpenInternal(null);
}
