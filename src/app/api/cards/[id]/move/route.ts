import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { runAutomationForEvent } from "@/lib/automation/engine";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { cardMoveSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, cardMoveSchema);
    const { supabase, user } = await requireApiUser();

    const { data: card, error: cardLookupError } = await supabase
      .from("cards")
      .select("id, board_id, list_id, title, priority, due_at")
      .eq("id", id)
      .maybeSingle();

    if (cardLookupError) {
      throw new ApiError(500, "card_lookup_failed", cardLookupError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "Cardが見つかりません。");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("workspace_id")
      .eq("id", card.board_id)
      .maybeSingle();
    if (boardError) {
      throw new ApiError(500, "board_lookup_failed", boardError.message);
    }
    if (!board) {
      throw new ApiError(404, "board_not_found", "Boardが見つかりません。");
    }

    const { data: movedCard, error: moveError } = await supabase
      .from("cards")
      .update({
        list_id: payload.listId,
        position: payload.position,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (moveError) {
      throw new ApiError(500, "card_move_failed", moveError.message);
    }

    const { data: assignees } = await supabase
      .from("card_assignees")
      .select("user_id")
      .eq("card_id", id);
    const { data: labels } = await supabase.from("card_labels").select("label_id").eq("card_id", id);

    await logActivity(supabase, {
      boardId: movedCard.board_id,
      cardId: movedCard.id,
      actorId: user.id,
      action: "card_moved",
      metadata: {
        fromListId: card.list_id,
        toListId: payload.listId,
        position: payload.position,
      },
    });

    await runAutomationForEvent(supabase, {
      trigger: "card_moved",
      workspaceId: board.workspace_id,
      boardId: movedCard.board_id,
      actorId: user.id,
      card: {
        id: movedCard.id,
        board_id: movedCard.board_id,
        list_id: movedCard.list_id,
        priority: movedCard.priority,
        due_at: movedCard.due_at,
        assigneeIds: (assignees ?? []).map((row) => row.user_id),
        labelIds: (labels ?? []).map((row) => row.label_id),
      },
    });

    return ok(movedCard);
  } catch (error) {
    return fail(error as Error);
  }
}
