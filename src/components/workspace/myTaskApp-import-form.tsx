"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type ImportSummary = {
  boardId: string;
  boardSlug: string | null;
  boardName: string;
  importedLists: number;
  importedCards: number;
  importedLabels: number;
  importedChecklists: number;
  importedChecklistItems: number;
};

type Props = {
  workspaceId: string;
};

export function MyTaskAppImportForm({ workspaceId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [boardName, setBoardName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("myTaskApp JSONファイルを選択してください。");
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (boardName.trim()) {
        formData.append("boardName", boardName.trim());
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/imports/myTaskApp`, {
        method: "POST",
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "myTaskAppインポートに失敗しました。");
      }
      setSummary({
        ...body.data.summary,
        boardSlug: body?.data?.board?.slug ?? null,
      });
      setBoardName("");
      setFile(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "myTaskAppインポートに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="surface p-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">myTaskAppインポート</h2>
      <p className="mt-1 text-sm muted">
        myTaskAppのボードJSONエクスポートを取り込み、リスト/カード/ラベル/チェックリストを再構築します。
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">JSONファイル</label>
          <input
            className="input"
            type="file"
            accept=".json,application/json"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">ボード名上書き（任意）</label>
          <input
            className="input"
            value={boardName}
            onChange={(event) => setBoardName(event.target.value)}
            placeholder="例: myTaskApp移行_営業管理"
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "インポート中..." : "インポート実行"}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {summary ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">インポート完了: {summary.boardName}</p>
          <p className="mt-1">
            リスト {summary.importedLists} / カード {summary.importedCards} / ラベル {summary.importedLabels}
          </p>
          <p className="mt-1">
            チェックリスト {summary.importedChecklists} / 項目 {summary.importedChecklistItems}
          </p>
          {summary.boardSlug ? (
            <Link className="mt-2 inline-block text-blue-700 underline" href={`/b/${summary.boardSlug}`}>
              インポートしたボードを開く
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
