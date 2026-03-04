"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Grid2x2, Plus, Search, Users } from "lucide-react";

import { SignOutButton } from "@/components/app/sign-out-button";
import { HomeUserMenu } from "@/components/workspace/home-user-menu";
import {
  clampSharedSidebarWidth,
  readSharedSidebarWidthFromStorage,
  writeSharedSidebarWidthToStorage,
} from "@/lib/sidebar-width";

type WorkspaceNavItem = {
  id: string;
  slug: string;
  name: string;
};

type MainNavKey = "boards";
type WorkspaceNavKey = "boards" | "members" | "board-management";

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

const HOME_SIDEBAR_DEFAULT_WIDTH_PX = 280;

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
  const [homeSidebarWidth, setHomeSidebarWidth] = useState<number>(() => {
    const storedWidth = readSharedSidebarWidthFromStorage();
    return storedWidth ?? HOME_SIDEBAR_DEFAULT_WIDTH_PX;
  });
  const [homeSidebarResizing, setHomeSidebarResizing] = useState(false);
  const homeContentRef = useRef<HTMLDivElement | null>(null);
  const homeSidebarWidthRef = useRef(homeSidebarWidth);
  const homeSidebarResizeStartRef = useRef<{ clientX: number; width: number } | null>(null);

  useEffect(() => {
    homeSidebarWidthRef.current = homeSidebarWidth;
  }, [homeSidebarWidth]);

  useEffect(() => {
    homeContentRef.current?.style.setProperty("--app-sidebar-width", `${homeSidebarWidth}px`);
  }, [homeSidebarWidth]);

  useEffect(() => {
    const storedWidth = readSharedSidebarWidthFromStorage();
    if (storedWidth !== null) {
      setHomeSidebarWidth(storedWidth);
    }
  }, []);

  useEffect(() => {
    if (!homeSidebarResizing) return;

    function handlePointerMove(event: PointerEvent) {
      const resizeStart = homeSidebarResizeStartRef.current;
      if (!resizeStart) return;
      const nextWidth = clampSharedSidebarWidth(resizeStart.width + (event.clientX - resizeStart.clientX), window.innerWidth);
      homeSidebarWidthRef.current = nextWidth;
      homeContentRef.current?.style.setProperty("--app-sidebar-width", `${nextWidth}px`);
    }

    function handlePointerEnd() {
      const resizeStart = homeSidebarResizeStartRef.current;
      if (!resizeStart) return;
      homeSidebarResizeStartRef.current = null;
      setHomeSidebarResizing(false);
      setHomeSidebarWidth(homeSidebarWidthRef.current);
      writeSharedSidebarWidthToStorage(homeSidebarWidthRef.current);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [homeSidebarResizing]);

  const handleHomeSidebarResizerPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    homeSidebarResizeStartRef.current = {
      clientX: event.clientX,
      width: homeSidebarWidthRef.current,
    };
    setHomeSidebarResizing(true);
  }, []);

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
            </>
          ) : null}
        </nav>
      </details>

      <div
        className="myTaskApp-home-content"
        ref={homeContentRef}
        style={{ "--app-sidebar-width": `${homeSidebarWidth}px` } as CSSProperties}
      >
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
                  <span className="myTaskApp-home-workspace-icon">{workspace.name.charAt(0).toUpperCase()}</span>
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
                  className={workspaceSubNavClass(activeWorkspaceNav === "board-management")}
                  href={`/w/${activeWorkspace.slug}/settings?tab=board-management`}
                >
                  <Grid2x2 size={14} />
                  <span>ボード管理</span>
                </Link>
              </div>
            </>
          ) : null}

          <div className="mt-auto">
            <SignOutButton />
          </div>
        </aside>
        <button
          className={`app-sidebar-resizer ${homeSidebarResizing ? "app-sidebar-resizer-active" : ""}`}
          type="button"
          aria-label="サイドバー幅を調整"
          aria-orientation="vertical"
          onPointerDown={handleHomeSidebarResizerPointerDown}
        />

        <main className="myTaskApp-home-main">{children}</main>
      </div>
    </div>
  );
}
