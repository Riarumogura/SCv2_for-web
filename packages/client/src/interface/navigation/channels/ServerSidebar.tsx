import { BiRegularCheckCircle, BiSolidCheckCircle } from "solid-icons/bi";
import {
  Accessor,
  JSX,
  Match,
  Setter,
  Show,
  Switch,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";

import { useLingui } from "@lingui-solid/solid/macro";
import type { API, Channel, Server, ServerFlags } from "stoat.js";
import { styled } from "styled-system/jsx";

import { KeybindAction, createKeybind } from "@revolt/keybinds";
import { TextWithEmoji } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import {
  Column,
  Draggable,
  Header,
  IconButton,
  MenuButton,
  OverflowingText,
  Row,
  Tooltip,
  iconSize,
  symbolSize,
  typography,
} from "@revolt/ui";
import { VoiceChannelPreview } from "@revolt/ui/components/features/voice/VoiceChannelPreview";
import { createDragHandle } from "@revolt/ui/components/utils/Draggable";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import MdChevronRight from "@material-design-icons/svg/filled/chevron_right.svg?component-solid";

import MdSettings from "@material-symbols/svg-400/outlined/settings-fill.svg?component-solid";
import MdStorage from "@material-symbols/svg-400/outlined/cloud-fill.svg?component-solid";
import MdCalendar from "@material-symbols/svg-400/outlined/calendar_month-fill.svg?component-solid";
import MdAlbum from "@material-symbols/svg-400/outlined/photo_library-fill.svg?component-solid";
import MdGameClips from "@material-symbols/svg-400/outlined/videocam-fill.svg?component-solid";
import MdMinecraft from "@material-symbols/svg-400/outlined/sports_esports-fill.svg?component-solid";

import { useStorageApi, StorageConfig } from "../../../api/storage";
import { requestOpenStorage } from "../../../api/storageExplorerSignal";
import { requestOpenCalendar } from "../../../api/calendarExplorerSignal";
import { requestOpenAlbum } from "../../../api/albumExplorerSignal";
import { requestOpenGameClips } from "../../../api/gameClipsExplorerSignal";
import { useMinecraftApi, McServer, MC_STATUS_LABELS } from "../../../api/minecraft";
import { requestOpenMinecraft } from "../../../api/minecraftExplorerSignal";

import { SidebarBase } from "./common";

interface Props {
  /**
   * Server to display sidebar for
   */
  server: Server;

  /**
   * Currently selected channel ID
   */
  channelId: string | undefined;

  /**
   * Open server information modal
   */
  openServerInfo: () => void;

  /**
   * Open server settings modal
   */
  openServerSettings: () => void;

  /**
   * Menu generator
   */
  menuGenerator: (target: Server | Channel) => JSX.Directives["floating"];
}

/**
 * Ordered category data returned from server
 */
type CategoryData = Omit<API.Category, "channels"> & { channels: Channel[] };

type OrderingEvent =
  | {
      type: "categories";
      ids: string[];
    }
  | {
      type: "category";
      id: string;
      channelIds: string[];
      moved: boolean;
    };

/**
 * Display server information and channels
 */
export const ServerSidebar = (props: Props) => {
  const navigate = useNavigate();
  const { openModal } = useModals();
  const state = useState();

  // CUSTOM: ストレージ/Minecraftセクションの開閉状態(サーバーごとに記憶、デフォルトは閉)。
  // カレンダー/アルバムは中に一覧を持たずクリックで直接パネルを開くだけなので開閉状態は不要。
  const isStorageSectionOpen = () =>
    state.layout.getSectionState(`sidebar-storage:${props.server.id}`, false);
  const toggleStorageSection = () =>
    state.layout.toggleSectionState(`sidebar-storage:${props.server.id}`, false);
  const isMinecraftSectionOpen = () =>
    state.layout.getSectionState(`sidebar-minecraft:${props.server.id}`, false);
  const toggleMinecraftSection = () =>
    state.layout.toggleSectionState(`sidebar-minecraft:${props.server.id}`, false);

  // Users can manage certain parts of the server individually, regardless of their ManageServer Permission
  const canManageServer = () =>
    props.server.orPermission(
      "ManageServer",
      "ManageCustomisation",
      "ManageRole",
      "ManagePermissions",
    );

  // TODO: this does not filter visible channels at the moment because the state for categories is not stored anywhere
  /** Gets a list of channels that are currently not hidden inside a closed category */
  const visibleChannels = () =>
    props.server.orderedChannels.flatMap((category) => category.channels);

  // TODO: when navigating channels, we want to add aria-keyshortcuts={localized-shortcut} to the next/previous channels
  // https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-keyshortcuts
  // TODO: issue warning if nothing is found somehow? warnings can be nicer than flat out not working
  // TODO: we want it to feel smooth when navigating through channels, so we'll want to select channels immediately but not actually navigate until we're done moving through them
  /** Navigates to the channel offset from the current one, wrapping around if needed */
  const _navigateChannel = (byOffset: number) => {
    if (props.channelId == null) {
      return;
    }

    const channels = visibleChannels();

    const currentChannelIndex = channels.findIndex(
      (channel) => channel.id === props.channelId,
    );

    // this will wrap the index around
    const nextChannel = channels.at(
      (currentChannelIndex + byOffset) % channels.length,
    );

    if (nextChannel) {
      navigate(`/server/${props.server.id}/channel/${nextChannel.id}`);
    }
  };

  // todo: I think these cause the infinite hang bug:

  // createKeybind(KeybindAction.NAVIGATION_CHANNEL_UP, () => navigateChannel(-1));

  // createKeybind(KeybindAction.NAVIGATION_CHANNEL_DOWN, () =>
  //   navigateChannel(1),
  // );

  createKeybind(KeybindAction.CHAT_MARK_SERVER_AS_READ, () => {
    if (props.server.unread) {
      props.server.ack();
    }
  });

  const noOrdering = () => !props.server.havePermission("ManageChannel");

  let heldEvent: OrderingEvent & { type: "category" } = null!;
  function handleOrdering(event: OrderingEvent) {
    if (event.type === "category" && event.moved && !heldEvent) {
      heldEvent = event;
      return;
    }

    const normalisedCategories = props.server.orderedChannels.map(
      (category) => ({
        ...category,
        channels: category.channels.map((channel) => channel.id),
      }),
    );

    if (event.type === "categories") {
      props.server.edit({
        categories: event.ids
          .map((id) => normalisedCategories.find((cat) => cat.id === id)!)
          .filter((cat) => cat),
      });
    } else {
      props.server.edit({
        categories: normalisedCategories.map((category) => {
          if (heldEvent && category.id === heldEvent.id) {
            return {
              ...category,
              channels: heldEvent.channelIds,
            };
          } else if (category.id === event.id) {
            return {
              ...category,
              channels: event.channelIds,
            };
          } else {
            return category;
          }
        }),
      });

      heldEvent = null!;
    }
  }

  // CUSTOM: ストレージメニューを追加
  const storageApi = useStorageApi();
  const [storages, setStorages] = createSignal<StorageConfig[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [serverLimits, setServerLimits] = createSignal<{
    used: number;
    limit: number;
    percentage: number;
  } | null>(null);

  // ストレージ一覧を取得
  const loadStorages = async () => {
    try {
      setLoading(true);
      const list = await storageApi.getStorages(props.server.id);
      setStorages(list);
    } catch (error) {
      console.error("ストレージ一覧の取得に失敗しました:", error);
    } finally {
      setLoading(false);
    }
  };

  // サーバー全体の容量上限情報を取得
  const loadServerLimits = async () => {
    try {
      const limits = await storageApi.getServerLimits(props.server.id);
      setServerLimits(limits);
    } catch (error) {
      console.error("サーバー容量情報の取得に失敗しました:", error);
    }
  };

  const refreshStorages = () => {
    loadStorages();
    loadServerLimits();
  };

  onMount(() => {
    refreshStorages();
  });

  // バイト数を読みやすい容量表記に変換
  const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;

  // ストレージ作成モーダルを開く
  const openCreateStorageModal = () => {
    openModal({
      type: "create_storage",
      serverId: props.server.id,
      onCreated: refreshStorages,
    });
  };

  // ストレージ編集モーダルを開く
  const openEditStorageModal = (storage: StorageConfig) => {
    openModal({
      type: "edit_storage",
      serverId: props.server.id,
      storage,
      onUpdated: refreshStorages,
    });
  };

  // ストレージ削除モーダルを開く
  const openDeleteStorageModal = (storage: StorageConfig) => {
    openModal({
      type: "delete_storage",
      serverId: props.server.id,
      storageId: storage.id,
      storageName: storage.name,
      onDeleted: refreshStorages,
    });
  };

  // ストレージエクスプローラーを開く
  const openStorage = (storageId: string) => {
    requestOpenStorage({ serverId: props.server.id, storageId });
  };

  // CUSTOM: カレンダーを開く
  const openCalendar = () => {
    requestOpenCalendar({ serverId: props.server.id });
  };

  // CUSTOM: アルバムを開く
  const openAlbum = () => {
    requestOpenAlbum({ serverId: props.server.id });
  };

  // CUSTOM: GameClipsを開く
  const openGameClips = () => {
    requestOpenGameClips({ serverId: props.server.id });
  };

  // CUSTOM: トレードカラー設定モーダルを開く
  const openTradeColorSettings = () => {
    openModal({
      type: "calendar_trade_color_settings",
      serverId: props.server.id,
    });
  };

  // CUSTOM: Minecraftサーバー管理メニューを追加。一覧表示は全メンバー可だが、
  // 作成・起動・停止・削除はManageServer権限を持つ場合のみ(canManageServer())。
  const minecraftApi = useMinecraftApi();
  const [mcServers, setMcServers] = createSignal<McServer[]>([]);
  const [mcLoading, setMcLoading] = createSignal(false);
  const [mcBusyIds, setMcBusyIds] = createSignal<Set<string>>(new Set());

  const refreshMcServers = async () => {
    try {
      setMcLoading(true);
      const list = await minecraftApi.listServers(props.server.id);
      setMcServers(list);
    } catch (error) {
      console.error("Minecraftサーバー一覧の取得に失敗しました:", error);
    } finally {
      setMcLoading(false);
    }
  };

  onMount(() => {
    refreshMcServers();
  });

  const setMcBusy = (mcId: string, busy: boolean) => {
    setMcBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(mcId);
      else next.delete(mcId);
      return next;
    });
  };

  const openCreateMinecraftServerModal = () => {
    openModal({
      type: "create_minecraft_server",
      serverId: props.server.id,
      onCreated: refreshMcServers,
    });
  };

  const openDeleteMinecraftServerModal = (server: McServer) => {
    openModal({
      type: "delete_minecraft_server",
      serverId: props.server.id,
      mcId: server.mcId,
      serverName: server.name,
      onDeleted: refreshMcServers,
    });
  };

  const openMinecraft = () => {
    requestOpenMinecraft({ serverId: props.server.id });
  };

  // CUSTOM: 起動jar候補が複数あり選択待ちの場合は、行クリックで選択モーダルを開く
  // (この状態のサーバーは選択完了までstartできない)
  const openSelectMinecraftJarModal = (server: McServer) => {
    openModal({
      type: "select_minecraft_jar",
      serverId: props.server.id,
      mcId: server.mcId,
      serverName: server.name,
      candidates: server.pendingJarCandidates ?? [],
      onSelected: refreshMcServers,
    });
  };

  // CUSTOM: 親のStorageItemActions divがonClickでstopPropagationしているため、
  // ここで個別にイベント伝播を止める必要はない(クリックでopenMinecraftが誘発されない)
  const startMcServer = async (server: McServer) => {
    setMcBusy(server.mcId, true);
    try {
      const updated = await minecraftApi.startServer(props.server.id, server.mcId);
      setMcServers((prev) => prev.map((s) => (s.mcId === updated.mcId ? updated : s)));
    } catch (error) {
      console.error("Minecraftサーバーの起動に失敗しました:", error);
    } finally {
      setMcBusy(server.mcId, false);
    }
  };

  const stopMcServer = async (server: McServer) => {
    setMcBusy(server.mcId, true);
    try {
      const updated = await minecraftApi.stopServer(props.server.id, server.mcId);
      setMcServers((prev) => prev.map((s) => (s.mcId === updated.mcId ? updated : s)));
    } catch (error) {
      console.error("Minecraftサーバーの停止に失敗しました:", error);
    } finally {
      setMcBusy(server.mcId, false);
    }
  };


  return (
    <SidebarBase use:floating={props.menuGenerator(props.server)}>
      <Switch
        fallback={
          <Header placement="secondary">
            <ServerInfo
              server={props.server}
              canManageServer={canManageServer()}
              openServerInfo={props.openServerInfo}
              openServerSettings={props.openServerSettings}
            />
          </Header>
        }
      >
        <Match when={props.server.banner}>
          <Header
            image
            placement="secondary"
            style={{
              background: `url('${props.server.bannerURL}')`,
            }}
          >
            <ServerInfo
              server={props.server}
              canManageServer={canManageServer()}
              openServerInfo={props.openServerInfo}
              openServerSettings={props.openServerSettings}
            />
          </Header>
        </Match>
      </Switch>
      <div
        use:invisibleScrollable
        style={{ "flex-grow": 1, "min-height": 0 }}
        use:floating={props.menuGenerator(props.server)}
      >
        <Draggable
          dragHandles
          type="category"
          disabled={noOrdering()}
          items={props.server.orderedChannels}
          onChange={(ids) => handleOrdering({ type: "categories", ids })}
        >
          {(entry) => (
            <Category
              server={props.server}
              category={entry.item}
              channelId={props.channelId}
              menuGenerator={props.menuGenerator}
              dragDisabled={entry.dragDisabled}
              setDragDisabled={entry.setDragDisabled}
              noOrdering={noOrdering}
              handleOrdering={handleOrdering}
            />
          )}
        </Draggable>
      </div>

      {/* CUSTOM: カレンダー/アルバム/ストレージ/Minecraftのメニューは、チャンネル一覧の
          スクロールに合わせて流れていかないよう、スクロール領域(上のdiv)の外側に
          常時表示のフッターとして配置する。この領域自体は`use:floating`配下に無いため、
          以前必要だった右クリックメニューの伝播ブロック(contextmenu capture)は不要になった */}
      <FooterMenuList use:invisibleScrollable>
        <SidebarMenuSection>
          <SidebarMenuHeader onClick={openCalendar}>
            <Row align gap="sm">
              <MdCalendar {...iconSize(16)} />
              <span style={{ "font-weight": "bold" }}>カレンダー</span>
            </Row>
            {/* CUSTOM: IconButton(最小高さ32px)を使うとヘッダーの高さが他の3メニューより
                大きくなってしまうため、シェブロンと同じ大きさのアイコンを直接クリック領域にする。
                クリックの伝播を止め、親(カレンダーを開く)が発火しないようにする */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                openTradeColorSettings();
              }}
              style={{ display: "flex", cursor: "pointer" }}
            >
              <Tooltip content="トレードカラー設定" placement="top">
                <Symbol size={16}>edit</Symbol>
              </Tooltip>
            </div>
          </SidebarMenuHeader>
        </SidebarMenuSection>

        {/* CUSTOM: アルバムメニュー。カテゴリ作成はアルバムパネル内の検索フォームから
            行うため、ここには歯車アイコンは置かない */}
        <SidebarMenuSection>
          <SidebarMenuHeader onClick={openAlbum}>
            <Row align gap="sm">
              <MdAlbum {...iconSize(16)} />
              <span style={{ "font-weight": "bold" }}>アルバム</span>
            </Row>
          </SidebarMenuHeader>
        </SidebarMenuSection>

        {/* CUSTOM: GameClipsメニュー。カテゴリ作成はパネル内のカテゴリタブから行うため、
            ここには歯車アイコンは置かない */}
        <SidebarMenuSection>
          <SidebarMenuHeader onClick={openGameClips}>
            <Row align gap="sm">
              <MdGameClips {...iconSize(16)} />
              <span style={{ "font-weight": "bold" }}>GameClips</span>
            </Row>
          </SidebarMenuHeader>
        </SidebarMenuSection>

        {/* CUSTOM: ストレージメニュー。一覧・容量バー・作成ボタンはクリックで開閉する */}
        <SidebarMenuSection>
          <SidebarMenuHeader onClick={toggleStorageSection}>
            <Row align gap="sm">
              <MdStorage {...iconSize(16)} />
              <span style={{ "font-weight": "bold" }}>ストレージ</span>
            </Row>
            <MdChevronRight {...iconSize(14)} data-open={isStorageSectionOpen()} />
          </SidebarMenuHeader>

          <Show when={isStorageSectionOpen()}>
            <SidebarMenuBody>
              <Show when={serverLimits()}>
                {(limits) => (
                  <ServerStorageUsage>
                    <StorageUsage>
                      <div
                        style={{
                          width: `${Math.min(100, limits().percentage)}%`,
                          height: "100%",
                          background:
                            limits().percentage >= 90
                              ? "var(--md-sys-color-error)"
                              : "var(--md-sys-color-primary)",
                          "border-radius": "1px",
                        }}
                      />
                    </StorageUsage>
                    <span style={{ "font-size": "11px" }}>
                      サーバー全体: {formatBytes(limits().used)} / {formatBytes(limits().limit)} (
                      {limits().percentage}%)
                    </span>
                  </ServerStorageUsage>
                )}
              </Show>

              <SidebarCreateButton onClick={openCreateStorageModal}>
                <Symbol size={16}>add</Symbol>
                新しいストレージを作成
              </SidebarCreateButton>

              <Show
                when={storages().length > 0}
                fallback={
                  <StorageEmptyState>
                    ストレージがありません
                  </StorageEmptyState>
                }
              >
                <StorageList>
                  {storages().map((storage) => (
                    <StorageItem
                      onClick={() => openStorage(storage.id)}
                    >
                      <Row align gap="sm" style={{ "justify-content": "space-between" }}>
                        <Row align gap="sm" style={{ overflow: "hidden" }}>
                          <Symbol size={16}>folder</Symbol>
                          <OverflowingText style={{ "font-size": "13px" }}>
                            {storage.name}
                          </OverflowingText>
                        </Row>
                        <StorageItemActions
                          onClick={(e: MouseEvent) => e.stopPropagation()}
                        >
                          <IconButton
                            size="xs"
                            variant="standard"
                            onPress={() => openEditStorageModal(storage)}
                          >
                            <Symbol size={14}>edit</Symbol>
                          </IconButton>
                          <IconButton
                            size="xs"
                            variant="standard"
                            onPress={() => openDeleteStorageModal(storage)}
                          >
                            <Symbol size={14}>delete</Symbol>
                          </IconButton>
                        </StorageItemActions>
                      </Row>
                      <StorageUsage>
                        <div
                          style={{
                            width: `${Math.min(100, (storage.usedSize / storage.sizeLimit) * 100)}%`,
                            height: "2px",
                            background: "var(--md-sys-color-primary)",
                            "border-radius": "1px",
                          }}
                        />
                      </StorageUsage>
                      <span style={{ "font-size": "11px", opacity: 0.7 }}>
                        {formatBytes(storage.usedSize)} / {formatBytes(storage.sizeLimit)}
                      </span>
                    </StorageItem>
                  ))}
                </StorageList>
              </Show>
            </SidebarMenuBody>
          </Show>
        </SidebarMenuSection>

        {/* CUSTOM: Minecraftサーバー管理メニュー。一覧表示・作成ボタンはクリックで開閉する。
            一覧表示は全メンバー可だが、作成・起動・停止・削除はManageServer権限を持つ場合のみ */}
        <SidebarMenuSection>
          <SidebarMenuHeader onClick={toggleMinecraftSection}>
            <Row align gap="sm">
              <MdMinecraft {...iconSize(16)} />
              <span style={{ "font-weight": "bold" }}>Minecraft</span>
            </Row>
            <MdChevronRight {...iconSize(14)} data-open={isMinecraftSectionOpen()} />
          </SidebarMenuHeader>

          <Show when={isMinecraftSectionOpen()}>
            <SidebarMenuBody>
              <Show when={canManageServer()}>
                <SidebarCreateButton onClick={openCreateMinecraftServerModal}>
                  <Symbol size={16}>add</Symbol>
                  新しいMinecraftサーバーを作成
                </SidebarCreateButton>
              </Show>

              <Show
                when={mcServers().length > 0}
                fallback={
                  <StorageEmptyState>
                    {mcLoading() ? "読み込み中..." : "Minecraftサーバーがありません"}
                  </StorageEmptyState>
                }
              >
                <StorageList>
                  {mcServers().map((server) => (
                    <StorageItem
                      onClick={() =>
                        server.status === "PENDING_JAR_SELECTION"
                          ? openSelectMinecraftJarModal(server)
                          : openMinecraft()
                      }
                    >
                      <Row align gap="sm" style={{ "justify-content": "space-between" }}>
                        <Row align gap="sm" style={{ overflow: "hidden" }}>
                          <Symbol size={16}>
                            {server.status === "RUNNING"
                              ? "play_circle"
                              : server.status === "PENDING_JAR_SELECTION"
                                ? "help"
                                : "stop_circle"}
                          </Symbol>
                          <OverflowingText style={{ "font-size": "13px" }}>
                            {server.name}
                          </OverflowingText>
                        </Row>
                        <StorageItemActions onClick={(e: MouseEvent) => e.stopPropagation()}>
                          <Show when={canManageServer()}>
                            <Show
                              when={server.status === "PENDING_JAR_SELECTION"}
                              fallback={
                                <Show
                                  when={server.status === "RUNNING" || server.status === "STARTING"}
                                  fallback={
                                    <Tooltip content="起動" placement="top">
                                      <IconButton
                                        size="xs"
                                        variant="standard"
                                        isDisabled={mcBusyIds().has(server.mcId)}
                                        onPress={() => startMcServer(server)}
                                      >
                                        <Symbol size={14}>play_arrow</Symbol>
                                      </IconButton>
                                    </Tooltip>
                                  }
                                >
                                  <Tooltip content="停止" placement="top">
                                    <IconButton
                                      size="xs"
                                      variant="standard"
                                      isDisabled={mcBusyIds().has(server.mcId)}
                                      onPress={() => stopMcServer(server)}
                                    >
                                      <Symbol size={14}>stop</Symbol>
                                    </IconButton>
                                  </Tooltip>
                                </Show>
                              }
                            >
                              <Tooltip content="起動するjarファイルを選択" placement="top">
                                <IconButton
                                  size="xs"
                                  variant="standard"
                                  onPress={() => openSelectMinecraftJarModal(server)}
                                >
                                  <Symbol size={14}>list</Symbol>
                                </IconButton>
                              </Tooltip>
                            </Show>
                            <IconButton
                              size="xs"
                              variant="standard"
                              onPress={() => openDeleteMinecraftServerModal(server)}
                            >
                              <Symbol size={14}>delete</Symbol>
                            </IconButton>
                          </Show>
                        </StorageItemActions>
                      </Row>
                      <span style={{ "font-size": "11px", opacity: 0.7 }}>
                        {MC_STATUS_LABELS[server.status]} ・ {server.type} {server.version} ・
                        ポート{server.port}
                      </span>
                    </StorageItem>
                  ))}
                </StorageList>
              </Show>
            </SidebarMenuBody>
          </Show>
        </SidebarMenuSection>
      </FooterMenuList>
    </SidebarBase>
  );
};

