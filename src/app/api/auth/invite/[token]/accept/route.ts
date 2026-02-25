import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const { supabase, user } = await requireApiUser();

    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      throw new ApiError(500, "invite_lookup_failed", inviteError.message);
    }
    if (!invite) {
      throw new ApiError(404, "invite_not_found", "招待が見つかりません。");
    }

    if (invite.status !== "pending") {
      throw new ApiError(400, "invite_invalid_state", "この招待は既に使用済みです。");
    }
    if (new Date(invite.expires_at).valueOf() < Date.now()) {
      await supabase.from("invites").update({ status: "expired" }).eq("id", invite.id);
      throw new ApiError(400, "invite_expired", "招待の有効期限が切れています。");
    }

    const normalizedInviteEmail = String(invite.email).toLowerCase();
    const normalizedUserEmail = String(user.email ?? "").toLowerCase();
    if (normalizedInviteEmail !== normalizedUserEmail) {
      throw new ApiError(
        403,
        "invite_email_mismatch",
        "招待メールアドレスとログインユーザーが一致しません。",
      );
    }

    const { error: memberError } = await supabase.from("workspace_members").upsert(
      {
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
        invited_by: invite.inviter_id,
      },
      { onConflict: "workspace_id,user_id" },
    );

    if (memberError) {
      throw new ApiError(500, "workspace_join_failed", memberError.message);
    }

    const { data: boards, error: boardsError } = await supabase
      .from("boards")
      .select("id")
      .eq("workspace_id", invite.workspace_id);
    if (boardsError) {
      throw new ApiError(500, "board_lookup_failed", boardsError.message);
    }

    if (boards?.length) {
      const { error: boardMemberError } = await supabase.from("board_members").upsert(
        boards.map((board) => ({
          board_id: board.id,
          user_id: user.id,
          role: invite.role === "workspace_admin" ? "board_admin" : "member",
        })),
        { onConflict: "board_id,user_id" },
      );
      if (boardMemberError) {
        throw new ApiError(500, "board_join_failed", boardMemberError.message);
      }
    }

    const { error: inviteUpdateError } = await supabase
      .from("invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq("id", invite.id);

    if (inviteUpdateError) {
      throw new ApiError(500, "invite_accept_failed", inviteUpdateError.message);
    }

    return ok({
      workspaceId: invite.workspace_id,
      role: invite.role,
    });
  } catch (error) {
    return fail(error as Error);
  }
}
