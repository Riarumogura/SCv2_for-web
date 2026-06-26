// CUSTOM: アルバムAPIクライアント。calendar.ts (CalendarApiClient) と同じ認証ヘッダー
// 構築方式・エラーハンドリング方式を採用する。
import env from "@revolt/common/lib/env";
import { useClient } from "@revolt/client";

export const VIEW_PERMISSIONS = ["anyone", "members"] as const;
export type ViewPermission = (typeof VIEW_PERMISSIONS)[number];

export const EDIT_PERMISSIONS = ["anyone", "creator_only", "members"] as const;
export type EditPermission = (typeof EDIT_PERMISSIONS)[number];

export interface AlbumCategory {
  id: string;
  serverId: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  color: string;
}

export interface AlbumPhotoMetadata {
  type: "Image" | "Video" | "File";
  width?: number;
  height?: number;
}

export interface Album {
  id: string;
  serverId: string;
  date: string;
  title: string;
  categoryIds: string[];
  viewPermission: ViewPermission;
  viewMemberIds: string[];
  editPermission: EditPermission;
  editMemberIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlbumRequest {
  title: string;
  date: string;
  categoryIds?: string[];
  viewPermission?: ViewPermission;
  viewMemberIds?: string[];
  editPermission?: EditPermission;
  editMemberIds?: string[];
}

export type UpdateAlbumRequest = Partial<CreateAlbumRequest>;

export interface SearchAlbumsQuery {
  title?: string;
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string[];
}

export interface AlbumDateColors {
  date: string;
  colors: string[];
}

export interface AlbumPhoto {
  id: string;
  albumId: string;
  serverId: string;
  // CUSTOM: /photos/:fileId/file(album-apiの無認証配信ルート)で実体を取得するための
  // 公開ID。Autumnのused_for(実際にメッセージ等として使われたか)を満たせず常に404に
  // なる問題を避けるため、アルバムの写真・動画はAutumnを使わず専用MinIOバケットに
  // 保存している(getPhotoFileUrl参照)
  fileId: string;
  filename?: string;
  contentType?: string;
  metadata: AlbumPhotoMetadata;
  size?: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface AddPhotoMetadata {
  type: AlbumPhotoMetadata["type"];
  width?: number;
  height?: number;
}

/**
 * アルバムAPIクライアント
 * CUSTOM: calendar.ts (CalendarApiClient) と同じ認証ヘッダー構築方式を採用
 */
export class AlbumApiClient {
  private baseUrl: string;
  private getClient: ReturnType<typeof useClient>;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || env.DEFAULT_ALBUM_API_URL;
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

  // ---- Categories ----

  async listCategories(serverId: string): Promise<AlbumCategory[]> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/categories`, { method: "GET", headers });

    if (!response.ok) {
      throw new Error(`カテゴリ一覧の取得に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async createCategory(serverId: string, data: CreateCategoryRequest): Promise<AlbumCategory> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/categories`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`カテゴリの作成に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  // ---- Albums ----

  async listAlbumsByDate(serverId: string, date: string): Promise<Album[]> {
    const headers = await this.getAuthHeaders(serverId);
    const url = new URL(`${this.baseUrl}/albums`);
    url.searchParams.set("date", date);

    const response = await fetch(url.toString(), { method: "GET", headers });
    if (!response.ok) {
      throw new Error(`アルバム一覧の取得に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async listAlbumDateColors(serverId: string, from: string, to: string): Promise<AlbumDateColors[]> {
    const headers = await this.getAuthHeaders(serverId);
    const url = new URL(`${this.baseUrl}/albums/dates`);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);

    const response = await fetch(url.toString(), { method: "GET", headers });
    if (!response.ok) {
      throw new Error(`カレンダー色情報の取得に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async searchAlbums(serverId: string, query: SearchAlbumsQuery): Promise<Album[]> {
    const headers = await this.getAuthHeaders(serverId);
    const url = new URL(`${this.baseUrl}/albums/search`);
    if (query.title) url.searchParams.set("title", query.title);
    if (query.dateFrom) url.searchParams.set("dateFrom", query.dateFrom);
    if (query.dateTo) url.searchParams.set("dateTo", query.dateTo);
    if (query.categoryIds && query.categoryIds.length > 0) {
      url.searchParams.set("categoryIds", query.categoryIds.join(","));
    }

    const response = await fetch(url.toString(), { method: "GET", headers });
    if (!response.ok) {
      throw new Error(`アルバムの検索に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async createAlbum(serverId: string, data: CreateAlbumRequest): Promise<Album> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/albums`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`アルバムの作成に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async getAlbum(serverId: string, albumId: string): Promise<Album> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/albums/${albumId}`, { method: "GET", headers });

    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "このアルバムを閲覧する権限がありません");
    }
    if (!response.ok) {
      throw new Error(`アルバムの取得に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async updateAlbum(serverId: string, albumId: string, data: UpdateAlbumRequest): Promise<Album> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/albums/${albumId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });

    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "このアルバムを編集する権限がありません");
    }
    if (!response.ok) {
      throw new Error(`アルバムの更新に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async deleteAlbum(serverId: string, albumId: string): Promise<void> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;
    const response = await fetch(`${this.baseUrl}/albums/${albumId}`, {
      method: "DELETE",
      headers: restHeaders,
    });

    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "このアルバムを削除する権限がありません");
    }
    if (!response.ok) {
      throw new Error(`アルバムの削除に失敗しました: ${response.status}`);
    }
  }

  // ---- Photos ----

  async listPhotos(serverId: string, albumId: string): Promise<AlbumPhoto[]> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/albums/${albumId}/photos`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`写真一覧の取得に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  // CUSTOM: ファイルの実体をmultipart/form-dataでalbum-apiに直接アップロードする
  // (Autumnのused_for問題を避けるため、専用MinIOバケットに保存する方式)。
  // Content-Typeはbrowserがboundary付きで自動設定するため、ここでは手動設定しない
  async addPhoto(
    serverId: string,
    albumId: string,
    file: globalThis.File,
    metadata: AddPhotoMetadata,
  ): Promise<AlbumPhoto> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;

    const body = new FormData();
    body.set("file", file, file.name);
    body.set("type", metadata.type);
    if (metadata.width !== undefined) body.set("width", String(metadata.width));
    if (metadata.height !== undefined) body.set("height", String(metadata.height));

    const response = await fetch(`${this.baseUrl}/albums/${albumId}/photos`, {
      method: "POST",
      headers: restHeaders,
      body,
    });

    if (response.status === 403) {
      const responseBody = await response.json().catch(() => null);
      throw new Error(responseBody?.error || "この写真を追加する権限がありません");
    }
    if (!response.ok) {
      throw new Error(`写真の追加に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  /**
   * 写真・動画の実体を直接表示/ダウンロードするためのURL(無認証で取得可能)
   */
  getPhotoFileUrl(fileId: string): string {
    return `${this.baseUrl}/photos/${fileId}/file`;
  }

  async deletePhoto(serverId: string, albumId: string, photoId: string): Promise<void> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;
    const response = await fetch(`${this.baseUrl}/albums/${albumId}/photos/${photoId}`, {
      method: "DELETE",
      headers: restHeaders,
    });

    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "この写真を削除する権限がありません");
    }
    if (!response.ok) {
      throw new Error(`写真の削除に失敗しました: ${response.status}`);
    }
  }
}

/**
 * アルバムAPIクライアントのインスタンスを作成
 */
export function useAlbumApi(): AlbumApiClient {
  return new AlbumApiClient();
}
