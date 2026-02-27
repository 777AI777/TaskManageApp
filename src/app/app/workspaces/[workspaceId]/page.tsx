import Link from "next/link";
import { notFound } from "next/navigation";

import { CreateBoardForm } from "@/components/workspace/create-board-form";
import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import { MyTaskAppImportForm } from "@/components/workspace/myTaskApp-import-form";
import { requireServerUser } from "@/lib/auth";
import { BOARD_ROLE_LABELS, BOARD_COMMON_LABELS } from "@/lib/board-ui-text";
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
      supabase
        .from("boards")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_archived", false)
        .order("created_at"),
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

  const boardIds = (boards ?? []).map((board) => board.id);
  const [{ data: lists }, { data: cards }] = boardIds.length
    ? await Promise.all([
        supabase.from("lists").select("id, board_id, name").in("board_id", boardIds),
        supabase
          .from("cards")
          .select("id, board_id, list_id, title, due_at, is_completed, archived")
          .in("board_id", boardIds)
          .eq("archived", false)
          .order("updated_at", { ascending: false })
          .limit(500),
      ])
    : [{ data: [] }, { data: [] }];

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const boardMap = new Map((boards ?? []).map((board) => [board.id, board]));
  const listMap = new Map((lists ?? []).map((list) => [list.id, list]));

  const workspaceCards = cards ?? [];
  const now = new Date().getTime();
  const openCount = workspaceCards.filter((card) => !card.is_completed).length;
  const completedCount = workspaceCards.filter((card) => card.is_completed).length;
  const overdueCount = workspaceCards.filter((card) => {
    if (!card.due_at || card.is_completed) return false;
    return new Date(card.due_at).valueOf() < now;
  }).length;
  const dueSoonCount = workspaceCards.filter((card) => {
    if (!card.due_at || card.is_completed) return false;
    const diff = new Date(card.due_at).valueOf() - now;
    return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  return (
    <main className="space-y-4">
      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="chip mb-2 inline-flex">ワークスペース</p>
            <h1 className="text-2xl font-bold">{workspace.name}</h1>
            <p className="mt-1 text-sm muted">{workspace.description ?? BOARD_COMMON_LABELS.noDescription}</p>
          </div>
          <Link className="btn btn-secondary" href="/app/workspaces">
            ワークスペース一覧へ戻る
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="surface p-4">
          <p className="text-xs uppercase tracking-wider muted">ボード</p>
          <p className="mt-2 text-2xl font-bold">{boards?.length ?? 0}</p>
        </article>
        <article className="surface p-4">
          <p className="text-xs uppercase tracking-wider muted">未完了カード</p>
          <p className="mt-2 text-2xl font-bold">{openCount}</p>
        </article>
        <article className="surface p-4">
          <p className="text-xs uppercase tracking-wider muted">完了カード</p>
          <p className="mt-2 text-2xl font-bold">{completedCount}</p>
        </article>
        <article className="surface p-4">
          <p className="text-xs uppercase tracking-wider muted">期限切れ / 7日以内</p>
          <p className="mt-2 text-2xl font-bold">
            {overdueCount} / {dueSoonCount}
          </p>
        </article>
      </section>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="surface p-5">
          <h2 className="text-lg font-semibold">ボード</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(boards ?? []).map((board) => (
              <article key={board.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold">{board.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm muted">{board.description ?? BOARD_COMMON_LABELS.noDescription}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="h-3 w-12 rounded-full" style={{ background: board.color ?? "#2563eb" }} aria-label="ボード色" />
                  <Link className="btn btn-secondary" href={`/app/workspaces/${workspaceId}/boards/${board.id}`}>
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
                  <span className="chip">
                    {BOARD_ROLE_LABELS[member.role as keyof typeof BOARD_ROLE_LABELS] ?? member.role}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">ワークスペーステーブル</h2>
          <span className="chip">プレミアム</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2">カード</th>
                <th className="px-3 py-2">ボード</th>
                <th className="px-3 py-2">リスト</th>
                <th className="px-3 py-2">期限</th>
                <th className="px-3 py-2">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspaceCards.map((card) => {
                const board = boardMap.get(card.board_id);
                const list = listMap.get(card.list_id);
                return (
                  <tr key={card.id}>
                    <td className="px-3 py-2">
                      <Link
                        className="text-blue-700 hover:underline"
                        href={
                          board?.slug
                            ? `/b/${board.slug}/c/${card.id}`
                            : `/app/workspaces/${workspaceId}/boards/${card.board_id}`
                        }
                      >
                        {card.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{board?.name ?? "-"}</td>
                    <td className="px-3 py-2">{list?.name ?? "-"}</td>
                    <td className="px-3 py-2">{card.due_at ? new Date(card.due_at).toLocaleString() : "-"}</td>
                    <td className="px-3 py-2">{card.is_completed ? "完了" : "未完了"}</td>
                  </tr>
                );
              })}
              {!workspaceCards.length ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                    カードがありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <CreateBoardForm workspaceId={workspaceId} templates={templates ?? []} />
        <InviteMemberForm workspaceId={workspaceId} />
        <MyTaskAppImportForm workspaceId={workspaceId} />
      </div>
    </main>
  );
}
