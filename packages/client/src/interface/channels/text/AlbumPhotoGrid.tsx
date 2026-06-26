// CUSTOM: Discordの複数画像添付のレイアウト(1枚はそのまま、2枚は横2分割、3枚は左1枚+右2分割、
// 4枚以上は2x2+残り枚数オーバーレイ)を参考にしたアルバム写真グリッド。
import { For, Show, createMemo } from "solid-js";
import { File as StoatFile } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { AlbumPhoto } from "../../../api/album";

const MAX_VISIBLE = 4;

function toStoatFile(client: ReturnType<ReturnType<typeof useClient>>, photo: AlbumPhoto) {
  return new StoatFile(client, {
    _id: photo.autumnId,
    tag: photo.tag,
    filename: photo.filename,
    // CUSTOM: バックエンドのAlbumPhotoMetadataはwidth/heightをoptionalにしているが、
    // Image/Video種別は常にAutumnアップロード時に解決済みのため、stoat.jsのMetadata型と
    // 構造的に互換である。
    metadata: photo.metadata as StoatFile["metadata"],
    content_type: photo.contentType,
    size: photo.size,
  });
}

export interface AlbumPhotoGridProps {
  photos: AlbumPhoto[];
}

/**
 * アルバム内の写真・動画をDiscord風のグリッドで表示する
 */
export function AlbumPhotoGrid(props: AlbumPhotoGridProps) {
  const client = useClient();
  const { openModal } = useModals();

  const visibleFiles = createMemo(() =>
    props.photos.slice(0, MAX_VISIBLE).map((photo) => toStoatFile(client(), photo)),
  );
  const remainingCount = createMemo(() => Math.max(0, props.photos.length - MAX_VISIBLE));

  function openPreview(file: StoatFile) {
    openModal({ type: "image_viewer", file });
  }

  return (
    <Show when={props.photos.length > 0} fallback={<EmptyHint>写真がまだありません</EmptyHint>}>
      <Grid data-count={Math.min(visibleFiles().length, MAX_VISIBLE)}>
        <For each={visibleFiles()}>
          {(file, index) => (
            <Cell onClick={() => openPreview(file)}>
              <Show
                when={file.metadata.type === "Video"}
                fallback={<Thumb src={file.previewUrl} loading="lazy" />}
              >
                <>
                  <ThumbVideo src={file.previewUrl} preload="metadata" muted />
                  <PlayIconOverlay>
                    <Symbol size={32}>play_circle</Symbol>
                  </PlayIconOverlay>
                </>
              </Show>
              <Show when={index() === MAX_VISIBLE - 1 && remainingCount() > 0}>
                <MoreOverlay>+{remainingCount()}</MoreOverlay>
              </Show>
            </Cell>
          )}
        </For>
      </Grid>
    </Show>
  );
}

const EmptyHint = styled("div", {
  base: {
    fontSize: "13px",
    color: "var(--md-sys-color-on-surface-variant)",
    padding: "var(--gap-md)",
  },
});

// CUSTOM: 枚数(data-count)に応じてDiscord風のグリッド配置を切り替える
const Grid = styled("div", {
  base: {
    display: "grid",
    gap: "2px",
    width: "100%",
    height: "260px",
    borderRadius: "var(--borderRadius-md)",
    overflow: "hidden",

    "&[data-count='1']": {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "1fr",
    },
    "&[data-count='2']": {
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr",
    },
    "&[data-count='3']": {
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
    },
    "&[data-count='4']": {
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
    },

    // CUSTOM: 3枚の時は1枚目を左側いっぱい(2行分)に広げ、右側に2枚を縦積みする
    "&[data-count='3'] > *:first-child": {
      gridRow: "1 / 3",
    },
  },
});

const Cell = styled("div", {
  base: {
    position: "relative",
    overflow: "hidden",
    cursor: "pointer",
    background: "var(--md-sys-color-surface-container-highest)",
  },
});

const Thumb = styled("img", {
  base: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
});

const ThumbVideo = styled("video", {
  base: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
});

const PlayIconOverlay = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    textShadow: "0 1px 4px rgba(0,0,0,0.6)",
    pointerEvents: "none",
  },
});

const MoreOverlay = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.55)",
    color: "white",
    fontSize: "24px",
    fontWeight: "bold",
  },
});
