"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type WorkspaceBoardManagementBoard = {
  id: string;
  name: string;
  slug: string;
  canArchive: boolean;
};

type WorkspaceBoardManagementProps = {
  boards: WorkspaceBoardManagementBoard[];
};

const FALLBACK_ERROR_MESSAGE = "ボードのアーカイブに失敗しました。";

export function WorkspaceBoardManagement({ boards }: WorkspaceBoardManagementProps) {
  const router = useRouter();
  const [items, setItems] = useState(boards);
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive(board: WorkspaceBoardManagementBoard) {
    if (!board.canArchive || pendingBoardId) {
      return;
    }

    const confirmed = window.confirm(
      `「${board.name}」をアーカイブします。アーカイブ後はボード画面を開けなくなります。続行しますか？`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setPendingBoardId(board.id);

    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error?.message ?? FALLBACK_ERROR_MESSAGE);
      }

      setItems((current) => current.filter((item) => item.id !== board.id));
      router.refresh();
    } catch (archiveError) {
      setError(
        archiveError instanceof Error ? archiveError.message : FALLBACK_ERROR_MESSAGE,
      );
    } finally {
      setPendingBoardId(null);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">ボード管理</h3>
        <p className="text-xs text-slate-500">削除はアーカイブとして処理されます。</p>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {items.length ? (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">ボード</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((board) => (
                <tr key={board.id}>
                  <td className="px-3 py-2">
                    <Link className="text-blue-700 hover:underline" href={`/b/${board.slug}`}>
                      {board.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="btn btn-secondary px-3 py-1 text-xs"
                      style={{ borderColor: "#d33d55", color: "#d33d55" }}
                      type="button"
                      onClick={() => void handleArchive(board)}
                      disabled={!board.canArchive || Boolean(pendingBoardId)}
                      title={board.canArchive ? "ボードをアーカイブ" : "このボードを管理する権限がありません"}
                    >
                      {pendingBoardId === board.id ? "処理中..." : "削除"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">表示できるボードがありません。</p>
      )}
    </section>
  );
}
