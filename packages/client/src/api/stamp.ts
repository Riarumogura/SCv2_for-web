// CUSTOM: 短尺MP4から作るスタンプAPIクライアント
import env from "@revolt/common/lib/env";
import { useClient } from "@revolt/client";

// CUSTOM: stamp-api(services/stamp-api/src/routes/stamps.ts)のレスポンスに
// urlは含まれない(バックエンドは自身の公開URLを知らない)。idとbaseUrlから
// このクライアントがurlを組み立てる。
export interface Stamp {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  durationMs: number;
  fileSize: number;
  createdAt: string;
  creatorId: string;
}

interface RawStamp {
  id: string;
  name: string;
  width: number;
  height: number;
  durationMs: number;
  fileSize: number;
  createdAt: string;
  creatorId: string;
}

export interface CreateStampRequest {
  file: Blob;
  name: string;
  width: number;
  height: number;
  durationMs: number;
}

/**
 * スタンプAPIクライアント
 */
export class StampApiClient {
  private baseUrl: string;
  // CUSTOM: useClient()はSolidの reactive owner が有効な間(コンポーネントの
  // セットアップ時)にしか呼び出せない。createStamp等の実行時(イベントハンドラ
  // 内の非同期処理)に遅延呼び出しすると owner が失われるため、
  // useStampApi()からコンストラクタ呼び出し時点で取得して保持する
  // (src/api/storage.tsのStorageApiClientと同じ対策)。
  private getClient: ReturnType<typeof useClient>;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || env.DEFAULT_STAMP_API_URL;
    this.getClient = useClient();
  }

  /**
   * 認証ヘッダーを取得
   * CUSTOM: stamp-apiのauthPluginはserverIdをURLからではなく
   * X-Server-Id ヘッダーから読み取る実装になっているため、必ず付与する。
   */
  private async getAuthHeaders(serverId: string): Promise<HeadersInit> {
    const currentClient = this.getClient();

    if (!currentClient) {
      throw new Error("クライアントが取得できません");
    }

    const authHeader = currentClient.authenticationHeader;
    if (!authHeader) {
      throw new Error("認証ヘッダーが取得できません");
    }

    return {
      [authHeader[0]]: authHeader[1],
      "X-Server-Id": serverId,
    };
  }

  private toStamp(raw: RawStamp): Stamp {
    return {
      ...raw,
      url: `${this.baseUrl}/stamps/${raw.id}/file`,
    };
  }

  /**
   * サーバーのスタンプ一覧を取得
   */
  async listStamps(serverId: string): Promise<{ stamps: Stamp[]; count: number; limit: number }> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/stamps`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`スタンプ一覧の取得に失敗しました: ${response.status}`);
    }

    const data = await response.json();
    return {
      stamps: data.stamps.map((raw: RawStamp) => this.toStamp(raw)),
      count: data.count,
      limit: data.limit,
    };
  }

  /**
   * スタンプを作成(fileは変換済みのアニメーションWebP Blob)
   */
  async createStamp(serverId: string, data: CreateStampRequest): Promise<Stamp> {
    const headers = await this.getAuthHeaders(serverId);
    const formData = new FormData();
    formData.append("file", data.file, "stamp.webp");
    formData.append("name", data.name);
    formData.append("width", String(data.width));
    formData.append("height", String(data.height));
    formData.append("durationMs", String(data.durationMs));

    const response = await fetch(`${this.baseUrl}/stamps`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new Error(body?.error || `スタンプの作成に失敗しました: ${response.status}`);
    }

    return this.toStamp(await response.json());
  }

  /**
   * スタンプを削除
   */
  async deleteStamp(serverId: string, stampId: string): Promise<void> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/stamps/${stampId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`スタンプの削除に失敗しました: ${response.status}`);
    }
  }
}

/**
 * スタンプAPIクライアントのインスタンスを作成
 */
export function useStampApi(): StampApiClient {
  return new StampApiClient();
}
