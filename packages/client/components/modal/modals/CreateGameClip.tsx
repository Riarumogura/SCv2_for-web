// CUSTOM: GameClips投稿作成モーダル
// CUSTOM: lingui(<Trans>/t)はi18nカタログ未コンパイルのためハッシュ文字列で表示されてしまう
// (storage系モーダルの既知バグと同種)。この機能では日本語をハードコードして回避する。
import { For, Show, createMemo, createResource, createSignal, onCleanup } from "solid-js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  Button,
  CircularProgress,
  ColouredText,
  Column,
  Dialog,
  DialogProps,
  IconButton,
  Row,
  Text,
  Tooltip,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useModals } from "..";
import { Modals } from "../types";
import {
  ALLOWED_GAMECLIP_CONTENT_TYPES,
  GameClipCategory,
  GameClipContentType,
  GameClipFile,
  useGameClipsApi,
} from "../../../src/api/gameclips";
import env from "@revolt/common/lib/env";

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_FILES = 10;
const AUTUMN_TAG = "attachments";

const EXTENSION_CONTENT_TYPES: Record<string, GameClipContentType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

function resolveContentType(file: globalThis.File): GameClipContentType | undefined {
  if ((ALLOWED_GAMECLIP_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return file.type as GameClipContentType;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? EXTENSION_CONTENT_TYPES[ext] : undefined;
}

// CUSTOM: AlbumExplorer.tsxのreadMediaDimensionsと同じ手法。stoat.jsのFile型は
// Image/Video種別にwidth/heightを要求するが、Autumnの/attachmentsアップロード応答は
// idのみで寸法を返さないため、ブラウザ側に読み込んで取得する。
async function readMediaDimensions(
  file: globalThis.File,
): Promise<{ width: number; height: number } | undefined> {
  if (file.type.startsWith("image/")) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
        URL.revokeObjectURL(url);
      };
      image.onerror = () => {
        resolve(undefined);
        URL.revokeObjectURL(url);
      };
      image.src = url;
    });
  }

  if (file.type.startsWith("video/")) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        resolve(undefined);
        URL.revokeObjectURL(url);
      };
      video.src = url;
    });
  }

  return undefined;
}

interface SelectedFile {
  file: globalThis.File;
  contentType: GameClipContentType;
  previewUrl: string;
}

/**
 * Modal to create a new GameClips post
 */
