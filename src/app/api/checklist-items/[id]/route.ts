import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { runAutomationForEvent } from "@/lib/automation/engine";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { checklistItemPatchSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, checklistItemPatchSchema);
    const { supabase, user } = await requireApiUser();

    const { data: item, error: itemLookupError } = await supabase
      .from("checklist_items")
      .select("id, checklist_id")
      .eq("id", id)
      .maybeSingle();
    if (itemLookupError) {
      throw new ApiError(500, "checklist_item_lookup_failed", itemLookupError.message);
    }
    if (!item) {
      throw new ApiError(404, "checklist_item_not_found", "チェックリスト項目が見つかりません。");
    }

    const { data: checklist, error: checklistLookupError } = await supabase
      .from("checklists")
      .select("id, card_id")
      .eq("id", item.checklist_id)
      .maybeSingle();
    if (checklistLookupError) {
      throw new ApiError(500, "checklist_lookup_failed", checklistLookupError.message);
    }
    if (!checklist) {
      throw new ApiError(404, "checklist_not_found", "チェックリストが見つかりません。");
    }

    const { data: card, error: cardLookupError } = await supabase
      .from("cards")
      .select("id, board_id, list_id, priority, due_at")
      .eq("id", checklist.card_id)
      .maybeSingle();
    if (cardLookupError) {
      throw new ApiError(500, "card_lookup_failed", cardLookupError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "カードが見つかりません。");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const { data: board, error: boardLookupError } = await supabase
      .from("boards")
      .select("workspace_id")
      .eq("id", card.board_id)
      .maybeSingle();
    if (boardLookupError) {
      throw new ApiError(500, "board_lookup_failed", boardLookupError.message);
    }
    if (!board) {
      throw new ApiError(404, "board_not_found", "ボードが見つかりません。");
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.content !== undefined) updatePayload.content = payload.content;
    if (payload.position !== undefined) updatePayload.position = payload.position;
    if (payload.isCompleted !== undefined) {
      updatePayload.is_completed = payload.isCompleted;
      updatePayload.completed_by = payload.isCompleted ? user.id : null;
      updatePayload.completed_at = payload.isCompleted ? new Date().toISOString() : null;
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("checklist_items")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) {
      throw new ApiError(500, "checklist_item_update_failed", updateError.message);
    }

    await logActivity(supabase, {
      boardId: card.board_id,
      cardId: checklist.card_id,
      actorId: user.id,
      action: "checklist_item_updated",
      metadata: { checklistItemId: id, ...payload },
    });

    if (payload.isCompleted === true) {
      const { data: remaining } = await supabase
        .from("checklist_items")
        .select("id")
        .eq("checklist_id", checklist.id)
        .eq("is_completed", false)
        .limit(1);

      if (!remaining?.length) {
        const [{ data: assignees }, { data: labels }] = await Promise.all([
          supabase.from("card_assignees").select("user_id").eq("card_id", card.id),
          supabase.from("card_labels").select("label_id").eq("card_id", card.id),
        ]);

        await runAutomationForEvent(supabase, {
          trigger: "checklist_completed",
          workspaceId: board.workspace_id,
          boardId: card.board_id,
          actorId: user.id,
          card: {
            id: card.id,
            board_id: card.board_id,
            list_id: card.list_id,
            priority: card.priority,
            due_at: card.due_at,
            assigneeIds: (assignees ?? []).map((row) => row.user_id),
            labelIds: (labels ?? []).map((row) => row.label_id),
          },
        });
      }
    }

    return ok(updatedItem);
  } catch (error) {
    return fail(error as Error);
  }
}
