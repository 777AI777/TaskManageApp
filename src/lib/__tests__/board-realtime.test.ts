import { describe, expect, it } from "vitest";

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
import {
  removeRealtimeAttachment,
  removeRealtimeCardAssignee,
  removeRealtimeCardCustomFieldValue,
  removeRealtimeCardLabel,
  removeRealtimeCard,
  removeRealtimeCardWatcher,
  removeRealtimeCustomField,
  removeRealtimeChecklist,
  removeRealtimeChecklistItem,
  removeRealtimeChecklistItemsByChecklist,
  removeRealtimeComment,
  removeRealtimeLabel,
  removeRealtimeList,
  upsertRealtimeAttachment,
  upsertRealtimeCardAssignee,
  upsertRealtimeCardCustomFieldValue,
  upsertRealtimeCardLabel,
  upsertRealtimeCard,
  upsertRealtimeCardWatcher,
  upsertRealtimeCustomField,
  upsertRealtimeChecklist,
  upsertRealtimeChecklistItem,
  upsertRealtimeComment,
  upsertRealtimeLabel,
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

function createCardAssignee(overrides?: Partial<CardAssignee>): CardAssignee {
  return {
    id: "assignee-1",
    card_id: "card-1",
    user_id: "user-1",
    ...overrides,
  };
}

function createCardLabel(overrides?: Partial<CardLabel>): CardLabel {
  return {
    id: "card-label-1",
    card_id: "card-1",
    label_id: "label-1",
    ...overrides,
  };
}

function createCardCustomFieldValue(overrides?: Partial<CardCustomFieldValue>): CardCustomFieldValue {
  return {
    id: "cfv-1",
    card_id: "card-1",
    custom_field_id: "field-1",
    value_text: "hello",
    value_number: null,
    value_date: null,
    value_boolean: null,
    value_option: null,
    created_at: "2026-03-05T00:00:00.000Z",
    updated_at: "2026-03-05T00:00:00.000Z",
    ...overrides,
  };
}

function createLabel(overrides?: Partial<Label>): Label {
  return {
    id: "label-1",
    board_id: "board-1",
    name: "Backend",
    color: "#579dff",
    ...overrides,
  };
}

function createCustomField(overrides?: Partial<CustomField>): CustomField {
  return {
    id: "field-1",
    board_id: "board-1",
    name: "Estimate",
    field_type: "number",
    options: [],
    position: 1000,
    created_by: "user-1",
    created_at: "2026-03-05T00:00:00.000Z",
    updated_at: "2026-03-05T00:00:00.000Z",
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

  it("ignores stale card events when updated_at is older than current state", () => {
    const initial = [
      createCard({
        id: "card-1",
        title: "Newer",
        updated_at: "2026-03-05T10:00:00.000Z",
      }),
    ];

    const stale = upsertRealtimeCard(
      initial,
      createCard({
        id: "card-1",
        title: "Older",
        updated_at: "2026-03-05T09:59:59.000Z",
      }),
    );
    expect(stale.find((card) => card.id === "card-1")?.title).toBe("Newer");

    const staleArchived = upsertRealtimeCard(
      initial,
      createCard({
        id: "card-1",
        archived: true,
        updated_at: "2026-03-05T09:59:59.000Z",
      }),
    );
    expect(staleArchived.some((card) => card.id === "card-1")).toBe(true);
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

  it("upserts and removes card assignees by id or card/user pair", () => {
    const initial = [createCardAssignee(), createCardAssignee({ id: "assignee-2", user_id: "user-2" })];
    const updatedById = upsertRealtimeCardAssignee(
      initial,
      createCardAssignee({ id: "assignee-1", user_id: "user-3" }),
    );
    expect(updatedById.find((item) => item.id === "assignee-1")?.user_id).toBe("user-3");

    const updatedByPair = upsertRealtimeCardAssignee(
      updatedById,
      createCardAssignee({ id: undefined, card_id: "card-1", user_id: "user-2" }),
    );
    expect(updatedByPair).toHaveLength(2);
    expect(updatedByPair.find((item) => item.user_id === "user-2")?.id).toBe("assignee-2");

    const removedById = removeRealtimeCardAssignee(updatedByPair, { id: "assignee-2" });
    expect(removedById).toHaveLength(1);

    const removedByPair = removeRealtimeCardAssignee(removedById, { card_id: "card-1", user_id: "user-3" });
    expect(removedByPair).toHaveLength(0);
  });

  it("upserts and removes card labels by id or card/label pair", () => {
    const initial = [createCardLabel(), createCardLabel({ id: "card-label-2", label_id: "label-2" })];
    const updatedById = upsertRealtimeCardLabel(initial, createCardLabel({ id: "card-label-1", label_id: "label-3" }));
    expect(updatedById.find((item) => item.id === "card-label-1")?.label_id).toBe("label-3");

    const updatedByPair = upsertRealtimeCardLabel(
      updatedById,
      createCardLabel({ id: undefined, card_id: "card-1", label_id: "label-2" }),
    );
    expect(updatedByPair).toHaveLength(2);
    expect(updatedByPair.find((item) => item.label_id === "label-2")?.id).toBe("card-label-2");

    const removedById = removeRealtimeCardLabel(updatedByPair, { id: "card-label-2" });
    expect(removedById).toHaveLength(1);

    const removedByPair = removeRealtimeCardLabel(removedById, { card_id: "card-1", label_id: "label-3" });
    expect(removedByPair).toHaveLength(0);
  });

  it("upserts and removes card custom field values by id and card/field pair", () => {
    const initial = [
      createCardCustomFieldValue(),
      createCardCustomFieldValue({ id: "cfv-2", custom_field_id: "field-2", value_text: "second" }),
    ];
    const updatedById = upsertRealtimeCardCustomFieldValue(
      initial,
      createCardCustomFieldValue({ id: "cfv-1", value_text: "updated" }),
    );
    expect(updatedById.find((item) => item.id === "cfv-1")?.value_text).toBe("updated");

    const updatedByPair = upsertRealtimeCardCustomFieldValue(
      updatedById,
      createCardCustomFieldValue({ id: "cfv-3", card_id: "card-1", custom_field_id: "field-2", value_text: "pair" }),
    );
    expect(updatedByPair).toHaveLength(2);
    expect(updatedByPair.find((item) => item.custom_field_id === "field-2")?.id).toBe("cfv-3");

    const removedById = removeRealtimeCardCustomFieldValue(updatedByPair, { id: "cfv-3" });
    expect(removedById).toHaveLength(1);

    const removedByPair = removeRealtimeCardCustomFieldValue(removedById, {
      card_id: "card-1",
      custom_field_id: "field-1",
    });
    expect(removedByPair).toHaveLength(0);
  });

  it("upserts and removes labels and custom fields by id", () => {
    const labels = [createLabel(), createLabel({ id: "label-2", name: "Frontend" })];
    const updatedLabels = upsertRealtimeLabel(labels, createLabel({ id: "label-1", name: "API" }));
    expect(updatedLabels.find((item) => item.id === "label-1")?.name).toBe("API");
    const removedLabels = removeRealtimeLabel(updatedLabels, "label-2");
    expect(removedLabels.map((item) => item.id)).toEqual(["label-1"]);

    const fields = [createCustomField(), createCustomField({ id: "field-2", name: "Severity" })];
    const updatedFields = upsertRealtimeCustomField(fields, createCustomField({ id: "field-1", name: "SP" }));
    expect(updatedFields.find((item) => item.id === "field-1")?.name).toBe("SP");
    const removedFields = removeRealtimeCustomField(updatedFields, "field-2");
    expect(removedFields.map((item) => item.id)).toEqual(["field-1"]);
  });
});
