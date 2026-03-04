"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { isValidBoardCode, normalizeBoardCodeInput } from "@/lib/task-id";

type WorkspaceBoardManagementBoard = {
  id: string;
  name: string;
  slug: string;
  boardCode: string;
  canArchive: boolean;
};

type WorkspaceBoardManagementProps = {
  boards: WorkspaceBoardManagementBoard[];
};

const FALLBACK_ERROR_MESSAGE = "Failed to update board settings.";

export function WorkspaceBoardManagement({ boards }: WorkspaceBoardManagementProps) {
  const router = useRouter();
  const [items, setItems] = useState(boards);
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null);
  const [savingBoardCodeId, setSavingBoardCodeId] = useState<string | null>(null);
  const [boardCodeDrafts, setBoardCodeDrafts] = useState<Record<string, string>>(
    Object.fromEntries(boards.map((board) => [board.id, board.boardCode])),
  );
  const [error, setError] = useState<string | null>(null);

  async function handleArchive(board: WorkspaceBoardManagementBoard) {
    if (!board.canArchive || pendingBoardId || savingBoardCodeId) {
      return;
    }

    const confirmed = window.confirm(
      `"${board.name}" will be archived. Archived boards cannot be opened. Continue?`,
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

  async function handleBoardCodeSave(board: WorkspaceBoardManagementBoard) {
    if (!board.canArchive || pendingBoardId || savingBoardCodeId) {
      return;
    }

    const draft = normalizeBoardCodeInput(boardCodeDrafts[board.id] ?? board.boardCode);
    if (!isValidBoardCode(draft)) {
      setError("Board ID must be 2-10 uppercase letters, numbers, hyphens, or underscores.");
      return;
    }

    if (draft === board.boardCode) {
      setError(null);
      return;
    }

    setError(null);
    setSavingBoardCodeId(board.id);

    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardCode: draft }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error?.message ?? FALLBACK_ERROR_MESSAGE);
      }

      const nextBoardCode =
        typeof body?.data?.board_code === "string" && body.data.board_code
          ? body.data.board_code
          : draft;
      setItems((current) =>
        current.map((item) =>
          item.id === board.id
            ? {
                ...item,
                boardCode: nextBoardCode,
              }
            : item,
        ),
      );
      setBoardCodeDrafts((current) => ({ ...current, [board.id]: nextBoardCode }));
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : FALLBACK_ERROR_MESSAGE);
    } finally {
      setSavingBoardCodeId(null);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">ボード管理</h3>
        <p className="text-xs text-slate-500">ボードIDの更新とアーカイブ管理を行えます。</p>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {items.length ? (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">ボード</th>
                <th className="px-3 py-2">ボードID</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((board) => {
                const draft = boardCodeDrafts[board.id] ?? board.boardCode;
                const canEdit = board.canArchive && !pendingBoardId;
                const isSavingCode = savingBoardCodeId === board.id;
                return (
                  <tr key={board.id}>
                    <td className="px-3 py-2">
                      <Link className="text-blue-700 hover:underline" href={`/b/${board.slug}`}>
                        {board.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[220px] items-center gap-2">
                        <input
                          type="text"
                          className="input h-9"
                          value={draft}
                          onChange={(event) =>
                            setBoardCodeDrafts((current) => ({
                              ...current,
                              [board.id]: normalizeBoardCodeInput(event.target.value),
                            }))
                          }
                          maxLength={10}
                          disabled={!canEdit || isSavingCode}
                          aria-label={`${board.name} board ID`}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary whitespace-nowrap px-3 py-1 text-xs"
                          onClick={() => void handleBoardCodeSave(board)}
                          disabled={!canEdit || isSavingCode || !isValidBoardCode(draft)}
                        >
                          {isSavingCode ? "保存中..." : "保存"}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="btn btn-secondary px-3 py-1 text-xs"
                        style={{ borderColor: "#d33d55", color: "#d33d55" }}
                        type="button"
                        onClick={() => void handleArchive(board)}
                        disabled={!board.canArchive || Boolean(pendingBoardId) || Boolean(savingBoardCodeId)}
                        title={board.canArchive ? "ボードをアーカイブ" : "このボードを操作する権限がありません"}
                      >
                        {pendingBoardId === board.id ? "処理中..." : "アーカイブ"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">表示できるボードがありません。</p>
      )}
    </section>
  );
}
