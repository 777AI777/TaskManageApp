import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { listPatchSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, listPatchSchema);
    const { supabase, user } = await requireApiUser();

    const { data: currentList, error: listError } = await supabase
      .from("lists")
      .select("id, board_id")
      .eq("id", id)
      .maybeSingle();
    if (listError) {
      throw new ApiError(500, "list_lookup_failed", listError.message);
    }
    if (!currentList) {
      throw new ApiError(404, "list_not_found", "Listが見つかりません。");
    }

    await assertBoardRole(supabase, currentList.board_id, user.id, ["member"]);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.position !== undefined) updatePayload.position = payload.position;
    if (payload.isArchived !== undefined) updatePayload.is_archived = payload.isArchived;

    const { data, error } = await supabase
      .from("lists")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      throw new ApiError(500, "list_update_failed", error.message);
    }

    await logActivity(supabase, {
      boardId: currentList.board_id,
      actorId: user.id,
      action: "list_updated",
      metadata: { listId: id, ...payload },
    });

    return ok(data);
  } catch (error) {
    return fail(error as Error);
  }
}
