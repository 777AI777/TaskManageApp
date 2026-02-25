import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { checklistItemCreateSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, checklistItemCreateSchema.omit({ checklistId: true }));
    const { supabase, user } = await requireApiUser();

    const { data: checklist, error: checklistError } = await supabase
      .from("checklists")
      .select("id, card_id")
      .eq("id", id)
      .maybeSingle();
    if (checklistError) {
      throw new ApiError(500, "checklist_lookup_failed", checklistError.message);
    }
    if (!checklist) {
      throw new ApiError(404, "checklist_not_found", "チェックリストが見つかりません。");
    }

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, board_id")
      .eq("id", checklist.card_id)
      .maybeSingle();
    if (cardError) {
      throw new ApiError(500, "card_lookup_failed", cardError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "カードが見つかりません。");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const { data: latestItem } = await supabase
      .from("checklist_items")
      .select("position")
      .eq("checklist_id", id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = payload.position ?? (latestItem?.position ?? 0) + 1000;

    const { data: item, error: itemError } = await supabase
      .from("checklist_items")
      .insert({
        checklist_id: id,
        content: payload.content,
        position: nextPosition,
      })
      .select("*")
      .single();
    if (itemError) {
      throw new ApiError(500, "checklist_item_create_failed", itemError.message);
    }

    await logActivity(supabase, {
      boardId: card.board_id,
      cardId: checklist.card_id,
      actorId: user.id,
      action: "checklist_item_created",
      metadata: { checklistId: id, itemId: item.id },
    });

    return ok(item, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
