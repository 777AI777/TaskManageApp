"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CardDeadlineState } from "@/lib/board-utils";
import type { TableSortKey, TableSortState } from "@/lib/table-sort";
import { getAriaSortValue } from "@/lib/table-sort";

export type TableRow = {
  id: string;
  taskId: string;
  title: string;
  listId: string;
  listName: string;
  labelIds: string[];
  labels: string[];
  dueAt: string | null;
  dueDateValue: string;
  dueLabel: string | null;
  deadlineState: CardDeadlineState;
  isCompleted: boolean;
  assigneeIds: string[];
  assigneePrimary: string | null;
  assigneeExtraCount: number;
  customFieldValues: Record<string, string>;
};

type SelectOption = {
  id: string;
  name: string;
};

const MULTISELECT_MENU_MAX_HEIGHT = 220;
const MULTISELECT_MENU_OFFSET = 4;
const MULTISELECT_VIEWPORT_PADDING = 8;

type Props = {
  rows: TableRow[];
  customFieldColumns: Array<{ id: string; name: string }>;
  lists: SelectOption[];
  labels: SelectOption[];
  members: SelectOption[];
  savingByCardId: Record<string, boolean>;
  sortState: TableSortState;
  onSort: (key: TableSortKey) => void;
  onSelectCard: (cardId: string) => void;
  onListChange: (cardId: string, listId: string) => void;
  onLabelsChange: (cardId: string, labelIds: string[]) => void;
  onAssigneesChange: (cardId: string, assigneeIds: string[]) => void;
  onDueDateChange: (cardId: string, dueDate: string | null) => void;
  onStatusChange: (cardId: string, isCompleted: boolean) => void;
};

function getMultiSelectSummary(selectedIds: string[], options: SelectOption[]): string {
  if (!selectedIds.length) return "-";
  const selectedNames = options.filter((option) => selectedIds.includes(option.id)).map((option) => option.name);
  if (!selectedNames.length) return "-";
  if (selectedNames.length === 1) return selectedNames[0];
  return `${selectedNames[0]} +${selectedNames.length - 1}`;
}

