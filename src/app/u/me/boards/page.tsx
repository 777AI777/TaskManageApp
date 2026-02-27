import Link from "next/link";
import type { CSSProperties } from "react";

import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { MyTaskAppHomeShell } from "@/components/workspace/myTaskApp-home-shell";
import { requireServerUser } from "@/lib/auth";
import { getHomeDataForUser } from "@/lib/home";

export const dynamic = "force-dynamic";
const UNIFIED_BOARD_BACKGROUND = "#c0c5d1";

function getBoardThumbStyle(): CSSProperties {
  return { background: UNIFIED_BOARD_BACKGROUND };
}

export default async function UserBoardsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ createWorkspace?: string }>;
}) {
  const query = await searchParams;
  const { supabase, user } = await requireServerUser();
  const [{ workspaces }, { data: profile }] = await Promise.all([
    getHomeDataForUser(supabase, user.id),
    supabase.from("profiles").select("avatar_color").eq("id", user.id).maybeSingle(),
  ]);
  const selectedWorkspace = workspaces[0] ?? null;
  const isCreateWorkspaceOpen = query.createWorkspace === "1";

  return (
    <MyTaskAppHomeShell
      userId={user.id}
      userEmail={user.email ?? "user@example.com"}
      userDisplayName={typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null}
      userAvatarColor={profile?.avatar_color ?? null}
      workspaces={workspaces.map((workspace) => ({
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
      }))}
      activeWorkspaceSlug={selectedWorkspace?.slug}
      activeMainNav="boards"
      activeWorkspaceNav={selectedWorkspace ? "boards" : undefined}
    >
      {!selectedWorkspace ? (
        <section className="myTaskApp-home-panel space-y-4">
          <div>
            <h1 className="text-2xl font-bold">ワークスペースを作成</h1>
            <p className="mt-1 text-sm text-slate-600">
              myTaskApp方式で作業を始めるには、最初にワークスペースを作成してください。
            </p>
          </div>
          <CreateWorkspaceForm />
        </section>
      ) : (
        <div className="space-y-4">
          <section className="myTaskApp-home-panel">
            <div className="myTaskApp-home-workspace-header">
              <div className="myTaskApp-home-workspace-badge">{selectedWorkspace.name.charAt(0).toUpperCase()}</div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{selectedWorkspace.name}</h1>
                <p className="text-sm text-slate-600">{selectedWorkspace.description ?? "ワークスペースホーム"}</p>
              </div>
            </div>
          </section>

          <section className="myTaskApp-home-panel">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-slate-900">ボード</h2>
              <Link className="myTaskApp-home-link" href={`/w/${selectedWorkspace.slug}/home`}>
                すべて表示
              </Link>
            </div>
            <div className="myTaskApp-board-grid">
              {selectedWorkspace.boards.map((board) => (
                <Link key={board.id} className="myTaskApp-board-tile" href={board.slug ? `/b/${board.slug}` : `/app/workspaces/${board.workspace_id}/boards/${board.id}`}>
                  <span
                    className="myTaskApp-board-tile-cover"
                    style={getBoardThumbStyle()}
                  />
                  <span className="myTaskApp-board-tile-title">{board.name}</span>
                </Link>
              ))}
              <Link className="myTaskApp-board-create-tile" href={`/w/${selectedWorkspace.slug}/home?createBoard=1`}>
                新しいボードを作成
              </Link>
            </div>
          </section>
        </div>
      )}

      {selectedWorkspace ? (
        <CreateWorkspaceForm mode="modal" open={isCreateWorkspaceOpen} onCloseHref="/u/me/boards" />
      ) : null}
    </MyTaskAppHomeShell>
  );
}
