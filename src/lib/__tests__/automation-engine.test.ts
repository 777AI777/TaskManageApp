import { describe, expect, it } from "vitest";

import { evaluateCondition, type AutomationEvent } from "@/lib/automation/engine";

const baseEvent: AutomationEvent = {
  trigger: "card_moved",
  workspaceId: "workspace-1",
  boardId: "board-1",
  actorId: "user-1",
  card: {
    id: "card-1",
    board_id: "board-1",
    list_id: "list-1",
    priority: "high",
    due_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    labelIds: ["label-1"],
    assigneeIds: ["user-2"],
  },
};

describe("automation condition evaluation", () => {
  it("matches card_priority_is", () => {
    expect(
      evaluateCondition(baseEvent, {
        id: "condition-1",
        condition_type: "card_priority_is",
        condition_payload: { priority: "high" },
        position: 0,
      }),
    ).toBe(true);
  });

  it("matches label_is", () => {
    expect(
      evaluateCondition(baseEvent, {
        id: "condition-2",
        condition_type: "label_is",
        condition_payload: { labelId: "label-1" },
        position: 0,
      }),
    ).toBe(true);
  });

  it("fails assignee_is when not assigned", () => {
    expect(
      evaluateCondition(baseEvent, {
        id: "condition-3",
        condition_type: "assignee_is",
        condition_payload: { userId: "user-9" },
        position: 0,
      }),
    ).toBe(false);
  });

  it("matches due_within_hours", () => {
    expect(
      evaluateCondition(baseEvent, {
        id: "condition-4",
        condition_type: "due_within_hours",
        condition_payload: { hours: 12 },
        position: 0,
      }),
    ).toBe(true);
  });
});
