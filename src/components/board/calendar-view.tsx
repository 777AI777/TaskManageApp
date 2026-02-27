"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Clock3 } from "lucide-react";
import { CSSProperties, useMemo, useState } from "react";

import type { BoardCard, BoardCardMeta } from "@/components/board/board-types";
import {
  buildCalendarWeekRows,
  type CalendarScheduledItem,
  type CalendarWeekRow,
  type CalendarWeekSegment,
} from "@/lib/calendar-layout";
import { resolveAvatarColor } from "@/lib/avatar-color";
import { addDays, normalizeRange, startOfDay, startOfWeek, toDayKey } from "@/lib/timeline-utils";

type Props = {
  cards: BoardCard[];
  cardMetaById: Map<string, BoardCardMeta>;
  onSelectCard: (cardId: string) => void;
};

type CalendarMode = "month" | "week";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"];
const CALENDAR_BAR_ROW_HEIGHT_PX = 36;
const CALENDAR_BARS_TOP_OFFSET_PX = 30;
const CALENDAR_BARS_BOTTOM_PADDING_PX = 10;
const CALENDAR_MONTH_ROW_MIN_HEIGHT_PX = 132;
const CALENDAR_WEEK_ROW_MIN_HEIGHT_PX = 210;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}\u5e74${date.getMonth() + 1}\u6708`;
}

function CalendarRangeBar({
  segment,
  meta,
  onSelectCard,
}: {
  segment: CalendarWeekSegment<BoardCard>;
  meta: BoardCardMeta | undefined;
  onSelectCard: (cardId: string) => void;
}) {
  const card = segment.card;
  const dragIdSuffix = `${card.id}:${segment.segmentKey}`;
  const moveDrag = useDraggable({ id: `calendar:move:${dragIdSuffix}` });
  const startResizeDrag = useDraggable({
    id: `calendar:resize-start:${dragIdSuffix}`,
    disabled: !segment.showStartHandle,
  });
  const endResizeDrag = useDraggable({
    id: `calendar:resize-end:${dragIdSuffix}`,
    disabled: !segment.showEndHandle,
  });

  const dragStyle: CSSProperties | undefined = moveDrag.transform
    ? {
        transform: CSS.Translate.toString(moveDrag.transform),
        transition: "transform 140ms cubic-bezier(0.22, 1, 0.36, 1)",
      }
    : undefined;
  const isDragging = moveDrag.isDragging || startResizeDrag.isDragging || endResizeDrag.isDragging;

  return (
    <div
      ref={moveDrag.setNodeRef}
      className={`tm-calendar-bar-shell tm-timeline-bar-shell-${meta?.deadlineState ?? "none"} ${
        isDragging ? "tm-calendar-bar-shell-dragging" : ""
      }`}
      style={dragStyle}
    >
      {segment.showStartHandle ? (
        <button
          ref={startResizeDrag.setNodeRef}
          className="tm-calendar-resize-handle tm-calendar-resize-handle-start"
          type="button"
          aria-label="\u958b\u59cb\u65e5\u3092\u8abf\u6574"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          {...startResizeDrag.listeners}
          {...startResizeDrag.attributes}
        />
      ) : null}

      <button
        className="tm-calendar-bar-main"
        type="button"
        onClick={() => onSelectCard(card.id)}
        title={meta?.dueLabel ? `${card.title} (${meta.dueLabel})` : card.title}
        {...moveDrag.listeners}
        {...moveDrag.attributes}
      >
        <span className="tm-calendar-bar-title">{card.title}</span>
        {meta?.dueLabel ? (
          <span className={`tm-task-state-chip tm-task-state-${meta.deadlineState}`}>
            <Clock3 size={12} />
            <span>{meta.dueLabel}</span>
          </span>
        ) : null}
      </button>

      <div className="tm-calendar-bar-meta">
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

      {segment.showEndHandle ? (
        <button
          ref={endResizeDrag.setNodeRef}
          className="tm-calendar-resize-handle tm-calendar-resize-handle-end"
          type="button"
          aria-label="\u7d42\u4e86\u65e5\u3092\u8abf\u6574"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          {...endResizeDrag.listeners}
          {...endResizeDrag.attributes}
        />
      ) : null}
    </div>
  );
}

function CalendarDayCell({
  day,
  todayKey,
  anchorMonth,
  mode,
  minHeight,
}: {
  day: Date;
  todayKey: string;
  anchorMonth: number;
  mode: CalendarMode;
  minHeight: number;
}) {
  const dayKey = toDayKey(day);
  const isToday = dayKey === todayKey;
  const inCurrentMonth = day.getMonth() === anchorMonth;
  const { setNodeRef, isOver } = useDroppable({
    id: `calendar:day:${dayKey}`,
  });

  return (
    <article
      ref={setNodeRef}
      data-day-key={dayKey}
      className={`tm-calendar-cell ${isToday ? "tm-calendar-cell-today" : ""} ${
        inCurrentMonth || mode === "week" ? "" : "tm-calendar-cell-muted"
      } ${isOver ? "tm-calendar-cell-over" : ""}`}
      style={{ minHeight }}
    >
      <div className="tm-calendar-date-label">{day.getDate()}\u65e5</div>
    </article>
  );
}

function CalendarWeekRowView({
  row,
  todayKey,
  anchorMonth,
  mode,
  cardMetaById,
  onSelectCard,
}: {
  row: CalendarWeekRow<BoardCard>;
  todayKey: string;
  anchorMonth: number;
  mode: CalendarMode;
  cardMetaById: Map<string, BoardCardMeta>;
  onSelectCard: (cardId: string) => void;
}) {
  const laneCount = Math.max(row.laneCount, 1);
  const rowMinHeight = Math.max(
    mode === "week" ? CALENDAR_WEEK_ROW_MIN_HEIGHT_PX : CALENDAR_MONTH_ROW_MIN_HEIGHT_PX,
    CALENDAR_BARS_TOP_OFFSET_PX + laneCount * CALENDAR_BAR_ROW_HEIGHT_PX + CALENDAR_BARS_BOTTOM_PADDING_PX,
  );
  const barsStyle: CSSProperties = {
    top: CALENDAR_BARS_TOP_OFFSET_PX,
    gridTemplateRows: `repeat(${laneCount}, ${CALENDAR_BAR_ROW_HEIGHT_PX}px)`,
  };

  return (
    <div className="tm-calendar-week-row">
      <div className="tm-calendar-week-cells">
        {row.days.map((day) => (
          <CalendarDayCell
            key={toDayKey(day)}
            day={day}
            todayKey={todayKey}
            anchorMonth={anchorMonth}
            mode={mode}
            minHeight={rowMinHeight}
          />
        ))}
      </div>

      <div className="tm-calendar-week-bars" style={barsStyle}>
        {row.segments.map((segment) => (
          <div
            key={`${segment.card.id}:${segment.segmentKey}`}
            className="tm-calendar-week-bar-slot"
            style={{
              gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
              gridRow: `${segment.lane + 1}`,
            }}
          >
            <CalendarRangeBar segment={segment} meta={cardMetaById.get(segment.card.id)} onSelectCard={onSelectCard} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalendarView({ cards, cardMetaById, onSelectCard }: Props) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [todayKey] = useState(() => toDayKey(startOfDay(new Date())));

  const scheduledCards = useMemo<Array<CalendarScheduledItem<BoardCard>>>(() => {
    return cards
      .map((card) => {
        const range = normalizeRange(card.start_at, card.due_at);
        return range ? { card, range } : null;
      })
      .filter((entry): entry is CalendarScheduledItem<BoardCard> => Boolean(entry))
      .sort((a, b) => {
        const byStart = a.range.start.valueOf() - b.range.start.valueOf();
        if (byStart !== 0) return byStart;
        const byEnd = a.range.end.valueOf() - b.range.end.valueOf();
        if (byEnd !== 0) return byEnd;
        return a.card.position - b.card.position;
      });
  }, [cards]);

  const viewDays = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(anchorDate, 0);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }

    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);
    const gridStart = startOfWeek(monthStart, 0);
    const daysInGrid = Math.ceil((monthEnd.valueOf() - gridStart.valueOf() + DAY_MS) / DAY_MS / 7) * 7;
    return Array.from({ length: daysInGrid }, (_, index) => addDays(gridStart, index));
  }, [anchorDate, mode]);

  const weekRows = useMemo(() => buildCalendarWeekRows(viewDays, scheduledCards), [scheduledCards, viewDays]);
  const periodLabel = formatMonthLabel(anchorDate);

  function jumpToToday() {
    setAnchorDate(startOfDay(new Date()));
  }

  function movePeriod(direction: "prev" | "next") {
    setAnchorDate((current) => {
      const multiplier = direction === "prev" ? -1 : 1;
      if (mode === "week") return addDays(current, 7 * multiplier);
      return new Date(current.getFullYear(), current.getMonth() + multiplier, 1);
    });
  }

  return (
    <section className="tm-calendar-surface">
      <header className="tm-view-toolbar">
        <div className="flex items-center gap-2">
          <p className="tm-toolbar-title">{periodLabel}</p>
          <button className="tm-toolbar-button" type="button" onClick={() => movePeriod("prev")}>
            {"<"}
          </button>
          <button className="tm-toolbar-button" type="button" onClick={jumpToToday}>
            {"\u4eca\u65e5"}
          </button>
          <button className="tm-toolbar-button" type="button" onClick={() => movePeriod("next")}>
            {">"}
          </button>
          <select
            className="tm-toolbar-select"
            value={mode}
            onChange={(event) => setMode(event.target.value as CalendarMode)}
          >
            <option value="month">{"\u6708"}</option>
            <option value="week">{"\u9031"}</option>
          </select>
        </div>
        <button className="tm-toolbar-sync" type="button">
          {"\u500b\u4eba\u30ab\u30ec\u30f3\u30c0\u30fc\u3068\u540c\u671f"}
        </button>
      </header>

      <div className={`tm-calendar-grid ${mode === "week" ? "tm-calendar-week" : ""}`}>
        <div className="tm-calendar-weekday-row">
          {WEEKDAY_LABELS.map((weekday) => (
            <div key={weekday} className="tm-calendar-weekday">
              {weekday}
            </div>
          ))}
        </div>

        <div className="tm-calendar-week-rows">
          {weekRows.map((row) => (
            <CalendarWeekRowView
              key={toDayKey(row.weekStart)}
              row={row}
              todayKey={todayKey}
              anchorMonth={anchorDate.getMonth()}
              mode={mode}
              cardMetaById={cardMetaById}
              onSelectCard={onSelectCard}
            />
          ))}
        </div>
      </div>

      {!scheduledCards.length ? <p className="mt-3 text-sm text-slate-500">{"\u65e5\u4ed8\u4ed8\u304d\u30ab\u30fc\u30c9\u304c\u3042\u308a\u307e\u305b\u3093\u3002"}</p> : null}
    </section>
  );
}
