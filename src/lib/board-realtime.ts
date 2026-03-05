import type {
  Attachment,
  BoardCard,
  BoardList,
  CardAssignee,
  CardComment,
  CardCustomFieldValue,
  CardLabel,
  CardWatcher,
  Checklist,
  ChecklistItem,
  CustomField,
  Label,
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

export function upsertRealtimeCardAssignee(current: CardAssignee[], nextAssignee: CardAssignee): CardAssignee[] {
  if (nextAssignee.id) {
    const byIdIndex = current.findIndex((assignee) => assignee.id === nextAssignee.id);
    if (byIdIndex >= 0) {
      const existing = current[byIdIndex];
      const next = [...current];
      next[byIdIndex] = {
        ...existing,
        ...nextAssignee,
        id: nextAssignee.id ?? existing.id,
      };
      return next;
    }
  }

  const byPairIndex = current.findIndex(
    (assignee) => assignee.card_id === nextAssignee.card_id && assignee.user_id === nextAssignee.user_id,
  );
  if (byPairIndex >= 0) {
    const existing = current[byPairIndex];
    const next = [...current];
    next[byPairIndex] = {
      ...existing,
      ...nextAssignee,
      id: nextAssignee.id ?? existing.id,
    };
    return next;
  }

  return [...current, nextAssignee];
}

export function removeRealtimeCardAssignee(
  current: CardAssignee[],
  target: { id?: string; card_id?: string; user_id?: string },
): CardAssignee[] {
  if (target.id) {
    const hasAssigneeWithId = current.some((assignee) => assignee.id === target.id);
    if (hasAssigneeWithId) {
      return current.filter((assignee) => assignee.id !== target.id);
    }
  }

  if (target.card_id && target.user_id) {
    return current.filter(
      (assignee) => !(assignee.card_id === target.card_id && assignee.user_id === target.user_id),
    );
  }

  return current;
}

export function upsertRealtimeCardLabel(current: CardLabel[], nextLabel: CardLabel): CardLabel[] {
  if (nextLabel.id) {
    const byIdIndex = current.findIndex((label) => label.id === nextLabel.id);
    if (byIdIndex >= 0) {
      const existing = current[byIdIndex];
      const next = [...current];
      next[byIdIndex] = {
        ...existing,
        ...nextLabel,
        id: nextLabel.id ?? existing.id,
      };
      return next;
    }
  }

  const byPairIndex = current.findIndex(
    (label) => label.card_id === nextLabel.card_id && label.label_id === nextLabel.label_id,
  );
  if (byPairIndex >= 0) {
    const existing = current[byPairIndex];
    const next = [...current];
    next[byPairIndex] = {
      ...existing,
      ...nextLabel,
      id: nextLabel.id ?? existing.id,
    };
    return next;
  }

  return [...current, nextLabel];
}

export function removeRealtimeCardLabel(
  current: CardLabel[],
  target: { id?: string; card_id?: string; label_id?: string },
): CardLabel[] {
  if (target.id) {
    const hasLabelWithId = current.some((label) => label.id === target.id);
    if (hasLabelWithId) {
      return current.filter((label) => label.id !== target.id);
    }
  }

  if (target.card_id && target.label_id) {
    return current.filter((label) => !(label.card_id === target.card_id && label.label_id === target.label_id));
  }

  return current;
}

export function upsertRealtimeCardCustomFieldValue(
  current: CardCustomFieldValue[],
  nextValue: CardCustomFieldValue,
): CardCustomFieldValue[] {
  const byIdIndex = current.findIndex((value) => value.id === nextValue.id);
  if (byIdIndex >= 0) {
    const next = [...current];
    next[byIdIndex] = nextValue;
    return next;
  }

  const byPairIndex = current.findIndex(
    (value) => value.card_id === nextValue.card_id && value.custom_field_id === nextValue.custom_field_id,
  );
  if (byPairIndex >= 0) {
    const next = [...current];
    next[byPairIndex] = nextValue;
    return next;
  }

  return [...current, nextValue];
}

export function removeRealtimeCardCustomFieldValue(
  current: CardCustomFieldValue[],
  target: { id?: string; card_id?: string; custom_field_id?: string },
): CardCustomFieldValue[] {
  if (target.id) {
    const hasValueWithId = current.some((value) => value.id === target.id);
    if (hasValueWithId) {
      return current.filter((value) => value.id !== target.id);
    }
  }

  if (target.card_id && target.custom_field_id) {
    return current.filter(
      (value) => !(value.card_id === target.card_id && value.custom_field_id === target.custom_field_id),
    );
  }

  return current;
}

export function upsertRealtimeLabel(current: Label[], nextLabel: Label): Label[] {
  const index = current.findIndex((label) => label.id === nextLabel.id);
  if (index === -1) {
    return [...current, nextLabel];
  }
  const next = [...current];
  next[index] = nextLabel;
  return next;
}

export function removeRealtimeLabel(current: Label[], labelId: string): Label[] {
  return current.filter((label) => label.id !== labelId);
}

export function upsertRealtimeCustomField(current: CustomField[], nextField: CustomField): CustomField[] {
  const index = current.findIndex((field) => field.id === nextField.id);
  if (index === -1) {
    return [...current, nextField];
  }
  const next = [...current];
  next[index] = nextField;
  return next;
}

export function removeRealtimeCustomField(current: CustomField[], customFieldId: string): CustomField[] {
  return current.filter((field) => field.id !== customFieldId);
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
