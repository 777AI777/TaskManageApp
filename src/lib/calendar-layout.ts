import { dayDiff, toDayKey, type TimelineRange } from "@/lib/timeline-utils";

const DAYS_PER_WEEK = 7;

export type CalendarCardIdentity = {
  id: string;
  position: number;
};

export type CalendarScheduledItem<TCard extends CalendarCardIdentity> = {
  card: TCard;
  range: TimelineRange;
};

export type CalendarWeekSegment<TCard extends CalendarCardIdentity> = {
  card: TCard;
  range: TimelineRange;
  segmentKey: string;
  segmentStart: Date;
  segmentEnd: Date;
  startCol: number;
  endCol: number;
  lane: number;
  showStartHandle: boolean;
  showEndHandle: boolean;
};

export type CalendarWeekRow<TCard extends CalendarCardIdentity> = {
  weekStart: Date;
  weekEnd: Date;
  days: Date[];
  laneCount: number;
  segments: Array<CalendarWeekSegment<TCard>>;
};

function toWeekRows(days: Date[]): Date[][] {
  const rows: Date[][] = [];
  for (let index = 0; index < days.length; index += DAYS_PER_WEEK) {
    rows.push(days.slice(index, index + DAYS_PER_WEEK));
  }
  return rows.filter((row) => row.length > 0);
}

function sortScheduledItems<TCard extends CalendarCardIdentity>(items: Array<CalendarScheduledItem<TCard>>) {
  return [...items].sort((a, b) => {
    const byStart = a.range.start.valueOf() - b.range.start.valueOf();
    if (byStart !== 0) return byStart;
    const byEnd = a.range.end.valueOf() - b.range.end.valueOf();
    if (byEnd !== 0) return byEnd;
    const byPosition = a.card.position - b.card.position;
    if (byPosition !== 0) return byPosition;
    return a.card.id.localeCompare(b.card.id);
  });
}

export function buildCalendarWeekRows<TCard extends CalendarCardIdentity>(
  days: Date[],
  scheduledItems: Array<CalendarScheduledItem<TCard>>,
): Array<CalendarWeekRow<TCard>> {
  const weekRows = toWeekRows(days);
  const sortedItems = sortScheduledItems(scheduledItems);

  return weekRows.map((weekDays) => {
    const weekStart = weekDays[0];
    const weekEnd = weekDays[weekDays.length - 1];
    const maxCol = weekDays.length - 1;
    const laneEnds: number[] = [];
    const segments: Array<CalendarWeekSegment<TCard>> = [];

    sortedItems.forEach((item) => {
      if (item.range.end.valueOf() < weekStart.valueOf() || item.range.start.valueOf() > weekEnd.valueOf()) {
        return;
      }

      const segmentStart =
        item.range.start.valueOf() < weekStart.valueOf() ? weekStart : item.range.start;
      const segmentEnd = item.range.end.valueOf() > weekEnd.valueOf() ? weekEnd : item.range.end;

      const startCol = Math.max(dayDiff(weekStart, segmentStart), 0);
      const endCol = Math.min(dayDiff(weekStart, segmentEnd), maxCol);

      let lane = laneEnds.findIndex((laneEnd) => startCol > laneEnd);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(endCol);
      } else {
        laneEnds[lane] = endCol;
      }

      segments.push({
        card: item.card,
        range: item.range,
        segmentKey: `${toDayKey(weekStart)}_${startCol}_${endCol}`,
        segmentStart,
        segmentEnd,
        startCol,
        endCol,
        lane,
        showStartHandle: segmentStart.valueOf() === item.range.start.valueOf(),
        showEndHandle: segmentEnd.valueOf() === item.range.end.valueOf(),
      });
    });

    return {
      weekStart,
      weekEnd,
      days: weekDays,
      laneCount: laneEnds.length,
      segments,
    };
  });
}
