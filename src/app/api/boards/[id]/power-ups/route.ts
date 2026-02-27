import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { resolvePowerUpDisplayName } from "@/lib/power-ups";
import { boardPowerUpPatchSchema } from "@/lib/validation/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: boardId } = await params;
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, boardId, user.id, ["member"]);

    const { data, error } = await supabase
      .from("board_power_ups")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at");
    if (error) {
      throw new ApiError(500, "board_power_ups_lookup_failed", error.message);
    }

    return ok(data ?? []);
  } catch (error) {
    return fail(error as Error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: boardId } = await params;
    const payload = await parseBody(request, boardPowerUpPatchSchema);
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, boardId, user.id, ["board_admin"]);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("board_power_ups")
      .upsert(
        {
          board_id: boardId,
          power_up_key: payload.powerUpKey,
          display_name: payload.displayName ?? resolvePowerUpDisplayName(payload.powerUpKey),
          is_enabled: payload.isEnabled,
          config: payload.config ?? {},
          created_by: user.id,
          updated_at: now,
        },
        { onConflict: "board_id,power_up_key" },
      )
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, "board_power_up_upsert_failed", error.message);
    }

    await logActivity(supabase, {
      boardId,
      actorId: user.id,
      action: payload.isEnabled ? "power_up_enabled" : "power_up_disabled",
      metadata: {
        powerUpKey: payload.powerUpKey,
      },
    });

    return ok(data);
  } catch (error) {
    return fail(error as Error);
  }
}
