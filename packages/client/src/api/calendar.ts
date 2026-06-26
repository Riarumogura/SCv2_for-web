// CUSTOM: 共有カレンダーAPIクライアント
import env from "@revolt/common/lib/env";
import { useClient } from "@revolt/client";

// CUSTOM: 元はイベントごとの手動カラーの選択肢だったが、現在はユーザーの
// 「トレードカラー」の選択肢としても使う共通パレット。
export const TRADE_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
] as const;
export type TradeColor = (typeof TRADE_COLORS)[number];

export const REPEAT_OPTIONS = ["none", "daily", "weekly", "monthly"] as const;
export type RepeatOption = (typeof REPEAT_OPTIONS)[number];

export const REMINDER_MINUTES_OPTIONS = [5, 15, 30, 60, 1440] as const;
export type ReminderMinutes = (typeof REMINDER_MINUTES_OPTIONS)[number];

export const EDIT_PERMISSIONS = ["anyone", "creator_only"] as const;
export type EditPermission = (typeof EDIT_PERMISSIONS)[number];

// CUSTOM: 該当メンバーが2人以上(または0人)の共有予定を示す固定のグレー表示
export const GROUP_EVENT_COLOR = "gray" as const;
export type EventColor = TradeColor | typeof GROUP_EVENT_COLOR;

export interface CalendarEvent {
  id: string;
  serverId: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  // CUSTOM: 予定の色は保存値ではなく、該当メンバーの現在のトレードカラーから
  // サーバー側で動的に解決された値(常にAPIレスポンスに含まれる)。
  // 該当メンバーが1人ならそのメンバーのトレードカラー、2人以上(または0人)ならgray。
  color: EventColor;
  repeat: RepeatOption;
  editPermission: EditPermission;
  // CUSTOM: 予定に該当する(関係する)メンバー。作成者は常に含まれる。
  memberIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  repeat?: RepeatOption;
  editPermission?: EditPermission;
  memberIds?: string[];
}

export type UpdateEventRequest = Partial<CreateEventRequest>;

export interface TradeColorAssignment {
  userId: string;
  color: TradeColor;
}

/**
 * カレンダーAPIクライアント
 * CUSTOM: storage.ts (StorageApiClient) と同じ認証ヘッダー構築方式を採用
 */
export class CalendarApiClient {
  private baseUrl: string;
  private getClient: ReturnType<typeof useClient>;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || env.DEFAULT_CALENDAR_API_URL;
    this.getClient = useClient();
  }

  /**
   * 認証ヘッダーを取得
   * CUSTOM: calendar-apiのauthPlugin (services/calendar-api/src/plugins/auth.ts) も
   * storage-apiと同様にserverIdをX-Server-Idヘッダーから読み取る実装になっている。
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
      "Content-Type": "application/json",
    };
  }

  /**
   * サーバー内のトレードカラー割り当て一覧を取得
   */
  async getTradeColors(serverId: string): Promise<TradeColorAssignment[]> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/trade-colors`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`トレードカラー一覧の取得に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 自分のトレードカラーを設定/変更する
   * @throws 既に他のユーザーが使用している色を指定した場合(409)
   */
  async setMyTradeColor(serverId: string, color: TradeColor): Promise<TradeColorAssignment> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/trade-colors/me`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ color }),
    });

    if (response.status === 409) {
      throw new Error("このトレードカラーは既に他のユーザーが使用しています");
    }
    if (!response.ok) {
      throw new Error(`トレードカラーの設定に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 指定期間内の予定一覧を取得
   */
  async getEvents(serverId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const headers = await this.getAuthHeaders(serverId);
    const url = new URL(`${this.baseUrl}/events`);
    url.searchParams.set("from", from.toISOString());
    url.searchParams.set("to", to.toISOString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`予定一覧の取得に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 予定を作成
   * @throws トレードカラー未設定の場合(400)
   */
  async createEvent(serverId: string, data: CreateEventRequest): Promise<CalendarEvent> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/events`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "予定の作成に失敗しました");
    }
    if (!response.ok) {
      throw new Error(`予定の作成に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 予定の詳細を取得
   */
  async getEvent(serverId: string, eventId: string): Promise<CalendarEvent> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`予定の取得に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 予定を更新
   * @throws 編集権限が無い場合(403)
   */
  async updateEvent(
    serverId: string,
    eventId: string,
    data: UpdateEventRequest
  ): Promise<CalendarEvent> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });

    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "この予定を編集する権限がありません");
    }
    if (!response.ok) {
      throw new Error(`予定の更新に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 予定を削除
   * @throws 編集権限が無い場合(403)
   */
  async deleteEvent(serverId: string, eventId: string): Promise<void> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;
    const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
      method: "DELETE",
      headers: restHeaders,
    });

    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "この予定を削除する権限がありません");
    }
    if (!response.ok) {
      throw new Error(`予定の削除に失敗しました: ${response.status}`);
    }
  }

  /**
   * 予定のリマインダーを設定(自分自身に対して)
   */
  async setReminder(
    serverId: string,
    eventId: string,
    minutesBefore: ReminderMinutes
  ): Promise<void> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/events/${eventId}/remind`, {
      method: "POST",
      headers,
      body: JSON.stringify({ minutesBefore }),
    });

    if (!response.ok) {
      throw new Error(`リマインダーの設定に失敗しました: ${response.status}`);
    }
  }

  /**
   * 予定のリマインダーを解除(自分自身に対して)
   */
  async deleteReminder(serverId: string, eventId: string): Promise<void> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;
    const response = await fetch(`${this.baseUrl}/events/${eventId}/remind`, {
      method: "DELETE",
      headers: restHeaders,
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`リマインダーの解除に失敗しました: ${response.status}`);
    }
  }

  /**
   * 予定に設定済みのリマインダー(自分自身のもの)を取得。未設定ならnull
   */
  async getReminder(serverId: string, eventId: string): Promise<ReminderMinutes | null> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/events/${eventId}/remind`, {
      method: "GET",
      headers,
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`リマインダーの取得に失敗しました: ${response.status}`);
    }

    const data = await response.json();
    return data.minutesBefore;
  }

  /**
   * CUSTOM: Web Push未対応のため、カレンダーパネル表示中に定期ポーリングして
   * アプリ内通知(スナックバー)を出すためのエンドポイント
   */
  async getDueReminders(
    serverId: string
  ): Promise<{ minutesBefore: ReminderMinutes; event: CalendarEvent }[]> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/reminders/due`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`リマインダーの確認に失敗しました: ${response.status}`);
    }

    return response.json();
  }
}

/**
 * カレンダーAPIクライアントのインスタンスを作成
 */
export function useCalendarApi(): CalendarApiClient {
  return new CalendarApiClient();
}
