"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type WorkspaceMemberManagementMember = {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  joinedAt: string | null;
  canRemove: boolean;
  removeDisabledReason: string | null;
};

type WorkspaceMemberManagementProps = {
  workspaceId: string;
  members: WorkspaceMemberManagementMember[];
};

const FALLBACK_ERROR_MESSAGE = "メンバーの削除に失敗しました。";

export function WorkspaceMemberManagement({
  workspaceId,
  members,
}: WorkspaceMemberManagementProps) {
  const router = useRouter();
  const [items, setItems] = useState(members);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(member: WorkspaceMemberManagementMember) {
    if (!member.canRemove || pendingMemberId) {
      return;
    }

    const confirmed = window.confirm(
      `「${member.name}」をワークスペースから削除します。続行しますか？`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setPendingMemberId(member.userId);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/members/${member.userId}`,
        { method: "DELETE" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? FALLBACK_ERROR_MESSAGE);
      }

      setItems((current) =>
        current.filter((item) => item.userId !== member.userId),
      );
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : FALLBACK_ERROR_MESSAGE,
      );
    } finally {
      setPendingMemberId(null);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 p-4">
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">名前</th>
              <th className="px-3 py-2">メール</th>
              <th className="px-3 py-2">権限</th>
              <th className="px-3 py-2">参加日</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((member) => (
              <tr key={member.userId}>
                <td className="px-3 py-2">{member.name}</td>
                <td className="px-3 py-2">{member.email ?? "-"}</td>
                <td className="px-3 py-2">{member.role}</td>
                <td className="px-3 py-2">
                  {member.joinedAt
                    ? new Date(member.joinedAt).toLocaleDateString("ja-JP")
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="btn btn-secondary px-3 py-1 text-xs"
                    style={{ borderColor: "#d33d55", color: "#d33d55" }}
                    type="button"
                    onClick={() => void handleRemove(member)}
                    disabled={!member.canRemove || Boolean(pendingMemberId)}
                    title={member.removeDisabledReason ?? "メンバーを削除"}
                  >
                    {pendingMemberId === member.userId ? "処理中..." : "削除"}
                  </button>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                  メンバーはいません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
