import { describe, expect, it } from "vitest";

import type {
  Attachment,
  BoardCard,
  BoardList,
  CardComment,
  CardWatcher,
  Checklist,
  ChecklistItem,
} from "@/components/board/board-types";
import {
  removeRealtimeAttachment,
  removeRealtimeCard,
  removeRealtimeCardWatcher,
  removeRealtimeChecklist,
  removeRealtimeChecklistItem,
  removeRealtimeChecklistItemsByChecklist,
  removeRealtimeComment,
  removeRealtimeList,
  upsertRealtimeAttachment,
  upsertRealtimeCard,
  upsertRealtimeCardWatcher,
  upsertRealtimeChecklist,
  upsertRealtimeChecklistItem,
  upsertRealtimeComment,
  upsertRealtimeList,
} from "@/lib/board-realtime";

function createCard(overrides?: Partial<BoardCard>): BoardCard {
  return {
    id: "card-1",
    board_id: "board-1",
    task_number: 1,
    list_id: "list-1",
    title: "Card",
    description: null,
    position: 1024,
    due_at: null,
    priority: "medium",
    estimate_points: null,
    start_at: null,
    archived: false,
    is_completed: false,
    completed_at: null,
    cover_color: null,
    cover_type: "none",
    cover_value: null,
    created_by: "user-1",
    created_at: "2026-02-26T00:00:00.000Z",
    updated_at: "2026-02-26T00:00:00.000Z",
    ...overrides,
  };
}

function createList(overrides?: Partial<BoardList>): BoardList {
  return {
    id: "list-1",
    board_id: "board-1",
    name: "To do",
    position: 1024,
    is_archived: false,
    ...overrides,
  };
}

function createComment(overrides?: Partial<CardComment>): CardComment {
  return {
    id: "comment-1",
    card_id: "card-1",
    user_id: "user-1",
    content: "Hello",
    created_at: "2026-03-05T00:00:00.000Z",
    ...overrides,
  };
}

function createChecklist(overrides?: Partial<Checklist>): Checklist {
  return {
    id: "checklist-1",
    card_id: "card-1",
    title: "Checklist",
    position: 1000,
    ...overrides,
  };
}

function createChecklistItem(overrides?: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: "item-1",
    checklist_id: "checklist-1",
    content: "Do thing",
    is_completed: false,
    position: 1000,
    assignee_id: null,
    due_at: null,
    completed_by: null,
    completed_at: null,
    ...overrides,
  };
}

function createAttachment(overrides?: Partial<Attachment>): Attachment {
  return {
    id: "attachment-1",
    card_id: "card-1",
    name: "file.txt",
    storage_path: "workspace/a/board/b/card/c/file.txt",
    mime_type: "text/plain",
    size_bytes: 100,
    preview_url: null,
    created_at: "2026-03-05T00:00:00.000Z",
    ...overrides,
  };
}

