import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { userBoardPreferencesPatchSchema } from "@/lib/validation/schemas";

export async function PATCH(request: Request) {
  try {
    const payload = await parseBody(request, userBoardPreferencesPatchSchema);
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, payload.boardId, user.id, ["member"]);

    const upsertPayload: Record<string, unknown> = {
      user_id: user.id,
      board_id: payload.boardId,
      updated_at: new Date().toISOString(),
    };

    if (payload.selectedView !== undefined) upsertPayload.selected_view = payload.selectedView;
    if (payload.leftRailCollapsed !== undefined) {
      upsertPayload.left_rail_collapsed = payload.leftRailCollapsed;
    }
    if (payload.showGuides !== undefined) upsertPayload.show_guides = payload.showGuides;

    const { data, error } = await supabase
      .from("user_board_preferences")
      .upsert(upsertPayload, { onConflict: "user_id,board_id" })
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, "board_preferences_update_failed", error.message);
    }

    return ok(data);
  } catch (error) {
    return fail(error as Error);
  }
}
