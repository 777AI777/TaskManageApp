import { describe, expect, it } from "vitest";
import { addDays, addMonths, endOfDay } from "date-fns";

import {
  canManageBoard,
  getReorderedItemPosition,
  matchesDueBucket,
  matchesDueFilter,
  nextOnboardingState,
  resolveCardDeadlineState,
} from "@/lib/board-utils";

describe("matchesDueFilter", () => {
  const now = new Date("2026-02-25T10:00:00.000Z");

  it("returns true for empty filter", () => {
    expect(matchesDueFilter(null, "", now)).toBe(true);
  });

  it("matches no due date", () => {
    expect(matchesDueFilter(null, "no-due-date", now)).toBe(true);
    expect(matchesDueFilter("2026-02-26T12:00:00.000Z", "no-due-date", now)).toBe(false);
  });

  it("matches overdue", () => {
    expect(matchesDueFilter("2026-02-24T12:00:00.000Z", "overdue", now)).toBe(true);
    expect(matchesDueFilter("2026-02-28T12:00:00.000Z", "overdue", now)).toBe(false);
  });
});

describe("matchesDueBucket", () => {
  const now = new Date("2026-02-25T10:00:00.000Z");

  it("matches no due date bucket", () => {
    expect(matchesDueBucket(null, "no-due-date", now)).toBe(true);
    expect(matchesDueBucket("2026-02-25T12:00:00.000Z", "no-due-date", now)).toBe(false);
  });

  it("matches overdue bucket", () => {
    expect(matchesDueBucket(new Date(now.getTime() - 1).toISOString(), "overdue", now)).toBe(true);
    expect(matchesDueBucket(now.toISOString(), "overdue", now)).toBe(false);
  });

  it("matches due until next day bucket with inclusive boundary", () => {
    const upper = endOfDay(addDays(now, 1));
    expect(matchesDueBucket(upper.toISOString(), "due-until-next-day", now)).toBe(true);
    expect(matchesDueBucket(new Date(upper.getTime() + 1).toISOString(), "due-until-next-day", now)).toBe(false);
  });

  it("matches due until next week bucket with inclusive boundary", () => {
    const upper = endOfDay(addDays(now, 7));
    expect(matchesDueBucket(upper.toISOString(), "due-until-next-week", now)).toBe(true);
    expect(matchesDueBucket(new Date(upper.getTime() + 1).toISOString(), "due-until-next-week", now)).toBe(false);
  });

  it("matches due until next month bucket with inclusive boundary", () => {
    const upper = endOfDay(addMonths(now, 1));
    expect(matchesDueBucket(upper.toISOString(), "due-until-next-month", now)).toBe(true);
    expect(matchesDueBucket(new Date(upper.getTime() + 1).toISOString(), "due-until-next-month", now)).toBe(false);
  });
});

describe("nextOnboardingState", () => {
  it("advances step while incomplete", () => {
    expect(nextOnboardingState(0, 4)).toEqual({ step: 1, completed: false });
  });

  it("returns completed at last step", () => {
    expect(nextOnboardingState(3, 4)).toEqual({ step: 3, completed: true });
  });
});

describe("resolveCardDeadlineState", () => {
  const now = new Date(2026, 1, 27, 10, 0, 0);

  it("returns completed when task is completed", () => {
    expect(resolveCardDeadlineState(new Date(2026, 1, 27, 9, 0, 0).toISOString(), true, now)).toBe("completed");
  });

  it("returns none when no due date exists", () => {
    expect(resolveCardDeadlineState(null, false, now)).toBe("none");
  });

  it("returns overdue when due time is before now", () => {
    expect(resolveCardDeadlineState(new Date(2026, 1, 27, 9, 59, 59).toISOString(), false, now)).toBe("overdue");
  });

  it("returns due-today when due is same local day and not overdue", () => {
    expect(resolveCardDeadlineState(new Date(2026, 1, 27, 23, 59, 59).toISOString(), false, now)).toBe("due-today");
  });

  it("returns upcoming when due is in future day", () => {
    expect(resolveCardDeadlineState(new Date(2026, 1, 28, 0, 0, 0).toISOString(), false, now)).toBe("upcoming");
  });
});

describe("canManageBoard", () => {
  it("allows workspace and board admins only", () => {
    expect(canManageBoard("workspace_admin")).toBe(true);
    expect(canManageBoard("board_admin")).toBe(true);
    expect(canManageBoard("member")).toBe(false);
  });
});

describe("getReorderedItemPosition", () => {
  const items = [
    { id: "list-a", position: 1000 },
    { id: "list-b", position: 2000 },
    { id: "list-c", position: 3000 },
  ];

  it("returns midpoint when moving between neighbors", () => {
    expect(getReorderedItemPosition(items, "list-c", "list-b")).toBe(1500);
  });

  it("returns half of next position when moving to first place", () => {
    expect(getReorderedItemPosition(items, "list-c", "list-a")).toBe(500);
  });

  it("returns previous plus increment when moving to last place", () => {
    expect(getReorderedItemPosition(items, "list-a", "list-c")).toBe(4024);
  });

  it("returns null when ids are invalid or unchanged", () => {
    expect(getReorderedItemPosition(items, "list-a", "list-a")).toBeNull();
    expect(getReorderedItemPosition(items, "missing", "list-a")).toBeNull();
    expect(getReorderedItemPosition(items, "list-a", "missing")).toBeNull();
  });
});
