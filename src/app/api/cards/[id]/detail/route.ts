import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const [
      { data: watchers, error: watcherError },
      { data: comments, error: commentsError },
      { data: checklists, error: checklistsError },
      { data: attachments, error: attachmentsError },
      { data: activities, error: activitiesError },
    ] = await Promise.all([
      supabase.from("card_watchers").select("user_id").eq("card_id", id),
      supabase.from("comments").select("*").eq("card_id", id).order("created_at"),
      supabase.from("checklists").select("*").eq("card_id", id).order("position"),
      supabase
        .from("attachments")
        .select("*")
        .eq("card_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activities")
        .select("*")
        .eq("card_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (watcherError) {
      throw new ApiError(500, "watcher_lookup_failed", watcherError.message);
    }
    if (commentsError) {
      throw new ApiError(500, "comment_lookup_failed", commentsError.message);
    }
    if (checklistsError) {
      throw new ApiError(500, "checklist_lookup_failed", checklistsError.message);
    }
    if (attachmentsError) {
      throw new ApiError(500, "attachment_lookup_failed", attachmentsError.message);
    }
    if (activitiesError) {
      throw new ApiError(500, "activity_lookup_failed", activitiesError.message);
    }

    const checklistIds = (checklists ?? []).map((checklist) => checklist.id);
    const { data: checklistItems, error: checklistItemsError } = checklistIds.length
      ? await supabase
          .from("checklist_items")
          .select("*")
          .in("checklist_id", checklistIds)
          .order("position")
      : { data: [], error: null };

    if (checklistItemsError) {
      throw new ApiError(500, "checklist_item_lookup_failed", checklistItemsError.message);
    }

    return ok({
      watchers: (watchers ?? []).map((watcher) => watcher.user_id),
      comments: comments ?? [],
      checklists: checklists ?? [],
      checklistItems: checklistItems ?? [],
      attachments: attachments ?? [],
      activities: activities ?? [],
    });
  } catch (error) {
    return fail(error as Error);
  }
}
