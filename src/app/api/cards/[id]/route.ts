import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { createNotification, logActivity } from "@/lib/activity";
import { runAutomationForEvent } from "@/lib/automation/engine";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { cardPatchSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, cardPatchSchema);
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

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.title !== undefined) updatePayload.title = payload.title;
    if (payload.description !== undefined) updatePayload.description = payload.description;
    if (payload.listId !== undefined) updatePayload.list_id = payload.listId;
    if (payload.position !== undefined) updatePayload.position = payload.position;
    if (payload.dueAt !== undefined) updatePayload.due_at = payload.dueAt;
    if (payload.priority !== undefined) updatePayload.priority = payload.priority;
    if (payload.estimatePoints !== undefined) updatePayload.estimate_points = payload.estimatePoints;
    if (payload.startAt !== undefined) updatePayload.start_at = payload.startAt;
    if (payload.archived !== undefined) updatePayload.archived = payload.archived;
    if (payload.coverColor !== undefined) updatePayload.cover_color = payload.coverColor;

    const { data: updatedCard, error: cardUpdateError } = await supabase
      .from("cards")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    if (cardUpdateError) {
      throw new ApiError(500, "card_update_failed", cardUpdateError.message);
    }

    if (payload.assigneeIds) {
      const { error: removeAssigneeError } = await supabase
        .from("card_assignees")
        .delete()
        .eq("card_id", id);
      if (removeAssigneeError) {
        throw new ApiError(500, "card_assignee_clear_failed", removeAssigneeError.message);
      }

      if (payload.assigneeIds.length) {
        const { error: assigneeInsertError } = await supabase.from("card_assignees").insert(
          payload.assigneeIds.map((assigneeId) => ({
            card_id: id,
            user_id: assigneeId,
            assigned_by: user.id,
          })),
        );
        if (assigneeInsertError) {
          throw new ApiError(500, "card_assignee_upsert_failed", assigneeInsertError.message);
        }
      }
    }

    if (payload.labelIds) {
      const { error: removeLabelError } = await supabase
        .from("card_labels")
        .delete()
        .eq("card_id", id);
      if (removeLabelError) {
        throw new ApiError(500, "card_label_clear_failed", removeLabelError.message);
      }

      if (payload.labelIds.length) {
        const { error: labelInsertError } = await supabase.from("card_labels").insert(
          payload.labelIds.map((labelId) => ({
            card_id: id,
            label_id: labelId,
          })),
        );
        if (labelInsertError) {
          throw new ApiError(500, "card_label_upsert_failed", labelInsertError.message);
        }

        await runAutomationForEvent(supabase, {
          trigger: "label_added",
          workspaceId: board.workspace_id,
          boardId: updatedCard.board_id,
          actorId: user.id,
          card: {
            id: updatedCard.id,
            board_id: updatedCard.board_id,
            list_id: updatedCard.list_id,
            priority: updatedCard.priority,
            due_at: updatedCard.due_at,
            labelIds: payload.labelIds,
            assigneeIds: payload.assigneeIds ?? [],
          },
        });
      }
    }

    if (payload.assigneeIds?.length) {
      for (const assigneeId of payload.assigneeIds) {
        if (assigneeId === user.id) {
          continue;
        }
        await createNotification(supabase, {
          userId: assigneeId,
          workspaceId: board.workspace_id,
          boardId: updatedCard.board_id,
          cardId: updatedCard.id,
          type: "card_assigned",
          message: `カード「${updatedCard.title}」にアサインされました。`,
        });
      }
    }

    await logActivity(supabase, {
      boardId: updatedCard.board_id,
      cardId: updatedCard.id,
      actorId: user.id,
      action: "card_updated",
      metadata: payload,
    });

    return ok(updatedCard);
  } catch (error) {
    return fail(error as Error);
  }
}
