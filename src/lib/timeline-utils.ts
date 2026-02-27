export const DAY_MS = 24 * 60 * 60 * 1000;
export const TIMELINE_DAY_WIDTH_PX = 100;

export type TimelineRange = {
  start: Date;
  end: Date;
};

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

export function startOfWeek(date: Date, weekStartsOn = 0): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() - weekStartsOn + 7) % 7;
  return addDays(day, -offset);
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0",
  )}`;
}

export function parseDayKey(dayKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function isWeekend(date: Date): boolean {
  const weekday = date.getDay();
  return weekday === 0 || weekday === 6;
}

export function utcDayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

export function dayDiff(start: Date, end: Date): number {
  return utcDayIndex(end) - utcDayIndex(start);
}

export function toLocalStartIso(date: Date): string {
  return startOfDay(date).toISOString();
}

export function normalizeRange(startAtIso: string | null, dueAtIso: string | null): TimelineRange | null {
  if (!startAtIso && !dueAtIso) return null;

  const parsedStart = startAtIso ? new Date(startAtIso) : null;
  const parsedEnd = dueAtIso ? new Date(dueAtIso) : null;
  const fallback = parsedStart ?? parsedEnd;
  if (!fallback) return null;

  const startCandidate = parsedStart ?? fallback;
  const endCandidate = parsedEnd ?? fallback;
  if (!Number.isFinite(startCandidate.valueOf()) || !Number.isFinite(endCandidate.valueOf())) {
    return null;
  }

  const start = startOfDay(startCandidate);
  const end = startOfDay(endCandidate);
  if (dayDiff(start, end) < 0) {
    return { start: end, end: start };
  }
  return { start, end };
}

export function shiftRangeToDay(range: TimelineRange, nextStart: Date): TimelineRange {
  const normalizedStart = startOfDay(nextStart);
  const spanDays = Math.max(dayDiff(range.start, range.end), 0);
  return {
    start: normalizedStart,
    end: addDays(normalizedStart, spanDays),
  };
}

export function resizeRangeFromStart(range: TimelineRange, nextStart: Date): TimelineRange {
  const start = startOfDay(nextStart);
  if (dayDiff(start, range.end) < 0) {
    return { start: range.end, end: range.end };
  }
  return { start, end: range.end };
}

export function resizeRangeFromEnd(range: TimelineRange, nextEnd: Date): TimelineRange {
  const end = startOfDay(nextEnd);
  if (dayDiff(range.start, end) < 0) {
    return { start: range.start, end: range.start };
  }
  return { start: range.start, end };
}

export function deltaXToDayShift(deltaX: number, dayWidthPx: number): number {
  if (!Number.isFinite(deltaX) || !Number.isFinite(dayWidthPx) || dayWidthPx <= 0) {
    return 0;
  }
  return Math.round(deltaX / dayWidthPx);
}
