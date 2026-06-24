// CUSTOM: Minecraftサーバーのテキストファイル(server.properties等)を編集するモーダル
// CUSTOM: lingui(<Trans>)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまうため
// 日本語をハードコードしている(storage系モーダルの既知バグと同種)
import { createResource, createSignal } from "solid-js";
import { styled } from "styled-system/jsx";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useMinecraftApi } from "../../../src/api/minecraft";

/**
 * Modal to view/edit a text file inside an extracted Minecraft server
 */
export function MinecraftTextEditorModal(
  props: DialogProps & Modals & { type: "minecraft_text_editor" },
) {
  const { showError } = useModals();
  const minecraftApi = useMinecraftApi();
  const [isSaving, setIsSaving] = createSignal(false);
  const [content, setContent] = createSignal<string | null>(null);

  const [initial] = createResource(async () => {
    const text = await minecraftApi.readTextFile(props.serverId, props.mcId, props.path);
    setContent(text);
    return text;
  });

  async function onSave() {
    const current = content();
    if (current === null) return;
    try {
      setIsSaving(true);
      await minecraftApi.writeTextFile(props.serverId, props.mcId, props.path, current);
      props.onSaved?.();
      props.onClose();
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={props.readOnly ? `${props.name}(閲覧のみ)` : props.name}
      actions={
        props.readOnly
          ? [{ text: "閉じる" }]
          : [
              { text: "キャンセル" },
              {
                text: "保存",
                onClick: () => {
                  onSave();
                  return false;
                },
                isDisabled: content() === null,
              },
            ]
      }
      isDisabled={isSaving()}
    >
      {initial.loading ? (
        <LoadingText>読み込み中...</LoadingText>
      ) : initial.error ? (
        <ErrorText>{(initial.error as Error).message ?? "読み込みに失敗しました"}</ErrorText>
      ) : (
        <EditorTextarea
          value={content() ?? ""}
          readOnly={props.readOnly}
          spellcheck={false}
          onInput={(e) => setContent(e.currentTarget.value)}
        />
      )}
    </Dialog>
  );
}

const EditorTextarea = styled("textarea", {
  base: {
    width: "100%",
    height: "400px",
    padding: "var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-lowest)",
    color: "inherit",
    fontFamily: "monospace",
    fontSize: "12px",
    resize: "vertical",
  },
});

const LoadingText = styled("div", {
  base: {
    padding: "var(--gap-lg)",
    textAlign: "center",
    fontSize: "13px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const ErrorText = styled("div", {
  base: {
    padding: "var(--gap-lg)",
    textAlign: "center",
    fontSize: "13px",
    color: "var(--md-sys-color-error)",
  },
});
