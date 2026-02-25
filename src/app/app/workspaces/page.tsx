import Link from "next/link";

import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { requireServerUser } from "@/lib/auth";

export default async function WorkspacesPage() {
  const { supabase, user } = await requireServerUser();

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id);

  const workspaceIds = (memberships ?? []).map((membership) => membership.workspace_id);
  const { data: workspaceRows } = workspaceIds.length
    ? await supabase.from("workspaces").select("id, name, description, created_at").in("id", workspaceIds)
    : { data: [] as Array<{ id: string; name: string; description: string | null; created_at: string }> };

  const roleMap = new Map((memberships ?? []).map((membership) => [membership.workspace_id, membership.role]));
  const workspaces = (workspaceRows ?? []).map((workspace) => ({
    workspace,
    role: roleMap.get(workspace.id) ?? "member",
  }));

  return (
    <main className="space-y-4">
      <section className="surface p-5">
        <h1 className="text-2xl font-bold">ワークスペース</h1>
        <p className="mt-1 text-sm muted">
          複数ワークスペースで開発プロジェクトを管理できます。
        </p>
      </section>

      <CreateWorkspaceForm />

      <section className="surface p-5">
        <h2 className="text-lg font-semibold">参加中ワークスペース</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map(({ workspace, role }) => (
            <article key={workspace.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold">{workspace.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm muted">{workspace.description ?? "説明なし"}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="chip">{role}</span>
                <Link className="btn btn-secondary" href={`/app/workspaces/${workspace.id}`}>
                  開く
                </Link>
              </div>
            </article>
          ))}
          {!workspaces.length ? (
            <p className="text-sm muted">まだワークスペースに参加していません。</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
