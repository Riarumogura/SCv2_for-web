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
  // CUSTOM: zipアップロードで起動jar候補が複数見つかり、ユーザーの選択待ちの状態
  "PENDING_JAR_SELECTION",
] as const;
export type McServerStatus = (typeof MC_SERVER_STATUSES)[number];

// CUSTOM: サイドバー・パネルで状態ラベルを共有するための一元化辞書
export const MC_STATUS_LABELS: Record<McServerStatus, string> = {
  CREATED: "未起動",
  STARTING: "起動中",
  RUNNING: "オンライン",
  STOPPING: "停止中",
  STOPPED: "停止済み",
  ERROR: "エラー",
  PENDING_JAR_SELECTION: "jar選択待ち",
};

export const MC_SERVER_SOURCES = ["NEW", "UPLOAD"] as const;
export type McServerSource = (typeof MC_SERVER_SOURCES)[number];

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
  source: McServerSource;
  customJarPath: string | null;
  pendingJarCandidates: string[] | null;
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

export interface UploadMcServerRequest {
  name: string;
  type: McServerType;
  memory: string;
  port: number;
  file: File;
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

  /**
   * 既存サーバーファイル(zip)をアップロードして作成する。
   * CUSTOM: fetch()はアップロード進捗を取得できないため、XMLHttpRequestを使う。
   * バックエンドはフィールドを先に検証してから展開を始めるため、FormDataには
   * name/type/memory/portを先にappendし、fileは必ず最後にappendすること。
   */
  uploadServer(
    serverId: string,
    data: UploadMcServerRequest,
    onProgress?: (percent: number) => void,
  ): Promise<McServer> {
    const currentClient = this.getClient();
    if (!currentClient) {
      return Promise.reject(new Error("クライアントが取得できません"));
    }
    const authHeader = currentClient.authenticationHeader;
    if (!authHeader) {
      return Promise.reject(new Error("認証ヘッダーが取得できません"));
    }

    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("type", data.type);
    formData.append("memory", data.memory);
    formData.append("port", String(data.port));
    formData.append("file", data.file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.baseUrl}/servers/${serverId}/minecraft/upload`);
      xhr.setRequestHeader(authHeader[0], authHeader[1]);
      xhr.setRequestHeader("X-Server-Id", serverId);

      xhr.upload.onprogress = (event) => {
        if (onProgress && event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("レスポンスの解析に失敗しました"));
          }
          return;
        }

        let message = `アップロードに失敗しました: ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error) {
            message = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
          }
        } catch {
          // レスポンスがJSONでない場合はデフォルトメッセージのまま
        }
        reject(new Error(message));
      };

      xhr.onerror = () => reject(new Error("アップロード中にネットワークエラーが発生しました"));
      xhr.send(formData);
    });
  }

  /**
   * 起動jar候補が複数あった場合に、ユーザーが選んだ候補を確定する
   */
  async selectJar(serverId: string, mcId: string, jarPath: string): Promise<McServer> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/minecraft/${mcId}/select-jar`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jarPath }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? `jarの選択に失敗しました: ${response.status}`);
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
