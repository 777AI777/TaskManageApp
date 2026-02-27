import { describe, expect, it } from "vitest";

import {
  addDays,
  deltaXToDayShift,
  dayDiff,
  normalizeRange,
  parseDayKey,
  resizeRangeFromEnd,
  resizeRangeFromStart,
  shiftRangeToDay,
  toDayKey,
  toLocalStartIso,
} from "@/lib/timeline-utils";

describe("timeline-utils", () => {
  it("round-trips day keys", () => {
    const parsed = parseDayKey("2026-03-03");
    expect(parsed).not.toBeNull();
    expect(toDayKey(parsed as Date)).toBe("2026-03-03");
  });

  it("normalizes due-only card to a one-day range", () => {
    const dueIso = new Date(2026, 1, 28, 15, 30).toISOString();
    const range = normalizeRange(null, dueIso);
    expect(range).not.toBeNull();
    expect(toDayKey((range as { start: Date }).start)).toBe("2026-02-28");
    expect(toDayKey((range as { end: Date }).end)).toBe("2026-02-28");
  });

  it("moves a due-only range with start-day anchor", () => {
    const dueIso = new Date(2026, 2, 3, 8, 0).toISOString();
    const range = normalizeRange(null, dueIso) as { start: Date; end: Date };
    const moved = shiftRangeToDay(range, new Date(2026, 2, 10));
    expect(toDayKey(moved.start)).toBe("2026-03-10");
    expect(toDayKey(moved.end)).toBe("2026-03-10");
  });

  it("keeps duration when moving the range", () => {
    const range = normalizeRange(
      new Date(2026, 1, 20, 9, 0).toISOString(),
      new Date(2026, 1, 22, 18, 0).toISOString(),
    ) as { start: Date; end: Date };
    const moved = shiftRangeToDay(range, new Date(2026, 2, 1));
    expect(toDayKey(moved.start)).toBe("2026-03-01");
    expect(toDayKey(moved.end)).toBe("2026-03-03");
    expect(dayDiff(moved.start, moved.end)).toBe(dayDiff(range.start, range.end));
  });

  it("clamps resize start so it cannot pass end", () => {
    const range = {
      start: new Date(2026, 1, 20),
      end: new Date(2026, 1, 23),
    };
    const resized = resizeRangeFromStart(range, new Date(2026, 1, 28));
    expect(toDayKey(resized.start)).toBe("2026-02-23");
    expect(toDayKey(resized.end)).toBe("2026-02-23");
  });

  it("keeps end when resizing start within range", () => {
    const range = {
      start: new Date(2026, 1, 20),
      end: new Date(2026, 1, 23),
    };
    const resized = resizeRangeFromStart(range, new Date(2026, 1, 21));
    expect(toDayKey(resized.start)).toBe("2026-02-21");
    expect(toDayKey(resized.end)).toBe("2026-02-23");
  });

  it("clamps resize end so it cannot go before start", () => {
    const range = {
      start: new Date(2026, 1, 20),
      end: new Date(2026, 1, 23),
    };
    const resized = resizeRangeFromEnd(range, new Date(2026, 1, 18));
    expect(toDayKey(resized.start)).toBe("2026-02-20");
    expect(toDayKey(resized.end)).toBe("2026-02-20");
  });

  it("keeps start when resizing end within range", () => {
    const range = {
      start: new Date(2026, 1, 20),
      end: new Date(2026, 1, 23),
    };
    const resized = resizeRangeFromEnd(range, new Date(2026, 1, 22));
    expect(toDayKey(resized.start)).toBe("2026-02-20");
    expect(toDayKey(resized.end)).toBe("2026-02-22");
  });

  it("normalizes range when source dates are reversed", () => {
    const range = normalizeRange(
      new Date(2026, 2, 14, 12, 0).toISOString(),
      new Date(2026, 2, 10, 9, 0).toISOString(),
    ) as { start: Date; end: Date };
    expect(toDayKey(range.start)).toBe("2026-03-10");
    expect(toDayKey(range.end)).toBe("2026-03-14");
  });

  it("serializes dates at local day start", () => {
    const iso = toLocalStartIso(new Date(2026, 1, 27, 14, 45));
    const parsed = new Date(iso);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
    expect(parsed.getSeconds()).toBe(0);
  });

  it("adds days in local date space", () => {
    const start = new Date(2026, 1, 27);
    const next = addDays(start, 3);
    expect(toDayKey(next)).toBe("2026-03-02");
  });

  it("converts pixel delta to day shift", () => {
    expect(deltaXToDayShift(190, 100)).toBe(2);
    expect(deltaXToDayShift(-149, 100)).toBe(-1);
    expect(deltaXToDayShift(0, 100)).toBe(0);
  });
});
