import type {
  Activity,
  BoardCard,
  BoardList,
  CardAssignee,
  CardLabel,
} from "@/components/board/board-types";

export function upsertRealtimeCard(current: BoardCard[], nextCard: BoardCard): BoardCard[] {
  const rest = current.filter((card) => card.id !== nextCard.id);
  if (nextCard.archived) {
    return rest;
  }
  return [...rest, nextCard];
}

export function removeRealtimeCard(current: BoardCard[], cardId: string): BoardCard[] {
  return current.filter((card) => card.id !== cardId);
}

export function upsertRealtimeList(current: BoardList[], nextList: BoardList): BoardList[] {
  const rest = current.filter((list) => list.id !== nextList.id);
  if (nextList.is_archived) {
    return rest;
  }
  return [...rest, nextList];
}

export function removeRealtimeList(current: BoardList[], listId: string): BoardList[] {
  return current.filter((list) => list.id !== listId);
}

export function parseActivityRelationshipMetadata(
  metadata: Record<string, unknown> | null | undefined,
): {
  assigneeIds: string[] | null;
  labelIds: string[] | null;
} {
  const assigneeIds = Array.isArray(metadata?.assigneeIds)
    ? metadata.assigneeIds.filter(
        (assigneeId): assigneeId is string => typeof assigneeId === "string",
      )
    : null;

  const labelIds = Array.isArray(metadata?.labelIds)
    ? metadata.labelIds.filter(
        (labelId): labelId is string => typeof labelId === "string",
      )
    : null;

  return { assigneeIds, labelIds };
}

export function applyCardAssigneeSnapshot(
  current: CardAssignee[],
  cardId: string,
  assigneeIds: string[],
): CardAssignee[] {
  return [
    ...current.filter((item) => item.card_id !== cardId),
    ...assigneeIds.map((userId) => ({ card_id: cardId, user_id: userId })),
  ];
}

export function applyCardLabelSnapshot(
  current: CardLabel[],
  cardId: string,
  labelIds: string[],
): CardLabel[] {
  return [
    ...current.filter((item) => item.card_id !== cardId),
    ...labelIds.map((labelId) => ({ card_id: cardId, label_id: labelId })),
  ];
}

export function getActivityCardId(activity: Pick<Activity, "card_id">): string | null {
  return typeof activity.card_id === "string" ? activity.card_id : null;
}
