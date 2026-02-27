"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type CreateWorkspaceFormProps = {
  mode?: "inline" | "modal";
  open?: boolean;
  onCloseHref?: string;
};

export function CreateWorkspaceForm({
  mode = "inline",
  open = true,
  onCloseHref = "/u/me/boards",
}: CreateWorkspaceFormProps = {}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Workspace作成に失敗しました。");
      }
      setName("");
      setDescription("");
      const workspaceSlug = body?.data?.workspace?.slug;
      const workspaceId = body?.data?.workspace?.id;
      router.push(
        workspaceSlug
          ? `/w/${workspaceSlug}/home`
          : workspaceId
            ? `/app/workspaces/${workspaceId}`
            : "/u/me/boards",
      );
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Workspace作成に失敗しました。");
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
          <h2 className="text-xl font-semibold text-slate-900">新規ワークスペース作成</h2>
          <Link
            href={onCloseHref}
            aria-label="閉じる"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </Link>
        </div>
      ) : (
        <h2 className="text-lg font-semibold">新規ワークスペース作成</h2>
      )}

      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">名前</label>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: Product Team"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">説明</label>
          <textarea
            className="input min-h-20"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="用途や運用ルールを記載"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className={`btn btn-primary ${mode === "modal" ? "w-full" : ""}`} type="submit" disabled={loading}>
          {loading ? "作成中..." : "作成"}
        </button>
      </div>
    </form>
  );

  if (mode === "modal") {
    return <div className="myTaskApp-create-board-modal-backdrop">{body}</div>;
  }

  return body;
}
