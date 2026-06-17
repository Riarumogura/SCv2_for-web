// CUSTOM: フォルダ選択ダイアログ
import { For, Show, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui-solid/solid/macro";

import { Column, Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";
import { useStorageApi } from "../../../src/api/storage";

interface SelectFolderProps {
  serverId: string;
  storageId: string;
  onSelect: (folderPath: string) => void;
}

/**
 * フォルダ選択ダイアログ
 */
export function SelectFolderModal(
  props: DialogProps & Modals & { type: "select_folder" } & SelectFolderProps,
) {
  const { t } = useLingui();
  const { showError } = useModals();
  const storageApi = useStorageApi();

  const [folders, setFolders] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [currentPath, setCurrentPath] = createSignal<string>("");
  const [selectedPath, setSelectedPath] = createSignal<string>("");

  // フォルダ一覧を取得
  const loadFolders = async (path?: string) => {
    try {
      setLoading(true);
      const files = await storageApi.listFiles(
        props.serverId,
        props.storageId,
        path
      );
      
      // フォルダのみを抽出（パスに基づく簡易的な判定）
      const folderPaths = files
        .filter(file => file.type === "folder" || file.path.includes("/"))
        .map(file => file.path);
      
      setFolders(folderPaths);
      setCurrentPath(path || "");
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時にフォルダ一覧を取得
  onMount(() => {
    loadFolders();
  });

  // パンくずリストのパスを分割
  const breadcrumbs = () => {
    if (!currentPath()) return [];
    return currentPath().split("/").filter(Boolean);
  };

  // フォルダ選択
  const handleSelectFolder = (folderPath: string) => {
    setSelectedPath(folderPath);
  };

  // 決定ボタン
  const handleConfirm = () => {
    props.onSelect(selectedPath() || currentPath());
    props.onClose();
  };

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Select Folder</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Select</Trans>,
          onClick: handleConfirm,
          isDisabled: loading(),
        },
      ]}
      isDisabled={loading()}
    >
      <Column>
        {/* パスナビゲーション */}
        <div style={{ "margin-bottom": "var(--gap-md)" }}>
          <div style={{ "font-size": "12px", "margin-bottom": "var(--gap-sm)" }}>
            <Trans>Current Path:</Trans>
          </div>
          <div style={{ display: "flex", "flex-wrap": "wrap", "align-items": "center" }}>
            <button
              type="button"
              onClick={() => {
                setCurrentPath("");
                loadFolders();
                setSelectedPath("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--md-sys-color-primary)",
                cursor: "pointer",
                "font-size": "14px",
                padding: "var(--gap-xs) var(--gap-sm)",
              }}
            >
              <Trans>Root</Trans>
            </button>
            <For each={breadcrumbs()}>
              {(crumb, index) => (
                <>
                  <span style={{ margin: "0 var(--gap-xs)", color: "var(--md-sys-color-on-surface-variant)" }}>
                    /
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const path = breadcrumbs()
                        .slice(0, index() + 1)
                        .join("/");
                      setCurrentPath(path);
                      loadFolders(path);
                      setSelectedPath("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--md-sys-color-primary)",
                      cursor: "pointer",
                      "font-size": "14px",
                      padding: "var(--gap-xs) var(--gap-sm)",
                    }}
                  >
                    {crumb}
                  </button>
                </>
              )}
            </For>
          </div>
        </div>

        {/* フォルダ一覧 */}
        <div style={{ 
          background: "var(--md-sys-color-surface-container-low)",
          "border-radius": "var(--borderRadius-sm)",
          padding: "var(--gap-md)",
          "max-height": "300px",
          overflow: "auto",
        }}>
          <Show
            when={!loading()}
            fallback={
              <div style={{ 
                display: "flex", 
                "justify-content": "center", 
                "align-items": "center",
                height: "100px",
                color: "var(--md-sys-color-on-surface-variant)",
              }}>
                <Trans>Loading folders...</Trans>
              </div>
            }
          >
            <Show
              when={folders().length > 0}
              fallback={
                <div style={{ 
                  display: "flex", 
                  "flex-direction": "column",
                  "justify-content": "center", 
                  "align-items": "center",
                  height: "100px",
                  color: "var(--md-sys-color-on-surface-variant)",
                }}>
                  <Trans>No folders found</Trans>
                  <div style={{ "font-size": "12px", "margin-top": "var(--gap-sm)" }}>
                    <Trans>Create a new folder or select the current path</Trans>
                  </div>
                </div>
              }
            >
              <div style={{ display: "flex", "flex-direction": "column", gap: "var(--gap-xs)" }}>
                <For each={folders()}>
                  {(folder) => (
                    <button
                      type="button"
                      onClick={() => handleSelectFolder(folder)}
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: "var(--gap-sm)",
                        padding: "var(--gap-sm)",
                        background: selectedPath() === folder 
                          ? "var(--md-sys-color-surface-container-highest)" 
                          : "transparent",
                        border: "1px solid var(--md-sys-color-outline)",
                        "border-radius": "var(--borderRadius-sm)",
                        cursor: "pointer",
                        "text-align": "left",
                      }}
                    >
                      <span style={{ "font-size": "20px" }}>📁</span>
                      <span style={{ "font-size": "14px" }}>{folder}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        {/* 選択されたパス表示 */}
        <Show when={selectedPath()}>
        <div style={{ 
          "margin-top": "var(--gap-md)",
          padding: "var(--gap-sm)",
          background: "var(--md-sys-color-surface-container-low)",
          "border-radius": "var(--borderRadius-sm)",
          "font-size": "14px",
          }}>
            <div style={{ "font-size": "12px", "margin-bottom": "var(--gap-xs)" }}>
              <Trans>Selected Folder:</Trans>
            </div>
            <div>{selectedPath()}</div>
          </div>
        </Show>

        {/* 新しいフォルダ作成 */}
        <div style={{ "margin-top": "var(--gap-md)" }}>
          <div style={{ "font-size": "12px", "margin-bottom": "var(--gap-sm)" }}>
            <Trans>Or create a new folder:</Trans>
          </div>
          <input
            type="text"
            placeholder="Enter folder name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const newFolderName = e.currentTarget.value;
                if (newFolderName) {
                  const newPath = currentPath() 
                    ? `${currentPath()}/${newFolderName}`
                    : newFolderName;
                  handleSelectFolder(newPath);
                  e.currentTarget.value = "";
                }
              }
            }}
            style={{
              width: "100%",
              padding: "var(--gap-sm)",
              border: "1px solid var(--md-sys-color-outline)",
              "border-radius": "var(--borderRadius-sm)",
              "font-size": "14px",
            }}
          />
        </div>

        {/* 現在のパスを選択するオプション */}
        <div style={{ "margin-top": "var(--gap-md)" }}>
          <button
            type="button"
            onClick={() => handleSelectFolder(currentPath())}
            style={{
              width: "100%",
              padding: "var(--gap-sm)",
              background: "var(--md-sys-color-surface-container-low)",
              border: "1px solid var(--md-sys-color-outline)",
              "border-radius": "var(--borderRadius-sm)",
              cursor: "pointer",
              "font-size": "14px",
              "text-align": "center",
            }}
          >
            <Trans>Select Current Path</Trans>
            <div style={{ "font-size": "12px", "margin-top": "var(--gap-xs)" }}>
              {currentPath() || "/"}
            </div>
          </button>
        </div>
      </Column>
    </Dialog>
  );
}