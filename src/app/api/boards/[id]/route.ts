import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { boardPatchSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, boardPatchSchema);
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, id, user.id, ["board_admin"]);

    const updatePayload: Record<string, unknown> = {};
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.description !== undefined) updatePayload.description = payload.description;
    if (payload.color !== undefined) updatePayload.color = payload.color;
    if (payload.slug !== undefined) updatePayload.slug = payload.slug;
    if (payload.visibility !== undefined) updatePayload.visibility = payload.visibility;
    if (payload.dashboardTiles !== undefined) updatePayload.dashboard_tiles = payload.dashboardTiles;
    if (payload.isArchived !== undefined) updatePayload.is_archived = payload.isArchived;
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("boards")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      throw new ApiError(500, "board_update_failed", error.message);
    }

    await logActivity(supabase, {
      boardId: id,
      actorId: user.id,
      action: "board_updated",
      metadata: payload,
    });

    return ok(data);
  } catch (error) {
    return fail(error as Error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, id, user.id, ["board_admin"]);

    const archivedAt = new Date().toISOString();

    const { error: cardArchiveError } = await supabase
      .from("cards")
      .update({
        archived: true,
        updated_at: archivedAt,
      })
      .eq("board_id", id)
      .eq("archived", false);
    if (cardArchiveError) {
      throw new ApiError(500, "card_archive_failed", cardArchiveError.message);
    }

    const { error: listArchiveError } = await supabase
      .from("lists")
      .update({
        is_archived: true,
        updated_at: archivedAt,
      })
      .eq("board_id", id)
      .eq("is_archived", false);
    if (listArchiveError) {
      throw new ApiError(500, "list_archive_failed", listArchiveError.message);
    }

    const { error: boardArchiveError } = await supabase
      .from("boards")
      .update({
        is_archived: true,
        updated_at: archivedAt,
      })
      .eq("id", id)
      .eq("is_archived", false);
    if (boardArchiveError) {
      throw new ApiError(500, "board_archive_failed", boardArchiveError.message);
    }

    await logActivity(supabase, {
      boardId: id,
      actorId: user.id,
      action: "board_archived",
      metadata: { archived: true },
    });

    return ok({ id, archived: true });
  } catch (error) {
    return fail(error as Error);
  }
}
