// CUSTOM: オンラインストレージAPIクライアント
import env from "@revolt/common/lib/env";
import { useClient } from "@revolt/client";

export interface StorageConfig {
  id: string;
  name: string;
  sizeLimit: number;
  usedSize: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: string;
}

export interface CreateStorageRequest {
  name: string;
  sizeLimit: number;
}

/**
 * ストレージAPIクライアント
 */
export class StorageApiClient {
  private baseUrl: string;
  
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || env.DEFAULT_STORAGE_API_URL;
  }

  /**
   * 認証ヘッダーを取得
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const client = useClient();
    const currentClient = client();
    
    if (!currentClient) {
      throw new Error("クライアントが取得できません");
    }

    // CUSTOM: stoat.jsのauthenticationHeaderを使用
    const authHeader = currentClient.authenticationHeader;
    if (!authHeader) {
      throw new Error("認証ヘッダーが取得できません");
    }

    return {
      [authHeader[0]]: authHeader[1],
      "Content-Type": "application/json",
    };
  }

  /**
   * サーバーのストレージ一覧を取得
   */
  async getStorages(serverId: string): Promise<StorageConfig[]> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/storages`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`ストレージ一覧の取得に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * ストレージを作成
   */
  async createStorage(serverId: string, data: CreateStorageRequest): Promise<StorageConfig> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/storages`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`ストレージの作成に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * ストレージの詳細を取得
   */
  async getStorage(serverId: string, storageId: string): Promise<StorageConfig> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/storages/${storageId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`ストレージの取得に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * ストレージ内のファイル一覧を取得
   */
  async listFiles(serverId: string, storageId: string, path?: string): Promise<StorageFile[]> {
    const headers = await this.getAuthHeaders();
    const url = new URL(`${this.baseUrl}/servers/${serverId}/storages/${storageId}/files`);
    
    if (path) {
      url.searchParams.set("path", path);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`ファイル一覧の取得に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(
    serverId: string,
    storageId: string,
    file: File,
    path: string
  ): Promise<StorageFile> {
    const headers = await this.getAuthHeaders();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);

    // Content-Typeを削除（FormDataが自動設定）
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;

    const response = await fetch(
      `${this.baseUrl}/servers/${serverId}/storages/${storageId}/files`,
      {
        method: "POST",
        headers: restHeaders,
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`ファイルのアップロードに失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * チャットのファイルをストレージに保存
   */
  async saveToStorage(
    serverId: string,
    storageId: string,
    fileUrl: string,
    destinationPath: string,
    folderPath?: string
  ): Promise<StorageFile> {
    const headers = await this.getAuthHeaders();
    
    // フォルダパスをdestinationPathに組み込む
    let finalDestinationPath = destinationPath;
    if (folderPath && folderPath !== "") {
      finalDestinationPath = `${folderPath}/${destinationPath}`;
    }

    const response = await fetch(
      `${this.baseUrl}/servers/${serverId}/storages/${storageId}/files/copy`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          sourceUrl: fileUrl,
          destinationPath: finalDestinationPath,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ファイルの保存に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * ファイルを削除
   */
  async deleteFile(serverId: string, storageId: string, filePath: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/servers/${serverId}/storages/${storageId}/files`,
      {
        method: "DELETE",
        headers,
        body: JSON.stringify({ path: filePath }),
      }
    );

    if (!response.ok) {
      throw new Error(`ファイルの削除に失敗しました: ${response.status}`);
    }
  }

  /**
   * フォルダを作成
   */
  async createFolder(serverId: string, storageId: string, path: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/servers/${serverId}/storages/${storageId}/folders`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ path }),
      }
    );

    if (!response.ok) {
      throw new Error(`フォルダの作成に失敗しました: ${response.status}`);
    }
  }
}

/**
 * ストレージAPIクライアントのインスタンスを作成
 */
export function useStorageApi(): StorageApiClient {
  return new StorageApiClient();
}