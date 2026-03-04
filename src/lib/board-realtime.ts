import type { BoardCard, BoardList } from "@/components/board/board-types";

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
