// CUSTOM: GameClips APIクライアント。album.ts (AlbumApiClient) と同じ認証ヘッダー
// 構築方式・エラーハンドリング方式を採用する。
import env from "@revolt/common/lib/env";
import { useClient } from "@revolt/client";

export const ALLOWED_GAMECLIP_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "video/mp4",
  "video/quicktime",
] as const;
export type GameClipContentType = (typeof ALLOWED_GAMECLIP_CONTENT_TYPES)[number];

export interface GameClipCategory {
  id: string;
  serverId: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface GameClipFileMetadata {
  type: "Image" | "Video";
  width?: number;
  height?: number;
}

export interface GameClipFile {
  autumnId: string;
  tag: string;
  filename: string;
  contentType: GameClipContentType;
  metadata: GameClipFileMetadata;
  size: number;
}

export interface GameClip {
  id: string;
  serverId: string;
  categoryId: string;
  description: string;
  files: GameClipFile[];
  mentionedUserIds: string[];
  allowComments: boolean;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameClipRequest {
  categoryId: string;
  description?: string;
  files: GameClipFile[];
  mentionedUserIds?: string[];
  allowComments?: boolean;
}

export interface UpdateGameClipRequest {
  description?: string;
  categoryId?: string;
  allowComments?: boolean;
  mentionedUserIds?: string[];
}

export interface ToggleLikeResponse {
  liked: boolean;
  likeCount: number;
}

export interface GameClipComment {
  id: string;
  gameClipId: string;
  serverId: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

/**
 * GameClips APIクライアント
 * CUSTOM: album.ts (AlbumApiClient) と同じ認証ヘッダー構築方式を採用
 */
export class GameClipsApiClient {
  private baseUrl: string;
  private getClient: ReturnType<typeof useClient>;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || env.DEFAULT_GAMECLIPS_API_URL;
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

  async listCategories(serverId: string): Promise<GameClipCategory[]> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/categories`, { method: "GET", headers });

    if (!response.ok) {
      throw new Error(`カテゴリ一覧の取得に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async createCategory(serverId: string, data: CreateCategoryRequest): Promise<GameClipCategory> {
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

  // ---- GameClips ----

  async listGameClips(serverId: string, categoryId?: string): Promise<GameClip[]> {
    const headers = await this.getAuthHeaders(serverId);
    const url = new URL(`${this.baseUrl}/gameclips`);
    if (categoryId) url.searchParams.set("categoryId", categoryId);

    const response = await fetch(url.toString(), { method: "GET", headers });
    if (!response.ok) {
      throw new Error(`投稿一覧の取得に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async createGameClip(serverId: string, data: CreateGameClipRequest): Promise<GameClip> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/gameclips`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`投稿の作成に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async getGameClip(serverId: string, id: string): Promise<GameClip> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/gameclips/${id}`, { method: "GET", headers });

    if (!response.ok) {
      throw new Error(`投稿の取得に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async updateGameClip(serverId: string, id: string, data: UpdateGameClipRequest): Promise<GameClip> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/gameclips/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });

    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "この投稿を編集する権限がありません");
    }
    if (!response.ok) {
      throw new Error(`投稿の更新に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async deleteGameClip(serverId: string, id: string): Promise<void> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;
    const response = await fetch(`${this.baseUrl}/gameclips/${id}`, {
      method: "DELETE",
      headers: restHeaders,
    });

    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "この投稿を削除する権限がありません");
    }
    if (!response.ok) {
      throw new Error(`投稿の削除に失敗しました: ${response.status}`);
    }
  }

  // ---- Likes ----

  async toggleLike(serverId: string, id: string): Promise<ToggleLikeResponse> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;
    const response = await fetch(`${this.baseUrl}/gameclips/${id}/like`, {
      method: "POST",
      headers: restHeaders,
    });

    if (!response.ok) {
      throw new Error(`いいねの切り替えに失敗しました: ${response.status}`);
    }
    return response.json();
  }

  // ---- Comments ----

  async listComments(serverId: string, id: string): Promise<GameClipComment[]> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/gameclips/${id}/comments`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`コメント一覧の取得に失敗しました: ${response.status}`);
    }
    return response.json();
  }

  async addComment(serverId: string, id: string, body: string): Promise<GameClipComment> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/gameclips/${id}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body }),
    });

    if (response.status === 403) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error || "この投稿はコメントが許可されていません");
    }
    if (response.status === 409) {
      throw new Error("コメントの上限(99件)に達しています");
    }
    if (!response.ok) {
      throw new Error(`コメントの投稿に失敗しました: ${response.status}`);
    }
    return response.json();
  }
}

/**
 * GameClips APIクライアントのインスタンスを作成
 */
export function useGameClipsApi(): GameClipsApiClient {
  return new GameClipsApiClient();
}
