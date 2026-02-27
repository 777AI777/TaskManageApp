import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseBody: vi.fn(),
  requireApiUser: vi.fn(),
  assertBoardRole: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  parseBody: mocks.parseBody,
}));

vi.mock("@/lib/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/lib/permissions", () => ({
  assertBoardRole: mocks.assertBoardRole,
}));

vi.mock("@/lib/activity", () => ({
  logActivity: mocks.logActivity,
}));

import { POST } from "./route";

type MaybeSingleResult = {
  data: unknown;
  error: { message: string } | null;
};

function createEqChain(result: MaybeSingleResult) {
  const chain = {
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  } as {
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  return chain;
}

function setupSupabase({ hasAssigneeMembership }: { hasAssigneeMembership: boolean }) {
  const checklistQuery = createEqChain({
    data: { id: "checklist-1", card_id: "card-1" },
    error: null,
  });
  const cardQuery = createEqChain({
    data: { id: "card-1", board_id: "board-1" },
    error: null,
  });
  const boardMemberQuery = createEqChain({
    data: hasAssigneeMembership ? { user_id: "member-1" } : null,
    error: null,
  });
  const latestItemQuery = createEqChain({
    data: { position: 1000 },
    error: null,
  });

  const insertSingle = vi.fn().mockResolvedValue({
    data: {
      id: "item-1",
      checklist_id: "checklist-1",
      content: "確認する",
      is_completed: false,
      position: 2000,
      assignee_id: "member-1",
      due_at: "2026-03-11T14:59:00.000Z",
    },
    error: null,
  });
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  let insertedPayload: Record<string, unknown> | null = null;
  const insert = vi.fn((payload: Record<string, unknown>) => {
    insertedPayload = payload;
    return { select: insertSelect };
  });

  const from = vi.fn((table: string) => {
    if (table === "checklists") {
      return { select: vi.fn().mockReturnValue(checklistQuery) };
    }
    if (table === "cards") {
      return { select: vi.fn().mockReturnValue(cardQuery) };
    }
    if (table === "board_members") {
      return { select: vi.fn().mockReturnValue(boardMemberQuery) };
    }
    if (table === "checklist_items") {
      return {
        select: vi.fn().mockReturnValue(latestItemQuery),
        insert,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from },
    insert,
    getInsertedPayload: () => insertedPayload,
  };
}

describe("POST /api/checklists/[id]/items", () => {
  beforeEach(() => {
    mocks.parseBody.mockReset();
    mocks.requireApiUser.mockReset();
    mocks.assertBoardRole.mockReset();
    mocks.logActivity.mockReset();
    mocks.assertBoardRole.mockResolvedValue(undefined);
    mocks.logActivity.mockResolvedValue(undefined);
  });

  it("creates checklist item with assignee_id and due_at", async () => {
    const { supabase, getInsertedPayload } = setupSupabase({ hasAssigneeMembership: true });
    mocks.parseBody.mockResolvedValue({
      content: "確認する",
      assigneeId: "member-1",
      dueAt: "2026-03-11T14:59:00.000Z",
    });
    mocks.requireApiUser.mockResolvedValue({
      supabase,
      user: { id: "actor-1" },
    });

    const response = await POST(new Request("http://localhost/api/test", { method: "POST" }), {
      params: Promise.resolve({ id: "checklist-1" }),
    });

    const body = await response.json();
    expect(response.status).toBe(201);
    expect(getInsertedPayload()).toMatchObject({
      checklist_id: "checklist-1",
      content: "確認する",
      position: 2000,
      assignee_id: "member-1",
      due_at: "2026-03-11T14:59:00.000Z",
    });
    expect(body.data.id).toBe("item-1");
  });

  it("returns 400 when assignee is not a board member", async () => {
    const { supabase, insert } = setupSupabase({ hasAssigneeMembership: false });
    mocks.parseBody.mockResolvedValue({
      content: "確認する",
      assigneeId: "not-member",
    });
    mocks.requireApiUser.mockResolvedValue({
      supabase,
      user: { id: "actor-1" },
    });

    const response = await POST(new Request("http://localhost/api/test", { method: "POST" }), {
      params: Promise.resolve({ id: "checklist-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_assignee");
    expect(insert).not.toHaveBeenCalled();
  });
});

