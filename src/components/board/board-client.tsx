"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNowStrict } from "date-fns";
import { ja } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { CalendarView } from "@/components/board/calendar-view";
import { CardDetailDrawer } from "@/components/board/card-detail-drawer";
import type {
  Activity,
  Attachment,
  BoardCard,
  BoardDataBundle,
  BoardList,
  CardAssignee,
  CardComment,
  CardLabel,
  Checklist,
  ChecklistItem,
} from "@/components/board/board-types";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PresenceUser = {
  key: string;
  display: string;
};

type BoardColumnProps = {
  list: BoardList;
  cards: BoardCard[];
  onCardClick: (cardId: string) => void;
  draftTitle: string;
  onDraftChange: (value: string) => void;
  onCreateCard: (event: FormEvent<HTMLFormElement>) => void;
};

function DraggableCard({
  card,
  onCardClick,
}: {
  card: BoardCard;
  onCardClick: (cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;
  const priorityLabel = PRIORITY_OPTIONS.find((option) => option.value === card.priority)?.label ?? card.priority;

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition ${
        isDragging ? "opacity-70" : ""
      }`}
      onClick={() => onCardClick(card.id)}
    >
      <p className="font-medium">{card.title}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="chip">優先度: {priorityLabel}</span>
        {card.due_at ? (
          <span className="chip">
            期限:{" "}
            {formatDistanceToNowStrict(new Date(card.due_at), {
              locale: ja,
              addSuffix: true,
            })}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function BoardColumn({
  list,
  cards,
  onCardClick,
  draftTitle,
  onDraftChange,
  onCreateCard,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `list:${list.id}`,
  });

  return (
    <section
      ref={setNodeRef}
      className={`surface flex w-80 flex-none flex-col p-3 ${isOver ? "ring-2 ring-blue-300" : ""}`}
    >
      <h3 className="mb-2 text-sm font-semibold">
        {list.name} <span className="muted">({cards.length})</span>
      </h3>
      <div className="flex min-h-28 flex-1 flex-col gap-2">
        {cards.map((card) => (
          <DraggableCard key={card.id} card={card} onCardClick={onCardClick} />
        ))}
      </div>
      <form className="mt-3 space-y-2" onSubmit={onCreateCard}>
        <input
          className="input"
          placeholder="カードを追加"
          value={draftTitle}
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <button className="btn btn-secondary w-full" type="submit">
          追加
        </button>
      </form>
    </section>
  );
}

export function BoardClient({ initialData }: { initialData: BoardDataBundle }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const sensors = useSensors(useSensor(PointerSensor));

  const [lists, setLists] = useState(initialData.lists);
  const [cards, setCards] = useState(initialData.cards);
  const [labels, setLabels] = useState(initialData.labels);
  const [cardAssignees, setCardAssignees] = useState(initialData.cardAssignees);
  const [cardLabels, setCardLabels] = useState(initialData.cardLabels);
  const [comments, setComments] = useState(initialData.comments);
  const [checklists, setChecklists] = useState(initialData.checklists);
  const [checklistItems, setChecklistItems] = useState(initialData.checklistItems);
  const [attachments, setAttachments] = useState(initialData.attachments);
  const [activities] = useState(initialData.activities);
  const [cardTitleDrafts, setCardTitleDrafts] = useState<Record<string, string>>({});
  const [newListName, setNewListName] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#64748b");
  const [listSaving, setListSaving] = useState(false);
  const [labelSaving, setLabelSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "calendar">("board");
  const [query, setQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterLabel, setFilterLabel] = useState<string>("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sortedLists = useMemo(() => [...lists].sort((a, b) => a.position - b.position), [lists]);
  const selectedCard = cards.find((card) => card.id === selectedCardId) ?? null;

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (query && !`${card.title} ${card.description ?? ""}`.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      if (filterPriority && card.priority !== filterPriority) {
        return false;
      }
      if (filterAssignee) {
        const assignees = cardAssignees.filter((item) => item.card_id === card.id).map((item) => item.user_id);
        if (!assignees.includes(filterAssignee)) {
          return false;
        }
      }
      if (filterLabel) {
        const labelList = cardLabels.filter((item) => item.card_id === card.id).map((item) => item.label_id);
        if (!labelList.includes(filterLabel)) {
          return false;
        }
      }
      return !card.archived;
    });
  }, [cards, query, filterPriority, filterAssignee, filterLabel, cardAssignees, cardLabels]);

  const cardsByList = useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    for (const list of sortedLists) {
      map.set(list.id, []);
    }
    for (const card of filteredCards.sort((a, b) => a.position - b.position)) {
      const bucket = map.get(card.list_id);
      if (bucket) {
        bucket.push(card);
      }
    }
    return map;
  }, [sortedLists, filteredCards]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      channel = supabase.channel(`board:${initialData.board.id}`, {
        config: { presence: { key: user?.id ?? crypto.randomUUID() } },
      });

      channel.on("presence", { event: "sync" }, () => {
        if (!channel || !active) {
          return;
        }
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        Object.keys(state).forEach((key) => {
          const entries = state[key] as Array<{ display?: string; email?: string }> | undefined;
          const first = entries?.[0];
          users.push({
            key,
            display: first?.display ?? first?.email ?? key,
          });
        });
        setPresenceUsers(users);
      });

      const refreshOnChange = () => router.refresh();
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${initialData.board.id}` },
          refreshOnChange,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "lists", filter: `board_id=eq.${initialData.board.id}` },
          refreshOnChange,
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, refreshOnChange)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "activities", filter: `board_id=eq.${initialData.board.id}` },
          refreshOnChange,
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, refreshOnChange);

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user) {
          await channel?.track({
            display: user.user_metadata?.display_name ?? user.email,
            email: user.email,
          });
        }
      });
    }

    void subscribe();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [initialData.board.id, router, supabase]);

  function updateCardInState(updatedCard: BoardCard) {
    setCards((current) => current.map((card) => (card.id === updatedCard.id ? updatedCard : card)));
  }

  async function handleCreateList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newListName.trim()) {
      return;
    }
    setListSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: initialData.board.id,
          name: newListName,
          position: Date.now(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "リスト作成に失敗しました。");
      }
      setLists((current) => [...current, body.data]);
      setNewListName("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "リスト作成に失敗しました。");
    } finally {
      setListSaving(false);
    }
  }

  async function handleCreateLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newLabelName.trim()) {
      return;
    }
    setLabelSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/boards/${initialData.board.id}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLabelName,
          color: newLabelColor,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "ラベル作成に失敗しました。");
      }
      setLabels((current) => [...current, body.data]);
      setNewLabelName("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ラベル作成に失敗しました。");
    } finally {
      setLabelSaving(false);
    }
  }

  async function createCard(listId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = (cardTitleDrafts[listId] ?? "").trim();
    if (!title) {
      return;
    }
    setError(null);
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: initialData.board.id,
          listId,
          title,
          position: Date.now(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "カード作成に失敗しました。");
      }
      setCards((current) => [...current, body.data]);
      setCardTitleDrafts((current) => ({ ...current, [listId]: "" }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "カード作成に失敗しました。");
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) {
      return;
    }

    const movingCard = cards.find((card) => card.id === activeId);
    if (!movingCard) {
      return;
    }

    const overCard = cards.find((card) => card.id === overId);
    const targetListId = overId.startsWith("list:") ? overId.replace("list:", "") : overCard?.list_id;
    if (!targetListId) {
      return;
    }

    const targetPosition =
      overCard && overCard.id !== movingCard.id ? overCard.position - 1 : Date.now();

    const previous = cards;
    setCards((current) =>
      current.map((card) =>
        card.id === movingCard.id ? { ...card, list_id: targetListId, position: targetPosition } : card,
      ),
    );

    try {
      const response = await fetch(`/api/cards/${movingCard.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId: targetListId,
          position: targetPosition,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "カード移動に失敗しました。");
      }
    } catch (dragError) {
      setCards(previous);
      setError(dragError instanceof Error ? dragError.message : "カード移動に失敗しました。");
    }
  }

  return (
    <main className="space-y-4">
      <section className="surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="chip mb-2 inline-flex">{initialData.workspace.name}</p>
            <h1 className="text-2xl font-bold">{initialData.board.name}</h1>
            <p className="mt-1 text-sm muted">{initialData.board.description ?? "説明なし"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="btn btn-secondary"
              href={`/app/workspaces/${initialData.workspace.id}/boards/${initialData.board.id}/automation`}
            >
              自動化ルール
            </Link>
            <Link className="btn btn-secondary" href={`/app/workspaces/${initialData.workspace.id}`}>
              ワークスペースへ
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="input"
            placeholder="検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select className="input h-11" value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)}>
            <option value="">優先度: 全て</option>
            {PRIORITY_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select className="input h-11" value={filterAssignee} onChange={(event) => setFilterAssignee(event.target.value)}>
            <option value="">担当者: 全て</option>
            {initialData.members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.profile?.display_name ?? member.profile?.email ?? member.user_id}
              </option>
            ))}
          </select>
          <select className="input h-11" value={filterLabel} onChange={(event) => setFilterLabel(event.target.value)}>
            <option value="">ラベル: 全て</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              className={`btn ${viewMode === "board" ? "btn-primary" : "btn-secondary"} flex-1`}
              onClick={() => setViewMode("board")}
            >
              ボード
            </button>
            <button
              className={`btn ${viewMode === "calendar" ? "btn-primary" : "btn-secondary"} flex-1`}
              onClick={() => setViewMode("calendar")}
            >
              カレンダー
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-sm muted">在席:</span>
          {presenceUsers.map((presenceUser) => (
            <span key={presenceUser.key} className="chip">
              {presenceUser.display}
            </span>
          ))}
          {!presenceUsers.length ? <span className="text-sm muted">表示中ユーザーなし</span> : null}
        </div>
      </section>

      {viewMode === "calendar" ? (
        <CalendarView cards={filteredCards} onSelectCard={setSelectedCardId} />
      ) : (
        <section className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <form className="surface flex flex-wrap items-center gap-2 p-3" onSubmit={handleCreateList}>
              <input
                className="input min-w-[220px] flex-1"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="新しいリスト名"
              />
              <button className="btn btn-secondary" type="submit" disabled={listSaving}>
                {listSaving ? "作成中..." : "リスト追加"}
              </button>
            </form>
            <form className="surface flex flex-wrap items-center gap-2 p-3" onSubmit={handleCreateLabel}>
              <input
                className="input min-w-[160px] flex-1"
                value={newLabelName}
                onChange={(event) => setNewLabelName(event.target.value)}
                placeholder="新しいラベル"
              />
              <input
                className="input h-11 w-16 p-1"
                type="color"
                value={newLabelColor}
                onChange={(event) => setNewLabelColor(event.target.value)}
              />
              <button className="btn btn-secondary" type="submit" disabled={labelSaving}>
                {labelSaving ? "作成中..." : "ラベル追加"}
              </button>
            </form>
          </div>
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {sortedLists.map((list) => (
                <BoardColumn
                  key={list.id}
                  list={list}
                  cards={cardsByList.get(list.id) ?? []}
                  onCardClick={setSelectedCardId}
                  draftTitle={cardTitleDrafts[list.id] ?? ""}
                  onDraftChange={(value) =>
                    setCardTitleDrafts((current) => ({
                      ...current,
                      [list.id]: value,
                    }))
                  }
                  onCreateCard={(event) => createCard(list.id, event)}
                />
              ))}
            </div>
          </DndContext>
        </section>
      )}

      <section className="surface p-4">
        <h2 className="text-lg font-semibold">アクティビティ</h2>
        <div className="mt-3 space-y-2">
          {activities.slice(0, 20).map((activity: Activity) => (
            <article key={activity.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-sm font-medium">{activity.action}</p>
              <p className="text-xs muted">{new Date(activity.created_at).toLocaleString("ja-JP")}</p>
            </article>
          ))}
          {!activities.length ? <p className="text-sm muted">アクティビティはありません。</p> : null}
        </div>
      </section>

      {selectedCard ? (
        <CardDetailDrawer
          workspaceId={initialData.workspace.id}
          boardId={initialData.board.id}
          card={selectedCard}
          members={initialData.members}
          labels={labels}
          cardAssignees={cardAssignees}
          cardLabels={cardLabels}
          comments={comments}
          checklists={checklists}
          checklistItems={checklistItems}
          attachments={attachments}
          onClose={() => setSelectedCardId(null)}
          onCardPatched={(updatedCard) => {
            updateCardInState(updatedCard);
          }}
          onCardRelationshipPatched={(nextAssigneeIds, nextLabelIds) => {
            setCardAssignees((current) => [
              ...current.filter((item: CardAssignee) => item.card_id !== selectedCard.id),
              ...nextAssigneeIds.map((userId) => ({ card_id: selectedCard.id, user_id: userId })),
            ]);
            setCardLabels((current) => [
              ...current.filter((item: CardLabel) => item.card_id !== selectedCard.id),
              ...nextLabelIds.map((labelId) => ({ card_id: selectedCard.id, label_id: labelId })),
            ]);
          }}
          onCommentCreated={(comment: CardComment) => setComments((current) => [...current, comment])}
          onChecklistCreated={(checklist: Checklist) => setChecklists((current) => [...current, checklist])}
          onChecklistItemCreated={(item: ChecklistItem) =>
            setChecklistItems((current) => [...current, item])
          }
          onChecklistItemPatched={(item: ChecklistItem) =>
            setChecklistItems((current) => current.map((value) => (value.id === item.id ? item : value)))
          }
          onAttachmentCreated={(attachment: Attachment) =>
            setAttachments((current) => [...current, attachment])
          }
        />
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      ) : null}
    </main>
  );
}
