// CUSTOM: ServerSidebar(GameClipsメニュー)からTextChannel(チャンネルサイドバー)へ、
// 「GameClipsを開く」ことを伝えるための小さな共有シグナル。albumExplorerSignal.tsと同じ理由
// (ServerSidebarはTextChannelの兄弟コンポーネントのため、ローカルなsidebarStateを直接呼べない)。
import { createSignal } from "solid-js";

export interface OpenGameClipsRequest {
  serverId: string;
}

const [pendingGameClipsOpen, setPendingGameClipsOpenInternal] =
  createSignal<OpenGameClipsRequest | null>(null);

export { pendingGameClipsOpen };

/**
 * GameClipsを開くようリクエストする
 */
export function requestOpenGameClips(request: OpenGameClipsRequest) {
  setPendingGameClipsOpenInternal(request);
}

/**
 * リクエストを消費(TextChannel側で処理した後に呼ぶ)
 */
export function consumePendingGameClipsOpen() {
  setPendingGameClipsOpenInternal(null);
}
