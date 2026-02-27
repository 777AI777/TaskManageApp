import Link from "next/link";
import type { PropsWithChildren } from "react";
import {
  Activity,
  Download,
  Grid2x2,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { HomeUserMenu } from "@/components/workspace/home-user-menu";
import { SignOutButton } from "@/components/app/sign-out-button";

type WorkspaceNavItem = {
  id: string;
  slug: string;
  name: string;
};

type MainNavKey = "boards";
type WorkspaceNavKey =
  | "boards"
  | "members"
  | "board-management"
  | "activity"
  | "export";

type MyTaskAppHomeShellProps = PropsWithChildren<{
  userId: string;
  userEmail: string;
  userDisplayName?: string | null;
  userAvatarColor?: string | null;
  workspaces: WorkspaceNavItem[];
  activeWorkspaceSlug?: string;
  activeMainNav?: MainNavKey;
  activeWorkspaceNav?: WorkspaceNavKey;
}>;

export function MyTaskAppHomeShell({
  children,
  userId,
  userEmail,
  userDisplayName,
  userAvatarColor,
  workspaces,
  activeWorkspaceSlug,
  activeMainNav,
  activeWorkspaceNav,
}: MyTaskAppHomeShellProps) {
  const activeWorkspace = workspaces.find((workspace) => workspace.slug === activeWorkspaceSlug) ?? null;
  const workspaceHomeHref = activeWorkspace ? `/w/${activeWorkspace.slug}/home` : "/u/me/boards";
  const createBoardHref = activeWorkspace ? `${workspaceHomeHref}?createBoard=1` : "/u/me/boards";

  function mainNavClass(isActive: boolean) {
    return `myTaskApp-home-main-nav-item ${isActive ? "myTaskApp-home-main-nav-item-active" : ""}`;
  }

  function workspaceSubNavClass(isActive: boolean) {
    return `myTaskApp-home-workspace-subnav-item ${
      isActive ? "myTaskApp-home-workspace-subnav-item-active" : ""
    }`;
  }

  return (
    <div className="myTaskApp-home-root">
      <header className="myTaskApp-home-topbar">
        <div className="flex items-center gap-2">
          <Link className="myTaskApp-home-logo" href="/u/me/boards">
            <Grid2x2 size={16} />
            <span>myTaskApp</span>
          </Link>
        </div>
        <label className="myTaskApp-home-search-wrap">
          <Search size={14} />
          <input className="myTaskApp-home-search" placeholder="検索" />
        </label>
        <div className="flex items-center justify-end gap-2">
          <Link className="myTaskApp-home-create-btn" href={createBoardHref}>
            作成
          </Link>
          <HomeUserMenu
            userId={userId}
            initialEmail={userEmail}
            initialDisplayName={userDisplayName ?? null}
            initialAvatarColor={userAvatarColor}
          />
        </div>
      </header>

      <details className="myTaskApp-home-mobile-nav lg:hidden">
        <summary>メニュー</summary>
        <nav className="myTaskApp-home-mobile-nav-body">
          <Link href="/u/me/boards">ボード</Link>
          {activeWorkspace ? (
            <>
              <Link href={`/w/${activeWorkspace.slug}/settings?tab=members`}>メンバー</Link>
              <Link href={`/w/${activeWorkspace.slug}/settings?tab=board-management`}>ボード管理</Link>
              <Link href={`/w/${activeWorkspace.slug}/settings?tab=activity`}>アクティビティ</Link>
              <Link href={`/w/${activeWorkspace.slug}/settings?tab=export`}>エクスポート</Link>
            </>
          ) : null}
        </nav>
      </details>

      <div className="myTaskApp-home-content">
        <aside className="myTaskApp-home-sidebar hidden lg:flex">
          <nav className="myTaskApp-home-main-nav">
            <Link className={mainNavClass(activeMainNav === "boards")} href="/u/me/boards">
              <Grid2x2 size={14} />
              <span>ボード</span>
            </Link>
          </nav>

          <div className="myTaskApp-home-sidebar-divider" />

          <div>
            <div className="myTaskApp-home-sidebar-heading-row">
              <p className="myTaskApp-home-sidebar-heading">ワークスペース</p>
              <Link
                className="myTaskApp-home-workspace-add-btn"
                href="/u/me/boards?createWorkspace=1"
                aria-label="ワークスペースを作成"
                title="ワークスペースを作成"
              >
                <Plus size={14} />
              </Link>
            </div>
            <div className="myTaskApp-home-workspace-list">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  className={`myTaskApp-home-workspace-item ${
                    workspace.slug === activeWorkspaceSlug ? "myTaskApp-home-workspace-item-active" : ""
                  }`}
                  href={`/w/${workspace.slug}/home`}
                >
                  <span className="myTaskApp-home-workspace-icon">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{workspace.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {activeWorkspace ? (
            <>
              <div className="myTaskApp-home-sidebar-divider" />
              <div className="myTaskApp-home-workspace-subnav">
                <Link
                  className={workspaceSubNavClass(activeWorkspaceNav === "boards")}
                  href={`/w/${activeWorkspace.slug}/home`}
                >
                  <Grid2x2 size={14} />
                  <span>ボード</span>
                </Link>
                <Link
                  className={workspaceSubNavClass(activeWorkspaceNav === "members")}
                  href={`/w/${activeWorkspace.slug}/settings?tab=members`}
                >
                  <Users size={14} />
                  <span>メンバー</span>
                </Link>
                <Link
                  className={workspaceSubNavClass(
                    activeWorkspaceNav === "board-management",
                  )}
                  href={`/w/${activeWorkspace.slug}/settings?tab=board-management`}
                >
                  <Grid2x2 size={14} />
                  <span>ボード管理</span>
                </Link>
                <Link
                  className={workspaceSubNavClass(activeWorkspaceNav === "activity")}
                  href={`/w/${activeWorkspace.slug}/settings?tab=activity`}
                >
                  <Activity size={14} />
                  <span>アクティビティ</span>
                </Link>
                <Link
                  className={workspaceSubNavClass(activeWorkspaceNav === "export")}
                  href={`/w/${activeWorkspace.slug}/settings?tab=export`}
                >
                  <Download size={14} />
                  <span>エクスポート</span>
                </Link>
              </div>
            </>
          ) : null}

          <div className="mt-auto">
            <SignOutButton />
          </div>
        </aside>

        <main className="myTaskApp-home-main">{children}</main>
      </div>
    </div>
  );
}

