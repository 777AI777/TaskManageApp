import { parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { boardChatMessageCreateSchema } from "@/lib/validation/schemas";

const CHAT_PAGE_SIZE = 50;

type BoardChatMessageRow = {
  id: string;
  board_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireApiUser();

    await assertBoardRole(supabase, id, user.id, ["member"]);

    const requestUrl = new URL(request.url);
    const beforeRaw = requestUrl.searchParams.get("before");
    let beforeIso: string | null = null;
    if (beforeRaw) {
      const beforeDate = new Date(beforeRaw);
      if (Number.isNaN(beforeDate.getTime())) {
        throw new ApiError(400, "invalid_before", "Invalid before query parameter.");
      }
      beforeIso = beforeDate.toISOString();
    }

    let query = supabase
      .from("board_chat_messages")
      .select("id, board_id, user_id, content, created_at")
      .eq("board_id", id)
      .order("created_at", { ascending: false })
      .limit(CHAT_PAGE_SIZE + 1);

    if (beforeIso) {
      query = query.lt("created_at", beforeIso);
    }

    const { data, error } = await query;
    if (error) {
      throw new ApiError(500, "board_chat_messages_lookup_failed", error.message);
    }

    const rows = (data ?? []) as BoardChatMessageRow[];
    const hasMore = rows.length > CHAT_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, CHAT_PAGE_SIZE) : rows;
    const oldestRow = pageRows[pageRows.length - 1];

    return ok({
      messages: [...pageRows].reverse(),
      hasMore,
      nextBefore: hasMore && oldestRow ? oldestRow.created_at : null,
    });
  } catch (error) {
    return fail(error as Error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, boardChatMessageCreateSchema);
    const { supabase, user } = await requireApiUser();

    await assertBoardRole(supabase, id, user.id, ["member"]);

    const content = payload.content.trim();

    const { data, error } = await supabase
      .from("board_chat_messages")
      .insert({
        board_id: id,
        user_id: user.id,
        content,
      })
      .select("id, board_id, user_id, content, created_at")
      .single();

    if (error) {
      throw new ApiError(500, "board_chat_message_create_failed", error.message);
    }

    return ok(data, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
