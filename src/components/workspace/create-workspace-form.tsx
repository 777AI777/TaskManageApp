"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function CreateWorkspaceForm() {
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
      router.push(`/app/workspaces/${body.data.workspace.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Workspace作成に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="surface p-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">新規ワークスペース作成</h2>
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
            placeholder="運用方針や目的を記載"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "作成中..." : "作成"}
        </button>
      </div>
    </form>
  );
}
