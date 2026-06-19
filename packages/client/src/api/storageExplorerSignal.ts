// CUSTOM: ServerSidebar(ストレージ一覧)からTextChannel(チャンネルサイドバー)へ、
// 「どのストレージを開くか」を伝えるための小さな共有シグナル。
// ServerSidebarはTextChannelの子ではなく兄弟コンポーネントとして描画されるため、
// TextChannel内のローカルなsidebarState (createSignal) を直接呼び出せない。
import { createSignal } from "solid-js";

export interface OpenStorageRequest {
  serverId: string;
  storageId: string;
}

const [pendingStorageOpen, setPendingStorageOpenInternal] =
  createSignal<OpenStorageRequest | null>(null);

export { pendingStorageOpen };

/**
 * ストレージエクスプローラーを開くようリクエストする
 */
export function requestOpenStorage(request: OpenStorageRequest) {
  setPendingStorageOpenInternal(request);
}

/**
 * リクエストを消費(TextChannel側で処理した後に呼ぶ)
 */
export function consumePendingStorageOpen() {
  setPendingStorageOpenInternal(null);
}
