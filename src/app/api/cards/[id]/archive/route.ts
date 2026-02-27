import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";

const archivePayloadSchema = z.object({
  archived: z.boolean().default(true),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, archivePayloadSchema);
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

    const { data: updatedCard, error: updateError } = await supabase
      .from("cards")
      .update({
        archived: payload.archived,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      throw new ApiError(500, "card_archive_failed", updateError.message);
    }

    await logActivity(supabase, {
      boardId: card.board_id,
      cardId: id,
      actorId: user.id,
      action: payload.archived ? "card_archived" : "card_unarchived",
      metadata: { archived: payload.archived },
    });

    return ok(updatedCard);
  } catch (error) {
    return fail(error as Error);
  }
}
