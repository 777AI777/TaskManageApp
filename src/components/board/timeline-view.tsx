"use client";

import { useDndMonitor, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Clock3 } from "lucide-react";
import { CSSProperties, FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import type { BoardCard, BoardCardMeta, BoardList } from "@/components/board/board-types";
import { resolveAvatarColor } from "@/lib/avatar-color";
import {
  addDays,
  dayDiff,
  isWeekend,
  normalizeRange,
  startOfDay,
  startOfWeek,
  TIMELINE_DAY_WIDTH_PX,
  toDayKey,
  utcDayIndex,
} from "@/lib/timeline-utils";

type Props = {
  cards: BoardCard[];
  lists: BoardList[];
  cardMetaById: Map<string, BoardCardMeta>;
  onSelectCard: (cardId: string) => void;
  onCreateUnscheduledCard: (listId: string, title: string) => Promise<void>;
  onPlaceUnscheduledCard: (cardId: string, listId: string, dayKey: string) => Promise<void>;
};

type TimelineScale = "week";

type PositionedCard = {
  card: BoardCard;
  range: { start: Date; end: Date };
  lane: number;
};

type RowData = {
  list: BoardList;
  scheduled: PositionedCard[];
  unscheduled: BoardCard[];
  laneCount: number;
};

const LANE_HEIGHT = 38;
const TRACK_MIN_HEIGHT = 56;
const WEEKDAY_LABELS = ["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"];

function formatMonthLabel(date: Date) {
  return `${date.getMonth() + 1}\u6708 ${date.getFullYear()}`;
}

function TimelineDayDropCell({
  listId,
  day,
  todayKey,
  placementActive,
}: {
  listId: string;
  day: Date;
  todayKey: string;
  placementActive: boolean;
}) {
  const dayKey = toDayKey(day);
  const { setNodeRef, isOver } = useDroppable({
    id: `timeline:day:${listId}:${dayKey}`,
  });
  const weekend = isWeekend(day);
  const isToday = dayKey === todayKey;

  return (
    <div
      ref={setNodeRef}
      className={`tm-timeline-day-cell ${weekend ? "tm-timeline-day-cell-weekend" : ""} ${
        isToday ? "tm-timeline-day-cell-today" : ""
      } ${isOver ? "tm-timeline-day-cell-over" : ""} ${placementActive ? "tm-timeline-day-cell-placeable" : ""}`}
      aria-label={`Drop on ${dayKey}`}
    />
  );
}

function TimelineBar({
  card,
  meta,
  left,
  width,
  top,
  onSelectCard,
}: {
  card: BoardCard;
  meta: BoardCardMeta | undefined;
  left: number;
  width: number;
  top: number;
  onSelectCard: (cardId: string) => void;
}) {
  const moveDrag = useDraggable({ id: `timeline:move:${card.id}` });
  const startResizeDrag = useDraggable({ id: `timeline:resize-start:${card.id}` });
  const endResizeDrag = useDraggable({ id: `timeline:resize-end:${card.id}` });

  const dragStyle: CSSProperties | undefined = moveDrag.transform
    ? { transform: CSS.Translate.toString(moveDrag.transform) }
    : undefined;
  const isDragging = moveDrag.isDragging || startResizeDrag.isDragging || endResizeDrag.isDragging;

  return (
    <div
      ref={moveDrag.setNodeRef}
      className={`tm-timeline-bar-shell tm-timeline-bar-shell-${meta?.deadlineState ?? "none"} ${
        isDragging ? "tm-timeline-bar-shell-dragging" : ""
      }`}
      style={{ left, width, top, ...dragStyle }}
    >
      <button
        ref={startResizeDrag.setNodeRef}
        className="tm-timeline-resize-handle tm-timeline-resize-handle-start"
        type="button"
        aria-label="Resize start"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        {...startResizeDrag.listeners}
        {...startResizeDrag.attributes}
      />

      <button
        className="tm-timeline-bar-main"
        type="button"
        onClick={() => onSelectCard(card.id)}
        {...moveDrag.listeners}
        {...moveDrag.attributes}
      >
        <span className="tm-timeline-bar-title">{card.title}</span>
        {meta?.dueLabel ? (
          <span className={`tm-task-state-chip tm-task-state-${meta.deadlineState}`}>
            <Clock3 size={12} />
            <span>{meta.dueLabel}</span>
          </span>
        ) : null}
      </button>

      <div className="tm-timeline-bar-meta">
{meta?.assigneePrimary ? (
          <span className="tm-task-assignee-pill tm-task-assignee-pill-compact" title={meta.assigneeTooltip ?? undefined}>
            <span className="tm-task-assignee-initial" style={{ backgroundColor: resolveAvatarColor(meta.assigneeColor) }}>
              {meta.assigneeInitial ?? "?"}
            </span>
            {meta.assigneeExtraCount > 0 ? (
              <span className="tm-task-assignee-extra">+{meta.assigneeExtraCount}</span>
            ) : null}
          </span>
        ) : null}
      </div>

      <button
        ref={endResizeDrag.setNodeRef}
        className="tm-timeline-resize-handle tm-timeline-resize-handle-end"
        type="button"
        aria-label="Resize end"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        {...endResizeDrag.listeners}
        {...endResizeDrag.attributes}
      />
    </div>
  );
}

function parsePlacementDragId(id: string): string | null {
  const match = /^timeline:place:([^:]+)$/.exec(id);
  return match ? match[1] : null;
}

function parseTimelineDayDropId(id: string): { listId: string; dayKey: string } | null {
  const match = /^timeline:day:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (!match) return null;
  return {
    listId: match[1],
    dayKey: match[2],
  };
}

function PlacementDraggableCard({
  card,
  disabled,
}: {
  card: BoardCard;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `timeline:place:${card.id}`,
    disabled,
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <button
      ref={setNodeRef}
      className={`tm-timeline-placement-item ${isDragging ? "tm-timeline-placement-item-dragging" : ""}`}
      type="button"
      style={style}
      disabled={disabled}
      {...listeners}
      {...attributes}
    >
      {card.title}
    </button>
  );
}

export function TimelineView({
  cards,
  lists,
  cardMetaById,
  onSelectCard,
  onCreateUnscheduledCard,
  onPlaceUnscheduledCard,
}: Props) {
  const [scale] = useState<TimelineScale>("week");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [activeListId, setActiveListId] = useState<string | null>(lists[0]?.id ?? null);

  const [quickAddListId, setQuickAddListId] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  const [placementListId, setPlacementListId] = useState<string | null>(null);
  const [placementSubmitting, setPlacementSubmitting] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);

  const quickAddRef = useRef<HTMLFormElement | null>(null);
  const placementRef = useRef<HTMLDivElement | null>(null);

  const todayKey = toDayKey(startOfDay(new Date()));
  const periodLabel = formatMonthLabel(anchorDate);

  useEffect(() => {
    if (!activeListId && lists.length > 0) {
      setActiveListId(lists[0].id);
    }
    if (activeListId && !lists.some((list) => list.id === activeListId)) {
      setActiveListId(lists[0]?.id ?? null);
    }
  }, [activeListId, lists]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (quickAddListId && !quickAddRef.current?.contains(event.target as Node)) {
        setQuickAddListId(null);
        setQuickAddError(null);
        setQuickAddTitle("");
      }
      if (placementListId && !placementRef.current?.contains(event.target as Node)) {
        setPlacementListId(null);
        setPlacementError(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setQuickAddListId(null);
      setQuickAddError(null);
      setQuickAddTitle("");
      setPlacementListId(null);
      setPlacementError(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [placementListId, quickAddListId]);

  const { rangeStart, days } = useMemo(() => {
    if (scale === "week") {
      const start = startOfWeek(anchorDate, 0);
      return {
        rangeStart: start,
        days: Array.from({ length: 14 }, (_, index) => addDays(start, index)),
      };
    }

    return { rangeStart: startOfDay(anchorDate), days: [] };
  }, [anchorDate, scale]);

  const trackWidth = days.length * TIMELINE_DAY_WIDTH_PX;
  const headerGridStyle: CSSProperties = {
    width: trackWidth,
    gridTemplateColumns: `repeat(${days.length}, ${TIMELINE_DAY_WIDTH_PX}px)`,
  };

  const rows = useMemo<RowData[]>(() => {
    return lists.map((list) => {
      const cardsInList = cards.filter((card) => card.list_id === list.id);
      const unscheduled: BoardCard[] = [];
      const scheduledRanges = cardsInList
        .map((card) => {
          const range = normalizeRange(card.start_at, card.due_at);
          return range ? { card, range } : null;
        })
        .filter((entry): entry is { card: BoardCard; range: { start: Date; end: Date } } => Boolean(entry))
        .sort((a, b) => {
          const byStart = dayDiff(a.range.start, b.range.start);
          if (byStart !== 0) return byStart;
          return a.card.position - b.card.position;
        });

      cardsInList.forEach((card) => {
        if (!normalizeRange(card.start_at, card.due_at)) unscheduled.push(card);
      });

      const laneEnds: number[] = [];
      const scheduled: PositionedCard[] = scheduledRanges.map((entry) => {
        const startIndex = utcDayIndex(entry.range.start);
        const endIndex = utcDayIndex(entry.range.end);
        let lane = laneEnds.findIndex((laneEnd) => startIndex > laneEnd);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(endIndex);
        } else {
          laneEnds[lane] = endIndex;
        }
        return {
          card: entry.card,
          range: entry.range,
          lane,
        };
      });

      return {
        list,
        scheduled,
        unscheduled: [...unscheduled].sort((a, b) => a.position - b.position),
        laneCount: Math.max(1, laneEnds.length),
      };
    });
  }, [cards, lists]);

  const placementRow = placementListId ? rows.find((row) => row.list.id === placementListId) ?? null : null;
  const floatingTargetListId = activeListId ?? lists[0]?.id ?? null;
  const placementActive = Boolean(placementListId);

  function moveTimeline(direction: "prev" | "next") {
    setAnchorDate((current) => addDays(current, direction === "prev" ? -7 : 7));
  }

  function jumpToday() {
    setAnchorDate(startOfDay(new Date()));
  }

  function openQuickAdd(listId: string) {
    setActiveListId(listId);
    setQuickAddListId(listId);
    setQuickAddTitle("");
    setQuickAddError(null);
    setPlacementListId(null);
    setPlacementError(null);
  }

  function openPlacementPanel(listId: string) {
    setActiveListId(listId);
    setPlacementListId(listId);
    setPlacementError(null);
    setQuickAddListId(null);
    setQuickAddTitle("");
    setQuickAddError(null);
  }

  async function submitQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetListId = quickAddListId;
    if (!targetListId) return;
    const title = quickAddTitle.trim();
    if (!title) {
      setQuickAddError("\u30bf\u30a4\u30c8\u30eb\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }

    setQuickAddSubmitting(true);
    setQuickAddError(null);
    try {
      await onCreateUnscheduledCard(targetListId, title);
      setQuickAddSubmitting(false);
      setQuickAddListId(null);
      setQuickAddTitle("");
    } catch (error) {
      setQuickAddSubmitting(false);
      setQuickAddError(
        error instanceof Error ? error.message : "\u30ab\u30fc\u30c9\u4f5c\u6210\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002",
      );
    }
  }

  useDndMonitor({
    onDragEnd: (event) => {
      if (!placementListId || placementSubmitting) return;
      const activeId = event.active?.id ? String(event.active.id) : "";
      const overId = event.over?.id ? String(event.over.id) : "";
      const cardId = parsePlacementDragId(activeId);
      const dayTarget = parseTimelineDayDropId(overId);
      if (!cardId || !dayTarget) return;

      setPlacementSubmitting(true);
      setPlacementError(null);
      void onPlaceUnscheduledCard(cardId, dayTarget.listId, dayTarget.dayKey)
        .then(() => {
          setPlacementListId(null);
          setActiveListId(dayTarget.listId);
        })
        .catch((error) => {
          setPlacementError(
            error instanceof Error ? error.message : "\u672a\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb\u306e\u914d\u7f6e\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002",
          );
        })
        .finally(() => {
          setPlacementSubmitting(false);
        });
    },
  });

  return (
    <section className="tm-timeline-surface">
      <header className="tm-timeline-topbar">
        <div className="tm-timeline-topbar-group">
          <p className="tm-timeline-period-label">{periodLabel}</p>
          <button className="tm-timeline-nav-button" type="button" onClick={() => moveTimeline("prev")}>
            {"<"}
          </button>
          <button className="tm-timeline-nav-button" type="button" onClick={jumpToday}>
            {"\u4eca\u65e5"}
          </button>
          <button className="tm-timeline-nav-button" type="button" onClick={() => moveTimeline("next")}>
            {">"}
          </button>
        </div>

        <div className="tm-timeline-topbar-group">
          <span className="tm-timeline-chip">{"\u9031"}</span>
          <span className="tm-timeline-chip">{"\u30ea\u30b9\u30c8"}</span>
        </div>
      </header>

      <div className="tm-timeline-scroll">
        <div className="tm-timeline-grid-head">
          <div className="tm-timeline-list-col-head">{"\u30ea\u30b9\u30c8"}</div>
          <div className="tm-timeline-track-head" style={headerGridStyle}>
            {days.map((day) => {
              const dayKey = toDayKey(day);
              const weekend = isWeekend(day);
              const isToday = dayKey === todayKey;
              return (
                <div
                  key={dayKey}
                  className={`tm-timeline-date-cell ${weekend ? "tm-timeline-date-cell-weekend" : ""} ${
                    isToday ? "tm-timeline-date-cell-today" : ""
                  }`}
                >
                  <span className="tm-timeline-date-weekday">{WEEKDAY_LABELS[day.getDay()]}</span>
                  <span className="tm-timeline-date-number">
                    {day.getDate()}
                    {"\u65e5"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {rows.map((row) => {
          const rowTrackHeight = Math.max(TRACK_MIN_HEIGHT, row.laneCount * LANE_HEIGHT + 16);
          return (
            <div
              key={row.list.id}
              className={`tm-timeline-grid-row ${activeListId === row.list.id ? "tm-timeline-grid-row-active" : ""}`}
              onMouseEnter={() => setActiveListId(row.list.id)}
            >
              <div className="tm-timeline-list-col">
                <p className="tm-timeline-list-name">{row.list.name}</p>
                <div className="tm-timeline-unscheduled-wrap">
                  <UnscheduledDrop listId={row.list.id}>
                    {(isOver) => (
                      <span className={`tm-timeline-unscheduled-pill ${isOver ? "tm-timeline-unscheduled-pill-over" : ""}`}>
                        {"\u672a\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb"} ({row.unscheduled.length})
                      </span>
                    )}
                  </UnscheduledDrop>
                  <button
                    className="tm-timeline-unscheduled-plus"
                    type="button"
                    onClick={() => openPlacementPanel(row.list.id)}
                    aria-label="Open unscheduled placement mode"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="tm-timeline-track" style={{ width: trackWidth, minHeight: rowTrackHeight }}>
                <div className="tm-timeline-day-grid" style={headerGridStyle}>
                  {days.map((day) => (
                    <TimelineDayDropCell
                      key={`${row.list.id}:${toDayKey(day)}`}
                      listId={row.list.id}
                      day={day}
                      todayKey={todayKey}
                      placementActive={placementActive}
                    />
                  ))}
                </div>

                {row.scheduled.map((item) => {
                  const startOffset = dayDiff(rangeStart, item.range.start);
                  const endOffset = dayDiff(rangeStart, item.range.end);
                  const visibleStart = Math.max(startOffset, 0);
                  const visibleEnd = Math.min(endOffset, days.length - 1);
                  if (visibleEnd < 0 || visibleStart > days.length - 1 || visibleEnd < visibleStart) {
                    return null;
                  }

                  const left = visibleStart * TIMELINE_DAY_WIDTH_PX + 4;
                  const width = Math.max((visibleEnd - visibleStart + 1) * TIMELINE_DAY_WIDTH_PX - 8, 70);
                  const top = 8 + item.lane * LANE_HEIGHT;

                  return (
                    <TimelineBar
                      key={item.card.id}
                      card={item.card}
                      meta={cardMetaById.get(item.card.id)}
                      left={left}
                      width={width}
                      top={top}
                      onSelectCard={onSelectCard}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {quickAddListId ? (
        <form ref={quickAddRef} className="tm-timeline-quick-add-pop tm-timeline-quick-add-pop-floating" onSubmit={submitQuickAdd}>
          <div className="tm-timeline-quick-add-head">
            <p>{"\u672a\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb\u3092\u8ffd\u52a0"}</p>
            <button
              type="button"
              onClick={() => {
                setQuickAddListId(null);
                setQuickAddTitle("");
                setQuickAddError(null);
              }}
            >
              {"\u00d7"}
            </button>
          </div>
          <input
            className="tm-timeline-quick-add-input"
            value={quickAddTitle}
            onChange={(event) => setQuickAddTitle(event.target.value)}
            placeholder="ex: test"
            autoFocus
          />
          {quickAddError ? <p className="tm-timeline-quick-add-error">{quickAddError}</p> : null}
          <div className="tm-timeline-quick-add-actions">
            <button className="tm-button tm-button-primary" type="submit" disabled={quickAddSubmitting}>
              {quickAddSubmitting ? "..." : "\u8ffd\u52a0"}
            </button>
          </div>
        </form>
      ) : null}

      {placementListId ? (
        <div ref={placementRef} className="tm-timeline-placement-pop">
          <div className="tm-timeline-placement-head">
            <p>{"\u672a\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb\u3092\u914d\u7f6e"}</p>
            <button
              type="button"
              onClick={() => {
                setPlacementListId(null);
                setPlacementError(null);
              }}
            >
              {"\u00d7"}
            </button>
          </div>

          <div className="tm-timeline-placement-list">
            {(placementRow?.unscheduled ?? []).map((card) => (
              <PlacementDraggableCard
                key={card.id}
                card={card}
                disabled={placementSubmitting}
              />
            ))}

            {!placementRow?.unscheduled.length ? (
              <p className="tm-timeline-placement-empty">{"\u672a\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb\u306e\u30ab\u30fc\u30c9\u304c\u3042\u308a\u307e\u305b\u3093\u3002"}</p>
            ) : null}
          </div>

          {placementError ? <p className="tm-timeline-quick-add-error">{placementError}</p> : null}
          <p className="tm-timeline-placement-help">
            {"\u4e0a\u306e\u30ab\u30fc\u30c9\u3092\u30c9\u30e9\u30c3\u30b0\u3057\u3066\u3001\u30bf\u30a4\u30e0\u30e9\u30a4\u30f3\u306e\u65e5\u4ed8\u30bb\u30eb\u306b\u30c9\u30ed\u30c3\u30d7\u3057\u3066\u304f\u3060\u3055\u3044\u3002"}
          </p>
        </div>
      ) : null}

      {floatingTargetListId ? (
        <button className="tm-timeline-floating-add" type="button" onClick={() => openQuickAdd(floatingTargetListId)}>
          <span>+</span>
          <span>{"\u8ffd\u52a0"}</span>
        </button>
      ) : null}

      {!cards.length ? (
        <p className="tm-timeline-empty">{"\u8868\u793a\u3067\u304d\u308b\u30ab\u30fc\u30c9\u304c\u3042\u308a\u307e\u305b\u3093\u3002"}</p>
      ) : null}
    </section>
  );
}

function UnscheduledDrop({
  listId,
  children,
}: {
  listId: string;
  children: (isOver: boolean) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeline:unscheduled:${listId}`,
  });

  return (
    <div ref={setNodeRef} className="tm-timeline-unscheduled-drop">
      {children(isOver)}
    </div>
  );
}

