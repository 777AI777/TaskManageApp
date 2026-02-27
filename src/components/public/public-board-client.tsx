"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BOARD_COMMON_LABELS, booleanLabel } from "@/lib/board-ui-text";

type PublicBoard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type PublicList = {
  id: string;
  name: string;
  position: number;
};

type PublicCard = {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  due_at: string | null;
  start_at: string | null;
  is_completed: boolean;
};

type PublicLabel = {
  id: string;
  name: string;
  color: string;
};

type PublicCardLabel = {
  card_id: string;
  label_id: string;
};

type PublicComment = {
  id: string;
  card_id: string;
  content: string;
  created_at: string;
};

type PublicChecklist = {
  id: string;
  card_id: string;
  title: string;
  position: number;
};

type PublicChecklistItem = {
  id: string;
  checklist_id: string;
  content: string;
  is_completed: boolean;
  position: number;
};

type PublicAttachment = {
  id: string;
  card_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

type PublicActivity = {
  id: string;
  card_id: string | null;
  action: string;
  created_at: string;
};

type PublicCustomField = {
  id: string;
  name: string;
  field_type: "text" | "number" | "date" | "checkbox" | "select";
  options: Array<{ id: string; label: string }> | string[];
  position: number;
};

type PublicCardCustomFieldValue = {
  id: string;
  card_id: string;
  custom_field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_option: string | null;
};

type Props = {
  board: PublicBoard;
  lists: PublicList[];
  cards: PublicCard[];
  labels: PublicLabel[];
  cardLabels: PublicCardLabel[];
  comments: PublicComment[];
  checklists: PublicChecklist[];
  checklistItems: PublicChecklistItem[];
  attachments: PublicAttachment[];
  activities: PublicActivity[];
  customFields: PublicCustomField[];
  cardCustomFieldValues: PublicCardCustomFieldValue[];
};

function renderCustomFieldValue(
  field: PublicCustomField,
  value: PublicCardCustomFieldValue | undefined,
) {
  if (!value) return "-";
  if (field.field_type === "text") return value.value_text || "-";
  if (field.field_type === "number") return value.value_number?.toString() ?? "-";
  if (field.field_type === "date") {
    return value.value_date ? new Date(value.value_date).toLocaleString("ja-JP") : "-";
  }
  if (field.field_type === "checkbox") {
    return booleanLabel(Boolean(value.value_boolean));
  }
  if (field.field_type === "select") {
    return value.value_option || "-";
  }
  return "-";
}

export function PublicBoardClient({
  board,
  lists,
  cards,
  labels,
  cardLabels,
  comments,
  checklists,
  checklistItems,
  attachments,
  activities,
  customFields,
  cardCustomFieldValues,
}: Props) {
  const UNIFIED_BOARD_BACKGROUND = "#c0c5d1";
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const sortedLists = useMemo(
    () => [...lists].sort((a, b) => a.position - b.position),
    [lists],
  );

  const cardsByList = useMemo(() => {
    const map = new Map<string, PublicCard[]>();
    sortedLists.forEach((list) => map.set(list.id, []));
    [...cards]
      .sort((a, b) => a.position - b.position)
      .forEach((card) => {
        const bucket = map.get(card.list_id);
        if (bucket) bucket.push(card);
      });
    return map;
  }, [cards, sortedLists]);

  const selectedCard = cards.find((card) => card.id === selectedCardId) ?? null;
  const selectedCardLabelIds = selectedCard
    ? cardLabels.filter((item) => item.card_id === selectedCard.id).map((item) => item.label_id)
    : [];
  const selectedLabels = labels.filter((label) => selectedCardLabelIds.includes(label.id));
  const selectedComments = selectedCard
    ? comments.filter((comment) => comment.card_id === selectedCard.id)
    : [];
  const selectedChecklists = selectedCard
    ? [...checklists.filter((checklist) => checklist.card_id === selectedCard.id)].sort((a, b) => a.position - b.position)
    : [];
  const selectedAttachments = selectedCard
    ? attachments.filter((attachment) => attachment.card_id === selectedCard.id)
    : [];
  const selectedActivities = selectedCard
    ? activities.filter((activity) => activity.card_id === selectedCard.id).slice(0, 20)
    : [];
  const selectedCustomValues = selectedCard
    ? cardCustomFieldValues.filter((value) => value.card_id === selectedCard.id)
    : [];

  const boardBackground = { background: UNIFIED_BOARD_BACKGROUND };

  return (
    <main className="tm-root min-h-screen" style={boardBackground}>
      <header className="tm-top-nav">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Public Board</span>
        </div>
        <div className="text-sm text-slate-700">
          {board.name}
        </div>
        <div className="flex justify-end">
          <Link className="tm-button tm-button-secondary" href="/login" prefetch={false}>
            {"\u30ed\u30b0\u30a4\u30f3"}
          </Link>
        </div>
      </header>

      <section className="p-4">
        <div className="tm-view-card mb-4">
          <h1 className="text-2xl font-bold text-slate-900">{board.name}</h1>
          <p className="mt-2 text-sm text-slate-700">{board.description ?? BOARD_COMMON_LABELS.noDescription}</p>
        </div>

        <div className="tm-board-lists-wrap">
          <div className="tm-board-lists">
            {sortedLists.map((list) => (
              <section key={list.id} className="tm-list-column">
                <h2 className="mb-2 text-sm font-semibold text-slate-900">{list.name}</h2>
                <div className="space-y-2">
                  {(cardsByList.get(list.id) ?? []).map((card) => (
                    <button
                      key={card.id}
                      className="tm-card block w-full text-left hover:bg-slate-100"
                      onClick={() => {
                        setSelectedCardId(card.id);
                      }}
                    >
                      <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                      <p className="mt-1 text-xs text-slate-700">
                        {card.due_at ? `Due: ${new Date(card.due_at).toLocaleString("ja-JP")}` : "No due date"}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      {selectedCard ? (
        <div className="fixed inset-0 z-50 bg-slate-950/70 p-4 md:p-8">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-700 p-5">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold">{selectedCard.title}</h2>
                <p className="mt-1 text-xs text-slate-400">{"\u516c\u958b\u30dc\u30fc\u30c9\u3092\u95b2\u89a7\u4e2d"}</p>
              </div>
              <button
                className="tm-button tm-button-secondary"
                onClick={() => {
                  setSelectedCardId(null);
                }}
              >
                {"\u9589\u3058\u308b"}</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <section className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{"\u8aac\u660e"}</p>
                  <p className="mt-1 text-sm text-slate-100 whitespace-pre-wrap">{selectedCard.description || "-"}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{"\u958b\u59cb\u65e5\u6642"}</p>
                    <p className="mt-1 text-sm">{selectedCard.start_at ? new Date(selectedCard.start_at).toLocaleString("ja-JP") : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{"\u671f\u9650"}</p>
                    <p className="mt-1 text-sm">{selectedCard.due_at ? new Date(selectedCard.due_at).toLocaleString("ja-JP") : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{"\u5b8c\u4e86\u72b6\u614b"}</p>
                    <p className="mt-1 text-sm">{selectedCard.is_completed ? "Complete" : "Incomplete"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{"\u30e9\u30d9\u30eb"}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {selectedLabels.map((label) => (
                      <span
                        key={label.id}
                        className="rounded-full border px-2 py-0.5 text-xs"
                        style={{ borderColor: label.color, background: `${label.color}33` }}
                      >
                        {label.name}
                      </span>
                    ))}
                    {!selectedLabels.length ? <span className="text-sm text-slate-400">-</span> : null}
                  </div>
                </div>

                {customFields.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{"\u30ab\u30b9\u30bf\u30e0\u30d5\u30a3\u30fc\u30eb\u30c9"}</p>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2">
                      {customFields
                        .sort((a, b) => a.position - b.position)
                        .map((field) => {
                          const value = selectedCustomValues.find((item) => item.custom_field_id === field.id);
                          return (
                            <div key={field.id} className="rounded border border-slate-700 bg-slate-800 p-2">
                              <p className="text-xs text-slate-400">{field.name}</p>
                              <p className="text-sm">{renderCustomFieldValue(field, value)}</p>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{"\u30c1\u30a7\u30c3\u30af\u30ea\u30b9\u30c8"}</p>
                  <div className="mt-1 space-y-2">
                    {selectedChecklists.map((checklist) => (
                      <div key={checklist.id} className="rounded border border-slate-700 bg-slate-800 p-2">
                        <p className="text-sm font-medium">{checklist.title}</p>
                        <ul className="mt-1 space-y-1 text-sm">
                          {checklistItems
                            .filter((item) => item.checklist_id === checklist.id)
                            .sort((a, b) => a.position - b.position)
                            .map((item) => (
                              <li key={item.id} className={item.is_completed ? "text-slate-400 line-through" : ""}>
                                {item.content}
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                    {!selectedChecklists.length ? <p className="text-sm text-slate-400">-</p> : null}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{"\u30b3\u30e1\u30f3\u30c8"}</p>
                  <div className="mt-1 space-y-2">
                    {selectedComments.map((comment) => (
                      <div key={comment.id} className="rounded border border-slate-700 bg-slate-800 p-2 text-sm">
                        <p>{comment.content}</p>
                        <p className="mt-1 text-xs text-slate-400">{new Date(comment.created_at).toLocaleString("ja-JP")}</p>
                      </div>
                    ))}
                    {!selectedComments.length ? <p className="text-sm text-slate-400">-</p> : null}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{"\u6dfb\u4ed8\u30d5\u30a1\u30a4\u30eb"}</p>
                  <div className="mt-1 space-y-1">
                    {selectedAttachments.map((attachment) => (
                      <div key={attachment.id} className="rounded border border-slate-700 bg-slate-800 p-2 text-sm">
                        {attachment.name} ({attachment.mime_type}, {(attachment.size_bytes / 1024).toFixed(1)}KB)
                      </div>
                    ))}
                    {!selectedAttachments.length ? <p className="text-sm text-slate-400">-</p> : null}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{"\u30a2\u30af\u30c6\u30a3\u30d3\u30c6\u30a3"}</p>
                  <div className="mt-1 space-y-1">
                    {selectedActivities.map((activity) => (
                      <div key={activity.id} className="rounded border border-slate-700 bg-slate-800 p-2 text-sm">
                        <p>{activity.action}</p>
                        <p className="text-xs text-slate-400">{new Date(activity.created_at).toLocaleString("ja-JP")}</p>
                      </div>
                    ))}
                    {!selectedActivities.length ? <p className="text-sm text-slate-400">-</p> : null}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