/**
 * Server Information
 */
function ServerInfo(
  props: Pick<Props, "server" | "openServerInfo" | "openServerSettings"> & {
    canManageServer: boolean;
  },
) {
  return (
    <Row align grow minWidth={0}>
      <ServerBadge flags={props.server.flags} />
      <ServerName onClick={props.openServerInfo}>
        <TextWithEmoji content={props.server.name} />
      </ServerName>
      {/* CUSTOM: ストレージ追加・予定変更等が即時反映されないため、サーバー全体を
          リロードするボタンを設定の歯車の左に追加 */}
      <Tooltip content="サーバーを再読み込み" placement="top">
        <IconButton
          size="xs"
          width="narrow"
          variant={props.server.banner ? "_header" : "standard"}
          onPress={() => window.location.reload()}
        >
          <Symbol size={20}>refresh</Symbol>
        </IconButton>
      </Tooltip>
      <Show when={props.canManageServer}>
        <IconButton
          size="xs"
          width="narrow"
          variant={props.server.banner ? "_header" : "standard"}
          onPress={props.openServerSettings}
        >
          <MdSettings {...symbolSize(24)} />
        </IconButton>
      </Show>
    </Row>
  );
}

/**
 * Server name
 */
const ServerName = styled("a", {
  base: {
    flexGrow: 1,
    minWidth: 0,

    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});

/**
 * Server badge
 */
function ServerBadge(props: { flags: ServerFlags }) {
  const { t } = useLingui();

  return (
    <Show when={props.flags}>
      <Tooltip
        content={props.flags === 1 ? t`Official Server` : t`Verified`}
        placement="top"
      >
        {props.flags === 1 ? (
          <BiSolidCheckCircle size={12} />
        ) : (
          <BiRegularCheckCircle size={12} />
        )}
      </Tooltip>
    </Show>
  );
}

/**
 * Single category entry
 */
function Category(
  props: {
    server: Server;
    category: CategoryData;
    channelId: string | undefined;
    noOrdering: Accessor<boolean>;
    handleOrdering: (event: OrderingEvent) => void;
  } & Pick<Props, "menuGenerator"> & {
      dragDisabled: Accessor<boolean>;
      setDragDisabled: Setter<boolean>;
    },
) {
  const state = useState();
  const isOpen = () => state.layout.getSectionState(props.category.id, true);

  const channels = createMemo(() =>
    props.category.channels.filter(
      (channel) =>
        props.category.id === "default" ||
        isOpen() ||
        channel.unread ||
        channel.id === props.channelId,
    ),
  );

  return (
    <CategorySection>
      <Show when={props.category.id !== "default"}>
        <div use:floating={props.menuGenerator(props.category as never)}>
          <CategoryBase
            open={isOpen()}
            onClick={() => {
              state.layout.toggleSectionState(props.category.id, true);
            }}
            {...createDragHandle(props.dragDisabled, props.setDragDisabled)}
          >
            {props.category.title}
            <MdChevronRight {...iconSize(12)} />
          </CategoryBase>
        </div>
      </Show>
      <Draggable
        type="channels"
        items={channels()}
        onChange={(channelIds) => {
          const current = channels();
          props.handleOrdering({
            type: "category",
            id: props.category.id,
            channelIds,
            moved: channelIds.length !== current.length,
          });
        }}
        disabled={props.noOrdering() || !isOpen()}
        minimumDropAreaHeight="32px"
      >
        {(entry) => (
          <Entry
            channel={entry.item}
            active={entry.item.id === props.channelId}
            menuGenerator={props.menuGenerator}
          />
        )}
      </Draggable>
    </CategorySection>
  );
}

const CategorySection = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-md)",
    flexDirection: "column",
    paddingBlock: "var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    background: "var(--md-sys-color-surface-container-low)",
  },
});

