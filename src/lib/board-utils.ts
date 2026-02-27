import { addDays, addMonths, endOfDay, endOfWeek, isAfter, isBefore, startOfDay } from "date-fns";

import type { Role } from "@/lib/types";

export type DueFilterMode = "" | "overdue" | "today" | "tomorrow" | "next-week" | "no-due-date";
export type DueBucket =
  | "no-due-date"
  | "overdue"
  | "due-until-next-day"
  | "due-until-next-week"
  | "due-until-next-month";
export type CardDeadlineState = "none" | "upcoming" | "due-today" | "overdue" | "completed";

function isWithinInclusiveRange(target: Date, from: Date, to: Date): boolean {
  return !isBefore(target, from) && !isAfter(target, to);
}

export function matchesDueBucket(
  dueAtIso: string | null,
  bucket: DueBucket,
  now = new Date(),
): boolean {
  const dueAt = dueAtIso ? new Date(dueAtIso) : null;
  if (bucket === "no-due-date") return dueAt === null;
  if (!dueAt) return false;

  if (bucket === "overdue") return isBefore(dueAt, now);
  if (bucket === "due-until-next-day") return isWithinInclusiveRange(dueAt, now, endOfDay(addDays(now, 1)));
  if (bucket === "due-until-next-week") return isWithinInclusiveRange(dueAt, now, endOfDay(addDays(now, 7)));
  if (bucket === "due-until-next-month") return isWithinInclusiveRange(dueAt, now, endOfDay(addMonths(now, 1)));
  return false;
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function resolveCardDeadlineState(
  dueAtIso: string | null,
  isCompleted: boolean,
  now = new Date(),
): CardDeadlineState {
  if (isCompleted) return "completed";
  if (!dueAtIso) return "none";

  const dueAt = new Date(dueAtIso);
  if (Number.isNaN(dueAt.valueOf())) return "none";
  if (isBefore(dueAt, now)) return "overdue";
  if (isSameLocalDay(dueAt, now)) return "due-today";
  return "upcoming";
}

export function matchesDueFilter(
  dueAtIso: string | null,
  dueFilter: DueFilterMode,
  now = new Date(),
): boolean {
  if (!dueFilter) return true;
  const dueAt = dueAtIso ? new Date(dueAtIso) : null;
  if (dueFilter === "no-due-date") return dueAt === null;
  if (!dueAt) return false;
  if (dueFilter === "overdue") return isBefore(dueAt, now);
  if (dueFilter === "today") return isAfter(dueAt, startOfDay(now)) && isBefore(dueAt, endOfDay(now));
  if (dueFilter === "tomorrow") return isAfter(dueAt, endOfDay(now)) && isBefore(dueAt, endOfDay(addDays(now, 1)));
  if (dueFilter === "next-week") return isAfter(dueAt, now) && isBefore(dueAt, endOfWeek(now, { weekStartsOn: 1 }));
  return true;
}

export function nextOnboardingState(currentStep: number, totalSteps: number) {
  if (totalSteps <= 0) {
    return { step: 0, completed: true };
  }
  if (currentStep >= totalSteps - 1) {
    return { step: totalSteps - 1, completed: true };
  }
  return { step: currentStep + 1, completed: false };
}

export function canManageBoard(role: Role) {
  return role === "workspace_admin" || role === "board_admin";
}
