import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { defaultBoardTemplatePayload, applyBoardTemplate } from "@/lib/templates";
import { ApiError, fail, ok } from "@/lib/http";
import { ensureProfileForUser } from "@/lib/profile";
import { slugify } from "@/lib/utils";
import { workspaceCreateSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const { supabase, user } = await requireApiUser();
    const { data: memberships, error } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id);

    if (error) {
      throw new ApiError(500, "workspace_membership_lookup_failed", error.message);
    }

    const workspaceIds = (memberships ?? []).map((membership) => membership.workspace_id);
    if (!workspaceIds.length) {
      return ok([]);
    }

    const { data: workspaces, error: workspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .in("id", workspaceIds)
      .order("created_at", { ascending: false });

    if (workspaceError) {
      throw new ApiError(500, "workspace_lookup_failed", workspaceError.message);
    }

    const roleMap = new Map((memberships ?? []).map((item) => [item.workspace_id, item.role]));
    return ok(
      (workspaces ?? []).map((workspace) => ({
        ...workspace,
        role: roleMap.get(workspace.id) ?? "member",
      })),
    );
  } catch (error) {
    return fail(error as Error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await parseBody(request, workspaceCreateSchema);
    const { supabase, user } = await requireApiUser();
    await ensureProfileForUser(supabase, user);
    const slug = `${slugify(payload.name)}-${crypto.randomUUID().slice(0, 6)}`;

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .insert({
        name: payload.name,
        slug,
        description: payload.description ?? null,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (workspaceError) {
      throw new ApiError(500, "workspace_create_failed", workspaceError.message);
    }

    const { error: membershipError } = await supabase.from("workspace_members").insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "workspace_admin",
      invited_by: user.id,
    });
    if (membershipError) {
      throw new ApiError(500, "workspace_member_create_failed", membershipError.message);
    }

    const { data: board, error: boardError } = await supabase
      .from("boards")
      .insert({
        workspace_id: workspace.id,
        name: "myTaskApp ボード",
        slug: `board-${crypto.randomUUID().slice(0, 8)}`,
        description: "初期ボード",
        color: "#2563eb",
        visibility: "private",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (boardError) {
      throw new ApiError(500, "default_board_create_failed", boardError.message);
    }

    const { error: boardMemberError } = await supabase.from("board_members").insert({
      board_id: board.id,
      user_id: user.id,
      role: "board_admin",
    });
    if (boardMemberError) {
      throw new ApiError(500, "default_board_member_failed", boardMemberError.message);
    }

    await applyBoardTemplate(supabase, board.id, user.id, defaultBoardTemplatePayload());

    const { error: templateError } = await supabase.from("templates").insert({
      workspace_id: workspace.id,
      created_by: user.id,
      name: "既定テンプレート",
      kind: "board",
      payload: defaultBoardTemplatePayload(),
      is_public: false,
    });
    if (templateError) {
      throw new ApiError(500, "template_create_failed", templateError.message);
    }

    return ok({ workspace, defaultBoard: board }, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
