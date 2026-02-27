"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { BOARD_ERROR_MESSAGES } from "@/lib/board-ui-text";

type Props = {
  workspaceId: string;
  templates?: Array<{ id: string; name: string }>;
  mode?: "inline" | "modal";
  open?: boolean;
  onCloseHref?: string;
  onClose?: () => void;
};

export function CreateBoardForm({
  workspaceId,
  templates: _templates,
  mode = "inline",
  open = true,
  onCloseHref = "/u/me/boards",
  onClose,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("ボード名は必須です。");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? BOARD_ERROR_MESSAGES.createBoard);
      }
      const boardSlug = body?.data?.slug;
      router.push(boardSlug ? `/b/${boardSlug}` : "/u/me/boards");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : BOARD_ERROR_MESSAGES.createBoard);
    } finally {
      setLoading(false);
    }
  }

  if (mode === "modal" && !open) {
    return null;
  }

  const body = (
    <form className={mode === "modal" ? "myTaskApp-create-board-modal" : "surface p-4"} onSubmit={handleSubmit}>
      {mode === "modal" ? (
        <div className="myTaskApp-create-board-header">
          <h2 className="text-xl font-semibold text-slate-900">ボードを作成</h2>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          ) : (
            <Link
              href={onCloseHref}
              aria-label="閉じる"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <X size={18} />
            </Link>
          )}
        </div>
      ) : (
        <h2 className="text-lg font-semibold">ボードを作成</h2>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">ボード名 *</label>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: プロダクト企画"
            required
          />
          {!name.trim() ? <p className="mt-1 text-xs text-amber-700">ボード名は必須です。</p> : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button className="btn btn-primary mt-4 w-full" type="submit" disabled={loading || !name.trim()}>
        {loading ? "作成中..." : "作成"}
      </button>
    </form>
  );

  if (mode === "modal") {
    return <div className="myTaskApp-create-board-modal-backdrop">{body}</div>;
  }

  return body;
}
