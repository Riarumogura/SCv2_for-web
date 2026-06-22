// CUSTOM: Minecraftサーバー管理パネル(一覧+選択中サーバーのコンソール/コマンド入力)
// CUSTOM: lingui(<Trans>)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうため
// 日本語をハードコードしている(storage系モーダルの既知バグと同種)
import {
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { IconButton } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import {
  useMinecraftApi,
  McServer,
  McServerStatus,
} from "../../../api/minecraft";

interface MinecraftExplorerProps {
  serverId: string;
}

const MC_STATUS_LABELS: Record<McServerStatus, string> = {
  CREATED: "未起動",
  STARTING: "起動中",
  RUNNING: "オンライン",
  STOPPING: "停止中",
  STOPPED: "停止済み",
  ERROR: "エラー",
};

const MAX_LOG_LINES = 500;

/**
 * Minecraftサーバー管理パネル
 */
export function MinecraftExplorer(props: MinecraftExplorerProps) {
  const minecraftApi = useMinecraftApi();
  const client = useClient();

  // CUSTOM: 一覧表示は全メンバー可だが、作成・起動・停止・コマンド送信・削除は
  // ManageServer権限を持つ場合のみ(ServerSidebar.tsxのcanManageServerと同じ判定)
  const canManageServer = () =>
    client()
      ?.servers.get(props.serverId)
      ?.orPermission(
        "ManageServer",
        "ManageCustomisation",
        "ManageRole",
        "ManagePermissions",
      ) ?? false;

  const [servers, setServers] = createSignal<McServer[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [selectedMcId, setSelectedMcId] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [logLines, setLogLines] = createSignal<string[]>([]);
  const [command, setCommand] = createSignal("");
  const [sendingCommand, setSendingCommand] = createSignal(false);
  let logContainer: HTMLDivElement | undefined;
  let ws: WebSocket | undefined;

  const selectedServer = () => servers().find((s) => s.mcId === selectedMcId());

  const refreshServers = async () => {
    try {
      setLoading(true);
      const list = await minecraftApi.listServers(props.serverId);
      setServers(list);
    } catch (error) {
      console.error("Minecraftサーバー一覧の取得に失敗しました:", error);
    } finally {
      setLoading(false);
    }
  };

  createEffect(
    on(
      () => props.serverId,
      () => refreshServers(),
    ),
  );

  function closeConsole() {
    ws?.close();
    ws = undefined;
  }

  function openConsole(mcId: string) {
    closeConsole();
    setLogLines([]);
    setSelectedMcId(mcId);

    const url = minecraftApi.consoleWsUrl(props.serverId, mcId);
    ws = new WebSocket(url);
    ws.onmessage = (event) => {
      setLogLines((prev) => {
        const next = [...prev, event.data as string];
        return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
      });
      // CUSTOM: 新しい行が来たら自動的に最下部までスクロールする
      requestAnimationFrame(() => {
        if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
      });
    };
    ws.onerror = () => {
      setLogLines((prev) => [...prev, "[クライアント] コンソール接続でエラーが発生しました"]);
    };
  }

  onCleanup(() => closeConsole());

  async function refreshOne(mcId: string) {
    try {
      const updated = await minecraftApi.getServer(props.serverId, mcId);
      setServers((prev) => prev.map((s) => (s.mcId === updated.mcId ? updated : s)));
    } catch (error) {
      console.error("Minecraftサーバー状態の取得に失敗しました:", error);
    }
  }

  async function handleStart(server: McServer) {
    setBusy(true);
    try {
      const updated = await minecraftApi.startServer(props.serverId, server.mcId);
      setServers((prev) => prev.map((s) => (s.mcId === updated.mcId ? updated : s)));
      // CUSTOM: 起動直後はコンテナがまだログを出し始めていないことがあるが、
      // WebSocketは接続後に出力されたログを順次受け取れるので先に開いておく
      openConsole(server.mcId);
    } catch (error) {
      console.error("Minecraftサーバーの起動に失敗しました:", error);
    } finally {
      setBusy(false);
    }
  }

  async function handleStop(server: McServer) {
    setBusy(true);
    try {
      const updated = await minecraftApi.stopServer(props.serverId, server.mcId);
      setServers((prev) => prev.map((s) => (s.mcId === updated.mcId ? updated : s)));
    } catch (error) {
      console.error("Minecraftサーバーの停止に失敗しました:", error);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendCommand() {
    const server = selectedServer();
    const trimmed = command().trim();
    if (!server || !trimmed) return;

    setSendingCommand(true);
    try {
      const response = await minecraftApi.sendCommand(props.serverId, server.mcId, trimmed);
      setLogLines((prev) => [...prev, `> ${trimmed}`, response]);
      setCommand("");
      requestAnimationFrame(() => {
        if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
      });
    } catch (error) {
      setLogLines((prev) => [...prev, `> ${trimmed}`, `[エラー] ${(error as Error).message}`]);
    } finally {
      setSendingCommand(false);
    }
  }

  return (
    <Container>
      <Section>
        <SectionHeader>
          <span>サーバー一覧</span>
          <IconButton size="xs" variant="standard" onPress={refreshServers}>
            <Symbol size={16}>refresh</Symbol>
          </IconButton>
        </SectionHeader>

        <Show
          when={servers().length > 0}
          fallback={
            <EmptyState>
              {loading() ? "読み込み中..." : "Minecraftサーバーがありません(サイドバーから作成してください)"}
            </EmptyState>
          }
        >
          <ServerList>
            <For each={servers()}>
              {(server) => (
                <ServerRow
                  data-selected={selectedMcId() === server.mcId}
                  onClick={() => openConsole(server.mcId)}
                >
                  <RowMain>
                    <Symbol size={16}>
                      {server.status === "RUNNING" ? "play_circle" : "stop_circle"}
                    </Symbol>
                    <RowName>{server.name}</RowName>
                  </RowMain>
                  <RowMeta>
                    {MC_STATUS_LABELS[server.status]} ・ {server.type} {server.version} ・ポート
                    {server.port}
                  </RowMeta>
                  <Show when={canManageServer()}>
                    <RowActions onClick={(e: MouseEvent) => e.stopPropagation()}>
                      <Show
                        when={server.status === "RUNNING" || server.status === "STARTING"}
                        fallback={
                          <IconButton
                            size="xs"
                            variant="standard"
                            isDisabled={busy()}
                            onPress={() => handleStart(server)}
                          >
                            <Symbol size={14}>play_arrow</Symbol>
                          </IconButton>
                        }
                      >
                        <IconButton
                          size="xs"
                          variant="standard"
                          isDisabled={busy()}
                          onPress={() => handleStop(server)}
                        >
                          <Symbol size={14}>stop</Symbol>
                        </IconButton>
                      </Show>
                      <IconButton
                        size="xs"
                        variant="standard"
                        onPress={() => refreshOne(server.mcId)}
                      >
                        <Symbol size={14}>refresh</Symbol>
                      </IconButton>
                    </RowActions>
                  </Show>
                </ServerRow>
              )}
            </For>
          </ServerList>
        </Show>
      </Section>

      <Show when={selectedServer()}>
        {(server) => (
          <ConsoleSection>
            <SectionHeader>
              <span>コンソール: {server().name}</span>
              <IconButton size="xs" variant="standard" onPress={closeConsole}>
                <Symbol size={16}>close</Symbol>
              </IconButton>
            </SectionHeader>
            <LogContainer ref={logContainer}>
              <For each={logLines()}>{(line) => <LogLine>{line}</LogLine>}</For>
            </LogContainer>
            <Show when={canManageServer()}>
              <CommandInputRow>
                <CommandInput
                  type="text"
                  placeholder="コマンドを入力(例: list)"
                  value={command()}
                  disabled={sendingCommand()}
                  onInput={(e) => setCommand(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendCommand();
                    }
                  }}
                />
                <IconButton
                  size="xs"
                  variant="standard"
                  isDisabled={sendingCommand() || !command().trim()}
                  onPress={handleSendCommand}
                >
                  <Symbol size={16}>send</Symbol>
                </IconButton>
              </CommandInputRow>
            </Show>
          </ConsoleSection>
        )}
      </Show>
    </Container>
  );
}

const Container = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
});

const Section = styled("div", {
  base: {
    padding: "var(--gap-md)",
    borderBottom: "1px solid var(--md-sys-color-outline-variant)",
    maxHeight: "40%",
    overflowY: "auto",
    flexShrink: 0,
  },
});

const ConsoleSection = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
    padding: "var(--gap-md)",
  },
});

