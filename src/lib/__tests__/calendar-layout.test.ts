import { describe, expect, it } from "vitest";

import { buildCalendarWeekRows, type CalendarScheduledItem } from "@/lib/calendar-layout";
import { addDays, toDayKey } from "@/lib/timeline-utils";

type TestCard = {
  id: string;
  position: number;
};

function makeDays(start: Date, length: number): Date[] {
  return Array.from({ length }, (_, index) => addDays(start, index));
}

function makeItem(
  cardId: string,
  position: number,
  start: Date,
  end: Date,
): CalendarScheduledItem<TestCard> {
  return {
    card: { id: cardId, position },
    range: { start, end },
  };
}

describe("calendar-layout", () => {
  it("builds one segment for a one-day card", () => {
    const days = makeDays(new Date(2026, 2, 1), 7);
    const rows = buildCalendarWeekRows(days, [makeItem("a", 1, new Date(2026, 2, 3), new Date(2026, 2, 3))]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.segments).toHaveLength(1);
    expect(rows[0]?.segments[0]).toMatchObject({
      startCol: 2,
      endCol: 2,
      showStartHandle: true,
      showEndHandle: true,
      lane: 0,
    });
  });

  it("keeps same-week multi-day card as one horizontal segment", () => {
    const days = makeDays(new Date(2026, 2, 1), 7);
    const rows = buildCalendarWeekRows(days, [makeItem("a", 1, new Date(2026, 2, 2), new Date(2026, 2, 5))]);
    const segment = rows[0]?.segments[0];
    expect(segment).toBeDefined();
    expect(segment?.startCol).toBe(1);
    expect(segment?.endCol).toBe(4);
  });

  it("splits a spanning card into week segments", () => {
    const days = makeDays(new Date(2026, 2, 1), 14);
    const rows = buildCalendarWeekRows(days, [makeItem("a", 1, new Date(2026, 2, 5), new Date(2026, 2, 10))]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.segments).toHaveLength(1);
    expect(rows[1]?.segments).toHaveLength(1);

    expect(rows[0]?.segments[0]).toMatchObject({
      startCol: 4,
      endCol: 6,
      showStartHandle: true,
      showEndHandle: false,
    });
    expect(rows[1]?.segments[0]).toMatchObject({
      startCol: 0,
      endCol: 2,
      showStartHandle: false,
      showEndHandle: true,
    });
  });

  it("assigns different lanes for overlapping cards and reuses lane when possible", () => {
    const days = makeDays(new Date(2026, 2, 1), 7);
    const rows = buildCalendarWeekRows(days, [
      makeItem("a", 1, new Date(2026, 2, 2), new Date(2026, 2, 4)),
      makeItem("b", 2, new Date(2026, 2, 3), new Date(2026, 2, 5)),
      makeItem("c", 3, new Date(2026, 2, 5), new Date(2026, 2, 6)),
    ]);

    const laneByCard = new Map(rows[0]?.segments.map((segment) => [segment.card.id, segment.lane]));
    expect(rows[0]?.laneCount).toBe(2);
    expect(laneByCard.get("a")).toBe(0);
    expect(laneByCard.get("b")).toBe(1);
    expect(laneByCard.get("c")).toBe(0);
  });

  it("includes stable segment key based on week and span", () => {
    const days = makeDays(new Date(2026, 2, 1), 7);
    const rows = buildCalendarWeekRows(days, [makeItem("a", 1, new Date(2026, 2, 2), new Date(2026, 2, 3))]);
    const segment = rows[0]?.segments[0];
    expect(segment?.segmentKey).toBe(`${toDayKey(new Date(2026, 2, 1))}_1_2`);
  });
});
