// CUSTOM: ストレージファイルのインラインプレビュー(画像・動画・PDF・テキスト)
import { Show, createSignal, onCleanup, onMount } from "solid-js";

import { styled } from "styled-system/jsx";

import { Column, Dialog, DialogProps } from "@revolt/ui";

import { Modals } from "../types";
import { getFileKind, useStorageApi } from "../../../src/api/storage";

interface StoragePreviewProps {
  serverId: string;
  storageId: string;
  path: string;
  name: string;
}

// CUSTOM: これより大きいテキストファイルはプレビューせずダウンロードを案内する
const TEXT_PREVIEW_MAX_SIZE = 1024 * 1024; // 1MB

/**
 * ストレージファイルのインラインプレビューダイアログ
 */
export function StoragePreviewModal(
  props: DialogProps & Modals & { type: "storage_preview" } & StoragePreviewProps,
) {
  const storageApi = useStorageApi();
  const kind = getFileKind(props.name, "file");

  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [blobUrl, setBlobUrl] = createSignal<string | null>(null);
  const [textContent, setTextContent] = createSignal<string | null>(null);
  const [tooLarge, setTooLarge] = createSignal(false);

  let objectUrl: string | undefined;

  onMount(async () => {
    if (kind === "file") {
      setLoading(false);
      return;
    }

    try {
      const blob = await storageApi.fetchFileBlob(props.serverId, props.storageId, props.path);

      if (kind === "text") {
        if (blob.size > TEXT_PREVIEW_MAX_SIZE) {
          setTooLarge(true);
        } else {
          setTextContent(await blob.text());
        }
      } else {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      }
    } catch (err) {
      console.error("プレビューの取得に失敗しました:", err);
      setError("プレビューの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  });

  onCleanup(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={props.name}
      actions={[{ text: "閉じる" }]}
      minWidth={600}
    >
      <Column>
        <Show when={loading()}>
          <Centered>読み込み中...</Centered>
        </Show>
        <Show when={!loading() && error()}>
          <Centered>{error()}</Centered>
        </Show>
        <Show when={!loading() && !error()}>
          <Show when={kind === "image"}>
            <Show when={blobUrl()}>
              <PreviewImage src={blobUrl()!} />
            </Show>
          </Show>
          <Show when={kind === "movie"}>
            <Show when={blobUrl()}>
              <PreviewVideo controls src={blobUrl()!} />
            </Show>
          </Show>
          <Show when={kind === "pdf"}>
            <Show when={blobUrl()}>
              <PreviewIframe src={blobUrl()!} />
            </Show>
          </Show>
          <Show when={kind === "text"}>
            <Show
              when={!tooLarge()}
              fallback={<Centered>ファイルサイズが大きいためプレビューできません。ダウンロードしてください。</Centered>}
            >
              <PreviewText>{textContent()}</PreviewText>
            </Show>
          </Show>
          <Show when={kind === "file"}>
            <Centered>このファイル形式のプレビューはサポートされていません。ダウンロードしてください。</Centered>
          </Show>
        </Show>
      </Column>
    </Dialog>
  );
}

const Centered = styled("div", {
  base: {
    padding: "var(--gap-lg)",
    textAlign: "center",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const PreviewImage = styled("img", {
  base: {
    maxWidth: "100%",
    maxHeight: "70vh",
    objectFit: "contain",
    display: "block",
    margin: "0 auto",
  },
});

const PreviewVideo = styled("video", {
  base: {
    maxWidth: "100%",
    maxHeight: "70vh",
    display: "block",
    margin: "0 auto",
  },
});

const PreviewIframe = styled("iframe", {
  base: {
    width: "100%",
    height: "70vh",
    border: "none",
  },
});

const PreviewText = styled("pre", {
  base: {
    maxHeight: "70vh",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    padding: "var(--gap-md)",
    background: "var(--md-sys-color-surface-container-low)",
    borderRadius: "var(--borderRadius-sm)",
    fontSize: "13px",
  },
});