/**
 * Category title styling
 */
const CategoryBase = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",

    padding: "0 var(--gap-sm)",
    paddingLeft: "calc(var(--gap-lg) + 5px)",
    paddingTop: "10px",

    cursor: "pointer",
    userSelect: "none",
    transition: "var(--transitions-fast) all",

    "--color": "var(--md-sys-color-on-surface)",
    color: "var(--color)",
    fill: "var(--color)",

    ...typography.raw({ class: "label", size: "small" }),
    fontSize: "13px",

    "&:hover": {
      "--color": "var(--md-sys-color-on-surface-variant)",
    },

    "& svg": {
      transition: "var(--transitions-fast) transform",
    },
  },
  variants: {
    open: {
      true: {
        "& svg": {
          transform: "rotateZ(90deg)",
        },
      },
    },
  },
});

/**
 * Server channel entry
 */
function Entry(
  props: { channel: Channel; active: boolean } & Pick<Props, "menuGenerator">,
) {
  const state = useState();
  const voice = useVoice();
  const { openModal } = useModals();

  const canEditChannel = createMemo(() =>
    (["ManageChannel", "ManagePermissions", "ManageWebhooks"] as const).some(
      (perm) => props.channel.server?.havePermission(perm),
    ),
  );

  const canInvite = createMemo(() =>
    props.channel.server?.havePermission("InviteOthers"),
  );

  const alertState = createMemo(
    () =>
      !props.active &&
      props.channel.unread &&
      (props.channel.mentions?.size || true),
  );

  const inCall = () => props.channel.id === voice.channel()?.id;

  const attentionState = createMemo(() =>
    props.active
      ? "selected"
      : inCall()
        ? "active"
        : state.notifications.isChannelMuted(props.channel)
          ? "muted"
          : props.channel.unread
            ? "active"
            : "normal",
  );

  return (
    <a href={`/server/${props.channel.serverId}/channel/${props.channel.id}`}>
      <Column gap="sm">
        <MenuButton
          use:floating={props.menuGenerator(props.channel)}
          size="normal"
          alert={alertState()}
          attention={attentionState()}
          icon={
            <>
              <Switch fallback={<Symbol>grid_3x3</Symbol>}>
                <Match when={props.channel.isVoice}>
                  <Symbol
                    color={inCall() ? "var(--md-sys-color-primary)" : undefined}
                  >
                    headset_mic
                  </Symbol>
                </Match>
              </Switch>
              <Show when={props.channel.icon}>
                <ChannelIcon
                  src={props.channel.iconURL}
                  css={{ marginEnd: "0.2em" }}
                />
              </Show>
            </>
          }
          actions={
            <>
              <Show when={canInvite()}>
                <a
                  use:floating={{
                    tooltip: { placement: "top", content: "Create Invite" },
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    openModal({
                      type: "create_invite",
                      channel: props.channel,
                    });
                  }}
                >
                  <Symbol size={16} fill>
                    person_add
                  </Symbol>
                </a>
              </Show>

              <Show when={canEditChannel()}>
                <a
                  use:floating={{
                    tooltip: { placement: "top", content: "Edit Channel" },
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    openModal({
                      type: "settings",
                      config: "channel",
                      context: props.channel,
                    });
                  }}
                >
                  <Symbol size={16} fill>
                    settings
                  </Symbol>
                </a>
              </Show>
            </>
          }
        >
          <OverflowingText>
            <TextWithEmoji content={props.channel.name!} />
          </OverflowingText>
        </MenuButton>

        <VoiceChannelPreview channel={props.channel} />
      </Column>
    </a>
  );
}

