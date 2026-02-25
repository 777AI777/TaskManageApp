import type { CardPriority } from "@/lib/types";

export const DEFAULT_BOARD_LISTS = [
  { name: "Backlog", position: 1000 },
  { name: "ToDo", position: 2000 },
  { name: "In Progress", position: 3000 },
  { name: "Review", position: 4000 },
  { name: "Done", position: 5000 },
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
