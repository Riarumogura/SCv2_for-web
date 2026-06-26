// CUSTOM: 短尺MP4からアニメーションWebPスタンプを作成するモーダル。
// トリミング・WebP変換はffmpeg.wasmでブラウザ内で完結させ、stamp-apiには
// 変換済みの最終ファイル(WebP)だけを送る。サーバー側に動画処理は一切ない。
import { Show, createSignal, onCleanup } from "solid-js";

import {
  CircularProgress,
  ColouredText,
  Column,
  Dialog,
  DialogProps,
  Row,
  Text,
  TextField,
} from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useStampApi } from "../../../src/api/stamp";

const MAX_SOURCE_DURATION_SECONDS = 15;
const MAX_TRIM_WINDOW_SECONDS = 5;
const MAX_SOURCE_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const OUTPUT_FPS = 15;
const OUTPUT_WIDTH = 320;
const OUTPUT_FILE_SIZE_TARGET_BYTES = 2 * 1024 * 1024; // 2MB, stamp-apiの既定上限と合わせる

/**
 * Modal to create a new stamp from a short MP4 clip
 */
export function CreateStampModal(
  props: DialogProps & Modals & { type: "create_stamp" },
) {
  const { showError } = useModals();
  const stampApi = useStampApi();

  const [name, setName] = createSignal("");
  const [sourceFile, setSourceFile] = createSignal<File>();
  const [sourceUrl, setSourceUrl] = createSignal<string>();
  const [duration, setDuration] = createSignal(0);
  const [sourceWidth, setSourceWidth] = createSignal(0);
  const [sourceHeight, setSourceHeight] = createSignal(0);
  const [trimStart, setTrimStart] = createSignal(0);
  const [trimEnd, setTrimEnd] = createSignal(0);
  const [error, setError] = createSignal<string>();
  const [converting, setConverting] = createSignal(false);

  let videoRef: HTMLVideoElement | undefined;

  onCleanup(() => {
    const url = sourceUrl();
    if (url) URL.revokeObjectURL(url);
  });

  function resetSource() {
    const url = sourceUrl();
    if (url) URL.revokeObjectURL(url);
    setSourceFile(undefined);
    setSourceUrl(undefined);
    setDuration(0);
    setSourceWidth(0);
    setSourceHeight(0);
    setTrimStart(0);
    setTrimEnd(0);
  }

  function onSelectFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;

    resetSource();
    setError(undefined);

    if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
      setError("動画ファイルが大きすぎます(100MB以下にしてください)");
      return;
    }

    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
  }

  function onLoadedMetadata() {
    if (!videoRef) return;
    const videoDuration = videoRef.duration;

    if (!isFinite(videoDuration) || videoDuration <= 0) {
      setError("動画の長さを取得できませんでした");
      resetSource();
      return;
    }

    if (videoDuration > MAX_SOURCE_DURATION_SECONDS) {
      setError(
        `動画が長すぎます(${MAX_SOURCE_DURATION_SECONDS}秒以下の動画を選択してください)`,
      );
      resetSource();
      return;
    }

    setDuration(videoDuration);
    setSourceWidth(videoRef.videoWidth);
    setSourceHeight(videoRef.videoHeight);
    setTrimStart(0);
    setTrimEnd(Math.min(videoDuration, MAX_TRIM_WINDOW_SECONDS));
  }

  /**
   * 出力スケールフィルタ(scale=320:-2)と同じ計算をJS側でも行い、
   * createImageBitmapでのWebPデコード(ブラウザ依存で不安定)に頼らず
   * width/heightを決定する。
   */
  function computeOutputDimensions(): { width: number; height: number } {
    const srcW = sourceWidth();
    const srcH = sourceHeight();
    if (!srcW || !srcH) return { width: OUTPUT_WIDTH, height: OUTPUT_WIDTH };

    const exactHeight = (srcH * OUTPUT_WIDTH) / srcW;
    const height = Math.max(2, Math.floor(exactHeight / 2) * 2);
    return { width: OUTPUT_WIDTH, height };
  }

  function onChangeStart(value: number) {
    const clampedStart = Math.min(value, duration());
    setTrimStart(clampedStart);
    if (trimEnd() - clampedStart > MAX_TRIM_WINDOW_SECONDS) {
      setTrimEnd(clampedStart + MAX_TRIM_WINDOW_SECONDS);
    } else if (trimEnd() < clampedStart) {
      setTrimEnd(clampedStart);
    }
    if (videoRef) videoRef.currentTime = clampedStart;
  }

  function onChangeEnd(value: number) {
    const clampedEnd = Math.min(value, duration());
    setTrimEnd(clampedEnd);
    if (clampedEnd - trimStart() > MAX_TRIM_WINDOW_SECONDS) {
      setTrimStart(clampedEnd - MAX_TRIM_WINDOW_SECONDS);
    } else if (trimStart() > clampedEnd) {
      setTrimStart(clampedEnd);
    }
    if (videoRef) videoRef.currentTime = clampedEnd;
  }

  /**
   * Trim + encode the source clip into a small looping animated WebP,
   * entirely in-browser. stamp-api never sees raw video.
   */
  async function convertToStampWebp(file: File, start: number, end: number) {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

    const ffmpeg = new FFmpeg();

    // CUSTOM: ffmpeg.exec()は失敗しても例外を投げず、戻り値0/非0でしか
    // 成否を知らせない。何が起きたか分かるよう、ログを溜めておいて
    // 失敗時にエラーメッセージへ含める(これがないと「readFileで
    // ファイルが見つからない」という意味不明なエラーしか見えない)。
    const logLines: string[] = [];
    ffmpeg.on("log", ({ message }) => {
      logLines.push(message);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
      wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
    });

    await ffmpeg.writeFile("input.mp4", await fetchFile(file));

    const { width, height } = computeOutputDimensions();

    async function runEncode(quality: number): Promise<Blob> {
      logLines.length = 0;

      const code = await ffmpeg.exec([
        "-ss", String(start),
        "-t", String(Math.max(0.1, end - start)),
        "-i", "input.mp4",
        "-vf", `fps=${OUTPUT_FPS},scale=${width}:${height}:flags=lanczos`,
        "-loop", "0",
        "-an",
        "-vcodec", "libwebp",
        "-lossless", "0",
        "-compression_level", "6",
        "-q:v", String(quality),
        "-vsync", "0",
        "output.webp",
      ]);

      if (code !== 0) {
        throw new Error(
          `動画の変換に失敗しました(ffmpeg終了コード: ${code})\n${logLines.slice(-10).join("\n")}`,
        );
      }

      const data = await ffmpeg.readFile("output.webp");
      return new Blob([data as Uint8Array], { type: "image/webp" });
    }

    let blob = await runEncode(70);
    if (blob.size > OUTPUT_FILE_SIZE_TARGET_BYTES) {
      // CUSTOM: サイズ上限に近い場合は品質を落として1回だけ再試行する
      // (全探索のbisectionはせず、シンプルな1回フォールバックに留める)
      blob = await runEncode(50);
    }

    return { blob, width, height };
  }

  async function onSubmit() {
    const file = sourceFile();
    if (!file) {
      setError("動画を選択してください");
      return;
    }
    if (!name().trim()) {
      setError("スタンプ名を入力してください");
      return;
    }

    setConverting(true);
    setError(undefined);

    try {
      const { blob, width, height } = await convertToStampWebp(
        file,
        trimStart(),
        trimEnd(),
      );

      await stampApi.createStamp(props.serverId, {
        file: blob,
        name: name().trim(),
        width,
        height,
        durationMs: Math.round((trimEnd() - trimStart()) * 1000),
      });

      props.onCreated?.();
      props.onClose();
    } catch (err) {
      showError(err);
    } finally {
      setConverting(false);
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title="スタンプを作成"
      actions={[
        { text: "閉じる" },
        {
          text: "作成",
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !sourceFile() || !name().trim() || converting(),
        },
      ]}
      isDisabled={converting()}
    >
      <Column>
        <Show when={!sourceFile()}>
          <Text class="label" size="small">
            短いMP4動画を選択してください(最大{MAX_SOURCE_DURATION_SECONDS}秒、最大{MAX_TRIM_WINDOW_SECONDS}秒まで切り出せます)
          </Text>
          <input type="file" accept="video/mp4" onChange={onSelectFile} />
        </Show>

        <Show when={error()}>
          <ColouredText colour="var(--md-sys-color-error)">
            {error()}
          </ColouredText>
        </Show>

        <Show when={sourceUrl()}>
          <video
            ref={videoRef}
            src={sourceUrl()}
            muted
            onLoadedMetadata={onLoadedMetadata}
            style={{ width: "100%", "max-height": "240px", "background": "black" }}
          />

          <Show when={duration() > 0}>
            <Column gap="sm">
              <Row align gap="sm">
                <Text class="label" size="small">
                  開始: {trimStart().toFixed(1)}秒
                </Text>
                <input
                  type="range"
                  min={0}
                  max={duration()}
                  step={0.1}
                  value={trimStart()}
                  onInput={(e) =>
                    onChangeStart(parseFloat(e.currentTarget.value))
                  }
                  style={{ flex: "1" }}
                />
              </Row>
              <Row align gap="sm">
                <Text class="label" size="small">
                  終了: {trimEnd().toFixed(1)}秒
                </Text>
                <input
                  type="range"
                  min={0}
                  max={duration()}
                  step={0.1}
                  value={trimEnd()}
                  onInput={(e) =>
                    onChangeEnd(parseFloat(e.currentTarget.value))
                  }
                  style={{ flex: "1" }}
                />
              </Row>
              <Text class="label" size="small">
                切り出す長さ: {(trimEnd() - trimStart()).toFixed(1)}秒(最大{MAX_TRIM_WINDOW_SECONDS}秒)
              </Text>
            </Column>
          </Show>

          <TextField
            label="スタンプ名"
            placeholder="例: わらう"
            maxlength={32}
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </Show>

        <Show when={converting()}>
          <Row align gap="sm">
            <CircularProgress />
            <Text class="label">変換中です…(初回はffmpeg本体の読み込みに少し時間がかかります)</Text>
          </Row>
        </Show>
      </Column>
    </Dialog>
  );
}