/**
 * Channel icon styling
 */
const ChannelIcon = styled("img", {
  base: {
    width: "16px",
    height: "16px",
    objectFit: "contain",
  },
});

// CUSTOM: カレンダー/アルバム/ストレージ/Minecraftのメニューをまとめて、チャンネル一覧の
// スクロールとは独立した「常時表示のフッター」として配置するための領域。展開状態が
// 重なって伸びてもサイドバー全体からはみ出さないよう、自身の高さを上限付きで内部スクロールする
const FooterMenuList = styled("div", {
  base: {
    flexShrink: 0,
    maxHeight: "50%",
    overflowY: "auto",
    paddingBottom: "var(--gap-md)",
  },
});

// CUSTOM: カレンダー/アルバム/ストレージ/Minecraft共通のメニュー枠。見た目を統一するため
// 4機能すべてがこの箱(SidebarMenuSection)+クリック可能なヘッダー(SidebarMenuHeader)
// の組み合わせを使う。一覧を持つストレージ/Minecraftだけがヘッダークリックで開閉する
const SidebarMenuSection = styled("div", {
  base: {
    marginTop: "var(--gap-lg)",
    borderRadius: "var(--borderRadius-sm)",
    background: "var(--md-sys-color-surface-container-low)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    overflow: "hidden",
  },
});

