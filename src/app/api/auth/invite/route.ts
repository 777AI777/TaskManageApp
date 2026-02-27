import { addDays } from "date-fns";

import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { ApiError, fail, ok } from "@/lib/http";
import { resolveInviteOrigin } from "@/lib/invite-url";
import { assertWorkspaceRole } from "@/lib/permissions";
import { randomToken } from "@/lib/utils";
import { inviteSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const payload = await parseBody(request, inviteSchema);
    const { supabase, user } = await requireApiUser();
    await assertWorkspaceRole(supabase, payload.workspaceId, user.id, ["workspace_admin"]);
    const normalizedEmail = payload.email.trim().toLowerCase();

    const { data: targetProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id, email")
      .ilike("email", normalizedEmail)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (profileLookupError) {
      throw new ApiError(500, "invite_profile_lookup_failed", profileLookupError.message);
    }

    if (targetProfile) {
      const { error: memberError } = await supabase.from("workspace_members").upsert(
        {
          workspace_id: payload.workspaceId,
          user_id: targetProfile.id,
          role: payload.role,
          invited_by: user.id,
        },
        { onConflict: "workspace_id,user_id" },
      );

      if (memberError) {
        throw new ApiError(500, "workspace_member_add_failed", memberError.message);
      }

      const { data: boards, error: boardsError } = await supabase
        .from("boards")
        .select("id")
        .eq("workspace_id", payload.workspaceId);

      if (boardsError) {
        throw new ApiError(500, "workspace_boards_lookup_failed", boardsError.message);
      }

      if (boards?.length) {
        const boardRole = payload.role === "workspace_admin" ? "board_admin" : "member";
        const { error: boardMemberError } = await supabase.from("board_members").upsert(
          boards.map((board) => ({
            board_id: board.id,
            user_id: targetProfile.id,
            role: boardRole,
          })),
          { onConflict: "board_id,user_id" },
        );

        if (boardMemberError) {
          throw new ApiError(500, "board_member_add_failed", boardMemberError.message);
        }
      }

      return ok({
        mode: "direct_member_add",
        member: {
          userId: targetProfile.id,
          email: targetProfile.email,
          role: payload.role,
        },
        message: "メンバーを直接追加しました。",
      });
    }

    const token = randomToken();
    const expiresAt = addDays(new Date(), 7).toISOString();
    const { data, error } = await supabase
      .from("invites")
      .insert({
        workspace_id: payload.workspaceId,
        email: normalizedEmail,
        role: payload.role,
        token,
        status: "pending",
        inviter_id: user.id,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, "invite_create_failed", error.message);
    }

    const inviteUrl = new URL(`/invite/${token}`, resolveInviteOrigin(request)).toString();

    return ok({
      mode: "invite_link",
      invite: data,
      inviteUrl,
      message: "ユーザーが未登録のため、招待リンクを作成しました。",
    });
  } catch (error) {
    return fail(error as Error);
  }
}
