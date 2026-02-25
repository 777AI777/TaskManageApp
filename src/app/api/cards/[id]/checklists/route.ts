import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { checklistCreateSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, checklistCreateSchema);
    const { supabase, user } = await requireApiUser();

    const { data: card, error: cardLookupError } = await supabase
      .from("cards")
      .select("id, board_id, list_id, priority, due_at")
      .eq("id", id)
      .maybeSingle();
    if (cardLookupError) {
      throw new ApiError(500, "card_lookup_failed", cardLookupError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "Cardが見つかりません。");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const { data: maxPositionRow } = await supabase
      .from("checklists")
      .select("position")
      .eq("card_id", id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = typeof maxPositionRow?.position === "number" ? maxPositionRow.position + 1000 : 1000;

    const { data: checklist, error: checklistError } = await supabase
      .from("checklists")
      .insert({
        card_id: id,
        title: payload.title,
        position: nextPosition,
      })
      .select("*")
      .single();
    if (checklistError) {
      throw new ApiError(500, "checklist_create_failed", checklistError.message);
    }

    await logActivity(supabase, {
      boardId: card.board_id,
      cardId: id,
      actorId: user.id,
      action: "checklist_created",
      metadata: { checklistId: checklist.id },
    });

    return ok(checklist, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
