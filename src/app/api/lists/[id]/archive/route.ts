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

    const { data: list, error: listLookupError } = await supabase
      .from("lists")
      .select("id, board_id")
      .eq("id", id)
      .maybeSingle();
    if (listLookupError) {
      throw new ApiError(500, "list_lookup_failed", listLookupError.message);
    }
    if (!list) {
      throw new ApiError(404, "list_not_found", "List not found.");
    }

    await assertBoardRole(supabase, list.board_id, user.id, ["member"]);

    const { data: updatedList, error: updateError } = await supabase
      .from("lists")
      .update({
        is_archived: payload.archived,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      throw new ApiError(500, "list_archive_failed", updateError.message);
    }

    await logActivity(supabase, {
      boardId: list.board_id,
      actorId: user.id,
      action: payload.archived ? "list_archived" : "list_unarchived",
      metadata: { listId: id, archived: payload.archived },
    });

    return ok(updatedList);
  } catch (error) {
    return fail(error as Error);
  }
}
