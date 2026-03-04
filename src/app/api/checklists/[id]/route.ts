import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireApiUser();

    const { data: checklist, error: checklistLookupError } = await supabase
      .from("checklists")
      .select("id, card_id")
      .eq("id", id)
      .maybeSingle();
    if (checklistLookupError) {
      throw new ApiError(500, "checklist_lookup_failed", checklistLookupError.message);
    }
    if (!checklist) {
      throw new ApiError(404, "checklist_not_found", "Checklist not found.");
    }

    const { data: card, error: cardLookupError } = await supabase
      .from("cards")
      .select("id, board_id")
      .eq("id", checklist.card_id)
      .maybeSingle();
    if (cardLookupError) {
      throw new ApiError(500, "card_lookup_failed", cardLookupError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "Card not found.");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const { error: deleteError } = await supabase
      .from("checklists")
      .delete()
      .eq("id", id);
    if (deleteError) {
      throw new ApiError(500, "checklist_delete_failed", deleteError.message);
    }

    return ok({ id });
  } catch (error) {
    return fail(error as Error);
  }
}
