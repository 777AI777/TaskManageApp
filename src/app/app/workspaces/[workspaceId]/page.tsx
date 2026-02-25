import Link from "next/link";
import { notFound } from "next/navigation";

import { CreateBoardForm } from "@/components/workspace/create-board-form";
import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import { requireServerUser } from "@/lib/auth";
import { assertWorkspaceRole } from "@/lib/permissions";

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { supabase, user } = await requireServerUser();
  await assertWorkspaceRole(supabase, workspaceId, user.id, ["member"]);

  const [{ data: workspace }, { data: boards }, { data: members }, { data: templates }] =
    await Promise.all([
      supabase.from("workspaces").select("*").eq("id", workspaceId).maybeSingle(),
      supabase.from("boards").select("*").eq("workspace_id", workspaceId).order("created_at"),
      supabase.from("workspace_members").select("user_id, role").eq("workspace_id", workspaceId),
      supabase.from("templates").select("id, name").eq("workspace_id", workspaceId).eq("kind", "board"),
    ]);

  if (!workspace) {
    notFound();
  }

  const memberIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", memberIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <main className="space-y-4">
      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="chip mb-2 inline-flex">Workspace</p>
            <h1 className="text-2xl font-bold">{workspace.name}</h1>
            <p className="mt-1 text-sm muted">{workspace.description ?? "説明なし"}</p>
          </div>
          <Link className="btn btn-secondary" href="/app/workspaces">
            一覧へ戻る
          </Link>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="surface p-5">
          <h2 className="text-lg font-semibold">ボード</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(boards ?? []).map((board) => (
              <article key={board.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold">{board.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm muted">{board.description ?? "説明なし"}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className="h-3 w-12 rounded-full"
                    style={{ background: board.color ?? "#2563eb" }}
                    aria-label="board-color"
                  />
                  <Link
                    className="btn btn-secondary"
                    href={`/app/workspaces/${workspaceId}/boards/${board.id}`}
                  >
                    開く
                  </Link>
                </div>
              </article>
            ))}
            {!boards?.length ? <p className="text-sm muted">ボードがありません。</p> : null}
          </div>
        </section>

        <section className="surface p-5">
          <h2 className="text-lg font-semibold">メンバー</h2>
          <div className="mt-3 space-y-2">
            {(members ?? []).map((member) => {
              const profile = profileMap.get(member.user_id);
              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{profile?.display_name ?? profile?.email ?? member.user_id}</p>
                    <p className="text-xs muted">{profile?.email}</p>
                  </div>
                  <span className="chip">{member.role}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CreateBoardForm workspaceId={workspaceId} templates={templates ?? []} />
        <InviteMemberForm workspaceId={workspaceId} />
      </div>
    </main>
  );
}