// CUSTOM: クリック可能なヘッダー行。右端に開閉用シェブロン(MdChevronRight,
// data-open='true'の時だけ90度回転)や設定ボタン等を置く。歯車等のIconButtonは
// ボタンの中にbuttonをネストできないため、divをクリック領域として使う
const SidebarMenuHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--gap-xs)",
    width: "100%",
    padding: "var(--gap-sm)",
    cursor: "pointer",
    transition: "var(--transitions-fast) background",
    color: "inherit",
    font: "inherit",
    textAlign: "left",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },

    "& svg": {
      transition: "var(--transitions-fast) transform",
    },
    "& svg[data-open='true']": {
      transform: "rotateZ(90deg)",
    },
  },
});

// CUSTOM: 開閉時に表示される本体(一覧・容量バー・作成ボタン等)
const SidebarMenuBody = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    padding: "0 var(--gap-sm) var(--gap-sm)",
  },
});

// CUSTOM: 一覧の有無に関わらず常に表示する「作成」ボタン(本体の最上部に置く)
const SidebarCreateButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-xs)",
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px dashed var(--md-sys-color-outline-variant)",
    background: "transparent",
    color: "var(--md-sys-color-on-surface-variant)",
    font: "inherit",
    fontSize: "13px",
    cursor: "pointer",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },
  },
});

const StorageEmptyState = styled("div", {
  base: {
    padding: "var(--gap-md)",
    textAlign: "center",
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const StorageList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
  },
});

const ServerStorageUsage = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    padding: "var(--gap-xs) var(--gap-sm)",
    marginBottom: "var(--gap-sm)",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const StorageItem = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    cursor: "pointer",
    transition: "var(--transitions-fast) background",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },
  },
});

const StorageItemActions = styled("div", {
  base: {
    display: "flex",
    gap: "2px",
    flexShrink: 0,
  },
});

const StorageUsage = styled("div", {
  base: {
    height: "2px",
    background: "var(--md-sys-color-surface-container-highest)",
    borderRadius: "1px",
    overflow: "hidden",
  },
});