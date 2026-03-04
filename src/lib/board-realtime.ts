import type {
  Attachment,
  BoardCard,
  BoardList,
  CardComment,
  CardWatcher,
  Checklist,
  ChecklistItem,
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

export function upsertRealtimeComment(current: CardComment[], nextComment: CardComment): CardComment[] {
  const index = current.findIndex((comment) => comment.id === nextComment.id);
  if (index === -1) {
    return [...current, nextComment];
  }
  const next = [...current];
  next[index] = nextComment;
  return next;
}

export function removeRealtimeComment(current: CardComment[], commentId: string): CardComment[] {
  return current.filter((comment) => comment.id !== commentId);
}

export function upsertRealtimeChecklist(current: Checklist[], nextChecklist: Checklist): Checklist[] {
  const index = current.findIndex((checklist) => checklist.id === nextChecklist.id);
  if (index === -1) {
    return [...current, nextChecklist];
  }
  const next = [...current];
  next[index] = nextChecklist;
  return next;
}

export function removeRealtimeChecklist(current: Checklist[], checklistId: string): Checklist[] {
  return current.filter((checklist) => checklist.id !== checklistId);
}

export function upsertRealtimeChecklistItem(
  current: ChecklistItem[],
  nextChecklistItem: ChecklistItem,
): ChecklistItem[] {
  const index = current.findIndex((item) => item.id === nextChecklistItem.id);
  if (index === -1) {
    return [...current, nextChecklistItem];
  }
  const next = [...current];
  next[index] = nextChecklistItem;
  return next;
}

export function removeRealtimeChecklistItem(current: ChecklistItem[], checklistItemId: string): ChecklistItem[] {
  return current.filter((item) => item.id !== checklistItemId);
}

export function removeRealtimeChecklistItemsByChecklist(
  current: ChecklistItem[],
  checklistId: string,
): ChecklistItem[] {
  return current.filter((item) => item.checklist_id !== checklistId);
}

export function upsertRealtimeAttachment(current: Attachment[], nextAttachment: Attachment): Attachment[] {
  const index = current.findIndex((attachment) => attachment.id === nextAttachment.id);
  if (index === -1) {
    return [...current, nextAttachment];
  }
  const next = [...current];
  next[index] = nextAttachment;
  return next;
}

export function removeRealtimeAttachment(current: Attachment[], attachmentId: string): Attachment[] {
  return current.filter((attachment) => attachment.id !== attachmentId);
}

export function upsertRealtimeCardWatcher(current: CardWatcher[], nextWatcher: CardWatcher): CardWatcher[] {
  if (nextWatcher.id) {
    const byIdIndex = current.findIndex((watcher) => watcher.id === nextWatcher.id);
    if (byIdIndex >= 0) {
      const existing = current[byIdIndex];
      const next = [...current];
      next[byIdIndex] = {
        ...existing,
        ...nextWatcher,
        id: nextWatcher.id ?? existing.id,
        created_at: nextWatcher.created_at ?? existing.created_at,
      };
      return next;
    }
  }

  const byPairIndex = current.findIndex(
    (watcher) => watcher.card_id === nextWatcher.card_id && watcher.user_id === nextWatcher.user_id,
  );
  if (byPairIndex >= 0) {
    const existing = current[byPairIndex];
    const next = [...current];
    next[byPairIndex] = {
      ...existing,
      ...nextWatcher,
      id: nextWatcher.id ?? existing.id,
      created_at: nextWatcher.created_at ?? existing.created_at,
    };
    return next;
  }

  return [...current, nextWatcher];
}

export function removeRealtimeCardWatcher(
  current: CardWatcher[],
  target: { id?: string; card_id?: string; user_id?: string },
): CardWatcher[] {
  if (target.id) {
    const hasWatcherWithId = current.some((watcher) => watcher.id === target.id);
    if (hasWatcherWithId) {
      return current.filter((watcher) => watcher.id !== target.id);
    }
  }

  if (target.card_id && target.user_id) {
    return current.filter(
      (watcher) => !(watcher.card_id === target.card_id && watcher.user_id === target.user_id),
    );
  }

  return current;
}
