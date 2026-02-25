import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";
import { assertWorkspaceRole } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireApiUser();
    await assertWorkspaceRole(supabase, id, user.id, ["member"]);

    const [{ data: workspace }, { data: boards }, { data: members }, { data: templates }] =
      await Promise.all([
        supabase.from("workspaces").select("*").eq("id", id).maybeSingle(),
        supabase.from("boards").select("*").eq("workspace_id", id).order("created_at", { ascending: true }),
        supabase
          .from("workspace_members")
          .select("workspace_id, user_id, role, joined_at")
          .eq("workspace_id", id),
        supabase
          .from("templates")
          .select("*")
          .eq("workspace_id", id)
          .order("created_at", { ascending: false }),
      ]);

    if (!workspace) {
      throw new ApiError(404, "workspace_not_found", "Workspaceが見つかりません。");
    }

    const memberIds = (members ?? []).map((member) => member.user_id);
    const { data: profiles, error: profilesError } = memberIds.length
      ? await supabase
          .from("profiles")
          .select("id, email, display_name, avatar_url")
          .in("id", memberIds)
      : { data: [], error: null };

    if (profilesError) {
      throw new ApiError(500, "profile_lookup_failed", profilesError.message);
    }

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return ok({
      workspace,
      boards: boards ?? [],
      members: (members ?? []).map((member) => ({
        ...member,
        profile: profileMap.get(member.user_id) ?? null,
      })),
      templates: templates ?? [],
    });
  } catch (error) {
    return fail(error as Error);
  }
}
