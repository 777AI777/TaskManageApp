import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/http";
import type { Role } from "@/lib/types";

const ROLE_WEIGHT: Record<Role, number> = {
  member: 1,
  board_admin: 2,
  workspace_admin: 3,
};

function isRoleAllowed(actual: Role, allowed: Role[]) {
  return allowed.some((candidate) => ROLE_WEIGHT[actual] >= ROLE_WEIGHT[candidate]);
}

export async function resolveWorkspaceRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<Role | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "workspace_role_lookup_failed", error.message);
  }
  return (data?.role ?? null) as Role | null;
}

export async function resolveBoardRole(
  supabase: SupabaseClient,
  boardId: string,
  userId: string,
): Promise<Role | null> {
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .eq("is_archived", false)
    .maybeSingle();
  if (boardError) {
    throw new ApiError(500, "board_lookup_failed", boardError.message);
  }
  if (!board) {
    throw new ApiError(404, "board_not_found", "Boardが見つかりません。");
  }

  const workspaceRole = await resolveWorkspaceRole(supabase, board.workspace_id, userId);
  if (workspaceRole === "workspace_admin") {
    return workspaceRole;
  }

  const { data, error } = await supabase
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "board_role_lookup_failed", error.message);
  }

  if (!data?.role) {
    return workspaceRole;
  }

  return data.role as Role;
}

export async function assertWorkspaceRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  allowed: Role[],
) {
  const role = await resolveWorkspaceRole(supabase, workspaceId, userId);
  if (!role || !isRoleAllowed(role, allowed)) {
    throw new ApiError(403, "forbidden", "Workspace権限が不足しています。");
  }
  return role;
}

export async function assertBoardRole(
  supabase: SupabaseClient,
  boardId: string,
  userId: string,
  allowed: Role[],
) {
  const role = await resolveBoardRole(supabase, boardId, userId);
  if (!role || !isRoleAllowed(role, allowed)) {
    throw new ApiError(403, "forbidden", "Board権限が不足しています。");
  }
  return role;
}
