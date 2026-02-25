"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = {
  workspaceId: string;
  templates: Array<{ id: string; name: string }>;
};

export function CreateBoardForm({ workspaceId, templates }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [templateId, setTemplateId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          color,
          templateId: templateId || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Board作成に失敗しました。");
      }
      const boardId = body.data.id;
      router.push(`/app/workspaces/${workspaceId}/boards/${boardId}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Board作成に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="surface p-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">新規ボード作成</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">ボード名</label>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: スプリント12"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">説明</label>
          <textarea
            className="input min-h-20"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="目的や対象タスク"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">カラー</label>
          <input
            className="input h-11 p-1"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">テンプレート</label>
          <select
            className="input h-11"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">標準テンプレート</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button className="btn btn-primary mt-4" type="submit" disabled={loading}>
        {loading ? "作成中..." : "ボードを作成"}
      </button>
    </form>
  );
}
