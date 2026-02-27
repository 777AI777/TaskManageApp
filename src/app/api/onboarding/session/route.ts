import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { onboardingSessionPatchSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");
    const flow = searchParams.get("flow") ?? "main";
    if (!boardId) {
      throw new ApiError(400, "missing_board", "boardId is required.");
    }

    await assertBoardRole(supabase, boardId, user.id, ["member"]);

    const { data, error } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("board_id", boardId)
      .eq("user_id", user.id)
      .eq("flow", flow)
      .maybeSingle();
    if (error) {
      throw new ApiError(500, "onboarding_session_lookup_failed", error.message);
    }

    return ok(data);
  } catch (error) {
    return fail(error as Error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await parseBody(request, onboardingSessionPatchSchema);
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, payload.boardId, user.id, ["member"]);

    const upsertPayload: Record<string, unknown> = {
      user_id: user.id,
      board_id: payload.boardId,
      flow: payload.flow,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (payload.currentStep !== undefined) {
      upsertPayload.current_step = payload.currentStep;
    }
    if (payload.isCompleted !== undefined) {
      upsertPayload.is_completed = payload.isCompleted;
    }

    const { data, error } = await supabase
      .from("onboarding_sessions")
      .upsert(upsertPayload, { onConflict: "user_id,board_id,flow" })
      .select("*")
      .single();
    if (error) {
      throw new ApiError(500, "onboarding_session_upsert_failed", error.message);
    }

    return ok(data);
  } catch (error) {
    return fail(error as Error);
  }
}
