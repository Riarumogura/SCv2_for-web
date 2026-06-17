import { For, Match, Show, Switch, createSignal } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";
import { File, Message } from "stoat.js";

import { useClient, useUser } from "@revolt/client";
import { CustomEmoji, UnicodeEmoji } from "@revolt/markdown/emoji";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";

import MdBadge from "@material-design-icons/svg/outlined/badge.svg?component-solid";
import MdContentCopy from "@material-design-icons/svg/outlined/content_copy.svg?component-solid";
import MdDelete from "@material-design-icons/svg/outlined/delete.svg?component-solid";
import MdDeleteSweep from "@material-design-icons/svg/outlined/delete_sweep.svg?component-solid";
import MdDownload from "@material-design-icons/svg/outlined/download.svg?component-solid";
import MdEdit from "@material-design-icons/svg/outlined/edit.svg?component-solid";
import MdLink from "@material-design-icons/svg/outlined/link.svg?component-solid";
import MdMarkChatUnread from "@material-design-icons/svg/outlined/mark_chat_unread.svg?component-solid";
import MdOpenInNew from "@material-design-icons/svg/outlined/open_in_new.svg?component-solid";
import MdPin from "@material-design-icons/svg/outlined/pin_invoke.svg?component-solid";
import MdReply from "@material-design-icons/svg/outlined/reply.svg?component-solid";
import MdReport from "@material-design-icons/svg/outlined/report.svg?component-solid";
import MdShare from "@material-design-icons/svg/outlined/share.svg?component-solid";
import MdShield from "@material-design-icons/svg/outlined/shield.svg?component-solid";
import MdStorage from "@material-symbols/svg-400/outlined/cloud-fill.svg?component-solid";

import MdSentimentContent from "@material-symbols/svg-400/outlined/sentiment_content.svg?component-solid";

import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
  ContextMenuSubMenu,
} from "./ContextMenu";

// CUSTOM: ストレージ選択モーダル用のインポート
import { useStorageApi } from "../../../src/api/storage";

/**
 * Context menu for messages
 */
export function MessageContextMenu(props: { message?: Message; file?: File }) {
  const user = useUser();
  const state = useState();
  const client = useClient();
  const { openModal, showError } = useModals();
  const storageApi = useStorageApi();

  // CUSTOM: ストレージ選択状態
  const [storages, setStorages] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(false);

  /**
   * Reply to this message
   */
  function reply() {
    state.draft.addReply(props.message!, user()!.id);
  }

  /**
   * Mark message as unread
   */
  function markAsUnread() {
    props.message!.ack(true, false, true);
  }

  /**
   * Copy message contents to clipboard
   */
  function copyText() {
    navigator.clipboard.writeText(props.message!.content);
  }

  /**
   * Report the message
   */
  function report() {
    openModal({
      type: "report_content",
      target: props.message!,
      client: client(),
    });
  }

  /**
   * Delete the message
   */
  function deleteMessage(ev: MouseEvent) {
    if (ev.shiftKey) {
      props.message!.delete();
    } else {
      openModal({
        type: "delete_message",
        message: props.message!,
      });
    }
  }

  /**
   * Open message in Stoat Admin Panel
   */
  function openAdminPanel() {
    window.open(
      `https://old-admin.stoatinternal.com/panel/inspect/message/${props.message!.id}`,
      "_blank",
    );
  }

  /**
   * Copy message link to clipboard
   */
  function copyLink() {
    navigator.clipboard.writeText(
      `${location.origin}${
        props.message!.server ? `/server/${props.message!.server?.id}` : ""
      }/channel/${props.message!.channelId}/${props.message!.id}`,
    );
  }

  /**
   * Copy message id to clipboard
   */
  function copyId() {
    navigator.clipboard.writeText(props.message!.id);
  }

  /**
   * Opens the file preview in a new tab
   */
  function OpenFile() {
    window.open(props.file?.originalUrl, "_blank");
  }

  /**
   * Copies the link to the original url of the file
   */
  function CopyLink() {
    navigator.clipboard.writeText(props.file?.originalUrl ?? "");
  }

  /**
   * CUSTOM: ファイルをストレージに保存
   */
  async function saveToStorage(storageId: string) {
    if (!props.file || !props.message?.serverId) return;

    try {
      setLoading(true);
      await storageApi.saveToStorage(
        props.message.serverId,
        storageId,
        props.file.originalUrl,
        `chat_${props.message.id}_${props.file.filename}`
      );
      // TODO: 成功通知を表示
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * CUSTOM: ストレージ一覧を取得
   */
  async function loadStorages() {
    if (!props.message?.serverId) return;

    try {
      setLoading(true);
      const serverStorages = await storageApi.getStorages(props.message.serverId);
      setStorages(serverStorages);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ContextMenu>
      <Show when={props.file}>
        <ContextMenuButton icon={MdOpenInNew} onClick={OpenFile}>
          <Trans>Open file</Trans>
        </ContextMenuButton>
        <ContextMenuButton icon={MdLink} onClick={CopyLink}>
          <Trans>Copy link</Trans>
        </ContextMenuButton>
        <a
          target="_blank"
          download={props.file?.filename}
          href={props.file?.originalUrl}
        >
          <ContextMenuButton icon={MdDownload}>
            <Trans>Save file</Trans>
          </ContextMenuButton>
        </a>

        {/* CUSTOM: ストレージに保存メニュー */}
        <Show when={props.message?.serverId}>
          <ContextMenuDivider />
          <ContextMenuSubMenu
            icon={MdStorage}
            onClick={loadStorages}
            buttonContent={<Trans>Save to Storage</Trans>}
          >
            <Show
              when={storages().length > 0}
              fallback={
                <ContextMenuButton disabled={loading()}>
                  <Trans>Loading storages...</Trans>
                </ContextMenuButton>
              }
            >
              <For each={storages()}>
                {(storage) => (
                  <ContextMenuButton
                    onClick={() => saveToStorage(storage.id)}
                    disabled={loading()}
                  >
                    <div style={{ display: "flex", "justify-content": "space-between", width: "100%" }}>
                      <span>{storage.name}</span>
                      <span style={{ "font-size": "11px", opacity: 0.7 }}>
                        {Math.round(storage.usedSize / 1024 / 1024 / 1024)}/{Math.round(storage.sizeLimit / 1024 / 1024 / 1024)} GB
                      </span>
                    </div>
                  </ContextMenuButton>
                )}
              </For>
            </Show>
          </ContextMenuSubMenu>
        </Show>

        <ContextMenuDivider />
      </Show>
      <Show when={props.message}>
        <Show when={props.message!.channel?.havePermission("SendMessage")}>
          <ContextMenuButton icon={MdReply}