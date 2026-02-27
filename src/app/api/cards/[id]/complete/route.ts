import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";

const completePayloadSchema = z.object({
  isCompleted: z.boolean().default(true),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, completePayloadSchema);
    const { supabase, user } = await requireApiUser();

    const { data: card, error: cardLookupError } = await supabase
      .from("cards")
      .select("id, board_id")
      .eq("id", id)
      .maybeSingle();

    if (cardLookupError) {
      throw new ApiError(500, "card_lookup_failed", cardLookupError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "Card not found.");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const completedAt = payload.isCompleted ? new Date().toISOString() : null;
    const { data: updatedCard, error: updateError } = await supabase
      .from("cards")
      .update({
        is_completed: payload.isCompleted,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      throw new ApiError(500, "card_complete_update_failed", updateError.message);
    }

    await logActivity(supabase, {
      boardId: card.board_id,
      cardId: id,
      actorId: user.id,
      action: payload.isCompleted ? "card_completed" : "card_reopened",
      metadata: { isCompleted: payload.isCompleted },
    });

    return ok(updatedCard);
  } catch (error) {
    return fail(error as Error);
  }
}
