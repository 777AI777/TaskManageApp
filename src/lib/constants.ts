import type { CardPriority } from "@/lib/types";

export const DEFAULT_BOARD_LISTS = [
  { name: "バックログ", position: 1000 },
  { name: "未着手", position: 2000 },
  { name: "進行中", position: 3000 },
  { name: "確認待ち", position: 4000 },
  { name: "完了", position: 5000 },
] as const;

export const PRIORITY_OPTIONS: { value: CardPriority; label: string }[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "urgent", label: "緊急" },
];

export const AUTOMATION_CONDITION_TYPES = [
  "card_priority_is",
  "label_is",
  "assignee_is",
  "due_within_hours",
  "list_is",
] as const;

export const AUTOMATION_ACTION_TYPES = [
  "move_card",
  "add_label",
  "assign_member",
  "set_due_date",
  "post_comment",
  "notify",
] as const;
