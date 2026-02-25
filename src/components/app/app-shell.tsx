import Link from "next/link";
import { PropsWithChildren } from "react";

import { SignOutButton } from "@/components/app/sign-out-button";

type WorkspaceSummary = {
  id: string;
  name: string;
};

type AppShellProps = PropsWithChildren<{
  userEmail: string;
  unreadNotifications: number;
  workspaces: WorkspaceSummary[];
}>;

export function AppShell({
  children,
  userEmail,
  unreadNotifications,
  workspaces,
}: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-4 px-2 py-4 sm:px-4">
      <aside className="surface hidden w-72 flex-none p-4 lg:block">
        <div className="mb-4">
          <p className="chip mb-2 inline-flex">TaskManageApp</p>
          <h1 className="text-lg font-bold">開発タスク管理</h1>
          <p className="mt-1 text-xs muted">{userEmail}</p>
        </div>

        <nav className="space-y-1">
          <Link className="block rounded-md px-3 py-2 text-sm hover:bg-blue-50" href="/app/workspaces">
            ワークスペース
          </Link>
          <Link className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-blue-50" href="/app/notifications">
            通知
            {unreadNotifications > 0 ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                {unreadNotifications}
              </span>
            ) : null}
          </Link>
        </nav>

        <div className="mt-6">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            参加中ワークスペース
          </p>
          <div className="space-y-1">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                className="block rounded-md px-3 py-2 text-sm hover:bg-blue-50"
                href={`/app/workspaces/${workspace.id}`}
              >
                {workspace.name}
              </Link>
            ))}
            {!workspaces.length ? (
              <p className="px-3 text-xs muted">ワークスペースがありません。</p>
            ) : null}
          </div>
        </div>

        <div className="mt-8">
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
