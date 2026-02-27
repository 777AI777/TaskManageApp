"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { ja } from "date-fns/locale";
import Link from "next/link";
import { useMemo, useState } from "react";

type Notification = {
  id: string;
  workspace_id: string | null;
  board_id: string | null;
  board_slug?: string | null;
  card_id: string | null;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

type Props = {
  initialNotifications: Notification[];
};

type FilterMode = "all" | "unread" | "read";

const FILTERS: Array<{ id: FilterMode; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "unread", label: "未読" },
  { id: "read", label: "既読" },
];

export function NotificationCenter({ initialNotifications }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [mode, setMode] = useState<FilterMode>("all");

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );

  const visibleNotifications = useMemo(() => {
    if (mode === "unread") return notifications.filter((notification) => !notification.read_at);
    if (mode === "read") return notifications.filter((notification) => notification.read_at);
    return notifications;
  }, [mode, notifications]);

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
    <section className="myTaskApp-home-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">通知センター</h1>
          <p className="text-sm text-slate-600">未読: {unreadCount}</p>
        </div>
        <button className="btn btn-secondary" onClick={markAllRead} disabled={!unreadCount}>
          すべて既読
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            className={`rounded-full border px-3 py-1 text-sm ${
              mode === filter.id
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-300 bg-white text-slate-700"
            }`}
            type="button"
            onClick={() => setMode(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {visibleNotifications.map((notification) => (
          <article
            key={notification.id}
            className={`rounded-lg border p-3 ${
              notification.read_at
                ? "border-slate-200 bg-slate-50 text-slate-800"
                : "border-blue-200 bg-blue-50 text-slate-900"
            }`}
          >
            <p className="text-sm font-medium">{notification.message}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <p className="text-slate-500">
                {formatDistanceToNowStrict(new Date(notification.created_at), {
                  locale: ja,
                  addSuffix: true,
                })}
              </p>
              <div className="flex items-center gap-2">
                {notification.board_slug ? (
                  <Link
                    className="font-semibold text-blue-700 underline underline-offset-2"
                    href={`/b/${notification.board_slug}`}
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
        {!visibleNotifications.length ? <p className="text-sm text-slate-500">通知はありません。</p> : null}
      </div>
    </section>
  );
}
