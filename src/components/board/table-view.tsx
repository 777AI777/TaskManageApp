"use client";

import type { CardDeadlineState } from "@/lib/board-utils";

type TableRow = {
  id: string;
  title: string;
  listName: string;
  labels: string[];
  dueAt: string | null;
  dueLabel: string | null;
  deadlineState: CardDeadlineState;
  assigneePrimary: string | null;
  assigneeExtraCount: number;
  customFieldValues: Record<string, string>;
};

type Props = {
  rows: TableRow[];
  customFieldColumns: Array<{ id: string; name: string }>;
  onSelectCard: (cardId: string) => void;
};

const DEADLINE_LABELS: Record<CardDeadlineState, string> = {
  none: "期限なし",
  upcoming: "期限あり",
  "due-today": "期限当日",
  overdue: "期限切れ",
  completed: "完了",
};

export function TableView({ rows, customFieldColumns, onSelectCard }: Props) {
  return (
    <div className="tm-table-surface overflow-x-auto">
      <table className="tm-table min-w-full text-sm">
        <thead className="tm-table-head">
          <tr>
            <th className="px-4 py-3 text-left">カード</th>
            <th className="px-4 py-3 text-left">リスト</th>
            <th className="px-4 py-3 text-left">ラベル</th>
            <th className="px-4 py-3 text-left">担当</th>
            {customFieldColumns.map((column) => (
              <th key={column.id} className="px-4 py-3 text-left">
                {column.name}
              </th>
            ))}
            <th className="px-4 py-3 text-left">期限</th>
            <th className="px-4 py-3 text-left">状態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="tm-table-row">
              <td className="px-4 py-3">
                <button className="tm-table-link text-left" onClick={() => onSelectCard(row.id)}>
                  {row.title}
                </button>
              </td>
              <td className="px-4 py-3">{row.listName}</td>
              <td className="px-4 py-3">{row.labels.length ? row.labels.join(", ") : "-"}</td>
              <td className="px-4 py-3">
                {row.assigneePrimary ? (
                  <span className="tm-table-assignee-label" title={row.assigneePrimary}>
                    {row.assigneePrimary}
                    {row.assigneeExtraCount > 0 ? ` +${row.assigneeExtraCount}` : ""}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              {customFieldColumns.map((column) => (
                <td key={`${row.id}:${column.id}`} className="px-4 py-3">
                  {row.customFieldValues[column.id] ?? "-"}
                </td>
              ))}
              <td className="px-4 py-3">
                {row.dueLabel ? (
                  <span className={`tm-task-state-chip tm-task-state-${row.deadlineState}`}>{row.dueLabel}</span>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`tm-task-state-chip tm-task-state-${row.deadlineState}`}>
                  {DEADLINE_LABELS[row.deadlineState]}
                </span>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={6 + customFieldColumns.length} className="px-4 py-10 text-center text-slate-500">
                表示できるカードがありません。
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