function createWatcher(overrides?: Partial<CardWatcher>): CardWatcher {
  return {
    id: "watcher-1",
    card_id: "card-1",
    user_id: "user-1",
    created_at: "2026-03-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("realtime reducers", () => {
  it("upserts and removes cards with archived handling", () => {
    const initial = [createCard(), createCard({ id: "card-2" })];
    const updated = upsertRealtimeCard(initial, createCard({ id: "card-1", title: "Updated" }));
    expect(updated.find((card) => card.id === "card-1")?.title).toBe("Updated");

    const archived = upsertRealtimeCard(updated, createCard({ id: "card-1", archived: true }));
    expect(archived.some((card) => card.id === "card-1")).toBe(false);

    const removed = removeRealtimeCard(archived, "card-2");
    expect(removed).toHaveLength(0);
  });

  it("upserts and removes lists with archived handling", () => {
    const initial = [createList(), createList({ id: "list-2" })];
    const updated = upsertRealtimeList(initial, createList({ id: "list-1", name: "Doing" }));
    expect(updated.find((list) => list.id === "list-1")?.name).toBe("Doing");

    const archived = upsertRealtimeList(updated, createList({ id: "list-1", is_archived: true }));
    expect(archived.some((list) => list.id === "list-1")).toBe(false);

    const removed = removeRealtimeList(archived, "list-2");
    expect(removed).toHaveLength(0);
  });

  it("upserts and removes comments without duplicates", () => {
    const initial = [createComment(), createComment({ id: "comment-2" })];
    const updated = upsertRealtimeComment(initial, createComment({ id: "comment-1", content: "Updated" }));
    expect(updated).toHaveLength(2);
    expect(updated.find((comment) => comment.id === "comment-1")?.content).toBe("Updated");

    const removed = removeRealtimeComment(updated, "comment-2");
    expect(removed.map((comment) => comment.id)).toEqual(["comment-1"]);
  });

  it("upserts and removes checklists and checklist items", () => {
    const checklists = [createChecklist(), createChecklist({ id: "checklist-2", card_id: "card-2" })];
    const updatedChecklists = upsertRealtimeChecklist(
      checklists,
      createChecklist({ id: "checklist-1", title: "Updated checklist" }),
    );
    expect(updatedChecklists.find((checklist) => checklist.id === "checklist-1")?.title).toBe("Updated checklist");

    const removedChecklists = removeRealtimeChecklist(updatedChecklists, "checklist-2");
    expect(removedChecklists.map((checklist) => checklist.id)).toEqual(["checklist-1"]);

    const items = [
      createChecklistItem(),
      createChecklistItem({ id: "item-2", checklist_id: "checklist-2" }),
      createChecklistItem({ id: "item-3", checklist_id: "checklist-1" }),
    ];
    const updatedItems = upsertRealtimeChecklistItem(
      items,
      createChecklistItem({ id: "item-1", content: "Updated item" }),
    );
    expect(updatedItems.find((item) => item.id === "item-1")?.content).toBe("Updated item");

    const removedSingle = removeRealtimeChecklistItem(updatedItems, "item-2");
    expect(removedSingle.map((item) => item.id)).toEqual(["item-1", "item-3"]);

    const removedByChecklist = removeRealtimeChecklistItemsByChecklist(removedSingle, "checklist-1");
    expect(removedByChecklist).toHaveLength(0);
  });

  it("upserts and removes attachments without duplicates", () => {
    const initial = [createAttachment(), createAttachment({ id: "attachment-2" })];
    const updated = upsertRealtimeAttachment(initial, createAttachment({ id: "attachment-1", name: "renamed.txt" }));
    expect(updated).toHaveLength(2);
    expect(updated.find((attachment) => attachment.id === "attachment-1")?.name).toBe("renamed.txt");

    const removed = removeRealtimeAttachment(updated, "attachment-2");
    expect(removed.map((attachment) => attachment.id)).toEqual(["attachment-1"]);
  });

  it("upserts and removes card watchers by id or card/user pair", () => {
    const initial = [createWatcher(), createWatcher({ id: "watcher-2", user_id: "user-2" })];
    const updated = upsertRealtimeCardWatcher(initial, createWatcher({ id: "watcher-1", created_at: "next" }));
    expect(updated).toHaveLength(2);
    expect(updated.find((watcher) => watcher.id === "watcher-1")?.created_at).toBe("next");

    const dedupedByPair = upsertRealtimeCardWatcher(
      updated,
      createWatcher({ id: undefined, card_id: "card-1", user_id: "user-2" }),
    );
    expect(dedupedByPair).toHaveLength(2);

    const removedById = removeRealtimeCardWatcher(dedupedByPair, { id: "watcher-2" });
    expect(removedById).toHaveLength(1);

    const withPairOnly = [
      { card_id: "card-1", user_id: "user-3" },
      { card_id: "card-1", user_id: "user-4" },
    ] as CardWatcher[];
    const removedByPair = removeRealtimeCardWatcher(withPairOnly, { card_id: "card-1", user_id: "user-3" });
    expect(removedByPair).toEqual([{ card_id: "card-1", user_id: "user-4" }]);
  });
});
