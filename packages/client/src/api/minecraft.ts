// CUSTOM: Minecraftサーバー管理APIクライアント
import env from "@revolt/common/lib/env";
import { useClient } from "@revolt/client";

export const MC_SERVER_TYPES = ["VANILLA", "FORGE", "FABRIC", "NEOFORGE", "PAPER"] as const;
export type McServerType = (typeof MC_SERVER_TYPES)[number];

export const MC_SERVER_STATUSES = [
  "CREATED",
  "STARTING",
  "RUNNING",
  "STOPPING",
  "STOPPED",
  "ERROR",
] as const;
export type McServerStatus = (typeof MC_SERVER_STATUSES)[number];

export interface McServer {
  id: string;
  serverId: string;
  mcId: string;
  name: string;
  version: string;
  type: McServerType;
  memory: string;
  port: number;
  rconPort: number;
  containerId: string | null;
  containerName: string;
  status: McServerStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMcServerRequest {
  name: string;
  version: string;
  type: McServerType;
  memory: string;
  port: number;
}

/**
 * Minecraftサーバー管理APIクライアント
 */
export class MinecraftApiClient {
  private baseUrl: string;
  // CUSTOM: useClient()はSolidのreactive ownerが有効な間にしか呼び出せないため、
  // useMinecraftApi()からコンストラクタ呼び出し時点で取得して保持する(storage.tsと同じ理由)
  private getClient: ReturnType<typeof useClient>;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || env.DEFAULT_MC_MANAGER_API_URL;
    this.getClient = useClient();
  }

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
      "Content-Type": "application/json",
    };
  }

  /**
   * コンソールWebSocket接続用のURLを取得する。
   * CUSTOM: ブラウザのWebSocket APIはカスタムヘッダーを送れないため、
   * セッショントークンとサーバーIDをクエリパラメータで渡す
   * (stoat.jsのEventClient#connect()が本体のWS接続を認証する方式と同じ)。
   */
  consoleWsUrl(serverId: string, mcId: string): string {
    const currentClient = this.getClient();
    if (!currentClient) {
      throw new Error("クライアントが取得できません");
    }
    const authHeader = currentClient.authenticationHeader;
    if (!authHeader) {
      throw new Error("認証ヘッダーが取得できません");
    }

    const wsBase = this.baseUrl.replace(/^http/, "ws");
    const url = new URL(`${wsBase}/servers/${serverId}/minecraft/${mcId}/console`);
    url.searchParams.set("token", authHeader[1]);
    url.searchParams.set("serverId", serverId);
    return url.toString();
  }

  async listServers(serverId: string): Promise<McServer[]> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/minecraft`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Minecraftサーバー一覧の取得に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  async createServer(serverId: string, data: CreateMcServerRequest): Promise<McServer> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/minecraft`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ? JSON.stringify(body.error) : `Minecraftサーバーの作成に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  async getServer(serverId: string, mcId: string): Promise<McServer> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/minecraft/${mcId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Minecraftサーバーの取得に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * CUSTOM: バックエンドは安全策として?confirm=trueを必須にしている
   * (フロント側の確認モーダルだけに頼らない二重のガード)。
   */
  async deleteServer(serverId: string, mcId: string): Promise<void> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;
    const response = await fetch(
      `${this.baseUrl}/servers/${serverId}/minecraft/${mcId}?confirm=true`,
      { method: "DELETE", headers: restHeaders },
    );

    if (!response.ok) {
      throw new Error(`Minecraftサーバーの削除に失敗しました: ${response.status}`);
    }
  }

  async startServer(serverId: string, mcId: string): Promise<McServer> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/minecraft/${mcId}/start`, {
      method: "POST",
      headers: restHeaders,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? `Minecraftサーバーの起動に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  async stopServer(serverId: string, mcId: string, force = false): Promise<McServer> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/minecraft/${mcId}/stop`, {
      method: "POST",
      headers,
      body: JSON.stringify({ force }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? `Minecraftサーバーの停止に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  async sendCommand(serverId: string, mcId: string, command: string): Promise<string> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/minecraft/${mcId}/command`, {
      method: "POST",
      headers,
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? `コマンドの送信に失敗しました: ${response.status}`);
    }

    const result = await response.json();
    return result.response as string;
  }
}

/**
 * MinecraftサーバーAPIクライアントのインスタンスを作成
 */
export function useMinecraftApi(): MinecraftApiClient {
  return new MinecraftApiClient();
}
