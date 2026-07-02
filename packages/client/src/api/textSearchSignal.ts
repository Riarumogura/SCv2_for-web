// CUSTOM: AppRail(レール)のSearchアイコンから、現在開いているTextChannelへ
// 「検索サイドバーを開く」ことを伝えるための小さな共有シグナル。calendarExplorerSignal.tsと
// 同じ理由(レールはTextChannelの兄弟コンポーネントのため、ローカルなsidebarStateを直接呼べない)。
// チャンネルIDでの絞り込みは行わない: 常に「現在マウントされているTextChannel」宛のリクエストとする。
import { createSignal } from "solid-js";

const [pendingSearchOpen, setPendingSearchOpenInternal] =
  createSignal<boolean>(false);

export { pendingSearchOpen };

/**
 * 現在開いているチャンネルの検索サイドバーを開くようリクエストする
 */
export function requestOpenSearch() {
  setPendingSearchOpenInternal(true);
}

/**
 * リクエストを消費(TextChannel側で処理した後に呼ぶ)
 */
export function consumePendingSearchOpen() {
  setPendingSearchOpenInternal(false);
}
