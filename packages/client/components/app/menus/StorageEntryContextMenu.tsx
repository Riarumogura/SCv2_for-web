// CUSTOM: ストレージのファイル/フォルダ行を右クリックしたときの操作メニュー
import { Show } from "solid-js";

import MdDelete from "@material-design-icons/svg/outlined/delete.svg?component-solid";
import MdDownload from "@material-design-icons/svg/outlined/download.svg?component-solid";
import MdDriveFileMove from "@material-design-icons/svg/outlined/drive_file_move.svg?component-solid";
import MdEdit from "@material-design-icons/svg/outlined/edit.svg?component-solid";

import { ContextMenu, ContextMenuButton, ContextMenuDivider } from "./ContextMenu";

interface StorageEntryContextMenuProps {
  type: "file" | "folder";
  onDownload?: () => void;
  onDelete: () => void;
  onRename?: () => void;
  onMove?: () => void;
}

/**
 * ストレージエクスプローラーのファイル/フォルダ操作コンテキストメニュー
 */
export function StorageEntryContextMenu(props: StorageEntryContextMenuProps) {
  return (
    <ContextMenu>
      <Show when={props.type === "file"}>
        <ContextMenuButton icon={MdDownload} onClick={props.onDownload}>
          ダウンロード
        </ContextMenuButton>
        <ContextMenuDivider />
        <ContextMenuButton icon={MdDelete} destructive onClick={props.onDelete}>
          削除
        </ContextMenuButton>
      </Show>
      <Show when={props.type === "folder"}>
        <ContextMenuButton icon={MdEdit} onClick={props.onRename}>
          名前変更
        </ContextMenuButton>
        <ContextMenuButton icon={MdDriveFileMove} onClick={props.onMove}>
          移動
        </ContextMenuButton>
        <ContextMenuDivider />
        <ContextMenuButton icon={MdDelete} destructive onClick={props.onDelete}>
          削除
        </ContextMenuButton>
      </Show>
    </ContextMenu>
  );
}
