import type { BoardPowerUp } from "@/lib/types";

export type PowerUpDefinition = {
  key: string;
  displayName: string;
  description: string;
};

export const POWER_UP_DEFINITIONS: PowerUpDefinition[] = [
  {
    key: "custom-fields",
    displayName: "Custom Fields",
    description: "カードに任意フィールドを追加します。",
  },
  {
    key: "card-aging",
    displayName: "Card Aging",
    description: "更新のないカードを視覚的に強調します。",
  },
  {
    key: "voting",
    displayName: "Voting",
    description: "カード投票を有効化します。",
  },
  {
    key: "map",
    displayName: "Map",
    description: "位置情報付きカードを地図で表示します。",
  },
  {
    key: "calendar",
    displayName: "Calendar",
    description: "期限日をカレンダー表示します。",
  },
  {
    key: "automation",
    displayName: "Automation",
    description: "ルール自動化(Butler相当)を有効化します。",
  },
];

const definitionByKey = new Map(POWER_UP_DEFINITIONS.map((item) => [item.key, item]));

export function resolvePowerUpDisplayName(key: string) {
  return definitionByKey.get(key)?.displayName ?? key;
}

export function mergePowerUps(
  boardId: string,
  rows: Array<Pick<BoardPowerUp, "id" | "board_id" | "power_up_key" | "display_name" | "is_enabled" | "config" | "created_by" | "created_at" | "updated_at">>,
  createdBy: string,
): BoardPowerUp[] {
  const rowMap = new Map(rows.map((row) => [row.power_up_key, row]));

  return POWER_UP_DEFINITIONS.map((definition) => {
    const row = rowMap.get(definition.key);
    if (row) {
      return {
        id: row.id,
        board_id: row.board_id,
        power_up_key: row.power_up_key,
        display_name: row.display_name,
        is_enabled: row.is_enabled,
        config: row.config,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    }
    const now = new Date().toISOString();
    return {
      id: `virtual-${definition.key}`,
      board_id: boardId,
      power_up_key: definition.key,
      display_name: definition.displayName,
      is_enabled: false,
      config: {},
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    };
  });
}
