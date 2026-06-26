// CUSTOM: スタンプピッカー(GifPicker.tsxを模倣)。検索/カテゴリは持たず、
// 現在のサーバーのスタンプをフラットなグリッドで表示するだけ。
// 送信はGifPickerと違い、URLをそのまま本文として送る方式ではなく
// (セルフホスト環境ではjanuaryのSSRF対策やNATループバック非対応で機能しないため)、
// スタンプのWebPバイトを取得してAutumnへ添付ファイルとしてアップロードし、
// 通常の画像添付と同じ経路で送信する(onSendAttachment)。
import { Show, createResource, useContext } from "solid-js";

import { VirtualContainer } from "@minht11/solid-virtual-container";
import { styled } from "styled-system/jsx";

import { Stamp, useStampApi } from "../../../../../../../src/api/stamp";

import { CompositionMediaPickerContext } from "./CompositionMediaPicker";

export function StampPicker(props: { serverId?: string }) {
  const stampApi = useStampApi();

  const [data] = createResource(
    () => props.serverId,
    (serverId) => stampApi.listStamps(serverId),
  );

  return (
    <Stack>
      <Show
        when={(data()?.stamps.length ?? 0) > 0}
        fallback={
          <Empty>このサーバーにはスタンプがありません。設定からスタンプを作成してください。</Empty>
        }
      >
        <Grid stamps={data()?.stamps ?? []} />
      </Show>
    </Stack>
  );
}

function Grid(props: { stamps: Stamp[] }) {
  let targetElement!: HTMLDivElement;

  return (
    <div ref={targetElement} use:invisibleScrollable style={{ "min-height": "0", flex: "1" }}>
      <VirtualContainer
        items={props.stamps}
        scrollTarget={targetElement}
        itemSize={{ height: 120, width: 200 }}
        crossAxisCount={(measurements) =>
          Math.floor(measurements.container.cross / measurements.itemSize.cross)
        }
      >
        {StampItem}
      </VirtualContainer>
    </div>
  );
}

const StampItem = (props: {
  style: unknown;
  tabIndex: number;
  item: Stamp;
}) => {
  const { onSendAttachment } = useContext(CompositionMediaPickerContext);

  async function onClick() {
    if (!onSendAttachment) return;
    // CUSTOM: /:stampId/file は無認証で配信されているので、ここは単純なfetchでよい
    const response = await fetch(props.item.url);
    const blob = await response.blob();
    await onSendAttachment(blob, `${props.item.name}.webp`);
  }

  return (
    <StampTile
      role="listitem"
      style={props.style as string}
      tabIndex={props.tabIndex}
      title={props.item.name}
      src={props.item.url}
      onClick={onClick}
    />
  );
};

const Stack = styled("div", {
  base: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
});

const Empty = styled("div", {
  base: {
    padding: "var(--gap-md)",
    fontSize: "13px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const StampTile = styled("img", {
  base: {
    width: "200px",
    height: "120px",
    cursor: "pointer",
    objectFit: "contain",
  },
});