export function CreateGameClipModal(
  props: DialogProps & Modals & { type: "create_gameclip" },
) {
  const { showError, openModal } = useModals();
  const gameClipsApi = useGameClipsApi();
  const client = useClient();
  const myId = client().user!.id;

  const [categories, { mutate: mutateCategories }] = createResource(() =>
    gameClipsApi.listCategories(props.serverId),
  );
  const [categoryId, setCategoryId] = createSignal(props.categoryId ?? "");

  const [selectedFiles, setSelectedFiles] = createSignal<SelectedFile[]>([]);
  const [description, setDescription] = createSignal("");
  const [allowComments, setAllowComments] = createSignal(true);
  const [error, setError] = createSignal<string>();
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  onCleanup(() => {
    for (const f of selectedFiles()) URL.revokeObjectURL(f.previewUrl);
  });

  const otherMembers = () =>
    client().serverMembers.filter(
      (member) => member.id.server === props.serverId && member.id.user !== myId,
    );
  const [selectedMentionIds, setSelectedMentionIds] = createSignal<Set<string>>(new Set());

  function toggleMention(userId: string) {
    setSelectedMentionIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function openCreateCategory() {
    openModal({
      type: "create_gameclip_category",
      serverId: props.serverId,
      onCreated: (category: GameClipCategory) => {
        mutateCategories((prev) => [...(prev ?? []), category]);
        setCategoryId(category.id);
      },
    });
  }

  function onFilesSelected(files: FileList) {
    setError(undefined);
    const accepted: SelectedFile[] = [];

    for (const file of Array.from(files)) {
      if (selectedFiles().length + accepted.length >= MAX_FILES) {
        setError(`ファイルは最大${MAX_FILES}個までです`);
        break;
      }

      const contentType = resolveContentType(file);
      if (!contentType) {
        setError(`"${file.name}" は対応していない形式です(.jpg/.png/.mp4/.movのみ)`);
        continue;
      }
      if (file.size > env.MAX_GAMECLIPS_FILE_SIZE) {
        setError(`"${file.name}" はファイルサイズが大きすぎます`);
        continue;
      }

      accepted.push({ file, contentType, previewUrl: URL.createObjectURL(file) });
    }

    if (accepted.length > 0) {
      setSelectedFiles((prev) => [...prev, ...accepted]);
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function openFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".jpg,.jpeg,.png,.mp4,.mov,image/jpeg,image/png,video/mp4,video/quicktime";
    input.addEventListener("change", () => {
      if (input.files && input.files.length > 0) onFilesSelected(input.files);
    });
    input.click();
  }

  async function uploadFile(selected: SelectedFile): Promise<GameClipFile> {
    const dimensions = await readMediaDimensions(selected.file);
    const type: "Image" | "Video" = selected.contentType.startsWith("image/") ? "Image" : "Video";

    const body = new FormData();
    body.set("file", selected.file, selected.file.name);
    const [authHeader, authHeaderValue] = client().authenticationHeader;
    const response = await fetch(`${client().configuration!.features.autumn.url}/attachments`, {
      method: "POST",
      body,
      headers: { [authHeader]: authHeaderValue },
    });

    if (!response.ok) {
      throw new Error(`アップロードに失敗しました: ${response.status}`);
    }

    const { id } = await response.json();

    return {
      autumnId: id,
      tag: AUTUMN_TAG,
      filename: selected.file.name,
      contentType: selected.contentType,
      metadata: { type, ...dimensions },
      size: selected.file.size,
    };
  }

  const canSubmit = createMemo(
    () => selectedFiles().length > 0 && categoryId() !== "" && !isSubmitting(),
  );

  async function onSubmit() {
    if (!canSubmit()) return;

    setIsSubmitting(true);
    setError(undefined);
    try {
      const files: GameClipFile[] = [];
      for (const selected of selectedFiles()) {
        files.push(await uploadFile(selected));
      }

      await gameClipsApi.createGameClip(props.serverId, {
        categoryId: categoryId(),
        description: description(),
        files,
        mentionedUserIds: Array.from(selectedMentionIds()),
        allowComments: allowComments(),
      });

      props.onCreated?.();
      props.onClose();
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title="GameClipsに投稿"
      actions={[
        { text: "キャンセル" },
        {
          text: "投稿",
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !canSubmit(),
        },
      ]}
      isDisabled={isSubmitting()}
    >
      <Column>
        <div>
          <FieldLabel>ファイル(.jpg / .png / .mp4 / .mov)</FieldLabel>
          <FilePreviewList>
            <For each={selectedFiles()}>
              {(selected, index) => (
                <FilePreviewItem>
                  <Show
                    when={selected.contentType.startsWith("video/")}
                    fallback={<PreviewThumb src={selected.previewUrl} />}
                  >
                    <PreviewVideo src={selected.previewUrl} muted />
                  </Show>
                  <RemoveButton onClick={() => removeFile(index())}>
                    <Symbol size={14}>close</Symbol>
                  </RemoveButton>
                </FilePreviewItem>
              )}
            </For>
            <Show when={selectedFiles().length < MAX_FILES}>
              <AddFileButton onClick={openFilePicker}>
                <Symbol size={24}>add</Symbol>
              </AddFileButton>
            </Show>
          </FilePreviewList>
        </div>

        <Show when={error()}>
          <ColouredText colour="var(--md-sys-color-error)">{error()}</ColouredText>
        </Show>

        <div>
          <Row align style={{ "justify-content": "space-between" }}>
            <FieldLabel>カテゴリ</FieldLabel>
            <Tooltip content="カテゴリを作成" placement="top">
              <IconButton size="xs" variant="standard" onPress={openCreateCategory}>
                <Symbol size={16}>add</Symbol>
              </IconButton>
            </Tooltip>
          </Row>
          <select
            value={categoryId()}
            onInput={(e) => setCategoryId((e.currentTarget as HTMLSelectElement).value)}
            style={{ width: "100%", padding: "var(--gap-xs)" }}
          >
            <option value="" disabled>
              カテゴリを選択
            </option>
            <For each={categories()}>
              {(category) => <option value={category.id}>{category.name}</option>}
            </For>
          </select>
        </div>

        <div>
          <Row align style={{ "justify-content": "space-between" }}>
            <FieldLabel>詳細</FieldLabel>
            <Text class="label" size="small">
              {description().length} / {MAX_DESCRIPTION_LENGTH}
            </Text>
          </Row>
          <DescriptionTextarea
            maxlength={MAX_DESCRIPTION_LENGTH}
            value={description()}
            onInput={(e) =>
              setDescription((e.currentTarget as HTMLTextAreaElement).value.slice(0, MAX_DESCRIPTION_LENGTH))
            }
            placeholder="投稿の説明を入力(500字以内)"
          />
        </div>

        <div>
          <FieldLabel>メンション</FieldLabel>
          <PickerList>
            <Show
              when={otherMembers().length > 0}
              fallback={<EmptyHint>メンションできるメンバーがいません</EmptyHint>}
            >
              <For each={otherMembers()}>
                {(member) => (
                  <PickerRow>
                    <input
                      type="checkbox"
                      checked={selectedMentionIds().has(member.id.user)}
                      onChange={() => toggleMention(member.id.user)}
                    />
                    <span>{member.user?.username ?? member.id.user}</span>
                  </PickerRow>
                )}
              </For>
            </Show>
          </PickerList>
        </div>

        <PickerRow>
          <input
            type="checkbox"
            checked={allowComments()}
            onChange={(e) => setAllowComments(e.currentTarget.checked)}
          />
          <span>コメントを許可する</span>
        </PickerRow>

        <Show when={isSubmitting()}>
          <Row align gap="sm">
            <CircularProgress />
            <Text class="label">投稿中です…</Text>
          </Row>
        </Show>
      </Column>
    </Dialog>
  );
}

const FieldLabel = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    marginBottom: "var(--gap-xs)",
  },
});

