import { TrackReference } from "solid-livekit-components";
import {
  API,
  Bot,
  Channel,
  Client,
  Emoji,
  File,
  ImageEmbed,
  Message,
  MFA,
  MFATicket,
  PublicBot,
  PublicChannelInvite,
  Server,
  ServerMember,
  ServerRole,
  Session,
  User,
  VideoEmbed,
} from "stoat.js";
import { ProtocolV1 } from "stoat.js/lib/events/v1";

import type { SettingsConfigurations } from "@revolt/app";
import { CategoryData } from "@revolt/app/menus/CategoryContextMenu";
import { ScreenShareQualityName } from "@revolt/state/stores/Voice";

import type { ChangelogResponse } from "./modals/Changelog";
import type { StorageConfig } from "../../src/api/storage";
import type { CalendarEvent } from "../../src/api/calendar";
import type { Album, AlbumCategory } from "../../src/api/album";
import type { Stamp } from "../../src/api/stamp";

export type Modals =
  | {
      type: "add_bot";
      invite: PublicBot;
    }
  | {
      type: "add_friend";
      client: Client;
    }
  | {
      type: "add_members_to_group";
      client: Client;
      group: Channel;
    }
  | {
      type: "ban_member";
      member: ServerMember;
    }
  | {
      type: "ban_non_member";
      user: User;
      server: Server;
    }
  | {
      type: "changelog";
      changelog: ChangelogResponse;
    }
  | {
      type: "channel_info";
      channel: Channel;
    }
  | {
      type: "channel_toggle_mature";
      channel: Channel;
    }
  | {
      type: "create_bot";
      client: Client;
      onCreate: (bot: Bot) => void;
    }
  | {
      type: "create_category";
      server: Server;
    }
  | {
      type: "create_channel";
      server: Server;
      cb?: (channel: Channel) => void;
    }
  | {
      type: "create_group";
      client: Client;
    }
  | {
      type: "create_role";
      server: Server;
      callback: (id: string) => void;
    }
  | {
      type: "create_or_join_server";
      client: Client;
    }
  | {
      type: "create_group_or_server";
      client: Client;
    }
  | {
      type: "create_invite";
      channel: Channel;
    }
  | {
      type: "create_server";
      client: Client;
    }
  | {
      type: "create_webhook";
      channel: Channel;
      callback: (id: string) => void;
    }
  | {
      type: "custom_status";
      client: Client;
    }
  | {
      type: "delete_bot";
      bot: Bot;
    }
  | {
      type: "delete_channel";
      channel: Channel;
    }
  | {
      type: "delete_category";
      server: Server;
      categoryId: string;
    }
  | {
      type: "delete_message";
      message: Message;
    }
  | {
      type: "delete_server";
      server: Server;
    }
  | {
      type: "delete_role";
      role: ServerRole;
      cb: () => void;
    }
  | {
      type: "edit_email";
      client: Client;
    }
  | {
      type: "edit_password";
      client: Client;
    }
  | {
      type: "edit_username";
      client: Client;
    }
  | {
      type: "emoji_preview";
      emoji: Emoji;
    }
  | {
      /**
       * @deprecated build proper error handling!
       */
      type: "error";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: any;
    }
  | {
      type: "error2";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: any;
    }
  | {
      type: "image_viewer";
      embed?: ImageEmbed;
      gif?: VideoEmbed;
      file?: File;
    }
  | {
      type: "join_server";
      client: Client;
    }
  | {
      type: "kick_member";
      member: ServerMember;
    }
  | {
      type: "leave_server";
      server: Server;
    }
  | {
      type: "mfa_enable_totp";
      identifier: string;
      secret: string;
      callback: (code?: string) => void;
    }
  | ({
      type: "mfa_flow";
    } & (
      | {
          mfa: MFA;
          state: "known";
          callback: (ticket?: MFATicket) => void;
        }
      | {
          state: "unknown";
          available_methods: API.MFAMethod[];
          callback: (response?: API.MFAResponse) => void;
        }
    ))
  | { type: "mfa_recovery"; codes: string[]; mfa: MFA }
  | {
      type: "onboarding";
      callback: (username: string, loginAfterSuccess?: true) => Promise<void>;
    }
  | {
      type: "policy_change";
      changes: ProtocolV1["types"]["policyChange"][];
      acknowledge: () => Promise<void>;
    }
  | {
      type: "rename_session";
      session: Session;
    }
  | {
      type: "report_content";
      client: Client;
      target: Server | User | Message;
      contextMessage?: Message;
    }
  | {
      type: "server_identity";
      member: ServerMember;
    }
  | {
      type: "server_info";
      server: Server;
    }
  | {
      type: "invite";
      invite: PublicChannelInvite;
    }
  | {
      type: "settings";
      config: keyof typeof SettingsConfigurations;
      // eslint-disable-next-line
      context?: any;
    }
  | {
      type: "signed_out";
    }
  | {
      type: "sign_out_sessions";
      client: Client;
    }
  // unimplemented: (modals.tsx#L58)
  | {
      type: "report_success";
      user?: User;
    }
  | {
      type: "out_of_date";
      version: string;
    }
  | {
      type: "reset_bot_token";
      bot: Bot;
    }
  | {
      type: "link_warning";
      url: URL;
      display: string;
    }
  // | {
  //     type: "pending_friend_requests";
  //     users: User[];
  //   }
  | {
      type: "user_picker";
      omit?: string[];
      callback: (users: string[]) => Promise<void>;
    }
  | {
      type: "user_profile";
      user: User;
      isPlaceholder?: boolean;
      placeholderProfile?: API.UserProfile;
    }
  | {
      type: "user_profile_roles";
      member: ServerMember;
    }
  | {
      type: "user_profile_mutual_friends";
      users: User[];
    }
  | {
      type: "user_profile_mutual_groups";
      groups: (Server | Channel)[];
    }
  | {
      type: "leave_group";
      channel: Channel;
    }
  | {
      type: "close_dm";
      channel: Channel;
    }
  | {
      type: "unfriend_user";
      user: User;
    }
  | {
      type: "block_user";
      user: User;
    }
  | {
      type: "import_theme";
    }
  | {
      type: "edit_category";
      server: Server;
      category: CategoryData;
    }
  | {
      type: "remove_member";
      group: Channel;
      user: User;
    }
  | {
      type: "screen_share_settings";
      trackReference: TrackReference;
      qualities: { name: string; fullName: string }[];
      audio: boolean;
      callback: (qualityName: ScreenShareQualityName, audio: boolean) => void;
      onCancel: () => void;
    }
  | {
      type: "screen_share_picker";
      callback: (
        idx: number,
        qualityName: ScreenShareQualityName,
        audio: boolean,
      ) => void;
      qualities: { name: string; fullName: string }[];
      sources: {
        idx: number;
        name: string;
        isFullScreen: boolean;
        image?: string;
      }[];
      onCancel: () => void;
    }
  | {
      type: "create_storage";
      serverId: string;
      onCreated?: () => void;
    }
  | {
      type: "edit_storage";
      serverId: string;
      storage: StorageConfig;
      onUpdated?: () => void;
    }
  | {
      type: "delete_storage";
      serverId: string;
      storageId: string;
      storageName: string;
      onDeleted?: () => void;
    }
  | {
      type: "select_folder";
      serverId: string;
      storageId: string;
      onSelect: (folderPath: string) => void;
    }
  | {
      type: "storage_preview";
      serverId: string;
      storageId: string;
      path: string;
      name: string;
    }
  | {
      type: "create_stamp";
      serverId: string;
      onCreated?: () => void;
    }
  | {
      type: "stamp_preview";
      serverId: string;
      stamp: Stamp;
      onDeleted?: () => void;
    }
  | {
      type: "create_minecraft_server";
      serverId: string;
      onCreated?: () => void;
    }
  | {
      type: "delete_minecraft_server";
      serverId: string;
      mcId: string;
      serverName: string;
      onDeleted?: () => void;
    }
  | {
      type: "select_minecraft_jar";
      serverId: string;
      mcId: string;
      serverName: string;
      candidates: string[];
      onSelected?: () => void;
    }
  | {
      type: "change_minecraft_jar";
      serverId: string;
      mcId: string;
      serverName: string;
      currentJarPath: string | null;
      onChanged?: () => void;
    }
  | {
      type: "minecraft_text_editor";
      serverId: string;
      mcId: string;
      path: string;
      name: string;
      readOnly: boolean;
      onSaved?: () => void;
    }
  | {
      type: "upload_zip_to_folder";
      serverId: string;
      mcId: string;
      initialPath: string;
      onUploaded?: () => void;
    }
  | {
      type: "create_event";
      serverId: string;
      initialDate?: string;
      onCreated?: () => void;
    }
  | {
      type: "edit_event";
      serverId: string;
      event: CalendarEvent;
      onUpdated?: () => void;
    }
  | {
      type: "delete_event";
      serverId: string;
      eventId: string;
      eventTitle: string;
      onDeleted?: () => void;
    }
  | {
      type: "calendar_trade_color_settings";
      serverId: string;
      onChanged?: () => void;
    }
  | {
      type: "create_album";
      serverId: string;
      initialDate?: string;
      onCreated?: (album: Album) => void;
    }
  | {
      type: "edit_album";
      serverId: string;
      album: Album;
      onUpdated?: () => void;
      onDeleted?: () => void;
    }
  | {
      type: "delete_album";
      serverId: string;
      albumId: string;
      albumTitle: string;
      onDeleted?: () => void;
    }
  | {
      type: "create_album_category";
      serverId: string;
      onCreated?: (category: AlbumCategory) => void;
    };
