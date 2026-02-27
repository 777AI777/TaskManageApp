import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { CreateBoardForm } from "@/components/workspace/create-board-form";
import { MyTaskAppHomeShell } from "@/components/workspace/myTaskApp-home-shell";
import { requireServerUser } from "@/lib/auth";
import { getHomeDataForUser } from "@/lib/home";

export const dynamic = "force-dynamic";
const UNIFIED_BOARD_BACKGROUND = "#c0c5d1";

function getBoardThumbStyle(): CSSProperties {
  return { background: UNIFIED_BOARD_BACKGROUND };
}

export default async function WorkspaceHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ createBoard?: string }>;
}) {
  const { workspaceSlug } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireServerUser();
  const [{ workspaces }, { data: profile }] = await Promise.all([
    getHomeDataForUser(supabase, user.id),
    supabase.from("profiles").select("avatar_color").eq("id", user.id).maybeSingle(),
  ]);

  const workspace = workspaces.find((item) => item.slug === workspaceSlug) ?? null;
  if (!workspace) {
    notFound();
  }

  const isCreateBoardOpen = query.createBoard === "1";

  return (
    <MyTaskAppHomeShell
      userId={user.id}
      userEmail={user.email ?? "user@example.com"}
      userDisplayName={typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null}
      userAvatarColor={profile?.avatar_color ?? null}
      workspaces={workspaces.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
      }))}
      activeWorkspaceSlug={workspace.slug}
      activeMainNav="boards"
      activeWorkspaceNav="boards"
    >
      <div className="space-y-4">
        <section className="myTaskApp-home-panel">
          <div className="myTaskApp-home-workspace-header">
            <div className="myTaskApp-home-workspace-badge">{workspace.name.charAt(0).toUpperCase()}</div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{workspace.name}</h1>
              <p className="text-sm text-slate-600">{workspace.description ?? "ワークスペースホーム"}</p>
            </div>
          </div>
        </section>

        <section className="myTaskApp-home-panel">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">ボード</h2>
            <Link className="myTaskApp-home-link" href="/u/me/boards">
              すべて表示
            </Link>
          </div>

          <div className="myTaskApp-board-grid">
            {workspace.boards.map((board) => (
              <Link key={board.id} className="myTaskApp-board-tile" href={board.slug ? `/b/${board.slug}` : `/app/workspaces/${board.workspace_id}/boards/${board.id}`}>
                <span
                  className="myTaskApp-board-tile-cover"
                  style={getBoardThumbStyle()}
                />
                <span className="myTaskApp-board-tile-title">{board.name}</span>
              </Link>
            ))}
            <Link className="myTaskApp-board-create-tile" href={`/w/${workspace.slug}/home?createBoard=1`}>
              新しいボードを作成
            </Link>
          </div>
        </section>
      </div>

      <CreateBoardForm
        workspaceId={workspace.id}
        mode="modal"
        open={isCreateBoardOpen}
        onCloseHref={`/w/${workspace.slug}/home`}
      />
    </MyTaskAppHomeShell>
  );
}
