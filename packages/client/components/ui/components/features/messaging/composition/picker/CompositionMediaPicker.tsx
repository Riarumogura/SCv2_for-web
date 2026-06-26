import { useFloating } from "solid-floating-ui";
import {
  Accessor,
  JSX,
  Match,
  Ref,
  Setter,
  Show,
  Switch,
  createContext,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Motion, Presence } from "solid-motionone";

import { flip, offset, shift } from "@floating-ui/dom";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Button } from "@revolt/ui/components/design";
import { Row } from "@revolt/ui/components/layout";

import { EmojiPicker } from "./EmojiPicker";
import { GifPicker } from "./GifPicker";
import { StampPicker } from "./StampPicker";

interface Props {
  /**
   * User card trigger area
   * @param triggerProps Props that need to be applied to the trigger area
   */
  children: (triggerProps: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref: Ref<any>;
    onClickGif: () => void;
    onClickEmoji: () => void;
    onClickStamp: () => void;
  }) => JSX.Element;

  /**
   * Send a message
   */
  onMessage: (content: string) => void;

  /**
   * Text replacement
   */
  onTextReplacement: (node: string) => void;

  /**
   * CUSTOM: 現在のサーバーID。スタンプ一覧はサーバー単位のため必要
   * (GIF/Emojiピッカーはサーバーに依存しないため元々このPropsにはなかった)。
   * DM等サーバー外のチャンネルではスタンプタブを使わないためundefined許容。
   */
  serverId?: string;

  /**
   * CUSTOM: スタンプをチャット添付ファイルとして送信する。
   * GIFと同じ「URLをそのまま本文として送ってjanuaryにEmbed化させる」方式は、
   * セルフホスト環境ではjanuaryのSSRF対策(プライベートIP帯への接続拒否)や
   * ルーターのNATループバック非対応により機能しないことが判明したため、
   * 既存の画像/動画添付と同じ経路(Autumnへの直接アップロード+attachments付き
   * メッセージ送信)を使う。
   */
  onSendAttachment?: (file: Blob, filename: string) => void | Promise<void>;
}

export const CompositionMediaPickerContext = createContext(
  null as unknown as Pick<
    Props,
    "onMessage" | "onTextReplacement" | "onSendAttachment"
  >,
);

export function CompositionMediaPicker(props: Props) {
  const [anchor, setAnchor] = createSignal<HTMLElement>();
  const [show, setShow] = createSignal<"gif" | "emoji" | "stamp">();

  return (
    <CompositionMediaPickerContext.Provider value={props}>
      {props.children({
        ref: setAnchor,
        onClickGif: () =>
          setShow((current) => (current === "gif" ? undefined : "gif")),
        onClickEmoji: () =>
          setShow((current) => (current === "emoji" ? undefined : "emoji")),
        onClickStamp: () =>
          setShow((current) => (current === "stamp" ? undefined : "stamp")),
      })}
      <Portal mount={document.getElementById("floating")!}>
        <Presence>
          <Show when={show()}>
            <Motion
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, easing: [0.87, 0, 0.13, 1] }}
            >
              <Picker
                anchor={anchor}
                show={show}
                setShow={setShow}
                onMessage={props.onMessage}
                onTextReplacement={props.onTextReplacement}
                onSendAttachment={props.onSendAttachment}
                serverId={props.serverId}
              />
            </Motion>
          </Show>
        </Presence>
      </Portal>
    </CompositionMediaPickerContext.Provider>
  );
}

function Picker(
  props: Pick<
    Props,
    "onMessage" | "onTextReplacement" | "onSendAttachment" | "serverId"
  > & {
    anchor: Accessor<HTMLElement | undefined>;
    show: Accessor<"gif" | "emoji" | "stamp" | undefined>;
    setShow: Setter<"gif" | "emoji" | "stamp" | undefined>;
  },
) {
  const [floating, setFloating] = createSignal<HTMLDivElement>();

  const position = useFloating(() => props.anchor(), floating, {
    placement: "top-end",
    middleware: [offset(5), flip(), shift()],
  });

  function onMouseDown() {
    props.setShow();
  }

  onMount(() => document.addEventListener("mousedown", onMouseDown));
  onCleanup(() => document.removeEventListener("mousedown", onMouseDown));

  return (
    <Base
      ref={setFloating}
      style={{
        position: position.strategy,
        top: `${position.y ?? 0}px`,
        left: `${position.x ?? 0}px`,
      }}
    >
      <Container>
        <Row justify class="CompositionButton">
          <Button
            groupActive={props.show() === "gif"}
            onPress={() => props.setShow("gif")}
            group="connected-start"
          >
            GIFs
          </Button>
          <Button
            groupActive={props.show() === "emoji"}
            onPress={() => props.setShow("emoji")}
            group={props.onSendAttachment ? "connected" : "connected-end"}
          >
            Emoji
          </Button>
          {/* CUSTOM: スタンプの送信にはonSendAttachmentが必要。リアクション用の
              ピッカー(MessageToolbar.tsx等)はこれを渡さないため、その文脈では
              スタンプタブ自体を表示しない */}
          <Show when={props.onSendAttachment}>
            <Button
              groupActive={props.show() === "stamp"}
              onPress={() => props.setShow("stamp")}
              group="connected-end"
            >
              スタンプ
            </Button>
          </Show>
        </Row>

        <Switch fallback={<span>Not available yet.</span>}>
          <Match when={props.show() === "gif"}>
            <GifPicker />
          </Match>
          <Match when={props.show() === "emoji"}>
            <EmojiPicker />
          </Match>
          <Match when={props.show() === "stamp" && props.onSendAttachment}>
            <StampPicker serverId={props.serverId} />
          </Match>
        </Switch>
      </Container>
    </Base>
  );
}

/**
 * Base element
 */
const Base = styled("div", {
  base: {
    width: "400px",
    height: "400px",
    // paddingInlineEnd: "5px",
  },
});

/**
 * Container element for the picker
 */
const Container = styled("div", {
  base: {
    width: "100%",
    height: "100%",

    userSelect: "none",

    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",

    alignItems: "stretch",

    overflow: "hidden",
    padding: "var(--gap-md) 0",

    borderRadius: "var(--borderRadius-lg)",
    color: "var(--md-sys-color-on-surface)",
    fill: "var(--md-sys-color-on-surface)",
    boxShadow: "0 0 3px var(--md-sys-color-shadow)",
    background: "var(--md-sys-color-surface-container)",
  },
});

/**
 * Styles for the content container
 */
export const compositionContent = cva({
  base: {
    flexGrow: 1,
    minHeight: 0,
  },
});