const FilePreviewList = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--gap-xs)",
  },
});

const FilePreviewItem = styled("div", {
  base: {
    position: "relative",
    width: "72px",
    height: "72px",
    borderRadius: "var(--borderRadius-sm)",
    overflow: "hidden",
    background: "var(--md-sys-color-surface-container-highest)",
  },
});

const PreviewThumb = styled("img", {
  base: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
});

const PreviewVideo = styled("video", {
  base: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
});

const RemoveButton = styled("button", {
  base: {
    position: "absolute",
    top: "2px",
    right: "2px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    border: "none",
    background: "rgba(0, 0, 0, 0.6)",
    color: "white",
    cursor: "pointer",
  },
});

const AddFileButton = styled("button", {
  base: {
    width: "72px",
    height: "72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px dashed var(--md-sys-color-outline-variant)",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  },
});

const DescriptionTextarea = styled("textarea", {
  base: {
    width: "100%",
    minHeight: "80px",
    resize: "vertical",
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
    color: "inherit",
    font: "inherit",
    fontSize: "13px",
  },
});

const PickerList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    maxHeight: "160px",
    overflowY: "auto",
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: "var(--borderRadius-sm)",
    padding: "var(--gap-sm)",
  },
});

const PickerRow = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    fontSize: "13px",
    cursor: "pointer",
  },
});

const EmptyHint = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    padding: "var(--gap-xs)",
  },
});
