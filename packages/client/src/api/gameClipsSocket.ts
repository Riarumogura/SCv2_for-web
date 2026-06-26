// CUSTOM: gameclips-api専用の軽量WSクライアント。Stoatコアのイベントバスとは独立。
// GameClipsExplorerがマウントされている間だけ接続する。
import env from "@revolt/common/lib/env";
import { useClient } from "@revolt/client";

export type GameClipWsEvent =
  | { type: "like_updated"; gameClipId: string; likeCount: number }
  | {
      type: "comment_added";
      gameClipId: string;
      commentCount: number;
      comment: { id: string; body: string; createdBy: string; createdAt: string };
    };

/**
 * GameClips専用WSへ接続し、サーバー単位のいいね/コメント更新イベントを購読する。
 * 戻り値の関数を呼ぶと切断する。
 */
export function connectGameClipsSocket(
  serverId: string,
  onEvent: (event: GameClipWsEvent) => void,
): () => void {
  const getClient = useClient();
  const client = getClient();
  const authHeader = client?.authenticationHeader;
  const token = authHeader?.[1];

  let socket: WebSocket | undefined;
  let retryDelay = 1000;
  let closedByCaller = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function connect() {
    if (!token) return;

    socket = new WebSocket(
      `${env.DEFAULT_GAMECLIPS_WS_URL}/servers/${serverId}/socket?token=${encodeURIComponent(token)}`,
    );

    socket.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch (error) {
        console.error("Failed to parse GameClips WS event:", error);
      }
    };

    socket.onclose = () => {
      if (closedByCaller) return;
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10_000);
    };
  }

  connect();

  return () => {
    closedByCaller = true;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}
