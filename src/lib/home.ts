import type { SupabaseClient } from "@supabase/supabase-js";

export type HomeBoard = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  is_archived: boolean;
};

export type HomeWorkspaceNav = {
  id: string;
  slug: string;
  name: string;
  role: "workspace_admin" | "board_admin" | "member";
};

export type HomeWorkspace = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  role: "workspace_admin" | "board_admin" | "member";
  boards: HomeBoard[];
};

async function getWorkspaceMembershipContext(supabase: SupabaseClient, userId: string) {
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);

  const workspaceIds = (memberships ?? []).map((membership) => membership.workspace_id);
  const roleMap = new Map(
    (memberships ?? []).map((membership) => [
      membership.workspace_id,
      membership.role as HomeWorkspace["role"],
    ]),
  );

  return {
    workspaceIds,
    roleMap,
  };
}

export async function getHomeNavigationForUser(supabase: SupabaseClient, userId: string) {
  const { workspaceIds, roleMap } = await getWorkspaceMembershipContext(supabase, userId);

  if (!workspaceIds.length) {
    return {
      workspaces: [] as HomeWorkspaceNav[],
    };
  }

  const { data: workspaceRows } = await supabase
    .from("workspaces")
    .select("id, slug, name, created_at")
    .in("id", workspaceIds)
    .order("created_at");

  const workspaces: HomeWorkspaceNav[] = (workspaceRows ?? []).map((workspace) => ({
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    role: roleMap.get(workspace.id) ?? "member",
  }));

  return {
    workspaces,
  };
}

export async function getHomeDataForUser(supabase: SupabaseClient, userId: string) {
  const { workspaceIds, roleMap } = await getWorkspaceMembershipContext(supabase, userId);

  if (!workspaceIds.length) {
    return {
      workspaces: [] as HomeWorkspace[],
    };
  }

  const [{ data: workspaceRows }, { data: boardRows }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, slug, name, description, created_at")
      .in("id", workspaceIds)
      .order("created_at"),
    supabase
      .from("boards")
      .select("id, workspace_id, name, slug, description, color, is_archived")
      .in("workspace_id", workspaceIds)
      .eq("is_archived", false)
      .order("created_at"),
  ]);

  const boardMap = new Map<string, HomeBoard[]>();
  (boardRows ?? []).forEach((board) => {
    const rows = boardMap.get(board.workspace_id) ?? [];
    rows.push(board as HomeBoard);
    boardMap.set(board.workspace_id, rows);
  });

  const workspaces: HomeWorkspace[] = (workspaceRows ?? []).map((workspace) => ({
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    description: workspace.description,
    role: roleMap.get(workspace.id) ?? "member",
    boards: boardMap.get(workspace.id) ?? [],
  }));

  return {
    workspaces,
  };
}
