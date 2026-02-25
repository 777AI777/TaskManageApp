"use client";

import { FormEvent, useState } from "react";

import type { AutomationAction, AutomationTrigger } from "@/lib/types";

type Rule = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  is_active: boolean;
};

type Props = {
  workspaceId: string;
  boardId: string;
  initialRules: Rule[];
};

export function RuleManager({ workspaceId, boardId, initialRules }: Props) {
  const [rules, setRules] = useState(initialRules);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("card_moved");
  const [action, setAction] = useState<AutomationAction>("notify");
  const [actionPayload, setActionPayload] = useState('{"userId": ""}');
  const [conditionType, setConditionType] = useState("list_is");
  const [conditionPayload, setConditionPayload] = useState('{"listId": ""}');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          boardId,
          name,
          trigger,
          conditions: [
            {
              type: conditionType,
              payload: JSON.parse(conditionPayload || "{}"),
              position: 0,
            },
          ],
          actions: [
            {
              action,
              payload: JSON.parse(actionPayload || "{}"),
              position: 0,
            },
          ],
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "ルール作成に失敗しました。");
      }
      setRules((current) => [body.data, ...current]);
      setName("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ルール作成に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(ruleId: string, isActive: boolean) {
    setError(null);
    const response = await fetch(`/api/automation/rules/${ruleId}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "ルール更新に失敗しました。");
      return;
    }
    setRules((current) =>
      current.map((rule) => (rule.id === ruleId ? { ...rule, is_active: !isActive } : rule)),
    );
  }

  return (
    <main className="space-y-4">
      <section className="surface p-5">
        <h1 className="text-2xl font-bold">自動化ルール</h1>
        <p className="mt-1 text-sm muted">
          Butler相当の代表トリガー/アクションを管理します。payloadはJSONで指定します。
        </p>
      </section>

      <form className="surface space-y-3 p-5" onSubmit={createRule}>
        <h2 className="text-lg font-semibold">ルール作成</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">ルール名</label>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">トリガー</label>
            <select
              className="input h-11"
              value={trigger}
              onChange={(event) => setTrigger(event.target.value as AutomationTrigger)}
            >
              <option value="card_moved">card_moved</option>
              <option value="due_soon">due_soon</option>
              <option value="overdue">overdue</option>
              <option value="label_added">label_added</option>
              <option value="checklist_completed">checklist_completed</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">条件タイプ</label>
            <input
              className="input"
              value={conditionType}
              onChange={(event) => setConditionType(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">アクション</label>
            <select
              className="input h-11"
              value={action}
              onChange={(event) => setAction(event.target.value as AutomationAction)}
            >
              <option value="move_card">move_card</option>
              <option value="add_label">add_label</option>
              <option value="assign_member">assign_member</option>
              <option value="set_due_date">set_due_date</option>
              <option value="post_comment">post_comment</option>
              <option value="notify">notify</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">条件payload(JSON)</label>
            <textarea
              className="input min-h-24 font-mono text-xs"
              value={conditionPayload}
              onChange={(event) => setConditionPayload(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">アクションpayload(JSON)</label>
            <textarea
              className="input min-h-24 font-mono text-xs"
              value={actionPayload}
              onChange={(event) => setActionPayload(event.target.value)}
            />
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "作成中..." : "ルール作成"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      <section className="surface p-5">
        <h2 className="text-lg font-semibold">登録済みルール</h2>
        <div className="mt-3 space-y-2">
          {rules.map((rule) => (
            <article
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3"
            >
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="text-xs muted">{rule.trigger}</p>
              </div>
              <button className="btn btn-secondary" onClick={() => toggleRule(rule.id, rule.is_active)}>
                {rule.is_active ? "無効化" : "有効化"}
              </button>
            </article>
          ))}
          {!rules.length ? <p className="text-sm muted">ルールがありません。</p> : null}
        </div>
      </section>
    </main>
  );
}
