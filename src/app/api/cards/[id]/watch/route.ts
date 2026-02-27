import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";

const watchPayloadSchema = z.object({
  watch: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, watchPayloadSchema);
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

    const { data: existing } = await supabase
      .from("card_watchers")
      .select("id")
      .eq("card_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    const nextWatch = payload.watch ?? !existing;
    if (nextWatch && !existing) {
      const { error } = await supabase.from("card_watchers").insert({
        card_id: id,
        user_id: user.id,
      });
      if (error) {
        throw new ApiError(500, "watch_add_failed", error.message);
      }
    }

    if (!nextWatch && existing) {
      const { error } = await supabase
        .from("card_watchers")
        .delete()
        .eq("card_id", id)
        .eq("user_id", user.id);
      if (error) {
        throw new ApiError(500, "watch_remove_failed", error.message);
      }
    }

    await logActivity(supabase, {
      boardId: card.board_id,
      cardId: id,
      actorId: user.id,
      action: nextWatch ? "card_watching_started" : "card_watching_stopped",
      metadata: { watching: nextWatch },
    });

    return ok({ cardId: id, watching: nextWatch });
  } catch (error) {
    return fail(error as Error);
  }
}
