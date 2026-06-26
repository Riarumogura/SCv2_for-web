// CUSTOM: ServerSidebar(アルバムメニュー)からTextChannel(チャンネルサイドバー)へ、
// 「アルバムを開く」ことを伝えるための小さな共有シグナル。calendarExplorerSignal.tsと同じ理由
// (ServerSidebarはTextChannelの兄弟コンポーネントのため、ローカルなsidebarStateを直接呼べない)。
import { createSignal } from "solid-js";

export interface OpenAlbumRequest {
  serverId: string;
}

const [pendingAlbumOpen, setPendingAlbumOpenInternal] =
  createSignal<OpenAlbumRequest | null>(null);

export { pendingAlbumOpen };

/**
 * アルバムを開くようリクエストする
 */
export function requestOpenAlbum(request: OpenAlbumRequest) {
  setPendingAlbumOpenInternal(request);
}

/**
 * リクエストを消費(TextChannel側で処理した後に呼ぶ)
 */
export function consumePendingAlbumOpen() {
  setPendingAlbumOpenInternal(null);
}
