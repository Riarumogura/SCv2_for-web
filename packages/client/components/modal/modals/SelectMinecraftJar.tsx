// CUSTOM: アップロードされたzip内に起動jarの候補が複数見つかった場合の選択モーダル
// CUSTOM: lingui(<Trans>)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうため
// 日本語をハードコードしている(storage系モーダルの既知バグと同種)
import { For, createSignal } from "solid-js";
import { styled } from "styled-system/jsx";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useMinecraftApi } from "../../../src/api/minecraft";

/**
 * Modal to resolve an ambiguous startup jar after a zip upload
 */
export function SelectMinecraftJarModal(
  props: DialogProps & Modals & { type: "select_minecraft_jar" },
) {
  const { showError } = useModals();
  const minecraftApi = useMinecraftApi();
  const [selected, setSelected] = createSignal<string | null>(props.candidates[0] ?? null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  async function onConfirm() {
    const jarPath = selected();
    if (!jarPath) return;

    try {
      setIsSubmitting(true);
      await minecraftApi.selectJar(props.serverId, props.mcId, jarPath);
      props.onSelected?.();
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
      title={`${props.serverName}: 起動するjarファイルを選択`}
      actions={[
        { text: "キャンセル" },
        {
          text: "決定",
          onClick: onConfirm,
          isDisabled: !selected(),
        },
      ]}
      isDisabled={isSubmitting()}
    >
      <Description>
        アップロードされたzip内に複数の.jarファイルが見つかりました。このサーバーの起動に使うjarファイルを選んでください。
      </Description>
      <CandidateList>
        <For each={props.candidates}>
          {(candidate) => (
            <CandidateRow onClick={() => setSelected(candidate)}>
              <input
                type="radio"
                name="jarCandidate"
                checked={selected() === candidate}
                onChange={() => setSelected(candidate)}
              />
              <span>{candidate}</span>
            </CandidateRow>
          )}
        </For>
      </CandidateList>
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
