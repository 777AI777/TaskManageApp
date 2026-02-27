"use client";

import { FormEvent, useState } from "react";

type Role = "workspace_admin" | "board_admin" | "member";

type Props = {
  workspaceId: string;
};

type InviteResponseData = {
  mode?: "direct_member_add" | "invite_link";
  inviteUrl?: string;
  message?: string;
};

export function InviteMemberForm({ workspaceId }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [fallbackInviteUrl, setFallbackInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setFallbackInviteUrl(null);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          email,
          role,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "招待送信に失敗しました。");
      }

      const data = (body?.data ?? {}) as InviteResponseData;
      if (data.mode === "invite_link" && data.inviteUrl) {
        setSuccess(data.message ?? "招待リンクを作成しました。");
        setFallbackInviteUrl(data.inviteUrl);
      } else {
        setSuccess(data.message ?? "招待を送信しました。");
      }
      setEmail("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "招待送信に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="surface p-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">メンバー招待</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">メール</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@example.com"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">権限</label>
          <select className="input h-11" value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="member">メンバー</option>
            <option value="board_admin">ボード管理者</option>
            <option value="workspace_admin">ワークスペース管理者</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "送信中..." : "招待を送信"}
        </button>
        {fallbackInviteUrl ? (
          <a
            className="text-sm font-semibold text-blue-700 underline underline-offset-2"
            href={fallbackInviteUrl}
            target="_blank"
            rel="noreferrer"
          >
            招待URLを開く
          </a>
        ) : null}
      </div>

      {success ? <p className="mt-2 text-sm text-emerald-700">{success}</p> : null}
      {fallbackInviteUrl ? (
        <p className="mt-2 break-all rounded-md bg-slate-100 px-3 py-2 font-mono text-xs">{fallbackInviteUrl}</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