function SortableHeader({
  label,
  sortKey,
  sortState,
  onSort,
}: {
  label: string;
  sortKey: TableSortKey;
  sortState: TableSortState;
  onSort: (key: TableSortKey) => void;
}) {
  const ariaSort = getAriaSortValue(sortState, sortKey);
  const isActive = sortState?.key === sortKey;
  const direction = isActive ? sortState.direction : null;

  return (
    <th className="tm-table-sort-header" aria-sort={ariaSort}>
      <button
        type="button"
        className={`tm-table-sort-button ${isActive ? "tm-table-sort-button-active" : ""}`}
        onClick={() => onSort(sortKey)}
        aria-label={`${label}で並び替え`}
      >
        <span>{label}</span>
        <span className="tm-table-sort-indicator" aria-hidden="true">
          {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}

function MultiSelectDropdown({
  selectedIds,
  options,
  disabled,
  triggerLabel,
  emptyLabel,
  onChange,
}: {
  selectedIds: string[];
  options: SelectOption[];
  disabled: boolean;
  triggerLabel: string;
  emptyLabel: string;
  onChange: (nextIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<"down" | "up">("down");
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>(MULTISELECT_MENU_MAX_HEIGHT);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const summary = getMultiSelectSummary(selectedIds, options);

  const updateMenuPlacement = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = Math.max(
      0,
      window.innerHeight - rect.bottom - MULTISELECT_VIEWPORT_PADDING - MULTISELECT_MENU_OFFSET,
    );
    const spaceAbove = Math.max(0, rect.top - MULTISELECT_VIEWPORT_PADDING - MULTISELECT_MENU_OFFSET);
    const nextPlacement: "down" | "up" =
      spaceBelow < MULTISELECT_MENU_MAX_HEIGHT && spaceAbove > spaceBelow ? "up" : "down";
    const availableSpace = nextPlacement === "up" ? spaceAbove : spaceBelow;

    setMenuPlacement(nextPlacement);
    setMenuMaxHeight(
      availableSpace > 0 ? Math.min(MULTISELECT_MENU_MAX_HEIGHT, availableSpace) : MULTISELECT_MENU_MAX_HEIGHT,
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updateMenuPlacement();

    window.addEventListener("resize", updateMenuPlacement);
    window.addEventListener("scroll", updateMenuPlacement, true);
    return () => {
      window.removeEventListener("resize", updateMenuPlacement);
      window.removeEventListener("scroll", updateMenuPlacement, true);
    };
  }, [open, updateMenuPlacement]);

  function handleToggleOption(optionId: string, checked: boolean) {
    const nextSet = new Set(selectedIds);
    if (checked) {
      nextSet.add(optionId);
    } else {
      nextSet.delete(optionId);
    }
    const nextIds = options.filter((option) => nextSet.has(option.id)).map((option) => option.id);
    onChange(nextIds);
  }

  return (
    <div className="tm-table-multiselect" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="tm-table-multiselect-trigger"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        {summary === "-" ? emptyLabel : summary}
      </button>
      {open ? (
        <div
          className={`tm-table-multiselect-menu ${menuPlacement === "up" ? "tm-table-multiselect-menu-up" : ""}`}
          role="menu"
          aria-label={triggerLabel}
          style={{ maxHeight: `${menuMaxHeight}px` }}
        >
          {options.length ? (
            options.map((option) => (
              <label key={option.id} className="tm-table-multiselect-option">
                <input
                  type="checkbox"
                  checked={selectedIdSet.has(option.id)}
                  onChange={(event) => handleToggleOption(option.id, event.target.checked)}
                  disabled={disabled}
                />
                <span>{option.name}</span>
              </label>
            ))
          ) : (
            <p className="tm-table-multiselect-empty">{emptyLabel}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TableView({
  rows,
  customFieldColumns,
  lists,
  labels,
  members,
  savingByCardId,
  sortState,
  onSort,
  onSelectCard,
  onListChange,
  onLabelsChange,
  onAssigneesChange,
  onDueDateChange,
  onStatusChange,
}: Props) {
  return (
    <div className="tm-table-surface overflow-x-auto">
      <table className="tm-table min-w-full text-sm">
        <thead className="tm-table-head">
          <tr>
            <SortableHeader label="ID" sortKey="taskId" sortState={sortState} onSort={onSort} />
            <SortableHeader label="カード" sortKey="title" sortState={sortState} onSort={onSort} />
            <SortableHeader label="リスト" sortKey="list" sortState={sortState} onSort={onSort} />
            <SortableHeader label="ラベル" sortKey="labels" sortState={sortState} onSort={onSort} />
            <SortableHeader label="担当者" sortKey="assignees" sortState={sortState} onSort={onSort} />
            {customFieldColumns.map((column) => (
              <SortableHeader
                key={column.id}
                label={column.name}
                sortKey={`custom:${column.id}`}
                sortState={sortState}
                onSort={onSort}
              />
            ))}
            <SortableHeader label="期限日" sortKey="dueAt" sortState={sortState} onSort={onSort} />
            <SortableHeader label="状態" sortKey="status" sortState={sortState} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSaving = Boolean(savingByCardId[row.id]);
            return (
              <tr key={row.id} className={`tm-table-row ${isSaving ? "tm-table-row-saving" : ""}`}>
                <td className="px-4 py-3">
                  <button className="tm-table-link text-left" onClick={() => onSelectCard(row.id)}>
                    {row.taskId}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className="tm-table-task-link">{row.title}</span>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="tm-table-inline-select"
                    value={row.listId}
                    onChange={(event) => onListChange(row.id, event.target.value)}
                    disabled={isSaving}
                    aria-label="リスト"
                  >
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <MultiSelectDropdown
                    selectedIds={row.labelIds}
                    options={labels}
                    disabled={isSaving}
                    triggerLabel="ラベルを編集"
                    emptyLabel="-"
                    onChange={(nextIds) => onLabelsChange(row.id, nextIds)}
                  />
                </td>
                <td className="px-4 py-3">
                  <MultiSelectDropdown
                    selectedIds={row.assigneeIds}
                    options={members}
                    disabled={isSaving}
                    triggerLabel="担当者を編集"
                    emptyLabel="-"
                    onChange={(nextIds) => onAssigneesChange(row.id, nextIds)}
                  />
                </td>
                {customFieldColumns.map((column) => (
                  <td key={`${row.id}:${column.id}`} className="px-4 py-3">
                    {row.customFieldValues[column.id] ?? "-"}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="tm-table-date-cell">
                    <input
                      type="date"
                      className="tm-table-date-input"
                      value={row.dueDateValue}
                      onChange={(event) => onDueDateChange(row.id, event.target.value || null)}
                      disabled={isSaving}
                      aria-label="期限日"
                    />
                    <button
                      type="button"
                      className="tm-table-date-clear"
                      onClick={() => onDueDateChange(row.id, null)}
                      disabled={isSaving || !row.dueDateValue}
                    >
                      クリア
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="tm-table-inline-select"
                    value={row.isCompleted ? "completed" : "incomplete"}
                    onChange={(event) => onStatusChange(row.id, event.target.value === "completed")}
                    disabled={isSaving}
                    aria-label="状態"
                  >
                    <option value="incomplete">未完了</option>
                    <option value="completed">完了</option>
                  </select>
                </td>
              </tr>
            );
          })}
          {!rows.length ? (
            <tr>
              <td colSpan={7 + customFieldColumns.length} className="px-4 py-10 text-center text-slate-500">
                表示できるカードがありません。
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
