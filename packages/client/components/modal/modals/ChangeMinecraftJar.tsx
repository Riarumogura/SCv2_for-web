// CUSTOM: アップロードで作成済みのサーバーが「最初に選んだjarが起動しない」場合に、
// 展開済みデータを残したまま起動jarだけ後から切り替えるためのモーダル
// CUSTOM: lingui(<Trans>)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうため
// 日本語をハードコードしている(storage系モーダルの既知バグと同種)
import { For, Show, createResource, createSignal } from "solid-js";
import { styled } from "styled-system/jsx";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useMinecraftApi } from "../../../src/api/minecraft";

/**
 * Modal to switch the startup jar of an already-uploaded Minecraft server
 */
export function ChangeMinecraftJarModal(
  props: DialogProps & Modals & { type: "change_minecraft_jar" },
) {
  const { showError } = useModals();
  const minecraftApi = useMinecraftApi();
  const [selected, setSelected] = createSignal<string | null>(props.currentJarPath);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const [candidates] = createResource(async () => {
    const entries = await minecraftApi.listFiles(props.serverId, props.mcId, "");
    return entries
      .filter((entry) => entry.type === "file" && entry.name.toLowerCase().endsWith(".jar"))
      .map((entry) => entry.name)
      .sort();
  });

  async function onConfirm() {
    const jarPath = selected();
    if (!jarPath) return;

    try {
      setIsSubmitting(true);
      await minecraftApi.changeJar(props.serverId, props.mcId, jarPath);
      props.onChanged?.();
      props.onClose();
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={`${props.serverName}: 起動するjarファイルを切り替え`}
      actions={[
        { text: "キャンセル" },
        {
          text: "切り替え",
          onClick: onConfirm,
          isDisabled: !selected() || selected() === props.currentJarPath,
        },
      ]}
      isDisabled={isSubmitting()}
    >
      <Description>
        サーバーを停止してから切り替えてください。展開済みのワールドデータ等はそのまま使われます。
      </Description>
      <Show when={!candidates.loading} fallback={<Description>jarファイルを検索中...</Description>}>
        <Show
          when={(candidates() ?? []).length > 0}
          fallback={<Description>ルート直下に.jarファイルが見つかりません</Description>}
        >
          <CandidateList>
            <For each={candidates()}>
              {(candidate) => (
                <CandidateRow onClick={() => setSelected(candidate)}>
                  <input
                    type="radio"
                    name="jarCandidate"
                    checked={selected() === candidate}
                    onChange={() => setSelected(candidate)}
                  />
                  <span>
                    {candidate}
                    {candidate === props.currentJarPath ? "(現在の設定)" : ""}
                  </span>
                </CandidateRow>
              )}
            </For>
          </CandidateList>
        </Show>
      </Show>
    </Dialog>
  );
}

const Description = styled("p", {
  base: {
    fontSize: "13px",
    color: "var(--md-sys-color-on-surface-variant)",
    marginBottom: "var(--gap-md)",
  },
});

const CandidateList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
  },
});

const CandidateRow = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: "13px",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },
  },
});
