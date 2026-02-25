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
