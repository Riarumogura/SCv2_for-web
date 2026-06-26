// CUSTOM: Discordの複数画像添付のレイアウト(1枚はそのまま、2枚は横2分割、3枚は左1枚+右2分割、
// 4枚以上は2x2+残り枚数オーバーレイ)を参考にしたアルバム写真グリッド。
import { For, Show, createMemo } from "solid-js";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { AlbumPhoto, useAlbumApi } from "../../../api/album";

const MAX_VISIBLE = 4;

export interface AlbumPhotoGridProps {
  photos: AlbumPhoto[];
}

/**
 * アルバム内の写真・動画をDiscord風のグリッドで表示する
 */
export function AlbumPhotoGrid(props: AlbumPhotoGridProps) {
  const albumApi = useAlbumApi();
  const { openModal } = useModals();

  const visiblePhotos = createMemo(() => props.photos.slice(0, MAX_VISIBLE));
  const remainingCount = createMemo(() => Math.max(0, props.photos.length - MAX_VISIBLE));

  // CUSTOM: アルバムの写真・動画はAutumnを使わず album-api 専用のMinIOバケットに保存されている
  // (Autumnはused_for=メッセージ等での実使用が無いアップロードの取得を404で拒否するため)。
  // stoat.js FileのpreviewUrl/originalUrlはAutumnのURL形式に固定されているため構築できず、
  // 代わりにimage_viewerモーダルのcustomFile(生URL)を使う
  function openPreview(photo: AlbumPhoto) {
    const type = photo.metadata.type === "Video" ? "Video" : "Image";
    openModal({
      type: "image_viewer",
      customFile: {
        url: albumApi.getPhotoFileUrl(photo.fileId),
        filename: photo.filename ?? "file",
        contentType: photo.contentType,
        size: photo.size,
        metadata: {
          type,
          width: photo.metadata.width ?? 1,
          height: photo.metadata.height ?? 1,
        },
      },
    });
  }

  return (
    <Show when={props.photos.length > 0} fallback={<EmptyHint>写真がまだありません</EmptyHint>}>
      <Grid data-count={Math.min(visiblePhotos().length, MAX_VISIBLE)}>
        <For each={visiblePhotos()}>
          {(photo, index) => (
            <Cell onClick={() => openPreview(photo)}>
              <Show
                when={photo.metadata.type === "Video"}
                fallback={<Thumb src={albumApi.getPhotoFileUrl(photo.fileId)} loading="lazy" />}
              >
                <>
                  <ThumbVideo
                    src={albumApi.getPhotoFileUrl(photo.fileId)}
                    preload="metadata"
                    muted
                  />
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
