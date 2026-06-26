// CUSTOM: アルバムパネル本体。上部1/4程度に検索フォーム(カレンダー検索/条件検索を
// 切り替え可能)、残りにアルバムページ(選択した日付のアルバム、または検索結果から
// 開いたアルバムを縦に並べて表示)を配置する。
import {
  ErrorBoundary,
  For,
  Show,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";
import { styled } from "styled-system/jsx";

import env from "@revolt/common/lib/env";
import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { IconButton, Tooltip } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import {
  useAlbumApi,
  Album,
  AlbumCategory,
  AlbumPhotoMetadata,
} from "../../../api/album";
import { toDateInputValue } from "./albumLabels";
import { MiniCalendar } from "./MiniCalendar";
import { AlbumPhotoGrid } from "./AlbumPhotoGrid";

export interface AlbumExplorerProps {
  serverId: string;
}

type SearchMode = "calendar" | "condition";

/**
 * アルバムパネル本体
 */
export function AlbumExplorer(props: AlbumExplorerProps) {
  const albumApi = useAlbumApi();
  const { openModal } = useModals();

  const [searchMode, setSearchMode] = createSignal<SearchMode>("calendar");

  // ---- カレンダー検索 ----
  const [selectedDate, setSelectedDate] = createSignal(toDateInputValue(new Date()));
  const [colorsByDate, setColorsByDate] = createSignal<Record<string, string[]>>({});
  const [dateAlbums, { refetch: refetchDateAlbums }] = createResource(selectedDate, (date) =>
    albumApi.listAlbumsByDate(props.serverId, date),
  );

  async function handleVisibleRangeChange(from: string, to: string) {
    const dateColors = await albumApi.listAlbumDateColors(props.serverId, from, to);
    const map: Record<string, string[]> = {};
    for (const entry of dateColors) map[entry.date] = entry.colors;
    setColorsByDate(map);
  }

  function openCreateAlbumForSelectedDate() {
    openModal({
      type: "create_album",
      serverId: props.serverId,
      initialDate: selectedDate(),
      onCreated: () => refetchDateAlbums(),
    });
  }

  // ---- 条件検索 ----
  const [titleQuery, setTitleQuery] = createSignal("");
  const [dateFromQuery, setDateFromQuery] = createSignal("");
  const [dateToQuery, setDateToQuery] = createSignal("");
  const [categories, { mutate: mutateCategories }] = createResource(() =>
    albumApi.listCategories(props.serverId),
  );
  const [filterCategoryIds, setFilterCategoryIds] = createSignal<Set<string>>(new Set());
  const [searchResults, setSearchResults] = createSignal<Album[]>();
  const [openedResultId, setOpenedResultId] = createSignal<string>();

  function toggleFilterCategory(id: string) {
    setFilterCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreateCategory() {
    openModal({
      type: "create_album_category",
      serverId: props.serverId,
      onCreated: (category: AlbumCategory) => {
        mutateCategories((prev) => [...(prev ?? []), category]);
        toggleFilterCategory(category.id);
      },
    });
  }

  async function runSearch() {
    const results = await albumApi.searchAlbums(props.serverId, {
      title: titleQuery() || undefined,
      dateFrom: dateFromQuery() || undefined,
      dateTo: dateToQuery() || undefined,
      categoryIds: filterCategoryIds().size > 0 ? Array.from(filterCategoryIds()) : undefined,
    });
    setSearchResults(results);
    setOpenedResultId(results[0]?.id);
  }

  const openedResult = createMemo(() => searchResults()?.find((album) => album.id === openedResultId()));

  return (
    // CUSTOM: dateAlbums/categories(createResource)はエラー状態で読み取ると例外を
    // re-throwする(Suspense/ErrorBoundary向けのSolidJSの仕様)。album-apiが落ちている等で
    // 失敗した場合、ErrorBoundaryが無いとこの例外がチャンネル全体の表示まで巻き込んで
    // 無限ローディングスピナーにしてしまうため、ここで握りつぶしてアルバムパネル内に
    // エラー表示を留める。
    <ErrorBoundary
      fallback={() => (
        <Container>
          <SearchSection>
            <EmptyHint>アルバムの読み込みに失敗しました。album-apiに接続できないか、サーバー側でエラーが発生しています。</EmptyHint>
          </SearchSection>
        </Container>
      )}
    >
    <Container>
      <SearchSection>
        <ModeToggle>
          <ModeButton data-active={searchMode() === "calendar"} onClick={() => setSearchMode("calendar")}>
            カレンダー検索
          </ModeButton>
          <ModeButton data-active={searchMode() === "condition"} onClick={() => setSearchMode("condition")}>
            条件検索
          </ModeButton>
        </ModeToggle>

        <Show when={searchMode() === "calendar"}>
          <MiniCalendar
            selectedDate={selectedDate()}
            onSelectDate={setSelectedDate}
            colorsByDate={colorsByDate()}
            onVisibleRangeChange={handleVisibleRangeChange}
          />
        </Show>

        <Show when={searchMode() === "condition"}>
          <ConditionForm>
            <input
              type="text"
              placeholder="アルバム名"
              value={titleQuery()}
              onInput={(e) => setTitleQuery((e.currentTarget as HTMLInputElement).value)}
            />
            <DateRangeRow>
              <input
                type="date"
                value={dateFromQuery()}
                onInput={(e) => setDateFromQuery((e.currentTarget as HTMLInputElement).value)}
              />
              <span>〜</span>
              <input
                type="date"
                value={dateToQuery()}
                onInput={(e) => setDateToQuery((e.currentTarget as HTMLInputElement).value)}
              />
            </DateRangeRow>
            <CategoryRow>
              <CategoryLabel>カテゴリ</CategoryLabel>
              <Tooltip content="カテゴリを作成" placement="top">
                <IconButton size="xs" variant="standard" onPress={openCreateCategory}>
                  <Symbol size={16}>add</Symbol>
                </IconButton>
              </Tooltip>
            </CategoryRow>
            <CategoryList>
              <For each={categories()}>
                {(category: AlbumCategory) => (
                  <CategoryChip
                    data-active={filterCategoryIds().has(category.id)}
                    onClick={() => toggleFilterCategory(category.id)}
                  >
                    <ColorDot style={{ background: category.color }} />
                    {category.name}
                  </CategoryChip>
                )}
              </For>
            </CategoryList>
            <SearchButton onClick={runSearch}>検索</SearchButton>
          </ConditionForm>
        </Show>
      </SearchSection>

      <AlbumPageSection>
        <Show when={searchMode() === "calendar"}>
          {/* CUSTOM: 同じ日付に複数アルバムを作成できるため、既存アルバムの有無に関わらず
              常に最上部に「アルバムを作成」ボタンを表示する */}
          <CreateAlbumPrompt onClick={openCreateAlbumForSelectedDate}>
            + アルバムを作成
          </CreateAlbumPrompt>
          <For each={dateAlbums()}>
            {(album) => (
              <AlbumBlock serverId={props.serverId} album={album} onChanged={refetchDateAlbums} />
            )}
          </For>
        </Show>

        <Show when={searchMode() === "condition"}>
          <Show when={searchResults()} fallback={<EmptyHint>検索条件を入力してください</EmptyHint>}>
            <ResultsList>
              <For each={searchResults()}>
                {(album) => (
                  <ResultRow
                    data-active={openedResultId() === album.id}
                    onClick={() => setOpenedResultId(album.id)}
                  >
                    <span>{album.title}</span>
                    <span>{album.date}</span>
                  </ResultRow>
                )}
              </For>
              <Show when={searchResults()?.length === 0}>
                <EmptyHint>該当するアルバムが見つかりませんでした</EmptyHint>
              </Show>
            </ResultsList>
            <Show when={openedResult()}>
              {(album) => (
                <AlbumBlock serverId={props.serverId} album={album()} onChanged={runSearch} />
              )}
            </Show>
          </Show>
        </Show>
      </AlbumPageSection>
    </Container>
    </ErrorBoundary>
  );
}

// CUSTOM: 画像/動画のintrinsicサイズをアップロード前にクライアント側で読み取る。
// stoat.jsのFile型はImage/Video種別にwidth/heightを要求するが、Autumnの/attachments
// アップロード応答はidのみで寸法を返さないため、Draft.ts(ドラフトのプレビュー生成)と
// 同じ手法でブラウザ側に読み込んで取得する。
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

// CUSTOM: チャット添付と同じAutumnバケット("attachments")に直接アップロードする
// (Composition.tsxのsendStampAttachmentと同じ直接アップロードパターン)
const AUTUMN_TAG = "attachments";

interface AlbumBlockProps {
  serverId: string;
  album: Album;
  onChanged?: () => void;
}

/**
 * 1件のアルバム(タイトル+写真追加+設定の枠と、写真グリッド)
 */
function AlbumBlock(props: AlbumBlockProps) {
  const albumApi = useAlbumApi();
  const client = useClient();
  const { openModal, showError } = useModals();
  const [photos, { refetch }] = createResource(
    () => props.album.id,
    (albumId) => albumApi.listPhotos(props.serverId, albumId),
  );
  const [isUploading, setIsUploading] = createSignal(false);

  async function uploadFile(file: globalThis.File) {
    if (file.size > env.MAX_FILE_SIZE) {
      throw new Error(`ファイルサイズが大きすぎます: ${file.name}`);
    }

    const dimensions = await readMediaDimensions(file);
    const type: AlbumPhotoMetadata["type"] = file.type.startsWith("image/")
      ? "Image"
      : file.type.startsWith("video/")
        ? "Video"
        : "File";

    const body = new FormData();
    body.set("file", file, file.name);
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

    await albumApi.addPhoto(props.serverId, props.album.id, {
      autumnId: id,
      tag: AUTUMN_TAG,
      filename: file.name,
      contentType: file.type,
      metadata: { type, ...dimensions },
      size: file.size,
    });
  }

  async function onFilesSelected(files: FileList) {
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
      refetch();
    } catch (error) {
      showError(error);
    } finally {
      setIsUploading(false);
    }
  }

  function openFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,video/*";
    input.addEventListener("change", () => {
      if (input.files && input.files.length > 0) onFilesSelected(input.files);
    });
    input.click();
  }

  function openSettings() {
    openModal({
      type: "edit_album",
      serverId: props.serverId,
      album: props.album,
      onUpdated: () => props.onChanged?.(),
      onDeleted: () => props.onChanged?.(),
    });
  }

  return (
    <Block>
      <BlockHeader>
        <BlockTitle>{props.album.title}</BlockTitle>
        <BlockActions>
          <Tooltip content="写真・動画を追加" placement="top">
            <IconButton size="xs" variant="standard" onPress={openFilePicker} isDisabled={isUploading()}>
              <Symbol size={18}>add</Symbol>
            </IconButton>
          </Tooltip>
          <Tooltip content="アルバム設定" placement="top">
            <IconButton size="xs" variant="standard" onPress={openSettings}>
              <Symbol size={18}>settings</Symbol>
            </IconButton>
          </Tooltip>
        </BlockActions>
      </BlockHeader>
      {/* CUSTOM: photos()(createResource)はエラー時に読み取ると例外をre-throwするため、
          1つのアルバムの写真取得が失敗しても他のアルバムブロックまで巻き込まないように
          ここでも個別にErrorBoundaryで止める */}
      <ErrorBoundary fallback={<EmptyHint>写真の読み込みに失敗しました</EmptyHint>}>
        <AlbumPhotoGrid photos={photos() ?? []} />
      </ErrorBoundary>
    </Block>
  );
}

