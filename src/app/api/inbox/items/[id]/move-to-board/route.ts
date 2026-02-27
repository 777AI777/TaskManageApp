import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole, assertWorkspaceRole } from "@/lib/permissions";
import { ensurePosition } from "@/lib/utils";

const moveToBoardSchema = z.object({
  boardId: z.uuid(),
  listId: z.uuid(),
  position: z.number().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const payload = moveToBoardSchema.parse(body);
    const { supabase, user } = await requireApiUser();

    const { data: item, error: itemLookupError } = await supabase
      .from("inbox_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (itemLookupError) {
      throw new ApiError(500, "inbox_lookup_failed", itemLookupError.message);
    }
    if (!item) {
      throw new ApiError(404, "inbox_not_found", "Inbox item not found.");
    }

    await assertWorkspaceRole(supabase, item.workspace_id, user.id, ["member"]);
    await assertBoardRole(supabase, payload.boardId, user.id, ["member"]);

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .insert({
        board_id: payload.boardId,
        list_id: payload.listId,
        title: item.title,
        description: item.description,
        position: ensurePosition(payload.position, Date.now()),
        priority: "medium",
        created_by: user.id,
      })
      .select("*")
      .single();
    if (cardError) {
      throw new ApiError(500, "inbox_move_card_create_failed", cardError.message);
    }

    const { data: movedItem, error: itemUpdateError } = await supabase
      .from("inbox_items")
      .update({
        board_id: payload.boardId,
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (itemUpdateError) {
      throw new ApiError(500, "inbox_move_update_failed", itemUpdateError.message);
    }

    await logActivity(supabase, {
      boardId: payload.boardId,
      cardId: card.id,
      actorId: user.id,
      action: "inbox_item_moved_to_board",
      metadata: {
        inboxItemId: id,
        listId: payload.listId,
      },
    });

    return ok({ card, inboxItem: movedItem }, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
