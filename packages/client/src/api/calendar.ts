// CUSTOM: 共有カレンダーAPIクライアント
import env from "@revolt/common/lib/env";
import { useClient } from "@revolt/client";

export const EVENT_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
] as const;
export type EventColor = (typeof EVENT_COLORS)[number];

export const REPEAT_OPTIONS = ["none", "daily", "weekly", "monthly"] as const;
export type RepeatOption = (typeof REPEAT_OPTIONS)[number];

export const REMINDER_MINUTES_OPTIONS = [5, 15, 30, 60, 1440] as const;
export type ReminderMinutes = (typeof REMINDER_MINUTES_OPTIONS)[number];

export interface CalendarEvent {
  id: string;
  serverId: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  color: EventColor;
  repeat: RepeatOption;
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
  color?: EventColor;
  repeat?: RepeatOption;
}

export type UpdateEventRequest = Partial<CreateEventRequest>;

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
   */
  async createEvent(serverId: string, data: CreateEventRequest): Promise<CalendarEvent> {
    const headers = await this.getAuthHeaders(serverId);
    const response = await fetch(`${this.baseUrl}/events`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

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

    if (!response.ok) {
      throw new Error(`予定の更新に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 予定を削除
   */
  async deleteEvent(serverId: string, eventId: string): Promise<void> {
    const headers = await this.getAuthHeaders(serverId);
    const { "Content-Type": _, ...restHeaders } = headers as Record<string, string>;
    const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
      method: "DELETE",
      headers: restHeaders,
    });

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
