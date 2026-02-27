import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";
import { assertWorkspaceRole } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const boardId = searchParams.get("boardId");
    const query = searchParams.get("q");
    const priority = searchParams.get("priority");
    const assigneeId = searchParams.get("assigneeId");
    const labelId = searchParams.get("labelId");
    const dueFrom = searchParams.get("dueFrom");
    const dueTo = searchParams.get("dueTo");

    if (!workspaceId) {
      throw new ApiError(400, "missing_workspace", "workspaceIdは必須です。");
    }
    await assertWorkspaceRole(supabase, workspaceId, user.id, ["member"]);

    const { data: boards, error: boardError } = await supabase
      .from("boards")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false);
    if (boardError) {
      throw new ApiError(500, "board_lookup_failed", boardError.message);
    }

    let boardIds = (boards ?? []).map((board) => board.id);
    if (boardId) {
      boardIds = boardIds.filter((id) => id === boardId);
    }
    if (!boardIds.length) {
      return ok([]);
    }

    let cardIdsFilter: string[] | null = null;

    if (assigneeId) {
      const { data: assigneeCards } = await supabase
        .from("card_assignees")
        .select("card_id")
        .eq("user_id", assigneeId);
      cardIdsFilter = (assigneeCards ?? []).map((row) => row.card_id);
    }

    if (labelId) {
      const { data: labelCards } = await supabase
        .from("card_labels")
        .select("card_id")
        .eq("label_id", labelId);
      const labelCardIds = (labelCards ?? []).map((row) => row.card_id);
      cardIdsFilter = cardIdsFilter
        ? cardIdsFilter.filter((id) => labelCardIds.includes(id))
        : labelCardIds;
    }

    let cardQuery = supabase
      .from("cards")
      .select("*")
      .in("board_id", boardIds)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(150);

    if (priority) {
      cardQuery = cardQuery.eq("priority", priority);
    }
    if (query) {
      cardQuery = cardQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }
    if (dueFrom) {
      cardQuery = cardQuery.gte("due_at", dueFrom);
    }
    if (dueTo) {
      cardQuery = cardQuery.lte("due_at", dueTo);
    }
    if (cardIdsFilter) {
      if (!cardIdsFilter.length) {
        return ok([]);
      }
      cardQuery = cardQuery.in("id", cardIdsFilter);
    }

    const { data: cards, error: cardError } = await cardQuery;
    if (cardError) {
      throw new ApiError(500, "search_failed", cardError.message);
    }

    return ok(cards ?? []);
  } catch (error) {
    return fail(error as Error);
  }
}