const Container = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  },
});

const SearchSection = styled("div", {
  base: {
    flex: "0 0 25%",
    minHeight: "220px",
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    padding: "var(--gap-md)",
    borderBottom: "1px solid var(--md-sys-color-outline-variant)",
    overflowY: "auto",
  },
});

const AlbumPageSection = styled("div", {
  base: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    padding: "var(--gap-md)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
  },
});

const ModeToggle = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-xs)",
  },
});

const ModeButton = styled("button", {
  base: {
    flex: "1 1 auto",
    padding: "var(--gap-xs) var(--gap-sm)",
    borderRadius: "var(--borderRadius-sm)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontSize: "12px",
    cursor: "pointer",

    "&[data-active='true']": {
      background: "var(--md-sys-color-primary-container)",
      borderColor: "var(--md-sys-color-primary)",
    },
  },
});

const ConditionForm = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",

    "& input[type='text'], & input[type='date']": {
      padding: "var(--gap-xs) var(--gap-sm)",
      borderRadius: "var(--borderRadius-sm)",
      border: "1px solid var(--md-sys-color-outline-variant)",
      background: "var(--md-sys-color-surface-container-low)",
      color: "inherit",
      font: "inherit",
      fontSize: "13px",
    },
  },
});

const DateRangeRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-xs)",

    "& input": { flex: "1 1 auto", minWidth: 0 },
  },
});

const CategoryRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const CategoryLabel = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const CategoryList = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--gap-xs)",
  },
});

const CategoryChip = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-xs)",
    padding: "2px var(--gap-sm)",
    borderRadius: "999px",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontSize: "12px",
    cursor: "pointer",

    "&[data-active='true']": {
      background: "var(--md-sys-color-secondary-container)",
      borderColor: "var(--md-sys-color-secondary)",
    },
  },
});

const ColorDot = styled("span", {
  base: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
});

const SearchButton = styled("button", {
  base: {
    alignSelf: "flex-start",
    padding: "var(--gap-xs) var(--gap-lg)",
    borderRadius: "var(--borderRadius-sm)",
    border: "none",
    background: "var(--md-sys-color-primary)",
    color: "var(--md-sys-color-on-primary)",
    font: "inherit",
    fontSize: "13px",
    cursor: "pointer",
  },
});

// CUSTOM: 既存アルバムの有無に関わらず常に表示する「アルバムを作成」ボタン(アルバムページ最上部)
const CreateAlbumPrompt = styled("button", {
  base: {
    alignSelf: "flex-start",
    padding: "var(--gap-xs) var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    border: "1px dashed var(--md-sys-color-outline-variant)",
    background: "transparent",
    color: "var(--md-sys-color-on-surface-variant)",
    font: "inherit",
    fontSize: "13px",
    cursor: "pointer",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },
  },
});

const EmptyHint = styled("div", {
  base: {
    fontSize: "13px",
    color: "var(--md-sys-color-on-surface-variant)",
    padding: "var(--gap-md)",
  },
});

const ResultsList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: "var(--borderRadius-sm)",
    overflow: "hidden",
  },
});

const ResultRow = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    padding: "var(--gap-sm)",
    fontSize: "13px",
    cursor: "pointer",

    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },

    "&[data-active='true']": {
      background: "var(--md-sys-color-secondary-container)",
    },
  },
});

const Block = styled("div", {
  base: {
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: "var(--borderRadius-md)",
    overflow: "hidden",
  },
});

const BlockHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--gap-sm) var(--gap-md)",
    borderBottom: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
  },
});

const BlockTitle = styled("div", {
  base: {
    fontSize: "14px",
    fontWeight: "bold",
  },
});

const BlockActions = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-xs)",
  },
});
