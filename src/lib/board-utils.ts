import { addDays, endOfDay, endOfWeek, isAfter, isBefore, startOfDay } from "date-fns";

import type { Role } from "@/lib/types";

export type DueFilterMode = "" | "overdue" | "today" | "tomorrow" | "next-week" | "no-due-date";
export type DueBucket =
  | "no-due-date"
  | "overdue"
  | "due-until-next-day";
export type CardDeadlineState = "none" | "upcoming" | "due-today" | "overdue" | "completed";
export type CardStatusFilters = {
  completed: boolean;
  nonCompleted: boolean;
};
export type CardListFilters = {
  listIds: string[];
};
type SortablePositionItem = {
  id: string;
  position: number;
};

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
  return false;
}

export function matchesCardStatusFilters(
  isCompleted: boolean,
  filters: CardStatusFilters,
): boolean {
  if (!filters.completed && !filters.nonCompleted) return true;
  return (filters.completed && isCompleted) || (filters.nonCompleted && !isCompleted);
}

export function matchesCardListFilters(
  listId: string,
  filters: CardListFilters,
): boolean {
  if (filters.listIds.length === 0) return true;
  return filters.listIds.includes(listId);
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

export function getReorderedItemPosition<T extends SortablePositionItem>(
  items: T[],
  activeId: string,
  overId: string,
): number | null {
  const ordered = [...items].sort((left, right) => left.position - right.position);
  const activeIndex = ordered.findIndex((item) => item.id === activeId);
  const overIndex = ordered.findIndex((item) => item.id === overId);
  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return null;
  }

  const reordered = [...ordered];
  const [moving] = reordered.splice(activeIndex, 1);
  reordered.splice(overIndex, 0, moving);

  const movingIndex = reordered.findIndex((item) => item.id === moving.id);
  const previous = movingIndex > 0 ? reordered[movingIndex - 1] : null;
  const next = movingIndex < reordered.length - 1 ? reordered[movingIndex + 1] : null;

  let position: number;
  if (previous && next) {
    position =
      previous.position < next.position
        ? previous.position + (next.position - previous.position) / 2
        : previous.position + 1;
  } else if (previous) {
    position = previous.position + 1024;
  } else if (next) {
    position = next.position > 0 ? next.position / 2 : next.position - 1;
  } else {
    return null;
  }

  if (!Number.isFinite(position) || position === moving.position) {
    return null;
  }
  return position;
}
