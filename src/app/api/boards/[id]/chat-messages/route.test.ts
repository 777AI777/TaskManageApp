import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/http";

const mocks = vi.hoisted(() => ({
  parseBody: vi.fn(),
  requireApiUser: vi.fn(),
  assertBoardRole: vi.fn(),
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

import { GET, POST } from "./route";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createAwaitableQuery(result: QueryResult) {
  const query: {
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    then: Promise<QueryResult>["then"];
    catch: Promise<QueryResult>["catch"];
    finally: Promise<QueryResult>["finally"];
  } = {
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    lt: vi.fn(),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    catch: Promise.resolve(result).catch.bind(Promise.resolve(result)),
    finally: Promise.resolve(result).finally.bind(Promise.resolve(result)),
  };

  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  return query;
}

function createSupabaseForGet(result: QueryResult) {
  const query = createAwaitableQuery(result);
  const from = vi.fn((table: string) => {
    if (table !== "board_chat_messages") throw new Error(`Unexpected table: ${table}`);
    return {
      select: vi.fn().mockReturnValue(query),
    };
  });
  return { supabase: { from }, query };
}

function createSupabaseForPost(insertResult: QueryResult) {
  let insertedPayload: Record<string, unknown> | null = null;
  const single = vi.fn().mockResolvedValue(insertResult);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn((payload: Record<string, unknown>) => {
    insertedPayload = payload;
    return { select };
  });
  const from = vi.fn((table: string) => {
    if (table !== "board_chat_messages") throw new Error(`Unexpected table: ${table}`);
    return { insert };
  });
  return { supabase: { from }, insert, getInsertedPayload: () => insertedPayload };
}

describe("boards/[id]/chat-messages route", () => {
  beforeEach(() => {
    mocks.parseBody.mockReset();
    mocks.requireApiUser.mockReset();
    mocks.assertBoardRole.mockReset();
    mocks.assertBoardRole.mockResolvedValue(undefined);
  });

  it("creates a board chat message", async () => {
    mocks.parseBody.mockResolvedValue({ content: "  hello team  " });
    const { supabase, getInsertedPayload } = createSupabaseForPost({
      data: {
        id: "msg-1",
        board_id: "board-1",
        user_id: "user-1",
        content: "hello team",
        created_at: "2026-03-05T00:00:00.000Z",
      },
      error: null,
    });
    mocks.requireApiUser.mockResolvedValue({ supabase, user: { id: "user-1" } });

    const response = await POST(new Request("http://localhost/api/boards/board-1/chat-messages", { method: "POST" }), {
      params: Promise.resolve({ id: "board-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(getInsertedPayload()).toEqual({
      board_id: "board-1",
      user_id: "user-1",
      content: "hello team",
    });
    expect(body.data.id).toBe("msg-1");
  });

  it("returns 400 when content is empty", async () => {
    mocks.parseBody.mockRejectedValue(
      new ApiError(400, "validation_error", "Validation error."),
    );
    const { supabase } = createSupabaseForPost({
      data: null,
      error: null,
    });
    mocks.requireApiUser.mockResolvedValue({ supabase, user: { id: "user-1" } });

    const response = await POST(new Request("http://localhost/api/boards/board-1/chat-messages", { method: "POST" }), {
      params: Promise.resolve({ id: "board-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("returns 400 when content length exceeds limit", async () => {
    mocks.parseBody.mockRejectedValue(
      new ApiError(400, "validation_error", "Validation error."),
    );
    const { supabase } = createSupabaseForPost({
      data: null,
      error: null,
    });
    mocks.requireApiUser.mockResolvedValue({ supabase, user: { id: "user-1" } });

    const response = await POST(new Request("http://localhost/api/boards/board-1/chat-messages", { method: "POST" }), {
      params: Promise.resolve({ id: "board-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("returns 403 when current user cannot access board chat", async () => {
    const { supabase } = createSupabaseForGet({
      data: [],
      error: null,
    });
    mocks.requireApiUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
    mocks.assertBoardRole.mockRejectedValue(new ApiError(403, "forbidden", "Forbidden"));

    const response = await GET(new Request("http://localhost/api/boards/board-1/chat-messages"), {
      params: Promise.resolve({ id: "board-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("forbidden");
  });

  it("returns paginated messages in ascending order for display", async () => {
    const rows = Array.from({ length: 51 }).map((_, index) => ({
      id: `msg-${index + 1}`,
      board_id: "board-1",
      user_id: `user-${index + 1}`,
      content: `message-${index + 1}`,
      created_at: `2026-03-05T00:${String(59 - index).padStart(2, "0")}:00.000Z`,
    }));
    const { supabase, query } = createSupabaseForGet({
      data: rows,
      error: null,
    });
    mocks.requireApiUser.mockResolvedValue({ supabase, user: { id: "user-1" } });

    const response = await GET(
      new Request("http://localhost/api/boards/board-1/chat-messages?before=2026-03-05T01:00:00.000Z"),
      {
        params: Promise.resolve({ id: "board-1" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(query.lt).toHaveBeenCalledWith("created_at", "2026-03-05T01:00:00.000Z");
    expect(body.data.messages).toHaveLength(50);
    expect(body.data.messages[0].id).toBe("msg-50");
    expect(body.data.messages[49].id).toBe("msg-1");
    expect(body.data.hasMore).toBe(true);
    expect(body.data.nextBefore).toBe("2026-03-05T00:10:00.000Z");
  });
});
