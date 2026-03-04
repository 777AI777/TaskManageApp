import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  assertBoardRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/lib/permissions", () => ({
  assertBoardRole: mocks.assertBoardRole,
}));

import { DELETE } from "./route";

type MaybeSingleResult = {
  data: unknown;
  error: { message: string } | null;
};

type DeleteResult = {
  error: { message: string } | null;
};

function createEqChain(result: MaybeSingleResult) {
  const chain = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  } as {
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  return chain;
}

function createDeleteEqChain(result: DeleteResult) {
  const chain = {
    eq: vi.fn(),
  } as {
    eq: ReturnType<typeof vi.fn>;
  };
  chain.eq.mockResolvedValue(result);
  return chain;
}

function setupSupabase(options?: {
  checklistResult?: MaybeSingleResult;
  deleteResult?: DeleteResult;
}) {
  const checklistQuery = createEqChain(
    options?.checklistResult ?? { data: { id: "checklist-1", card_id: "card-1" }, error: null },
  );
  const cardQuery = createEqChain({ data: { id: "card-1", board_id: "board-1" }, error: null });
  const checklistDeleteQuery = createDeleteEqChain(options?.deleteResult ?? { error: null });
  const checklistDelete = vi.fn().mockReturnValue(checklistDeleteQuery);

  const from = vi.fn((table: string) => {
    if (table === "checklists") {
      return {
        select: vi.fn().mockReturnValue(checklistQuery),
        delete: checklistDelete,
      };
    }
    if (table === "cards") {
      return { select: vi.fn().mockReturnValue(cardQuery) };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from },
    checklistDelete,
  };
}

describe("DELETE /api/checklists/[id]", () => {
  beforeEach(() => {
    mocks.requireApiUser.mockReset();
    mocks.assertBoardRole.mockReset();
    mocks.assertBoardRole.mockResolvedValue(undefined);
  });

  it("deletes a checklist", async () => {
    const { supabase, checklistDelete } = setupSupabase();
    mocks.requireApiUser.mockResolvedValue({
      supabase,
      user: { id: "actor-1" },
    });

    const response = await DELETE(new Request("http://localhost/api/test", { method: "DELETE" }), {
      params: Promise.resolve({ id: "checklist-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: "checklist-1" });
    expect(mocks.assertBoardRole).toHaveBeenCalledWith(supabase, "board-1", "actor-1", ["member"]);
    expect(checklistDelete).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when checklist does not exist", async () => {
    const { supabase, checklistDelete } = setupSupabase({
      checklistResult: { data: null, error: null },
    });
    mocks.requireApiUser.mockResolvedValue({
      supabase,
      user: { id: "actor-1" },
    });

    const response = await DELETE(new Request("http://localhost/api/test", { method: "DELETE" }), {
      params: Promise.resolve({ id: "missing-checklist" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("checklist_not_found");
    expect(checklistDelete).not.toHaveBeenCalled();
  });

  it("returns 500 when delete fails", async () => {
    const { supabase } = setupSupabase({
      deleteResult: { error: { message: "db delete failed" } },
    });
    mocks.requireApiUser.mockResolvedValue({
      supabase,
      user: { id: "actor-1" },
    });

    const response = await DELETE(new Request("http://localhost/api/test", { method: "DELETE" }), {
      params: Promise.resolve({ id: "checklist-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("checklist_delete_failed");
  });
});
