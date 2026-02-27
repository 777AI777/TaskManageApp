import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";
import { assertWorkspaceRole } from "@/lib/permissions";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const { id: workspaceId, memberId } = await params;
    const { supabase, user } = await requireApiUser();

    await assertWorkspaceRole(supabase, workspaceId, user.id, ["workspace_admin"]);

    if (memberId === user.id) {
      throw new ApiError(400, "cannot_remove_self", "自分自身は削除できません。");
    }

    const { data: member, error: memberLookupError } = await supabase
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", memberId)
      .maybeSingle();

    if (memberLookupError) {
      throw new ApiError(500, "workspace_member_lookup_failed", memberLookupError.message);
    }
    if (!member) {
      throw new ApiError(404, "workspace_member_not_found", "対象メンバーが見つかりません。");
    }

    if (member.role === "workspace_admin") {
      const { count: adminCount, error: adminCountError } = await supabase
        .from("workspace_members")
        .select("user_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("role", "workspace_admin");

      if (adminCountError) {
        throw new ApiError(500, "workspace_admin_count_failed", adminCountError.message);
      }
      if ((adminCount ?? 0) <= 1) {
        throw new ApiError(400, "last_workspace_admin", "最後のワークスペース管理者は削除できません。");
      }
    }

    const { data: boardRows, error: boardLookupError } = await supabase
      .from("boards")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (boardLookupError) {
      throw new ApiError(500, "workspace_boards_lookup_failed", boardLookupError.message);
    }

    const boardIds = (boardRows ?? []).map((board) => board.id);
    if (boardIds.length) {
      const { error: boardMemberDeleteError } = await supabase
        .from("board_members")
        .delete()
        .eq("user_id", memberId)
        .in("board_id", boardIds);

      if (boardMemberDeleteError) {
        throw new ApiError(500, "board_member_remove_failed", boardMemberDeleteError.message);
      }
    }

    const { error: workspaceMemberDeleteError } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", memberId);

    if (workspaceMemberDeleteError) {
      throw new ApiError(500, "workspace_member_remove_failed", workspaceMemberDeleteError.message);
    }

    return ok({
      removed: true,
      userId: memberId,
    });
  } catch (error) {
    return fail(error as Error);
  }
}
