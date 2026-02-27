import Link from "next/link";
import { notFound } from "next/navigation";

import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import { MyTaskAppHomeShell } from "@/components/workspace/myTaskApp-home-shell";
import { WorkspaceBoardManagement } from "@/components/workspace/workspace-board-management";
import { WorkspaceMemberManagement } from "@/components/workspace/workspace-member-management";
import { requireServerUser } from "@/lib/auth";
import { getHomeNavigationForUser } from "@/lib/home";

type SettingsTab = "members" | "board-management" | "activity" | "export";

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "members", label: "メンバー" },
  { id: "board-management", label: "ボード管理" },
  { id: "activity", label: "アクティビティ" },
  { id: "export", label: "エクスポート" },
];

function resolveTab(value: string | undefined): SettingsTab {
  if (
    value === "board-management" ||
    value === "activity" ||
    value === "export"
  ) {
    return value;
  }
  return "members";
}

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceSlug } = await params;
  const query = await searchParams;
  const selectedTab = resolveTab(query.tab);

  const { supabase, user } = await requireServerUser();
  const [{ workspaces }, { data: profile }] = await Promise.all([
    getHomeNavigationForUser(
      supabase,
      user.id,
    ),
    supabase.from("profiles").select("avatar_color").eq("id", user.id).maybeSingle(),
  ]);
  const workspace =
    workspaces.find((item) => item.slug === workspaceSlug) ?? null;
  if (!workspace) {
    notFound();
  }

  let members: Array<{ user_id: string; role: string; joined_at: string | null }> = [];
  let boards: Array<{ id: string; name: string; slug: string }> = [];
  let myBoardMemberships: Array<{ board_id: string; role: string }> = [];
  let activities: Array<Record<string, unknown>> = [];
  let profiles: Array<{ id: string; display_name: string | null; email: string | null }> = [];
  let cards: Array<{ id: string; title: string }> = [];

  if (selectedTab === "members") {
    const { data: memberRows } = await supabase
      .from("workspace_members")
      .select("user_id, role, joined_at")
      .eq("workspace_id", workspace.id)
      .order("joined_at", { ascending: true });
    members = (memberRows ?? []) as Array<{ user_id: string; role: string; joined_at: string | null }>;

    const memberIds = members.map((member) => member.user_id);
    if (memberIds.length) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", memberIds);
      profiles = (profileRows ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>;
    }
  }

  if (selectedTab === "board-management" || selectedTab === "activity") {
    const { data: boardRows } = await supabase
      .from("boards")
      .select("id, name, slug")
      .eq("workspace_id", workspace.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });
    boards = (boardRows ?? []) as Array<{ id: string; name: string; slug: string }>;
  }

  if (selectedTab === "board-management") {
    const boardIds = boards.map((board) => board.id);
    if (boardIds.length) {
      const { data: boardMemberRows } = await supabase
        .from("board_members")
        .select("board_id, role")
        .eq("user_id", user.id)
        .in("board_id", boardIds);
      myBoardMemberships = (boardMemberRows ?? []) as Array<{ board_id: string; role: string }>;
    }
  }

  if (selectedTab === "activity") {
    const boardIds = boards.map((board) => board.id);
    if (boardIds.length) {
      const { data: activityRows } = await supabase
        .from("activities")
        .select("id, board_id, card_id, actor_id, action, metadata, created_at")
        .in("board_id", boardIds)
        .order("created_at", { ascending: false })
        .limit(50);
      activities = (activityRows ?? []) as Array<Record<string, unknown>>;
    }

    const actorIds = Array.from(
      new Set(activities.map((item) => String(item.actor_id)).filter(Boolean)),
    );
    const cardIds = Array.from(
      new Set(
        activities
          .map((item) => item.card_id)
          .filter(
            (cardId): cardId is string =>
              typeof cardId === "string" && cardId.length > 0,
          ),
      ),
    );

    const [{ data: profileRows }, { data: cardRows }] = await Promise.all([
      actorIds.length
        ? supabase.from("profiles").select("id, display_name, email").in("id", actorIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              display_name: string | null;
              email: string | null;
            }>,
          }),
      cardIds.length
        ? supabase.from("cards").select("id, title").in("id", cardIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    ]);

    profiles = (profileRows ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>;
    cards = (cardRows ?? []) as Array<{ id: string; title: string }>;
  }

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const boardMap = new Map(boards.map((board) => [board.id, board]));
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const boardRoleById = new Map(
    myBoardMemberships.map((membership) => [
      membership.board_id,
      membership.role,
    ]),
  );

  const managedBoards = boards.map((board) => {
    const boardRole = boardRoleById.get(board.id);
    return {
      id: board.id,
      name: board.name,
      slug: board.slug,
      canArchive:
        workspace.role === "workspace_admin" ||
        boardRole === "workspace_admin" ||
        boardRole === "board_admin",
    };
  });

  const memberRows = members.map((member) => {
    const profile = profileMap.get(member.user_id);
    const canRemove =
      workspace.role === "workspace_admin" && member.user_id !== user.id;
    return {
      userId: member.user_id,
      name: profile?.display_name ?? profile?.email ?? member.user_id,
      email: profile?.email ?? null,
      role: member.role,
      joinedAt: member.joined_at,
      canRemove,
      removeDisabledReason:
        workspace.role !== "workspace_admin"
          ? "メンバーを削除する権限がありません"
          : member.user_id === user.id
            ? "自分自身は削除できません"
            : null,
    };
  });

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
      activeWorkspaceNav={selectedTab}
    >
      <section className="myTaskApp-home-panel space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ワークスペース設定</h1>
          <p className="mt-1 text-sm text-slate-600">{workspace.name}</p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/w/${workspace.slug}/settings?tab=${tab.id}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                selectedTab === tab.id
                  ? "bg-[#ccd8e9] text-[#0c66e4]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {selectedTab === "members" ? (
          <div className="space-y-4">
            <WorkspaceMemberManagement
              workspaceId={workspace.id}
              members={memberRows}
            />
            <InviteMemberForm workspaceId={workspace.id} />
          </div>
        ) : null}

        {selectedTab === "board-management" ? (
          <WorkspaceBoardManagement boards={managedBoards} />
        ) : null}

        {selectedTab === "activity" ? (
          <div className="space-y-2">
            {(activities ?? []).map((activity) => {
              const actor = profileMap.get(String(activity.actor_id));
              const board = boardMap.get(String(activity.board_id));
              const card =
                typeof activity.card_id === "string" && activity.card_id
                  ? cardMap.get(activity.card_id)
                  : undefined;
              return (
                <article
                  key={String(activity.id)}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {actor?.display_name ?? actor?.email ?? "Unknown"}:{" "}
                    {String(activity.action)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    ボード: {board?.name ?? "-"}
                    {card ? ` / カード: ${card.title}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {activity.created_at
                      ? new Date(String(activity.created_at)).toLocaleString("ja-JP")
                      : "-"}
                  </p>
                </article>
              );
            })}
            {!activities?.length ? (
              <p className="text-sm text-slate-500">アクティビティはありません。</p>
            ) : null}
          </div>
        ) : null}

        {selectedTab === "export" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              ワークスペース全体のデータを JSON 形式でエクスポートします。
            </p>
            <Link
              className="btn btn-primary inline-flex"
              href={`/api/workspaces/${workspace.id}/exports/json`}
            >
              JSONをダウンロード
            </Link>
          </div>
        ) : null}
      </section>
    </MyTaskAppHomeShell>
  );
}
