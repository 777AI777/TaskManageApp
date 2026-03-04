import { describe, expect, it } from "vitest";

import type { BoardCard, BoardList } from "@/components/board/board-types";
import {
  removeRealtimeCard,
  removeRealtimeList,
  upsertRealtimeCard,
  upsertRealtimeList,
} from "@/lib/board-realtime";

function createCard(overrides?: Partial<BoardCard>): BoardCard {
  return {
    id: "card-1",
    board_id: "board-1",
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
});