const SectionHeader = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: "bold",
    marginBottom: "var(--gap-sm)",
  },
});

const EmptyState = styled("div", {
  base: {
    padding: "var(--gap-md)",
    textAlign: "center",
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const ServerList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
  },
});

const ServerRow = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    cursor: "pointer",
    transition: "var(--transitions-fast) background",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },

    '&[data-selected="true"]': {
      background: "var(--md-sys-color-surface-container-high)",
    },
  },
});

const RowMain = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-xs)",
    justifyContent: "space-between",
  },
});

const RowName = styled("span", {
  base: {
    fontSize: "13px",
    flexGrow: 1,
  },
});

const RowMeta = styled("span", {
  base: {
    fontSize: "11px",
    opacity: 0.7,
  },
});

const RowActions = styled("div", {
  base: {
    display: "flex",
    gap: "2px",
    marginTop: "2px",
  },
});

const LogContainer = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    background: "var(--md-sys-color-surface-container-lowest)",
    borderRadius: "var(--borderRadius-sm)",
    padding: "var(--gap-sm)",
    fontFamily: "monospace",
    fontSize: "11px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
});

const LogLine = styled("div", {
  base: {
    lineHeight: 1.4,
  },
});

const CommandInputRow = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-xs)",
    marginTop: "var(--gap-sm)",
  },
});

const CommandInput = styled("input", {
  base: {
    flexGrow: 1,
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
    color: "inherit",
    fontFamily: "monospace",
    fontSize: "12px",
  },
});
