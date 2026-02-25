"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";

import type { BoardCard } from "@/components/board/board-types";

type Props = {
  cards: BoardCard[];
  onSelectCard: (cardId: string) => void;
};

function dateKey(isoDate: string) {
  return format(new Date(isoDate), "yyyy-MM-dd");
}

export function CalendarView({ cards, onSelectCard }: Props) {
  const dueCards = cards.filter((card) => card.due_at).sort((a, b) => {
    return new Date(a.due_at ?? 0).valueOf() - new Date(b.due_at ?? 0).valueOf();
  });

  const grouped = new Map<string, BoardCard[]>();
  for (const card of dueCards) {
    const key = dateKey(card.due_at!);
    const list = grouped.get(key) ?? [];
    list.push(card);
    grouped.set(key, list);
  }

  return (
    <div className="surface p-4">
      <h2 className="text-lg font-semibold">カレンダー</h2>
      <div className="mt-3 space-y-3">
        {Array.from(grouped.entries()).map(([day, dayCards]) => (
          <article key={day} className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="font-semibold">
              {format(new Date(day), "M月d日 (EEE)", {
                locale: ja,
              })}
            </h3>
            <div className="mt-2 space-y-2">
              {dayCards.map((card) => (
                <button
                  key={card.id}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100"
                  onClick={() => onSelectCard(card.id)}
                >
                  <p className="font-medium">{card.title}</p>
                  <p className="text-xs muted">
                    期限:{" "}
                    {format(new Date(card.due_at!), "HH:mm", {
                      locale: ja,
                    })}
                  </p>
                </button>
              ))}
            </div>
          </article>
        ))}
        {!dueCards.length ? <p className="text-sm muted">期限付きカードはありません。</p> : null}
      </div>
    </div>
  );
}
