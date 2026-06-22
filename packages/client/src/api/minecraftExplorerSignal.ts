// CUSTOM: ServerSidebar(Minecraftメニュー)からTextChannel(チャンネルサイドバー)へ、
// パネルを開くことを伝えるための共有シグナル(storageExplorerSignal.tsと同じパターン)。
import { createSignal } from "solid-js";

export interface OpenMinecraftRequest {
  serverId: string;
}

const [pendingMinecraftOpen, setPendingMinecraftOpenInternal] =
  createSignal<OpenMinecraftRequest | null>(null);

export { pendingMinecraftOpen };

/**
 * Minecraftサーバー管理パネルを開くようリクエストする
 */
export function requestOpenMinecraft(request: OpenMinecraftRequest) {
  setPendingMinecraftOpenInternal(request);
}

/**
 * リクエストを消費(TextChannel側で処理した後に呼ぶ)
 */
export function consumePendingMinecraftOpen() {
  setPendingMinecraftOpenInternal(null);
}
