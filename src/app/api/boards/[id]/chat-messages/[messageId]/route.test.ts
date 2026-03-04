import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/http";

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

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createAwaitableQuery(result: QueryResult) {
  const resolved = Promise.resolve(result);
  const query: {
    eq: ReturnType<typeof vi.fn>;
    then: Promise<QueryResult>["then"];
    catch: Promise<QueryResult>["catch"];
    finally: Promise<QueryResult>["finally"];
  } = {
    eq: vi.fn(),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };

  query.eq.mockReturnValue(query);
  return query;
}

function createSupabaseForDelete(options: {
  selectResult: QueryResult;
  deleteResult?: QueryResult;
}) {
  const selectBuilder: {
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(options.selectResult),
  };
  selectBuilder.eq.mockReturnValue(selectBuilder);

  const deleteBuilder = createAwaitableQuery(options.deleteResult ?? { data: null, error: null });
  const deleteCall = vi.fn().mockReturnValue(deleteBuilder);

  const from = vi.fn((table: string) => {
    if (table !== "board_chat_messages") throw new Error(`Unexpected table: ${table}`);
    return {
      select: vi.fn().mockReturnValue(selectBuilder),
      delete: deleteCall,
    };
  });

  return { supabase: { from }, selectBuilder, deleteBuilder, deleteCall };
}

describe("boards/[id]/chat-messages/[messageId] route", () => {
  beforeEach(() => {
    mocks.requireApiUser.mockReset();
    mocks.assertBoardRole.mockReset();
    mocks.assertBoardRole.mockResolvedValue(undefined);
  });

  it("deletes own board chat message", async () => {
    const { supabase, deleteBuilder } = createSupabaseForDelete({
      selectResult: {
        data: { id: "msg-1", board_id: "board-1", user_id: "user-1" },
        error: null,
      },
      deleteResult: { data: null, error: null },
    });
    mocks.requireApiUser.mockResolvedValue({ supabase, user: { id: "user-1" } });

    const response = await DELETE(
      new Request("http://localhost/api/boards/board-1/chat-messages/msg-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "board-1", messageId: "msg-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: "msg-1", deleted: true });
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(1, "id", "msg-1");
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(2, "board_id", "board-1");
  });

  it("returns 403 when deleting another user's message", async () => {
    const { supabase, deleteCall } = createSupabaseForDelete({
      selectResult: {
        data: { id: "msg-1", board_id: "board-1", user_id: "user-2" },
        error: null,
      },
    });
    mocks.requireApiUser.mockResolvedValue({ supabase, user: { id: "user-1" } });

    const response = await DELETE(
      new Request("http://localhost/api/boards/board-1/chat-messages/msg-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "board-1", messageId: "msg-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("board_chat_message_forbidden");
    expect(deleteCall).not.toHaveBeenCalled();
  });

  it("returns 404 when message is not found", async () => {
    const { supabase, deleteCall } = createSupabaseForDelete({
      selectResult: {
        data: null,
        error: null,
      },
    });
    mocks.requireApiUser.mockResolvedValue({ supabase, user: { id: "user-1" } });

    const response = await DELETE(
      new Request("http://localhost/api/boards/board-1/chat-messages/msg-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "board-1", messageId: "msg-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("board_chat_message_not_found");
    expect(deleteCall).not.toHaveBeenCalled();
  });

  it("returns 403 when current user cannot access board chat", async () => {
    const { supabase, selectBuilder } = createSupabaseForDelete({
      selectResult: {
        data: { id: "msg-1", board_id: "board-1", user_id: "user-1" },
        error: null,
      },
    });
    mocks.requireApiUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    mocks.assertBoardRole.mockRejectedValue(new ApiError(403, "forbidden", "Forbidden"));

    const response = await DELETE(
      new Request("http://localhost/api/boards/board-1/chat-messages/msg-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "board-1", messageId: "msg-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("forbidden");
    expect(selectBuilder.maybeSingle).not.toHaveBeenCalled();
  });
});
