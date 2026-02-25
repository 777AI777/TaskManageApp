import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { ensurePosition } from "@/lib/utils";
import { listCreateSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const payload = await parseBody(request, listCreateSchema);
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, payload.boardId, user.id, ["member"]);

    const position = ensurePosition(payload.position, Date.now());
    const { data, error } = await supabase
      .from("lists")
      .insert({
        board_id: payload.boardId,
        name: payload.name,
        position,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) {
      throw new ApiError(500, "list_create_failed", error.message);
    }

    await logActivity(supabase, {
      boardId: payload.boardId,
      actorId: user.id,
      action: "list_created",
      metadata: { listId: data.id, name: data.name },
    });

    return ok(data, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
