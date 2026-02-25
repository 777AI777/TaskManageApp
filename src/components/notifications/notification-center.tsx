"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ja } from "date-fns/locale";
import Link from "next/link";

type Notification = {
  id: string;
  workspace_id: string | null;
  board_id: string | null;
  card_id: string | null;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

type Props = {
  initialNotifications: Notification[];
};

export function NotificationCenter({ initialNotifications }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );

  async function markOneRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              read_at: new Date().toISOString(),
            }
          : notification,
      ),
    );
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at ?? new Date().toISOString(),
      })),
    );
  }

  return (
    <section className="surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">通知センター</h1>
          <p className="text-sm muted">未読: {unreadCount}</p>
        </div>
        <button className="btn btn-secondary" onClick={markAllRead} disabled={!unreadCount}>
          すべて既読
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {notifications.map((notification) => (
          <article
            key={notification.id}
            className={`rounded-lg border p-3 ${notification.read_at ? "bg-slate-50" : "bg-blue-50/50"}`}
          >
            <p className="text-sm font-medium">{notification.message}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs muted">
              <p>
                {formatDistanceToNowStrict(new Date(notification.created_at), {
                  locale: ja,
                  addSuffix: true,
                })}
              </p>
              <div className="flex items-center gap-2">
                {notification.workspace_id && notification.board_id ? (
                  <Link
                    className="font-semibold text-blue-700 underline underline-offset-2"
                    href={`/app/workspaces/${notification.workspace_id}/boards/${notification.board_id}`}
                  >
                    ボードへ
                  </Link>
                ) : null}
                {!notification.read_at ? (
                  <button className="btn btn-secondary px-2 py-1 text-xs" onClick={() => markOneRead(notification.id)}>
                    既読
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        {!notifications.length ? <p className="text-sm muted">通知はありません。</p> : null}
      </div>
    </section>
  );
}
