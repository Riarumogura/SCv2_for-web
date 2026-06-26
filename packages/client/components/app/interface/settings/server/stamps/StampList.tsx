// CUSTOM: スタンプ管理設定ページ(EmojiList.tsxと同じ構造)
import { For, Show, createResource } from "solid-js";
import { Server } from "stoat.js";

import { useModals } from "@revolt/modal";
import {
  Button,
  CategoryButton,
  CircularProgress,
  Column,
  Row,
  Text,
} from "@revolt/ui";

import { useStampApi } from "../../../../../../src/api/stamp";

/**
 * Stamp list
 */
export function StampList(props: { server: Server }) {
  const { openModal } = useModals();
  const stampApi = useStampApi();

  const [data, { refetch }] = createResource(() =>
    stampApi.listStamps(props.server.id),
  );

  function isDisabled() {
    const current = data();
    return !!current && current.count >= current.limit;
  }

  function openCreateStampModal() {
    openModal({
      type: "create_stamp",
      serverId: props.server.id,
      onCreated: refetch,
    });
  }

  return (
    <Column gap="lg">
      <Row align justify>
        <Button onPress={openCreateStampModal} isDisabled={isDisabled()}>
          スタンプを作成
        </Button>
        <Show when={data()}>
          {(current) => (
            <Text class="label">
              残り{Math.max(0, current().limit - current().count)}個作成できます
            </Text>
          )}
        </Show>
      </Row>

      <Show when={data.loading}>
        <CircularProgress />
      </Show>

      <Column gap="sm">
        <For each={data()?.stamps ?? []}>
          {(stamp) => (
            <CategoryButton
              roundedIcon={false}
              icon={
                <img
                  src={stamp.url}
                  alt={stamp.name}
                  style={{
                    width: "32px",
                    height: "32px",
                    "object-fit": "contain",
                  }}
                />
              }
              onClick={() =>
                openModal({
                  type: "stamp_preview",
                  serverId: props.server.id,
                  stamp,
                  onDeleted: refetch,
                })
              }
            >
              <span>{stamp.name}</span>
            </CategoryButton>
          )}
        </For>
      </Column>
    </Column>
  );
}
