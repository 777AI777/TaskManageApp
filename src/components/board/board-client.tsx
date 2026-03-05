"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  type CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  ChevronDown,
  Clock3,
  GitBranch,
  GripVertical,
  Kanban,
  MessageSquare,
  Plus,
  Table,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CSSProperties,
  FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CalendarView } from "@/components/board/calendar-view";
import { BoardPointerSensor, getCardDndId, parseCardDndId } from "@/components/board/board-dnd";
import { BoardChatPanel } from "@/components/board/board-chat-panel";
import { CardDetailDrawer } from "@/components/board/card-detail-drawer";
import { TableView } from "@/components/board/table-view";
import { TimelineView } from "@/components/board/timeline-view";
import { CreateBoardForm } from "@/components/workspace/create-board-form";
import { HomeUserMenu } from "@/components/workspace/home-user-menu";
import type {
  BoardCard,
  CardComment,
  Checklist,
  ChecklistItem,
  Attachment,
  CardDetailData,
  BoardDataBundle,
  BoardList,
  CardCustomFieldValue,
  CardWatcher,
  BoardChatMessage,
  CustomField,
  BoardCardMeta,
} from "@/components/board/board-types";
import {
  BOARD_COMMON_LABELS,
  BOARD_ERROR_MESSAGES,
  BOARD_ROLE_LABELS,
  booleanLabel,
} from "@/lib/board-ui-text";
import {
  removeRealtimeAttachment,
  removeRealtimeCard,
  removeRealtimeCardWatcher,
  removeRealtimeChecklist,
  removeRealtimeChecklistItem,
  removeRealtimeChecklistItemsByChecklist,
  removeRealtimeComment,
  removeRealtimeList,
  upsertRealtimeAttachment,
  upsertRealtimeCard,
  upsertRealtimeCardWatcher,
  upsertRealtimeChecklist,
  upsertRealtimeChecklistItem,
  upsertRealtimeComment,
  upsertRealtimeList,
} from "@/lib/board-realtime";
import {
  canManageBoard,
  getReorderedItemPosition,
  matchesCardListFilters,
  matchesCardStatusFilters,
  matchesDueBucket,
  resolveCardDeadlineState,
  type CardListFilters,
  type CardStatusFilters,
  type DueBucket,
} from "@/lib/board-utils";
import { resolveAvatarColor } from "@/lib/avatar-color";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  clampSharedSidebarWidth,
  readSharedSidebarWidthFromStorage,
  writeSharedSidebarWidthToStorage,
} from "@/lib/sidebar-width";
import {
  applyTableSortStateToSearchParams,
  getNextTableSortState,
  parseTableSortState,
  type TableSortDirection,
  type TableSortKey,
  type TableSortState,
} from "@/lib/table-sort";
import { formatTaskDisplayId } from "@/lib/task-id";
import {
  addDays,
  deltaXToDayShift,
  normalizeRange,
  parseDayKey,
  resizeRangeFromEnd,
  resizeRangeFromStart,
  shiftRangeToDay,
  TIMELINE_DAY_WIDTH_PX,
  toLocalStartIso,
} from "@/lib/timeline-utils";

type ViewMode = "board" | "calendar" | "table" | "timeline";
type MemberFilters = {
  unassigned: boolean;
  assignedToMe: boolean;
  memberIds: string[];
};
const DEFAULT_TABLE_SORT_STATE: Exclude<TableSortState, null> = {
  key: "taskId",
  direction: "asc",
};
type StatusFilters = CardStatusFilters;
type ListFilters = CardListFilters;
type LabelFilters = {
  noLabel: boolean;
  labelIds: string[];
};
type TimelineDragKind = "move" | "resize-start" | "resize-end";
type TimelineDragSnapshot = {
  kind: TimelineDragKind;
  cardId: string;
  listId: string;
  range: { start: Date; end: Date };
};
type TimelineOverTarget =
  | {
      type: "day";
      listId: string;
      dayKey: string;
    }
  | {
      type: "unscheduled";
      listId: string;
    };
type CalendarOverTarget = {
  type: "day";
  dayKey: string;
};
type ViewMenuItem = {
  mode: ViewMode;
  label: string;
  icon: LucideIcon;
};
const UNIFIED_BOARD_BACKGROUND = "#c0c5d1";
const DEFAULT_MEMBER_FILTERS: MemberFilters = { unassigned: false, assignedToMe: false, memberIds: [] };
const DEFAULT_STATUS_FILTERS: StatusFilters = { completed: false, nonCompleted: false };
const DEFAULT_LIST_FILTERS: ListFilters = { listIds: [] };
const DEFAULT_LABEL_FILTERS: LabelFilters = { noLabel: false, labelIds: [] };
const DUE_FILTER_OPTIONS: Array<{ value: DueBucket; label: string; tone: "neutral" | "danger" | "warning" }> = [
  { value: "no-due-date", label: "\u671f\u9650\u306a\u3057", tone: "neutral" },
  { value: "overdue", label: "\u671f\u9650\u5207\u308c", tone: "danger" },
  { value: "due-until-next-day", label: "\u660e\u65e5\u307e\u3067\u306e\u671f\u9650\u3042\u308a", tone: "warning" },
];

const VIEW_MENU_ITEMS: ViewMenuItem[] = [
  { mode: "board", label: "\u30dc\u30fc\u30c9", icon: Kanban },
  { mode: "table", label: "\u30c6\u30fc\u30d6\u30eb", icon: Table },
  { mode: "calendar", label: "\u30ab\u30ec\u30f3\u30c0\u30fc", icon: Calendar },
  { mode: "timeline", label: "\u30ac\u30f3\u30c8\u30c1\u30e3\u30fc\u30c8", icon: GitBranch },
];
const BOARD_LEFT_RAIL_DEFAULT_WIDTH_PX = 320;
const BOARD_LEFT_RAIL_COLLAPSED_WIDTH_PX = 64;
const LIST_COLUMN_DND_PREFIX = "list-column:";
const LIST_REORDER_ERROR_MESSAGE = "Failed to reorder list.";
const BOARD_CHAT_PAGE_SIZE = 50;

type BoardChatPageData = {
  messages: BoardChatMessage[];
  hasMore: boolean;
  nextBefore: string | null;
};

function getListColumnDndId(listId: string): string {
  return `${LIST_COLUMN_DND_PREFIX}${listId}`;
}

function parseListColumnDndId(id: string): string | null {
  if (!id.startsWith(LIST_COLUMN_DND_PREFIX)) return null;
  const listId = id.slice(LIST_COLUMN_DND_PREFIX.length);
  return listId.length > 0 ? listId : null;
}

function parseTimelineActiveId(id: string): { kind: TimelineDragKind; cardId: string } | null {
  const match = /^timeline:(move|resize-start|resize-end):([^:]+)$/.exec(id);
  if (!match) return null;
  return {
    kind: match[1] as TimelineDragKind,
    cardId: match[2],
  };
}

function isTimelinePlacementActiveId(id: string): boolean {
  return /^timeline:place:[^:]+$/.test(id);
}

function parseTimelineOverId(id: string): TimelineOverTarget | null {
  const dayMatch = /^timeline:day:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (dayMatch) {
    return {
      type: "day",
      listId: dayMatch[1],
      dayKey: dayMatch[2],
    };
  }

  const unscheduledMatch = /^timeline:unscheduled:([^:]+)$/.exec(id);
  if (unscheduledMatch) {
    return {
      type: "unscheduled",
      listId: unscheduledMatch[1],
    };
  }

  return null;
}

function parseCalendarActiveId(id: string): { kind: TimelineDragKind; cardId: string } | null {
  const match = /^calendar:(move|resize-start|resize-end):([^:]+)(?::([^:]+))?$/.exec(id);
  if (!match) return null;
  return {
    kind: match[1] as TimelineDragKind,
    cardId: match[2],
  };
}

function parseCalendarOverId(id: string): CalendarOverTarget | null {
  const match = /^calendar:day:(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (!match) return null;
  return {
    type: "day",
    dayKey: match[1],
  };
}

function getPointerClientX(event: Event): number | null {
  if ("clientX" in event && typeof event.clientX === "number") {
    return event.clientX;
  }
  if ("touches" in event) {
    const touches = (event as TouchEvent).touches;
    return touches.length ? touches[0]?.clientX ?? null : null;
  }
  if ("changedTouches" in event) {
    const changedTouches = (event as TouchEvent).changedTouches;
    return changedTouches.length ? changedTouches[0]?.clientX ?? null : null;
  }
  return null;
}

function getCalendarDayWidthPx(): number {
  const calendarDayCell = document.querySelector(".tm-calendar-cell");
  if (calendarDayCell instanceof HTMLElement) {
    const width = calendarDayCell.getBoundingClientRect().width;
    if (Number.isFinite(width) && width > 0) {
      return width;
    }
  }
  return TIMELINE_DAY_WIDTH_PX;
}

function deltaXToCalendarDayShift(deltaX: number, dayWidthPx: number): number {
  if (!Number.isFinite(deltaX) || !Number.isFinite(dayWidthPx) || dayWidthPx <= 0) {
    return 0;
  }
  const raw = deltaX / dayWidthPx;
  return raw >= 0 ? Math.floor(raw) : Math.ceil(raw);
}

function getCalendarStartEdgeDay(event: DragEndEvent): Date | null {
  const translatedRect = event.active.rect.current.translated;
  const initialRect = event.active.rect.current.initial;
  const rect = translatedRect ?? initialRect;
  if (!rect) return null;

  const probeX = rect.left + 2;
  const probeY = rect.top + rect.height / 2;
  const elements = document.elementsFromPoint(probeX, probeY);
  const dayCell = elements.find(
    (element) => element instanceof HTMLElement && element.matches(".tm-calendar-cell[data-day-key]"),
  ) as HTMLElement | undefined;
  if (!dayCell) return null;

  const dayKey = dayCell.getAttribute("data-day-key");
  if (!dayKey) return null;
  return parseDayKey(dayKey);
}

function isCalendarDayDroppableId(id: string): boolean {
  return /^calendar:day:\d{4}-\d{2}-\d{2}$/.test(id);
}

function formatCustomFieldValue(
  field: CustomField,
  value: CardCustomFieldValue | undefined,
) {
  if (!value) return "-";
  if (field.field_type === "text") return value.value_text ?? "-";
  if (field.field_type === "number") return value.value_number?.toString() ?? "-";
  if (field.field_type === "date") {
    return value.value_date ? new Date(value.value_date).toLocaleString() : "-";
  }
  if (field.field_type === "checkbox") {
    return booleanLabel(Boolean(value.value_boolean));
  }
  if (field.field_type === "select") return value.value_option ?? "-";
  return "-";
}

function formatCardDueLabel(dueAtIso: string | null): string | null {
  if (!dueAtIso) return null;
  const dueDate = new Date(dueAtIso);
  if (Number.isNaN(dueDate.valueOf())) return null;
  return dueDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function toDueAtIsoFromDate(value: string): string | null {
  if (!value) return null;
  const dueAt = new Date(`${value}T23:59:00`);
  if (Number.isNaN(dueAt.getTime())) return null;
  return dueAt.toISOString();
}

function compareBoardChatMessage(left: BoardChatMessage, right: BoardChatMessage): number {
  const leftTime = new Date(left.created_at).getTime();
  const rightTime = new Date(right.created_at).getTime();
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.id.localeCompare(right.id);
}

function upsertBoardChatMessage(messages: BoardChatMessage[], nextMessage: BoardChatMessage): BoardChatMessage[] {
  const index = messages.findIndex((message) => message.id === nextMessage.id);
  if (index === -1) {
    return [...messages, nextMessage].sort(compareBoardChatMessage);
  }
  const next = [...messages];
  next[index] = nextMessage;
  return next.sort(compareBoardChatMessage);
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

const TABLE_SORT_COLLATOR = new Intl.Collator("ja-JP", {
  numeric: true,
  sensitivity: "base",
});

function normalizeSortableNameList(values: string[]): string | null {
  if (!values.length) return null;
  return [...values].sort(TABLE_SORT_COLLATOR.compare).join(" ");
}

function isEmptyTableSortValue(value: string | number | boolean | null): boolean {
  if (value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function compareTableSortValues(
  left: string | number | boolean | null,
  right: string | number | boolean | null,
  direction: TableSortDirection,
): number {
  const leftEmpty = isEmptyTableSortValue(left);
  const rightEmpty = isEmptyTableSortValue(right);
  if (leftEmpty || rightEmpty) {
    if (leftEmpty && rightEmpty) return 0;
    return leftEmpty ? 1 : -1;
  }

  let compared = 0;
  if (typeof left === "string" && typeof right === "string") {
    compared = TABLE_SORT_COLLATOR.compare(left, right);
  } else if (typeof left === "number" && typeof right === "number") {
    compared = left - right;
  } else if (typeof left === "boolean" && typeof right === "boolean") {
    compared = Number(left) - Number(right);
  } else {
    compared = TABLE_SORT_COLLATOR.compare(String(left), String(right));
  }

  return direction === "asc" ? compared : -compared;
}

function toSortableTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function resolveCustomFieldSortValue(
  field: CustomField | undefined,
  value: CardCustomFieldValue | undefined,
): string | number | boolean | null {
  if (!field || !value) return null;

  if (field.field_type === "text") {
    return value.value_text?.trim() || null;
  }

  if (field.field_type === "number") {
    return value.value_number ?? null;
  }

  if (field.field_type === "date") {
    return toSortableTimestamp(value.value_date);
  }

  if (field.field_type === "checkbox") {
    return value.value_boolean === null ? null : Boolean(value.value_boolean);
  }

  if (field.field_type === "select") {
    return value.value_option?.trim() || null;
  }

  return null;
}

function toAssigneeInitial(name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : null;
}

function CardPresentation({
  card,
  boardCode,
  meta,
}: {
  card: BoardCard;
  boardCode: string;
  meta: BoardCardMeta | undefined;
}) {
  const taskId = formatTaskDisplayId(boardCode, card.task_number);
  return (
    <>
      <div className="tm-card-drag-row">
        <p className="tm-task-id-label">{taskId}</p>
        <div className="flex items-center gap-2">
          {meta?.dueLabel ? (
            <span className={`tm-task-state-chip tm-task-state-${meta.deadlineState}`}>
              <Clock3 size={12} />
              <span>{meta.dueLabel}</span>
            </span>
          ) : null}
          <span className="tm-card-drag-handle" aria-hidden="true">
            <GripVertical size={14} />
          </span>
        </div>
      </div>
      {card.cover_type === "color" && card.cover_value ? (
        <div className="mb-2 h-7 rounded-md" style={{ backgroundColor: card.cover_value }} />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="tm-card-main-row">
          <p
            className={`tm-card-title-clamp text-sm font-semibold ${card.archived ? "opacity-70" : ""}`}
            title={card.title}
          >
            {card.title}
          </p>
          {meta?.assigneePrimary ? (
            <span className="tm-task-assignee-pill" title={meta.assigneeTooltip ?? undefined}>
              <span className="tm-task-assignee-initial" style={{ backgroundColor: resolveAvatarColor(meta.assigneeColor) }}>
                {meta.assigneeInitial ?? "?"}
              </span>
              {meta.assigneeExtraCount > 0 ? (
                <span className="tm-task-assignee-extra">+{meta.assigneeExtraCount}</span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

function DnDCard({
  card,
  boardCode,
  meta,
  onOpen,
}: {
  card: BoardCard;
  boardCode: string;
  meta: BoardCardMeta | undefined;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: getCardDndId(card.id) });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`tm-card tm-card-clickable tm-card-draggable ${isDragging ? "tm-card-dragging" : ""}`}
      onClick={() => onOpen(card.id)}
      {...listeners}
      {...attributes}
    >
      <CardPresentation card={card} boardCode={boardCode} meta={meta} />
    </article>
  );
}
function Column({
  list,
  cards,
  boardCode,
  cardMetaById,
  onOpen,
  draft,
  onDraft,
  onCreate,
  canArchive,
  onArchive,
  onRename,
}: {
  list: BoardList;
  cards: BoardCard[];
  boardCode: string;
  cardMetaById: Map<string, BoardCardMeta>;
  onOpen: (id: string) => void;
  draft: string;
  onDraft: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  canArchive: boolean;
  onArchive: (list: BoardList) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(list.name);
  const [showListActions, setShowListActions] = useState(false);
  const listActionsRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef: setCardDropNodeRef, isOver } = useDroppable({ id: `list:${list.id}` });
  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getListColumnDndId(list.id),
    disabled: editingName,
  });
  const style: CSSProperties | undefined =
    transform || transition
      ? {
          transform: CSS.Translate.toString(transform),
          transition,
        }
      : undefined;

  useEffect(() => {
    if (!showListActions) return;

    function handlePointerDown(event: MouseEvent) {
      if (listActionsRef.current && !listActionsRef.current.contains(event.target as Node)) {
        setShowListActions(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowListActions(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showListActions]);

  async function submitRename() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (!trimmed || trimmed === list.name) {
      setNameInput(list.name);
      return;
    }
    const response = await fetch(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (response.ok) {
      onRename(list.id, trimmed);
    } else {
      setNameInput(list.name);
    }
  }

  function handleNameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitRename();
    } else if (event.key === "Escape") {
      setEditingName(false);
      setNameInput(list.name);
    }
  }

  return (
    <section
      ref={setSortableNodeRef}
      style={style}
      className={`tm-list-column tm-list-column-app tm-list-column-sortable ${isOver ? "ring-2 ring-blue-400" : ""} ${
        isDragging ? "tm-list-column-sortable-dragging" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div
          className={`min-w-0 flex-1 ${editingName ? "" : "tm-list-column-header-drag-handle"}`}
          {...(editingName ? {} : { ...attributes, ...listeners })}
        >
          {editingName ? (
            <input
              className="tm-list-name-input"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              onBlur={() => void submitRename()}
              onKeyDown={handleNameKeyDown}
              autoFocus
            />
          ) : (
            <h3
              className="tm-list-title truncate text-sm font-bold cursor-pointer rounded px-1 -mx-1 hover:bg-black/5"
              onClick={() => { setNameInput(list.name); setEditingName(true); }}
            >
              {list.name}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="tm-list-count text-xs">{cards.length}</span>
          {canArchive ? (
            <div className="tm-list-actions" ref={listActionsRef}>
              <button
                className="tm-icon-button tm-list-archive-button"
                type="button"
                aria-label="リスト操作"
                aria-haspopup="menu"
                aria-expanded={showListActions}
                onClick={() => setShowListActions((prev) => !prev)}
              >
                {"\u2026"}
              </button>
              {showListActions ? (
                <div className="tm-list-actions-menu" role="menu">
                  <button
                    className="tm-list-actions-menu-item"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowListActions(false);
                      onArchive(list);
                    }}
                  >
                    このリストをアーカイブ
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div ref={setCardDropNodeRef} className="tm-list-column-body">
        <div className="tm-list-column-scroll">
          <div className="flex min-h-24 flex-col gap-2">
            {cards.map((card) => (
              <DnDCard
                key={card.id}
                card={card}
                boardCode={boardCode}
                meta={cardMetaById.get(card.id)}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
        <form className="tm-list-column-footer" onSubmit={onCreate}>
          <input
            className="tm-input"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            placeholder={"\u30ab\u30fc\u30c9\u3092\u8ffd\u52a0"}
          />
          <button className="tm-button tm-button-secondary w-full" type="submit">
            {"\u30ab\u30fc\u30c9\u3092\u8ffd\u52a0"}
          </button>
        </form>
      </div>
    </section>
  );
}

export function BoardClient({
  initialData,
  initialCardId = null,
}: {
  initialData: BoardDataBundle;
  initialCardId?: string | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dndContextId = `board-dnd-${initialData.board.id}`;
  const sensors = useSensors(
    useSensor(BoardPointerSensor),
  );
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeId = args.active?.id ? String(args.active.id) : "";
    const listColumnActive = parseListColumnDndId(activeId);
    if (listColumnActive) {
      const listColumnContainers = args.droppableContainers.filter((container) =>
        Boolean(parseListColumnDndId(String(container.id))),
      );
      if (!listColumnContainers.length) {
        return closestCenter(args);
      }
      return closestCenter({ ...args, droppableContainers: listColumnContainers });
    }

    const calendarActive = parseCalendarActiveId(activeId);
    if (!calendarActive || calendarActive.kind !== "move") {
      return rectIntersection(args);
    }

    const translatedRect = args.active.rect.current.translated;
    const initialRect = args.active.rect.current.initial;
    const activeRect = translatedRect ?? initialRect;
    if (!activeRect) {
      return rectIntersection(args);
    }

    const probeX = activeRect.left + 2;
    const probeY = activeRect.top + activeRect.height / 2;
    const matchedContainer = args.droppableContainers.find((container) => {
      const containerId = String(container.id);
      if (!isCalendarDayDroppableId(containerId)) return false;
      const containerRect = args.droppableRects.get(container.id);
      if (!containerRect) return false;
      return (
        probeX >= containerRect.left &&
        probeX <= containerRect.right &&
        probeY >= containerRect.top &&
        probeY <= containerRect.bottom
      );
    });

    if (!matchedContainer) {
      return rectIntersection(args);
    }

    return closestCenter({
      ...args,
      droppableContainers: [matchedContainer],
    });
  }, []);
  const viewPickerRef = useRef<HTMLDivElement | null>(null);
  const headerTaskAddRef = useRef<HTMLDivElement | null>(null);
  const leftRailBodyRef = useRef<HTMLDivElement | null>(null);
  const timelineDragStartXRef = useRef<number | null>(null);
  const timelineDragSnapshotRef = useRef<TimelineDragSnapshot | null>(null);

  const [lists, setLists] = useState(initialData.lists);
  const [cards, setCards] = useState(initialData.cards);
  const [labels, setLabels] = useState(initialData.labels);
  const [cardAssignees, setCardAssignees] = useState(initialData.cardAssignees);
  const [cardLabels, setCardLabels] = useState(initialData.cardLabels);
  const [cardWatchers, setCardWatchers] = useState<CardWatcher[]>([]);
  const [customFields] = useState(initialData.customFields);
  const [cardCustomFieldValues, setCardCustomFieldValues] = useState(initialData.cardCustomFieldValues);
  const [comments, setComments] = useState<CardComment[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [boardChatMessages, setBoardChatMessages] = useState<BoardChatMessage[]>(
    [...initialData.boardChatMessages].sort(compareBoardChatMessage),
  );
  const [boardChatCollapsed, setBoardChatCollapsed] = useState(false);
  const [boardChatMobileOpen, setBoardChatMobileOpen] = useState(false);
  const [boardChatSending, setBoardChatSending] = useState(false);
  const [boardChatLoadingMore, setBoardChatLoadingMore] = useState(false);
  const [boardChatHasMore, setBoardChatHasMore] = useState(
    initialData.boardChatMessages.length >= BOARD_CHAT_PAGE_SIZE,
  );
  const [boardChatNextBefore, setBoardChatNextBefore] = useState<string | null>(
    initialData.boardChatMessages[0]?.created_at ?? null,
  );
  const [boardChatError, setBoardChatError] = useState<string | null>(null);
  const [boardChatDeletingIds, setBoardChatDeletingIds] = useState<string[]>([]);
  const [cardDetailLoadingById, setCardDetailLoadingById] = useState<Record<string, boolean>>({});
  const loadedCardDetailRef = useRef(new Set<string>());
  const checklistsRef = useRef<Checklist[]>([]);

  const [boardName, setBoardName] = useState(initialData.board.name);
  const [boardSlug, setBoardSlug] = useState(initialData.board.slug);
  const [workspaceBoards, setWorkspaceBoards] = useState(initialData.workspaceBoards);
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [boardNameDraft, setBoardNameDraft] = useState(initialData.board.name);
  const [isSavingBoardName, setIsSavingBoardName] = useState(false);

  const defaultView: ViewMode =
    initialData.preferences?.selected_view === "calendar"
      ? "calendar"
      : initialData.preferences?.selected_view === "table"
        ? "table"
        : initialData.preferences?.selected_view === "timeline"
          ? "timeline"
          : "board";
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(initialData.preferences?.left_rail_collapsed ?? false);
  const [leftRailWidth, setLeftRailWidth] = useState<number>(BOARD_LEFT_RAIL_DEFAULT_WIDTH_PX);
  const [leftRailResizing, setLeftRailResizing] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showListComposer, setShowListComposer] = useState(false);
  const [showViewPicker, setShowViewPicker] = useState(false);
  const [showHeaderTaskAdd, setShowHeaderTaskAdd] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);

  const [keywordQuery, setKeywordQuery] = useState("");
  const [memberFilters, setMemberFilters] = useState<MemberFilters>(DEFAULT_MEMBER_FILTERS);
  const [statusFilters, setStatusFilters] = useState<StatusFilters>(DEFAULT_STATUS_FILTERS);
  const [listFilters, setListFilters] = useState<ListFilters>(DEFAULT_LIST_FILTERS);
  const [dueFilters, setDueFilters] = useState<DueBucket[]>([]);
  const [labelFilters, setLabelFilters] = useState<LabelFilters>(DEFAULT_LABEL_FILTERS);

  const [newListName, setNewListName] = useState("");
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({});
  const [headerTaskTitle, setHeaderTaskTitle] = useState("");
  const [headerTaskListId, setHeaderTaskListId] = useState<string | null>(() => {
    const firstList = [...initialData.lists]
      .filter((list) => !list.is_archived)
      .sort((a, b) => a.position - b.position)[0];
    return firstList?.id ?? null;
  });
  const [headerTaskSubmitting, setHeaderTaskSubmitting] = useState(false);
  const [headerTaskError, setHeaderTaskError] = useState<string | null>(null);
  const [tableSavingByCardId, setTableSavingByCardId] = useState<Record<string, boolean>>({});
  const tableSavingByCardIdRef = useRef<Record<string, boolean>>({});
  const [activeDragCardId, setActiveDragCardId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(initialCardId);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leftRailWidthRef = useRef(leftRailWidth);
  const leftRailResizeStartRef = useRef<{ clientX: number; width: number } | null>(null);

  const canManageBoardUi = canManageBoard(initialData.currentUser.role);
  const currentUserId = initialData.currentUser.id;
  const boardCode = initialData.board.board_code;

  const sortedLists = useMemo(
    () => [...lists].filter((list) => !list.is_archived).sort((a, b) => a.position - b.position),
    [lists],
  );
  const headerTaskAddDisabled = sortedLists.length === 0;
  const sortableListColumnIds = useMemo(
    () => sortedLists.map((list) => getListColumnDndId(list.id)),
    [sortedLists],
  );

  const selectedCard = activeCardId ? cards.find((card) => card.id === activeCardId) ?? null : null;
  const selectedCardId = selectedCard?.id ?? null;
  const selectedCardDetailLoading = selectedCard ? Boolean(cardDetailLoadingById[selectedCard.id]) : false;
  const selectedCardChecklistIds = useMemo(() => {
    if (!selectedCardId) return [];
    return checklists
      .filter((checklist) => checklist.card_id === selectedCardId)
      .map((checklist) => checklist.id)
      .sort();
  }, [checklists, selectedCardId]);
  const selectedCardChecklistIdsKey = useMemo(
    () => selectedCardChecklistIds.join(","),
    [selectedCardChecklistIds],
  );

  useEffect(() => {
    setActiveCardId(initialCardId ?? null);
  }, [initialCardId]);

  useEffect(() => {
    setShareLinkCopied(false);
  }, [selectedCardId]);

  useEffect(() => {
    if (!selectedCardId) return;
    setBoardChatMobileOpen(false);
  }, [selectedCardId]);

  useEffect(() => {
    tableSavingByCardIdRef.current = tableSavingByCardId;
  }, [tableSavingByCardId]);

  useEffect(() => {
    checklistsRef.current = checklists;
  }, [checklists]);

  useEffect(() => {
    leftRailWidthRef.current = leftRailWidth;
  }, [leftRailWidth]);

  useEffect(() => {
    const displayWidth = leftRailCollapsed ? BOARD_LEFT_RAIL_COLLAPSED_WIDTH_PX : leftRailWidth;
    leftRailBodyRef.current?.style.setProperty("--app-sidebar-width", `${displayWidth}px`);
  }, [leftRailCollapsed, leftRailWidth]);

  useEffect(() => {
    const storedWidth = readSharedSidebarWidthFromStorage();
    if (storedWidth !== null) {
      setLeftRailWidth(storedWidth);
    }
  }, []);

  useEffect(() => {
    if (!leftRailCollapsed) return;
    leftRailResizeStartRef.current = null;
    setLeftRailResizing(false);
  }, [leftRailCollapsed]);

  useEffect(() => {
    if (!leftRailResizing) return;

    function handlePointerMove(event: PointerEvent) {
      const resizeStart = leftRailResizeStartRef.current;
      if (!resizeStart) return;
      const nextWidth = clampSharedSidebarWidth(resizeStart.width + (event.clientX - resizeStart.clientX), window.innerWidth);
      leftRailWidthRef.current = nextWidth;
      leftRailBodyRef.current?.style.setProperty("--app-sidebar-width", `${nextWidth}px`);
    }

    function handlePointerEnd() {
      const resizeStart = leftRailResizeStartRef.current;
      if (!resizeStart) return;
      leftRailResizeStartRef.current = null;
      setLeftRailResizing(false);
      setLeftRailWidth(leftRailWidthRef.current);
      writeSharedSidebarWidthToStorage(leftRailWidthRef.current);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [leftRailResizing]);

  const handleLeftRailResizerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (leftRailCollapsed || event.button !== 0) return;
      event.preventDefault();
      leftRailResizeStartRef.current = {
        clientX: event.clientX,
        width: leftRailWidthRef.current,
      };
      setLeftRailResizing(true);
    },
    [leftRailCollapsed],
  );

  useEffect(() => {
    if (!sortedLists.length) {
      setHeaderTaskListId(null);
      setShowHeaderTaskAdd(false);
      setHeaderTaskTitle("");
      setHeaderTaskError(null);
      return;
    }
    if (!headerTaskListId || !sortedLists.some((list) => list.id === headerTaskListId)) {
      setHeaderTaskListId(sortedLists[0].id);
    }
  }, [headerTaskListId, sortedLists]);

  const selectedCardWatcherIds = useMemo(() => {
    if (!selectedCardId) return [];
    return cardWatchers.filter((watcher) => watcher.card_id === selectedCardId).map((watcher) => watcher.user_id);
  }, [cardWatchers, selectedCardId]);

  const assigneeIdsByCard = useMemo(() => {
    const map = new Map<string, string[]>();
    cardAssignees.forEach((item) => {
      const current = map.get(item.card_id);
      if (current) {
        current.push(item.user_id);
        return;
      }
      map.set(item.card_id, [item.user_id]);
    });
    return map;
  }, [cardAssignees]);

  const labelIdsByCard = useMemo(() => {
    const map = new Map<string, string[]>();
    cardLabels.forEach((item) => {
      const current = map.get(item.card_id);
      if (current) {
        current.push(item.label_id);
        return;
      }
      map.set(item.card_id, [item.label_id]);
    });
    return map;
  }, [cardLabels]);

  const filteredCards = useMemo(() => {
    const normalizedKeyword = keywordQuery.trim().toLowerCase();
    const hasMemberFilters =
      memberFilters.unassigned || memberFilters.assignedToMe || memberFilters.memberIds.length > 0;
    const hasStatusFilters = statusFilters.completed || statusFilters.nonCompleted;
    const hasListFilters = listFilters.listIds.length > 0;
    const hasDueFilters = dueFilters.length > 0;
    const hasLabelFilters = labelFilters.noLabel || labelFilters.labelIds.length > 0;

    return cards.filter((card) => {
      if (card.archived) return false;

      if (
        normalizedKeyword &&
        !`${card.title} ${card.description ?? ""} ${formatTaskDisplayId(boardCode, card.task_number)}`
          .toLowerCase()
          .includes(normalizedKeyword)
      ) {
        return false;
      }

      const assignees = assigneeIdsByCard.get(card.id) ?? [];
      const labelsForCard = labelIdsByCard.get(card.id) ?? [];

      if (hasMemberFilters) {
        const matchesMembers =
          (memberFilters.unassigned && assignees.length === 0) ||
          (memberFilters.assignedToMe && assignees.includes(currentUserId)) ||
          (memberFilters.memberIds.length > 0 &&
            memberFilters.memberIds.some((memberId) => assignees.includes(memberId)));
        if (!matchesMembers) return false;
      }

      if (hasStatusFilters && !matchesCardStatusFilters(card.is_completed, statusFilters)) {
        return false;
      }

      if (hasListFilters && !matchesCardListFilters(card.list_id, listFilters)) {
        return false;
      }

      if (hasDueFilters && !dueFilters.some((bucket) => matchesDueBucket(card.due_at, bucket))) {
        return false;
      }

      if (hasLabelFilters) {
        const matchesLabels =
          (labelFilters.noLabel && labelsForCard.length === 0) ||
          (labelFilters.labelIds.length > 0 &&
            labelFilters.labelIds.some((labelId) => labelsForCard.includes(labelId)));
        if (!matchesLabels) return false;
      }

      return true;
    });
  }, [
    assigneeIdsByCard,
    cards,
    currentUserId,
    boardCode,
    dueFilters,
    keywordQuery,
    labelFilters.labelIds,
    labelFilters.noLabel,
    labelIdsByCard,
    listFilters.listIds,
    memberFilters.assignedToMe,
    memberFilters.memberIds,
    memberFilters.unassigned,
    statusFilters.completed,
    statusFilters.nonCompleted,
  ]);

  const cardsByList = useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    sortedLists.forEach((list) => map.set(list.id, []));
    [...filteredCards]
      .sort((a, b) => a.position - b.position)
      .forEach((card) => {
        const bucket = map.get(card.list_id);
        if (bucket) bucket.push(card);
      });
    return map;
  }, [sortedLists, filteredCards]);

  const activeDragCard = useMemo(
    () => (activeDragCardId ? cards.find((card) => card.id === activeDragCardId) ?? null : null),
    [cards, activeDragCardId],
  );

  const listNameById = useMemo(() => {
    return new Map(sortedLists.map((list) => [list.id, list.name]));
  }, [sortedLists]);

  const memberNameById = useMemo(() => {
    return new Map(
      initialData.members.map((member) => [
        member.user_id,
        member.profile?.display_name ?? member.profile?.email ?? member.user_id,
      ]),
    );
  }, [initialData.members]);

  const memberAvatarColorById = useMemo(() => {
    return new Map(
      initialData.members.map((member) => [member.user_id, resolveAvatarColor(member.profile?.avatar_color)]),
    );
  }, [initialData.members]);

  const cardMetaById = useMemo(() => {
    const map = new Map<string, BoardCardMeta>();
    cards.forEach((card) => {
      const assigneeIds = assigneeIdsByCard.get(card.id) ?? [];
      const assigneeNames = assigneeIds.map((id) => memberNameById.get(id) ?? id);
      const assigneePrimaryId = assigneeIds[0] ?? null;
      const assigneePrimary = assigneeNames[0] ?? null;
      map.set(card.id, {
        deadlineState: resolveCardDeadlineState(card.due_at, card.is_completed),
        dueLabel: formatCardDueLabel(card.due_at),
        assigneePrimary,
        assigneeInitial: toAssigneeInitial(assigneePrimary),
        assigneeColor: assigneePrimaryId ? (memberAvatarColorById.get(assigneePrimaryId) ?? null) : null,
        assigneeTooltip: assigneeNames.length > 0 ? assigneeNames.join(", ") : null,
        assigneeExtraCount: Math.max(assigneeNames.length - 1, 0),
      });
    });
    return map;
  }, [cards, assigneeIdsByCard, memberAvatarColorById, memberNameById]);

  const labelNameById = useMemo(() => {
    return new Map(labels.map((label) => [label.id, label.name]));
  }, [labels]);

  const sortedCustomFields = useMemo(
    () => [...customFields].sort((a, b) => a.position - b.position),
    [customFields],
  );

  const customFieldValueByCardAndField = useMemo(() => {
    const map = new Map<string, CardCustomFieldValue>();
    cardCustomFieldValues.forEach((value) => {
      map.set(`${value.card_id}:${value.custom_field_id}`, value);
    });
    return map;
  }, [cardCustomFieldValues]);

  const customFieldById = useMemo(
    () => new Map(sortedCustomFields.map((field) => [field.id, field])),
    [sortedCustomFields],
  );

  const searchParamsString = searchParams.toString();
  const tableSortState = useMemo<TableSortState>(() => {
    const params = new URLSearchParams(searchParamsString);
    return parseTableSortState(
      params,
      sortedCustomFields.map((field) => field.id),
    );
  }, [searchParamsString, sortedCustomFields]);
  const effectiveTableSortState = tableSortState ?? DEFAULT_TABLE_SORT_STATE;

  const tableCustomFieldColumns = useMemo(
    () => sortedCustomFields.map((field) => ({ id: field.id, name: field.name })),
    [sortedCustomFields],
  );

  const tableLists = useMemo(
    () => sortedLists.map((list) => ({ id: list.id, name: list.name })),
    [sortedLists],
  );

  const tableLabels = useMemo(
    () =>
      labels.map((label) => ({
        id: label.id,
        name: label.name || "（無題ラベル）",
      })),
    [labels],
  );

  const tableMembers = useMemo(
    () =>
      initialData.members.map((member) => ({
        id: member.user_id,
        name: memberNameById.get(member.user_id) ?? member.user_id,
      })),
    [initialData.members, memberNameById],
  );

  const baseTableCards = useMemo(
    () => [...filteredCards].sort((a, b) => a.position - b.position),
    [filteredCards],
  );

  const sortedTableCards = useMemo(() => {
    const activeSortState = effectiveTableSortState;

    const baseOrderByCardId = new Map(baseTableCards.map((card, index) => [card.id, index]));
    const customFieldId = activeSortState.key.startsWith("custom:")
      ? activeSortState.key.slice("custom:".length)
      : null;
    const customField = customFieldId ? customFieldById.get(customFieldId) : undefined;

    function resolveSortValue(card: BoardCard): string | number | boolean | null {
      if (activeSortState.key === "taskId") {
        return card.task_number;
      }

      if (activeSortState.key === "title") {
        return card.title.trim();
      }

      if (activeSortState.key === "list") {
        return listNameById.get(card.list_id) ?? null;
      }

      if (activeSortState.key === "labels") {
        const labelIds = labelIdsByCard.get(card.id) ?? [];
        const names = labelIds.map((id) => labelNameById.get(id) ?? id).filter((value) => value.length > 0);
        return normalizeSortableNameList(names);
      }

      if (activeSortState.key === "assignees") {
        const assigneeIds = assigneeIdsByCard.get(card.id) ?? [];
        const names = assigneeIds.map((id) => memberNameById.get(id) ?? id).filter((value) => value.length > 0);
        return normalizeSortableNameList(names);
      }

      if (activeSortState.key === "dueAt") {
        return toSortableTimestamp(card.due_at);
      }

      if (activeSortState.key === "status") {
        return card.is_completed;
      }

      if (!customFieldId) {
        return null;
      }

      const customFieldValue = customFieldValueByCardAndField.get(`${card.id}:${customFieldId}`);
      return resolveCustomFieldSortValue(customField, customFieldValue);
    }

    return [...baseTableCards].sort((left, right) => {
      const compared = compareTableSortValues(
        resolveSortValue(left),
        resolveSortValue(right),
        activeSortState.direction,
      );
      if (compared !== 0) return compared;

      return (baseOrderByCardId.get(left.id) ?? 0) - (baseOrderByCardId.get(right.id) ?? 0);
    });
  }, [
    assigneeIdsByCard,
    baseTableCards,
    customFieldById,
    customFieldValueByCardAndField,
    effectiveTableSortState,
    labelIdsByCard,
    labelNameById,
    listNameById,
    memberNameById,
  ]);

  const tableRows = useMemo(() => {
    return sortedTableCards.map((card) => {
      const meta = cardMetaById.get(card.id);
      const labelIds = labelIdsByCard.get(card.id) ?? [];
      const assigneeIds = assigneeIdsByCard.get(card.id) ?? [];
      return {
        id: card.id,
        taskId: formatTaskDisplayId(boardCode, card.task_number),
        title: card.title,
        listId: card.list_id,
        listName: listNameById.get(card.list_id) ?? BOARD_COMMON_LABELS.unknown,
        labelIds,
        assigneeIds,
        assigneePrimary: meta?.assigneePrimary ?? null,
        assigneeExtraCount: meta?.assigneeExtraCount ?? 0,
        labels: labelIds.map((id) => labelNameById.get(id) ?? id),
        customFieldValues: Object.fromEntries(
          sortedCustomFields.map((field) => {
            const value = customFieldValueByCardAndField.get(`${card.id}:${field.id}`);
            return [field.id, formatCustomFieldValue(field, value)];
          }),
        ) as Record<string, string>,
        dueAt: card.due_at,
        dueDateValue: toDateInputValue(card.due_at),
        dueLabel: meta?.dueLabel ?? null,
        deadlineState: meta?.deadlineState ?? resolveCardDeadlineState(card.due_at, card.is_completed),
        isCompleted: card.is_completed,
      };
    });
  }, [
    assigneeIdsByCard,
    boardCode,
    cardMetaById,
    customFieldValueByCardAndField,
    labelIdsByCard,
    labelNameById,
    listNameById,
    sortedCustomFields,
    sortedTableCards,
  ]);

  function getNextListPosition() {
    const maxPosition = lists.reduce((max, list) => Math.max(max, list.position), 0);
    return maxPosition + 1024;
  }

  function getNextCardPosition(listId: string) {
    const maxPosition = cards
      .filter((card) => card.list_id === listId && !card.archived)
      .reduce((max, card) => Math.max(max, card.position), 0);
    return maxPosition + 1024;
  }

  const applyCardDetailData = useCallback((cardId: string, detail: CardDetailData) => {
    const previousChecklistIds = new Set(
      checklistsRef.current
        .filter((checklist) => checklist.card_id === cardId)
        .map((checklist) => checklist.id),
    );
    const nextChecklistIds = new Set(detail.checklists.map((checklist) => checklist.id));

    setCardWatchers((current) => [
      ...current.filter((watcher) => watcher.card_id !== cardId),
      ...detail.watchers.map((userId) => ({ card_id: cardId, user_id: userId })),
    ]);
    setComments((current) => [
      ...current.filter((comment) => comment.card_id !== cardId),
      ...detail.comments,
    ]);
    setChecklists((current) => [
      ...current.filter((checklist) => checklist.card_id !== cardId),
      ...detail.checklists,
    ]);
    setChecklistItems((current) => [
      ...current.filter(
        (item) =>
          !previousChecklistIds.has(item.checklist_id) && !nextChecklistIds.has(item.checklist_id),
      ),
      ...detail.checklistItems,
    ]);
    setAttachments((current) => [
      ...current.filter((attachment) => attachment.card_id !== cardId),
      ...detail.attachments,
    ]);
  }, []);

  const fetchCardDetail = useCallback(
    async (cardId: string, options?: { force?: boolean }) => {
      const force = Boolean(options?.force);
      if (!force && loadedCardDetailRef.current.has(cardId)) {
        return;
      }

      setCardDetailLoadingById((current) => ({ ...current, [cardId]: true }));
      try {
        const response = await fetch(`/api/cards/${cardId}/detail`);
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.data) {
          throw new Error(body?.error?.message ?? "Failed to load card detail.");
        }

        applyCardDetailData(cardId, body.data as CardDetailData);
        loadedCardDetailRef.current.add(cardId);
      } catch (detailError) {
        setError(
          detailError instanceof Error
            ? detailError.message
            : "Failed to load card detail.",
        );
      } finally {
        setCardDetailLoadingById((current) => ({ ...current, [cardId]: false }));
      }
    },
    [applyCardDetailData],
  );

  useEffect(() => {
    if (!selectedCardId) return;
    void fetchCardDetail(selectedCardId);
  }, [fetchCardDetail, selectedCardId]);

  useEffect(() => {
    if (!selectedCardId) return;
    const channel = supabase.channel(
      `card-detail-sync:${initialData.board.id}:${selectedCardId}:${selectedCardChecklistIdsKey || "none"}`,
    );

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `card_id=eq.${selectedCardId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") {
            const removedComment = payload.old as Partial<CardComment>;
            if (!removedComment.id) return;
            setComments((current) => removeRealtimeComment(current, removedComment.id as string));
            return;
          }

          const nextComment = payload.new as Partial<CardComment>;
          if (
            typeof nextComment.id !== "string" ||
            typeof nextComment.card_id !== "string" ||
            typeof nextComment.user_id !== "string" ||
            typeof nextComment.content !== "string" ||
            typeof nextComment.created_at !== "string"
          ) {
            return;
          }
          const nextCommentId = nextComment.id;
          const nextCommentCardId = nextComment.card_id;
          const nextCommentUserId = nextComment.user_id;
          const nextCommentContent = nextComment.content;
          const nextCommentCreatedAt = nextComment.created_at;
          setComments((current) =>
            upsertRealtimeComment(current, {
              id: nextCommentId,
              card_id: nextCommentCardId,
              user_id: nextCommentUserId,
              content: nextCommentContent,
              created_at: nextCommentCreatedAt,
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checklists",
          filter: `card_id=eq.${selectedCardId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") {
            const removedChecklist = payload.old as Partial<Checklist>;
            if (!removedChecklist.id) return;
            setChecklists((current) => removeRealtimeChecklist(current, removedChecklist.id as string));
            setChecklistItems((current) =>
              removeRealtimeChecklistItemsByChecklist(current, removedChecklist.id as string),
            );
            return;
          }

          const nextChecklist = payload.new as Partial<Checklist>;
          if (
            typeof nextChecklist.id !== "string" ||
            typeof nextChecklist.card_id !== "string" ||
            typeof nextChecklist.title !== "string" ||
            typeof nextChecklist.position !== "number"
          ) {
            return;
          }
          const nextChecklistId = nextChecklist.id;
          const nextChecklistCardId = nextChecklist.card_id;
          const nextChecklistTitle = nextChecklist.title;
          const nextChecklistPosition = nextChecklist.position;
          setChecklists((current) =>
            upsertRealtimeChecklist(current, {
              id: nextChecklistId,
              card_id: nextChecklistCardId,
              title: nextChecklistTitle,
              position: nextChecklistPosition,
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attachments",
          filter: `card_id=eq.${selectedCardId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") {
            const removedAttachment = payload.old as Partial<Attachment>;
            if (!removedAttachment.id) return;
            setAttachments((current) => removeRealtimeAttachment(current, removedAttachment.id as string));
            return;
          }

          const nextAttachment = payload.new as Partial<Attachment>;
          if (
            typeof nextAttachment.id !== "string" ||
            typeof nextAttachment.card_id !== "string" ||
            typeof nextAttachment.name !== "string" ||
            typeof nextAttachment.storage_path !== "string" ||
            typeof nextAttachment.mime_type !== "string" ||
            typeof nextAttachment.size_bytes !== "number" ||
            typeof nextAttachment.created_at !== "string"
          ) {
            return;
          }
          const nextAttachmentId = nextAttachment.id;
          const nextAttachmentCardId = nextAttachment.card_id;
          const nextAttachmentName = nextAttachment.name;
          const nextAttachmentStoragePath = nextAttachment.storage_path;
          const nextAttachmentMimeType = nextAttachment.mime_type;
          const nextAttachmentSizeBytes = nextAttachment.size_bytes;
          const nextAttachmentCreatedAt = nextAttachment.created_at;
          const nextAttachmentPreviewUrl =
            typeof nextAttachment.preview_url === "string" ? nextAttachment.preview_url : null;
          setAttachments((current) =>
            upsertRealtimeAttachment(current, {
              id: nextAttachmentId,
              card_id: nextAttachmentCardId,
              name: nextAttachmentName,
              storage_path: nextAttachmentStoragePath,
              mime_type: nextAttachmentMimeType,
              size_bytes: nextAttachmentSizeBytes,
              preview_url: nextAttachmentPreviewUrl,
              created_at: nextAttachmentCreatedAt,
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "card_watchers",
          filter: `card_id=eq.${selectedCardId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") {
            const removedWatcher = payload.old as Partial<CardWatcher>;
            const hasWatcherIdentifier =
              Boolean(removedWatcher.id) ||
              (Boolean(removedWatcher.card_id) && Boolean(removedWatcher.user_id));
            setCardWatchers((current) =>
              removeRealtimeCardWatcher(current, {
                id: typeof removedWatcher.id === "string" ? removedWatcher.id : undefined,
                card_id: typeof removedWatcher.card_id === "string" ? removedWatcher.card_id : undefined,
                user_id: typeof removedWatcher.user_id === "string" ? removedWatcher.user_id : undefined,
              }),
            );
            if (!hasWatcherIdentifier) {
              void fetchCardDetail(selectedCardId, { force: true });
            }
            return;
          }

          const nextWatcher = payload.new as Partial<CardWatcher>;
          if (typeof nextWatcher.card_id !== "string" || typeof nextWatcher.user_id !== "string") return;
          const nextWatcherCardId = nextWatcher.card_id;
          const nextWatcherUserId = nextWatcher.user_id;
          const nextWatcherId = typeof nextWatcher.id === "string" ? nextWatcher.id : undefined;
          const nextWatcherCreatedAt =
            typeof nextWatcher.created_at === "string" ? nextWatcher.created_at : undefined;
          setCardWatchers((current) =>
            upsertRealtimeCardWatcher(current, {
              id: nextWatcherId,
              card_id: nextWatcherCardId,
              user_id: nextWatcherUserId,
              created_at: nextWatcherCreatedAt,
            }),
          );
        },
      );

    selectedCardChecklistIds.forEach((checklistId) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checklist_items",
          filter: `checklist_id=eq.${checklistId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") {
            const removedItem = payload.old as Partial<ChecklistItem>;
            if (!removedItem.id) return;
            setChecklistItems((current) => removeRealtimeChecklistItem(current, removedItem.id as string));
            return;
          }

          const nextItem = payload.new as Partial<ChecklistItem>;
          if (
            typeof nextItem.id !== "string" ||
            typeof nextItem.checklist_id !== "string" ||
            typeof nextItem.content !== "string" ||
            typeof nextItem.is_completed !== "boolean" ||
            typeof nextItem.position !== "number"
          ) {
            return;
          }
          const nextItemId = nextItem.id;
          const nextItemChecklistId = nextItem.checklist_id;
          const nextItemContent = nextItem.content;
          const nextItemIsCompleted = nextItem.is_completed;
          const nextItemPosition = nextItem.position;
          const nextItemAssigneeId = typeof nextItem.assignee_id === "string" ? nextItem.assignee_id : null;
          const nextItemDueAt = typeof nextItem.due_at === "string" ? nextItem.due_at : null;
          const nextItemCompletedBy = typeof nextItem.completed_by === "string" ? nextItem.completed_by : null;
          const nextItemCompletedAt = typeof nextItem.completed_at === "string" ? nextItem.completed_at : null;
          setChecklistItems((current) =>
            upsertRealtimeChecklistItem(current, {
              id: nextItemId,
              checklist_id: nextItemChecklistId,
              content: nextItemContent,
              is_completed: nextItemIsCompleted,
              position: nextItemPosition,
              assignee_id: nextItemAssigneeId,
              due_at: nextItemDueAt,
              completed_by: nextItemCompletedBy,
              completed_at: nextItemCompletedAt,
            }),
          );
        },
      );
    });

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    fetchCardDetail,
    initialData.board.id,
    selectedCardChecklistIds,
    selectedCardChecklistIdsKey,
    selectedCardId,
    supabase,
  ]);

  useEffect(() => {
    if (!selectedCardId) return;
    const activeSelectedCardId = selectedCardId;

    function syncSelectedCardDetail() {
      void fetchCardDetail(activeSelectedCardId, { force: true });
    }

    function handleFocus() {
      syncSelectedCardDetail();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncSelectedCardDetail();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchCardDetail, selectedCardId]);

  useEffect(() => {
    const boardId = initialData.board.id;
    const channel = supabase
      .channel(`board-sync:${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cards",
          filter: `board_id=eq.${boardId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") {
            const removedCard = payload.old as Partial<BoardCard>;
            if (!removedCard.id) return;

            setCards((current) => removeRealtimeCard(current, removedCard.id as string));
            loadedCardDetailRef.current.delete(removedCard.id);
            applyCardDetailData(removedCard.id, {
              watchers: [],
              comments: [],
              checklists: [],
              checklistItems: [],
              attachments: [],
            });
            return;
          }

          const nextCard = payload.new as Partial<BoardCard>;
          if (!nextCard.id) return;
          const normalized = nextCard as BoardCard;

          setCards((current) => upsertRealtimeCard(current, normalized));

          if (normalized.archived) {
            loadedCardDetailRef.current.delete(normalized.id);
            applyCardDetailData(normalized.id, {
              watchers: [],
              comments: [],
              checklists: [],
              checklistItems: [],
              attachments: [],
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lists",
          filter: `board_id=eq.${boardId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") {
            const removedList = payload.old as Partial<BoardList>;
            if (!removedList.id) return;
            setLists((current) => removeRealtimeList(current, removedList.id as string));
            return;
          }

          const nextList = payload.new as Partial<BoardList>;
          if (!nextList.id) return;
          const normalized = nextList as BoardList;
          setLists((current) => upsertRealtimeList(current, normalized));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "board_chat_messages",
          filter: `board_id=eq.${boardId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") {
            const removedMessage = payload.old as Partial<BoardChatMessage>;
            if (!removedMessage.id) return;
            setBoardChatMessages((current) => current.filter((message) => message.id !== removedMessage.id));
            setBoardChatDeletingIds((current) => current.filter((id) => id !== removedMessage.id));
            return;
          }

          const nextMessage = payload.new as Partial<BoardChatMessage>;
          if (!nextMessage.id || !nextMessage.created_at || !nextMessage.content || !nextMessage.user_id || !nextMessage.board_id) {
            return;
          }

          setBoardChatMessages((current) =>
            upsertBoardChatMessage(current, nextMessage as BoardChatMessage),
          );
        },
      );

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applyCardDetailData, initialData.board.id, supabase]);


  const boardBackground = useMemo<CSSProperties>(
    () => ({ background: UNIFIED_BOARD_BACKGROUND }),
    [],
  );

  function openCard(cardId: string) {
    setActiveCardId(cardId);
  }

  function closeCard() {
    setActiveCardId(null);
  }

  async function copyCardShareLink(cardId: string) {
    const sharePath = `/b/${boardSlug}/c/${cardId}`;
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${sharePath}` : sharePath;
    if (!navigator?.clipboard?.writeText) {
      setError("この環境ではリンクをコピーできません。");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareLinkCopied(true);
      window.setTimeout(() => setShareLinkCopied(false), 1800);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "リンクのコピーに失敗しました。");
    }
  }

  function refreshSelectedCardDetail() {
    if (!selectedCardId || selectedCardDetailLoading) {
      return;
    }
    void fetchCardDetail(selectedCardId, { force: true });
  }

  async function sendBoardChatMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || boardChatSending) return;

    setBoardChatSending(true);
    setBoardChatError(null);
    try {
      const response = await fetch(`/api/boards/${initialData.board.id}/chat-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) {
        throw new Error(body?.error?.message ?? "チャットの送信に失敗しました。");
      }

      setBoardChatMessages((current) => upsertBoardChatMessage(current, body.data as BoardChatMessage));
    } catch (chatSendError) {
      const message = chatSendError instanceof Error ? chatSendError.message : "チャットの送信に失敗しました。";
      setBoardChatError(message);
      throw chatSendError;
    } finally {
      setBoardChatSending(false);
    }
  }

  async function deleteBoardChatMessage(messageId: string) {
    if (boardChatDeletingIds.includes(messageId)) return;

    setBoardChatDeletingIds((current) => (current.includes(messageId) ? current : [...current, messageId]));
    setBoardChatError(null);
    try {
      const response = await fetch(`/api/boards/${initialData.board.id}/chat-messages/${messageId}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data?.deleted) {
        throw new Error(body?.error?.message ?? "チャットメッセージの削除に失敗しました。");
      }

      setBoardChatMessages((current) => current.filter((message) => message.id !== messageId));
    } catch (chatDeleteError) {
      const message =
        chatDeleteError instanceof Error ? chatDeleteError.message : "チャットメッセージの削除に失敗しました。";
      setBoardChatError(message);
      throw chatDeleteError;
    } finally {
      setBoardChatDeletingIds((current) => current.filter((id) => id !== messageId));
    }
  }

  async function loadOlderBoardChatMessages() {
    if (!boardChatHasMore || boardChatLoadingMore || !boardChatNextBefore) return;

    setBoardChatLoadingMore(true);
    setBoardChatError(null);
    try {
      const query = `before=${encodeURIComponent(boardChatNextBefore)}`;
      const response = await fetch(`/api/boards/${initialData.board.id}/chat-messages?${query}`);
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) {
        throw new Error(body?.error?.message ?? "過去メッセージの取得に失敗しました。");
      }

      const data = body.data as Partial<BoardChatPageData>;
      const incomingMessages = Array.isArray(data.messages)
        ? (data.messages as BoardChatMessage[])
        : [];

      setBoardChatMessages((current) =>
        incomingMessages.reduce((acc, message) => upsertBoardChatMessage(acc, message), current),
      );
      setBoardChatHasMore(Boolean(data.hasMore));
      setBoardChatNextBefore(
        typeof data.nextBefore === "string"
          ? data.nextBefore
          : data.hasMore
            ? (incomingMessages[0]?.created_at ?? boardChatNextBefore)
            : null,
      );
    } catch (chatLoadError) {
      const message = chatLoadError instanceof Error ? chatLoadError.message : "過去メッセージの取得に失敗しました。";
      setBoardChatError(message);
    } finally {
      setBoardChatLoadingMore(false);
    }
  }

  async function persistPreferences(patch: {
    selectedView?: ViewMode;
    leftRailCollapsed?: boolean;
  }) {
    await fetch("/api/user/board-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: initialData.board.id, ...patch }),
    });
  }

  async function createList(name: string) {
    const response = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: initialData.board.id, name, position: getNextListPosition() }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? BOARD_ERROR_MESSAGES.createList);
    setLists((current) => [...current, body.data]);
  }

  async function createCard(listId: string, title: string) {
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: initialData.board.id, listId, title, position: getNextCardPosition(listId) }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? BOARD_ERROR_MESSAGES.createCard);
    setCards((current) => [...current, body.data]);
  }

  async function createUnscheduledCard(listId: string, title: string) {
    await createCard(listId, title);
  }

  async function submitHeaderTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (headerTaskSubmitting) return;

    const title = headerTaskTitle.trim();
    if (!title) return;
    if (!headerTaskListId) {
      setHeaderTaskError("先にリストを追加してください。");
      return;
    }

    setHeaderTaskSubmitting(true);
    setHeaderTaskError(null);
    try {
      await createCard(headerTaskListId, title);
      setHeaderTaskTitle("");
      setShowHeaderTaskAdd(false);
    } catch (headerCreateError) {
      setHeaderTaskError(
        headerCreateError instanceof Error ? headerCreateError.message : BOARD_ERROR_MESSAGES.createCard,
      );
    } finally {
      setHeaderTaskSubmitting(false);
    }
  }

  async function placeUnscheduledCard(cardId: string, listId: string, dayKey: string) {
    const movingCard = cards.find((card) => card.id === cardId);
    if (!movingCard) {
      throw new Error(BOARD_ERROR_MESSAGES.moveCard);
    }

    const targetDay = parseDayKey(dayKey);
    if (!targetDay) {
      throw new Error(BOARD_ERROR_MESSAGES.moveCard);
    }

    const startAt = toLocalStartIso(targetDay);
    const dueAt = startAt;
    const previous = cards;

    setCards((current) =>
      current.map((card) =>
        card.id === cardId
          ? {
              ...card,
              list_id: listId,
              start_at: startAt,
              due_at: dueAt,
            }
          : card,
      ),
    );

    try {
      const updated = await patchCard(cardId, {
        listId,
        startAt,
        dueAt,
      });
      setCards((current) => current.map((card) => (card.id === updated.id ? updated : card)));
    } catch (error) {
      setCards(previous);
      const message = error instanceof Error ? error.message : BOARD_ERROR_MESSAGES.moveCard;
      setError(message);
      throw new Error(message);
    }
  }

  async function patchCard(cardId: string, patch: Record<string, unknown>): Promise<BoardCard> {
    const response = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error?.message ?? BOARD_ERROR_MESSAGES.moveCard);
    }
    return body.data as BoardCard;
  }

  function replaceCardAssignees(cardId: string, nextAssigneeIds: string[]) {
    setCardAssignees((current) => [
      ...current.filter((item) => item.card_id !== cardId),
      ...nextAssigneeIds.map((userId) => ({ card_id: cardId, user_id: userId })),
    ]);
  }

  function replaceCardLabels(cardId: string, nextLabelIds: string[]) {
    setCardLabels((current) => [
      ...current.filter((item) => item.card_id !== cardId),
      ...nextLabelIds.map((labelId) => ({ card_id: cardId, label_id: labelId })),
    ]);
  }

  async function runTableCardPatch({
    cardId,
    patch,
    applyOptimistic,
    rollback,
    fallbackMessage,
  }: {
    cardId: string;
    patch: Record<string, unknown>;
    applyOptimistic: () => void;
    rollback: () => void;
    fallbackMessage: string;
  }) {
    if (tableSavingByCardIdRef.current[cardId]) return;

    setError(null);
    setTableSavingByCardId((current) => ({ ...current, [cardId]: true }));
    tableSavingByCardIdRef.current = { ...tableSavingByCardIdRef.current, [cardId]: true };

    applyOptimistic();
    try {
      const updated = await patchCard(cardId, patch);
      setCards((current) => current.map((card) => (card.id === cardId ? updated : card)));
    } catch (error) {
      rollback();
      setError(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setTableSavingByCardId((current) => ({ ...current, [cardId]: false }));
      tableSavingByCardIdRef.current = { ...tableSavingByCardIdRef.current, [cardId]: false };
    }
  }

  function handleTableListChange(cardId: string, nextListId: string) {
    const previousCard = cards.find((card) => card.id === cardId);
    if (!previousCard || previousCard.list_id === nextListId) return;

    void runTableCardPatch({
      cardId,
      patch: { listId: nextListId },
      applyOptimistic: () => {
        setCards((current) =>
          current.map((card) => (card.id === cardId ? { ...card, list_id: nextListId } : card)),
        );
      },
      rollback: () => {
        setCards((current) =>
          current.map((card) => (card.id === cardId ? { ...card, list_id: previousCard.list_id } : card)),
        );
      },
      fallbackMessage: BOARD_ERROR_MESSAGES.moveCard,
    });
  }

  function handleTableLabelsChange(cardId: string, nextLabelIds: string[]) {
    const previousLabelIds = labelIdsByCard.get(cardId) ?? [];
    if (areStringArraysEqual(previousLabelIds, nextLabelIds)) return;

    void runTableCardPatch({
      cardId,
      patch: { labelIds: nextLabelIds },
      applyOptimistic: () => replaceCardLabels(cardId, nextLabelIds),
      rollback: () => replaceCardLabels(cardId, previousLabelIds),
      fallbackMessage: BOARD_ERROR_MESSAGES.moveCard,
    });
  }

  function handleTableAssigneesChange(cardId: string, nextAssigneeIds: string[]) {
    const previousAssigneeIds = assigneeIdsByCard.get(cardId) ?? [];
    if (areStringArraysEqual(previousAssigneeIds, nextAssigneeIds)) return;

    void runTableCardPatch({
      cardId,
      patch: { assigneeIds: nextAssigneeIds },
      applyOptimistic: () => replaceCardAssignees(cardId, nextAssigneeIds),
      rollback: () => replaceCardAssignees(cardId, previousAssigneeIds),
      fallbackMessage: BOARD_ERROR_MESSAGES.moveCard,
    });
  }

  function handleTableDueDateChange(cardId: string, dueDate: string | null) {
    const previousCard = cards.find((card) => card.id === cardId);
    if (!previousCard) return;

    const previousDueDate = toDateInputValue(previousCard.due_at);
    const nextDueDate = dueDate ?? "";
    if (previousDueDate === nextDueDate) return;

    const nextDueAtIso = dueDate ? toDueAtIsoFromDate(dueDate) : null;
    if (dueDate && !nextDueAtIso) {
      setError("期限日の形式が正しくありません。");
      return;
    }

    void runTableCardPatch({
      cardId,
      patch: { dueAt: nextDueAtIso },
      applyOptimistic: () => {
        setCards((current) =>
          current.map((card) => (card.id === cardId ? { ...card, due_at: nextDueAtIso } : card)),
        );
      },
      rollback: () => {
        setCards((current) =>
          current.map((card) => (card.id === cardId ? { ...card, due_at: previousCard.due_at } : card)),
        );
      },
      fallbackMessage: BOARD_ERROR_MESSAGES.moveCard,
    });
  }

  function handleTableStatusChange(cardId: string, isCompleted: boolean) {
    const previousCard = cards.find((card) => card.id === cardId);
    if (!previousCard || previousCard.is_completed === isCompleted) return;

    const completedAt = isCompleted ? new Date().toISOString() : null;

    void runTableCardPatch({
      cardId,
      patch: { isCompleted },
      applyOptimistic: () => {
        setCards((current) =>
          current.map((card) =>
            card.id === cardId ? { ...card, is_completed: isCompleted, completed_at: completedAt } : card,
          ),
        );
      },
      rollback: () => {
        setCards((current) =>
          current.map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  is_completed: previousCard.is_completed,
                  completed_at: previousCard.completed_at,
                }
              : card,
          ),
        );
      },
      fallbackMessage: BOARD_ERROR_MESSAGES.moveCard,
    });
  }

  function handleTableSort(sortKey: TableSortKey) {
    const nextSortState = getNextTableSortState(effectiveTableSortState, sortKey);
    const nextParams = applyTableSortStateToSearchParams(
      new URLSearchParams(searchParamsString),
      nextSortState,
    );
    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  async function archiveList(list: BoardList) {
    const response = await fetch(`/api/lists/${list.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? BOARD_ERROR_MESSAGES.archiveList);
      return;
    }
    setLists((current) => current.map((value) => (value.id === list.id ? body.data : value)));
    setCards((current) => current.filter((card) => card.list_id !== list.id));
  }

  async function updateListPosition(listId: string, position: number) {
    const response = await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error?.message ?? LIST_REORDER_ERROR_MESSAGE);
    }
  }

  function cancelBoardNameEdit() {
    setIsEditingBoardName(false);
    setBoardNameDraft(boardName);
  }

  function startBoardNameEdit() {
    if (!canManageBoardUi || isSavingBoardName) return;
    setError(null);
    setBoardNameDraft(boardName);
    setIsEditingBoardName(true);
  }

  async function renameBoard() {
    if (!canManageBoardUi || isSavingBoardName) return;
    const trimmed = boardNameDraft.trim();
    if (!trimmed || trimmed === boardName) {
      cancelBoardNameEdit();
      return;
    }
    if (trimmed.length < 2) {
      setError(BOARD_ERROR_MESSAGES.boardNameTooShort);
      return;
    }

    setIsSavingBoardName(true);
    const response = await fetch(`/api/boards/${initialData.board.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const body = await response.json().catch(() => null);
    setIsSavingBoardName(false);

    if (!response.ok) {
      setError(body?.error?.message ?? BOARD_ERROR_MESSAGES.renameBoard);
      return;
    }

    const nextName = typeof body?.data?.name === "string" ? body.data.name : trimmed;
    const nextSlug = typeof body?.data?.slug === "string" ? body.data.slug : boardSlug;

    setError(null);
    setBoardName(nextName);
    setBoardSlug(nextSlug);
    setBoardNameDraft(nextName);
    setWorkspaceBoards((current) =>
      current.map((item) => (item.id === initialData.board.id ? { ...item, name: nextName, slug: nextSlug } : item)),
    );
    setIsEditingBoardName(false);
  }

  function handleBoardNameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void renameBoard();
    } else if (event.key === "Escape") {
      cancelBoardNameEdit();
    }
  }

  function handleBoardNameButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startBoardNameEdit();
    }
  }

  function resetTimelineDragTracking() {
    timelineDragStartXRef.current = null;
    timelineDragSnapshotRef.current = null;
  }

  function onDragStart(event: DragStartEvent) {
    const activeId = event.active?.id ? String(event.active.id) : "";
    const timelineActive = parseTimelineActiveId(activeId);
    const calendarActive = parseCalendarActiveId(activeId);
    const activeCardId = parseCardDndId(activeId);

    setActiveDragCardId(
      activeCardId ?? timelineActive?.cardId ?? calendarActive?.cardId ?? null,
    );

    timelineDragStartXRef.current = getPointerClientX(event.activatorEvent);
    timelineDragSnapshotRef.current = null;

    const datedActive = timelineActive ?? calendarActive;
    if (!datedActive) return;

    const movingCard = cards.find((card) => card.id === datedActive.cardId);
    if (!movingCard) return;

    const range = normalizeRange(movingCard.start_at, movingCard.due_at);
    if (!range) return;

    timelineDragSnapshotRef.current = {
      kind: datedActive.kind,
      cardId: movingCard.id,
      listId: movingCard.list_id,
      range,
    };
  }

  function onDragMove(event: DragMoveEvent) {
    const activeId = event.active?.id ? String(event.active.id) : "";
    if (!parseTimelineActiveId(activeId) && !isTimelinePlacementActiveId(activeId)) return;

    const timelineScroller = document.querySelector(".tm-timeline-scroll");
    if (!(timelineScroller instanceof HTMLElement)) return;

    const pointerStartX = timelineDragStartXRef.current;
    if (pointerStartX === null) return;

    const pointerX = pointerStartX + event.delta.x;
    const rect = timelineScroller.getBoundingClientRect();
    const edgeThreshold = 72;
    const maxStep = 24;

    if (pointerX < rect.left + edgeThreshold) {
      const ratio = Math.min((rect.left + edgeThreshold - pointerX) / edgeThreshold, 1);
      timelineScroller.scrollLeft -= Math.ceil(maxStep * ratio);
      return;
    }

    if (pointerX > rect.right - edgeThreshold) {
      const ratio = Math.min((pointerX - (rect.right - edgeThreshold)) / edgeThreshold, 1);
      timelineScroller.scrollLeft += Math.ceil(maxStep * ratio);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const activeId = event.active?.id ? String(event.active.id) : null;
    const overId = event.over?.id ? String(event.over.id) : null;
    setActiveDragCardId(null);
    if (!activeId) {
      resetTimelineDragTracking();
      return;
    }
    const timelineActive = parseTimelineActiveId(activeId);
    const calendarActive = parseCalendarActiveId(activeId);
    const activeListColumnId = parseListColumnDndId(activeId);
    const overListColumnId = overId ? parseListColumnDndId(overId) : null;
    if (activeId === overId && overId && !timelineActive && !calendarActive) {
      resetTimelineDragTracking();
      return;
    }

    if (activeListColumnId) {
      resetTimelineDragTracking();
      if (!overListColumnId || activeListColumnId === overListColumnId) {
        return;
      }
      const targetPosition = getReorderedItemPosition(sortedLists, activeListColumnId, overListColumnId);
      if (targetPosition === null) return;

      const previous = lists;
      setLists((current) =>
        current.map((list) =>
          list.id === activeListColumnId ? { ...list, position: targetPosition } : list,
        ),
      );

      try {
        await updateListPosition(activeListColumnId, targetPosition);
      } catch (error) {
        setLists(previous);
        setError(error instanceof Error ? error.message : LIST_REORDER_ERROR_MESSAGE);
      }
      return;
    }

    const timelineOver = overId ? parseTimelineOverId(overId) : null;
    const calendarOver = overId ? parseCalendarOverId(overId) : null;

    if (timelineActive) {
      const movingCard = cards.find((card) => card.id === timelineActive.cardId);
      if (!movingCard) {
        resetTimelineDragTracking();
        return;
      }
      const previous = cards;

      if (timelineOver?.type === "unscheduled") {
        if (movingCard.list_id === timelineOver.listId && !movingCard.start_at && !movingCard.due_at) {
          resetTimelineDragTracking();
          return;
        }
        setCards((current) =>
          current.map((card) =>
            card.id === movingCard.id
              ? { ...card, list_id: timelineOver.listId, start_at: null, due_at: null }
              : card,
          ),
        );
        try {
          const updated = await patchCard(movingCard.id, {
            listId: timelineOver.listId,
            startAt: null,
            dueAt: null,
          });
          setCards((current) => current.map((card) => (card.id === updated.id ? updated : card)));
        } catch (error) {
          setCards(previous);
          setError(error instanceof Error ? error.message : BOARD_ERROR_MESSAGES.moveCard);
        }
        resetTimelineDragTracking();
        return;
      }

      let targetListId = movingCard.list_id;
      let nextRange: { start: Date; end: Date } | null = null;

      if (timelineOver?.type === "day") {
        targetListId = timelineOver.listId;
        const targetDay = parseDayKey(timelineOver.dayKey);
        if (!targetDay) {
          resetTimelineDragTracking();
          return;
        }
        const currentRange = normalizeRange(movingCard.start_at, movingCard.due_at) ?? {
          start: targetDay,
          end: targetDay,
        };
        nextRange =
          timelineActive.kind === "move"
            ? shiftRangeToDay(currentRange, targetDay)
            : timelineActive.kind === "resize-start"
              ? resizeRangeFromStart(currentRange, targetDay)
              : resizeRangeFromEnd(currentRange, targetDay);
      } else {
        const snapshot = timelineDragSnapshotRef.current;
        const baseRange =
          snapshot && snapshot.cardId === movingCard.id
            ? snapshot.range
            : normalizeRange(movingCard.start_at, movingCard.due_at);
        if (!baseRange) {
          resetTimelineDragTracking();
          return;
        }
        const dayShift = deltaXToDayShift(event.delta.x, TIMELINE_DAY_WIDTH_PX);
        if (dayShift === 0) {
          resetTimelineDragTracking();
          return;
        }
        nextRange =
          timelineActive.kind === "move"
            ? shiftRangeToDay(baseRange, addDays(baseRange.start, dayShift))
            : timelineActive.kind === "resize-start"
              ? resizeRangeFromStart(baseRange, addDays(baseRange.start, dayShift))
              : resizeRangeFromEnd(baseRange, addDays(baseRange.end, dayShift));
      }

      if (!nextRange) {
        resetTimelineDragTracking();
        return;
      }

      const nextStartAt = toLocalStartIso(nextRange.start);
      const nextDueAt = toLocalStartIso(nextRange.end);

      const unchanged =
        movingCard.list_id === targetListId &&
        movingCard.start_at === nextStartAt &&
        movingCard.due_at === nextDueAt;
      if (unchanged) {
        resetTimelineDragTracking();
        return;
      }

      setCards((current) =>
        current.map((card) =>
          card.id === movingCard.id
            ? {
                ...card,
                list_id: targetListId,
                start_at: nextStartAt,
                due_at: nextDueAt,
              }
            : card,
        ),
      );

      try {
        const updated = await patchCard(movingCard.id, {
          listId: targetListId,
          startAt: nextStartAt,
          dueAt: nextDueAt,
        });
        setCards((current) => current.map((card) => (card.id === updated.id ? updated : card)));
      } catch (error) {
        setCards(previous);
        setError(error instanceof Error ? error.message : BOARD_ERROR_MESSAGES.moveCard);
      }
      resetTimelineDragTracking();
      return;
    }

    if (calendarActive) {
      const movingCard = cards.find((card) => card.id === calendarActive.cardId);
      if (!movingCard) {
        resetTimelineDragTracking();
        return;
      }

      const calendarOverDay =
        calendarOver?.type === "day" ? parseDayKey(calendarOver.dayKey) : null;
      const snapshot = timelineDragSnapshotRef.current;
      const fallbackBaseRange = calendarOverDay ?? new Date();
      const baseRange =
        snapshot && snapshot.cardId === movingCard.id
          ? snapshot.range
          : normalizeRange(movingCard.start_at, movingCard.due_at) ?? {
              start: fallbackBaseRange,
              end: fallbackBaseRange,
            };

      const calendarDayWidthPx = getCalendarDayWidthPx();
      const dayShift = deltaXToCalendarDayShift(event.delta.x, calendarDayWidthPx);

      let nextRange: { start: Date; end: Date } | null = null;
      if (calendarActive.kind === "move") {
        const startEdgeDay = getCalendarStartEdgeDay(event);
        if (startEdgeDay) {
          nextRange = shiftRangeToDay(baseRange, startEdgeDay);
        } else if (dayShift !== 0) {
          nextRange = shiftRangeToDay(baseRange, addDays(baseRange.start, dayShift));
        }
      } else if (calendarActive.kind === "resize-start") {
        if (calendarOverDay) {
          nextRange = resizeRangeFromStart(baseRange, calendarOverDay);
        } else if (dayShift !== 0) {
          nextRange = resizeRangeFromStart(baseRange, addDays(baseRange.start, dayShift));
        }
      } else {
        if (calendarOverDay) {
          nextRange = resizeRangeFromEnd(baseRange, calendarOverDay);
        } else if (dayShift !== 0) {
          nextRange = resizeRangeFromEnd(baseRange, addDays(baseRange.end, dayShift));
        }
      }

      if (!nextRange) {
        resetTimelineDragTracking();
        return;
      }

      const nextStartAt = toLocalStartIso(nextRange.start);
      const nextDueAt = toLocalStartIso(nextRange.end);

      if (movingCard.start_at === nextStartAt && movingCard.due_at === nextDueAt) {
        resetTimelineDragTracking();
        return;
      }

      const previous = cards;
      setCards((current) =>
        current.map((card) =>
          card.id === movingCard.id
            ? {
                ...card,
                start_at: nextStartAt,
                due_at: nextDueAt,
              }
            : card,
        ),
      );

      try {
        const updated = await patchCard(movingCard.id, {
          startAt: nextStartAt,
          dueAt: nextDueAt,
        });
        setCards((current) => current.map((card) => (card.id === updated.id ? updated : card)));
      } catch (error) {
        setCards(previous);
        setError(error instanceof Error ? error.message : BOARD_ERROR_MESSAGES.moveCard);
      }
      resetTimelineDragTracking();
      return;
    }

    resetTimelineDragTracking();
    if (!overId) return;

    const overCardId = parseCardDndId(overId);
    const overCard = overCardId ? cards.find((card) => card.id === overCardId) : null;
    const targetListId =
      overId.startsWith("list:")
        ? overId.replace("list:", "")
        : overListColumnId ?? overCard?.list_id;
    const activeCardId = parseCardDndId(activeId);
    if (!targetListId || !activeCardId) return;

    const movingCard = cards.find((card) => card.id === activeCardId);
    if (!movingCard) return;
    if (overCard && overCard.id === movingCard.id) return;

    const targetPosition =
      overCard && overCard.id !== movingCard.id
        ? overCard.position - 1
        : getNextCardPosition(targetListId);
    if (movingCard.list_id === targetListId && movingCard.position === targetPosition) return;

    const previous = cards;

    setCards((current) =>
      current.map((card) =>
        card.id === movingCard.id ? { ...card, list_id: targetListId, position: targetPosition } : card,
      ),
    );

    const response = await fetch(`/api/cards/${movingCard.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: targetListId, position: targetPosition }),
    });

    if (!response.ok) {
      setCards(previous);
      setError(BOARD_ERROR_MESSAGES.moveCard);
    }
  }

  function onDragCancel() {
    setActiveDragCardId(null);
    resetTimelineDragTracking();
  }

  function selectView(mode: ViewMode) {
    setViewMode(mode);
    if (mode !== "board") {
      setShowListComposer(false);
    }
    setShowViewPicker(false);
    void persistPreferences({ selectedView: mode });
  }

  function clearFilters() {
    setKeywordQuery("");
    setMemberFilters(DEFAULT_MEMBER_FILTERS);
    setStatusFilters(DEFAULT_STATUS_FILTERS);
    setListFilters(DEFAULT_LIST_FILTERS);
    setDueFilters([]);
    setLabelFilters(DEFAULT_LABEL_FILTERS);
  }

  function toggleMemberIdFilter(memberId: string) {
    setMemberFilters((current) => ({
      ...current,
      memberIds: current.memberIds.includes(memberId)
        ? current.memberIds.filter((id) => id !== memberId)
        : [...current.memberIds, memberId],
    }));
  }

  function toggleDueFilter(bucket: DueBucket) {
    setDueFilters((current) => (
      current.includes(bucket) ? current.filter((value) => value !== bucket) : [...current, bucket]
    ));
  }

  function toggleListIdFilter(listId: string) {
    setListFilters((current) => ({
      ...current,
      listIds: current.listIds.includes(listId)
        ? current.listIds.filter((id) => id !== listId)
        : [...current.listIds, listId],
    }));
  }

  function toggleLabelIdFilter(labelId: string) {
    setLabelFilters((current) => ({
      ...current,
      labelIds: current.labelIds.includes(labelId)
        ? current.labelIds.filter((id) => id !== labelId)
        : [...current.labelIds, labelId],
    }));
  }

  const userInitial = (
    initialData.currentUser.display_name ??
    initialData.currentUser.email ??
    BOARD_COMMON_LABELS.user
  )
    .charAt(0)
    .toUpperCase();
  const currentUserAvatarColor = resolveAvatarColor(
    initialData.currentUser.avatar_color ?? memberAvatarColorById.get(currentUserId),
  );
  const currentUserRoleLabel = BOARD_ROLE_LABELS[initialData.currentUser.role] ?? initialData.currentUser.role;
  const hasActiveFilters = Boolean(
    keywordQuery.trim() ||
      memberFilters.unassigned ||
      memberFilters.assignedToMe ||
      memberFilters.memberIds.length ||
      statusFilters.completed ||
      statusFilters.nonCompleted ||
      listFilters.listIds.length ||
      dueFilters.length ||
      labelFilters.noLabel ||
      labelFilters.labelIds.length,
  );
  const filtersVisible = showFilterPanel;
  const CurrentViewIcon = VIEW_MENU_ITEMS.find((item) => item.mode === viewMode)?.icon ?? Kanban;
  const boardDescriptionText = initialData.board.description?.trim() ?? "";
  const showBoardDescription = boardDescriptionText.length > 0 && boardDescriptionText !== "初期テンプレート";

  useEffect(() => {
    if (!showViewPicker && !showHeaderTaskAdd && !showFilterPanel && !boardChatMobileOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (showViewPicker && !viewPickerRef.current?.contains(event.target as Node)) {
        setShowViewPicker(false);
      }
      if (
        showHeaderTaskAdd &&
        !headerTaskSubmitting &&
        !headerTaskAddRef.current?.contains(event.target as Node)
      ) {
        setShowHeaderTaskAdd(false);
        setHeaderTaskTitle("");
        setHeaderTaskError(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (showViewPicker) {
        setShowViewPicker(false);
      }
      if (showHeaderTaskAdd && !headerTaskSubmitting) {
        setShowHeaderTaskAdd(false);
        setHeaderTaskTitle("");
        setHeaderTaskError(null);
      }
      if (showFilterPanel) {
        setShowFilterPanel(false);
      }
      if (boardChatMobileOpen) {
        setBoardChatMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [boardChatMobileOpen, headerTaskSubmitting, showFilterPanel, showHeaderTaskAdd, showViewPicker]);

  return (
    <main className="tm-root" style={boardBackground}>
      <header className="tm-top-nav">
        <div className="flex items-center gap-3">
          <Link className="font-semibold hover:opacity-80 transition-opacity" href="/">
            myTaskApp
          </Link>
        </div>
        <div className="relative flex items-center justify-end gap-2">
          <HomeUserMenu
            userId={initialData.currentUser.id}
            initialEmail={initialData.currentUser.email ?? ""}
            initialDisplayName={initialData.currentUser.display_name}
            initialAvatarColor={initialData.currentUser.avatar_color}
            menuMetaText={currentUserRoleLabel}
          />
        </div>
      </header>

      <div
        className="tm-body"
        ref={leftRailBodyRef}
        style={
          {
            "--app-sidebar-width": `${
              leftRailCollapsed ? BOARD_LEFT_RAIL_COLLAPSED_WIDTH_PX : leftRailWidth
            }px`,
          } as CSSProperties
        }
      >
        <aside
          className={`tm-left-rail ${leftRailResizing ? "tm-left-rail-resizing" : ""}`}
        >
          <div className="mb-3 flex items-center justify-between">
            {!leftRailCollapsed ? <h2 className="text-lg font-bold">{BOARD_COMMON_LABELS.workspace}</h2> : null}
            <button
              className="tm-icon-button"
              type="button"
              onClick={() => {
                const next = !leftRailCollapsed;
                setLeftRailCollapsed(next);
                void persistPreferences({ leftRailCollapsed: next });
              }}
            >
              {leftRailCollapsed ? ">" : "<"}
            </button>
          </div>

          {!leftRailCollapsed ? (
            <div className="tm-left-rail-content">
              <div className="tm-left-rail-top">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{BOARD_COMMON_LABELS.boards}</p>
                  <div className="mt-2 space-y-1">
                    {workspaceBoards.map((board) => {
                      const isCurrentBoard = board.id === initialData.board.id;
                      if (isCurrentBoard && canManageBoardUi) {
                        return (
                          <div key={board.id} className="rounded-md bg-blue-100 px-2 py-1.5 text-sm text-blue-700">
                            {isEditingBoardName ? (
                              <p className="w-full truncate font-semibold">{boardNameDraft}</p>
                            ) : (
                              <button
                                className="w-full truncate text-left font-semibold"
                                type="button"
                                onClick={startBoardNameEdit}
                                onKeyDown={handleBoardNameButtonKeyDown}
                              >
                                {board.name}
                              </button>
                            )}
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={board.id}
                          className={`block rounded-md px-2 py-1.5 text-sm ${
                            isCurrentBoard ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                          }`}
                          href={`/b/${board.slug}`}
                          prefetch={false}
                        >
                          {board.name}
                        </Link>
                      );
                    })}
                  </div>
                  <button
                    className="mt-3 block w-full rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-200"
                    type="button"
                    onClick={() => setShowCreateBoardModal(true)}
                  >
                    + ボードを追加
                  </button>
                </div>
              </div>
              <BoardChatPanel
                members={initialData.members}
                messages={boardChatMessages}
                currentUserId={currentUserId}
                collapsed={boardChatCollapsed}
                sending={boardChatSending}
                loadingMore={boardChatLoadingMore}
                hasMore={boardChatHasMore}
                deletingMessageIds={boardChatDeletingIds}
                error={boardChatError}
                onToggleCollapsed={() => setBoardChatCollapsed((current) => !current)}
                onSend={sendBoardChatMessage}
                onDeleteMessage={deleteBoardChatMessage}
                onLoadMore={loadOlderBoardChatMessages}
                onClearError={() => setBoardChatError(null)}
              />
            </div>
          ) : null}
        </aside>
        <button
          className={`app-sidebar-resizer ${leftRailResizing ? "app-sidebar-resizer-active" : ""} ${
            leftRailCollapsed ? "app-sidebar-resizer-disabled" : ""
          }`}
          type="button"
          aria-label="サイドバー幅を調整"
          aria-orientation="vertical"
          disabled={leftRailCollapsed}
          onPointerDown={handleLeftRailResizerPointerDown}
        />

        <section className="tm-main-view">
          <div className="tm-board-header">
            <div className="tm-board-header-main">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{initialData.workspace.name}</p>
              <div className="tm-board-title-row">
                {isEditingBoardName ? (
                  <input
                    className="tm-board-name-input"
                    value={boardNameDraft}
                    onChange={(event) => setBoardNameDraft(event.target.value)}
                    onBlur={() => void renameBoard()}
                    onKeyDown={handleBoardNameKeyDown}
                    aria-label={BOARD_COMMON_LABELS.boardName}
                    autoFocus
                    disabled={isSavingBoardName}
                  />
                ) : (
                  <button
                    className="tm-board-name-button"
                    type="button"
                    onClick={startBoardNameEdit}
                    onKeyDown={handleBoardNameButtonKeyDown}
                    disabled={!canManageBoardUi}
                    aria-label={canManageBoardUi ? BOARD_COMMON_LABELS.boardNameEdit : BOARD_COMMON_LABELS.boardName}
                  >
                    <h1 className="text-2xl font-bold text-slate-900">{boardName}</h1>
                  </button>
                )}
                <div className="tm-view-picker" ref={viewPickerRef}>
                  <button
                    className="tm-view-picker-trigger"
                    type="button"
                    aria-label="\u30d3\u30e5\u30fc\u3092\u9078\u629e"
                    onClick={() =>
                      setShowViewPicker((value) => {
                        const next = !value;
                        if (next) {
                          setShowHeaderTaskAdd(false);
                          setHeaderTaskTitle("");
                          setHeaderTaskError(null);
                        }
                        return next;
                      })
                    }
                  >
                    <CurrentViewIcon className="h-4 w-4" />
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {showViewPicker ? (
                    <div className="tm-view-picker-panel" role="dialog" aria-label="\u30d3\u30e5\u30fc">
                      <div className="tm-view-picker-header">
                        <p className="tm-view-picker-title">{"\u30d3\u30e5\u30fc"}</p>
                        <button
                          className="tm-view-picker-close"
                          type="button"
                          aria-label="\u9589\u3058\u308b"
                          onClick={() => setShowViewPicker(false)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="tm-view-picker-list">
                        {VIEW_MENU_ITEMS.map((item) => {
                          const Icon = item.icon;
                          const isActive = viewMode === item.mode;
                          return (
                            <button
                              key={item.mode}
                              className={`tm-view-picker-item ${isActive ? "tm-view-picker-item-active" : ""}`}
                              type="button"
                              onClick={() => selectView(item.mode)}
                            >
                              <Icon className="tm-view-picker-icon" />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="tm-header-task-add" ref={headerTaskAddRef}>
                  <button
                    className="tm-header-task-add-trigger"
                    type="button"
                    aria-label={headerTaskAddDisabled ? "先にリストを追加してください" : "タスクを追加"}
                    title={headerTaskAddDisabled ? "先にリストを追加してください" : "タスクを追加"}
                    disabled={headerTaskAddDisabled || headerTaskSubmitting}
                    onClick={() =>
                      setShowHeaderTaskAdd((current) => {
                        const next = !current;
                        if (next) {
                          setShowViewPicker(false);
                          setHeaderTaskError(null);
                        } else {
                          setHeaderTaskTitle("");
                          setHeaderTaskError(null);
                        }
                        return next;
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  {showHeaderTaskAdd ? (
                    <form className="tm-header-task-add-pop" role="dialog" aria-label="タスクを追加" onSubmit={submitHeaderTask}>
                      <div className="tm-header-task-add-head">
                        <p>タスクを追加</p>
                        <button
                          className="tm-header-task-add-close"
                          type="button"
                          aria-label="閉じる"
                          disabled={headerTaskSubmitting}
                          onClick={() => {
                            setShowHeaderTaskAdd(false);
                            setHeaderTaskTitle("");
                            setHeaderTaskError(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        className="tm-header-task-add-input"
                        value={headerTaskTitle}
                        onChange={(event) => setHeaderTaskTitle(event.target.value)}
                        placeholder="タスク名を入力"
                        autoFocus
                        disabled={headerTaskSubmitting}
                      />
                      <select
                        className="tm-header-task-add-select"
                        value={headerTaskListId ?? ""}
                        onChange={(event) => setHeaderTaskListId(event.target.value)}
                        disabled={headerTaskSubmitting || headerTaskAddDisabled}
                      >
                        {sortedLists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                      </select>
                      {headerTaskError ? <p className="tm-header-task-add-error">{headerTaskError}</p> : null}
                      <div className="tm-header-task-add-actions">
                        <button
                          className="tm-button tm-button-primary"
                          type="submit"
                          disabled={headerTaskSubmitting || !headerTaskTitle.trim() || !headerTaskListId}
                        >
                          {headerTaskSubmitting ? "追加中..." : "追加"}
                        </button>
                        <button
                          className="tm-button tm-button-secondary"
                          type="button"
                          disabled={headerTaskSubmitting}
                          onClick={() => {
                            setShowHeaderTaskAdd(false);
                            setHeaderTaskTitle("");
                            setHeaderTaskError(null);
                          }}
                        >
                          キャンセル
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </div>
              {showBoardDescription ? <p className="text-sm text-slate-700">{boardDescriptionText}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="tm-button tm-button-secondary"
                type="button"
                onClick={() => setShowFilterPanel((value) => !value)}
              >
                {showFilterPanel ? "フィルターを閉じる" : "フィルター"}
              </button>
            </div>
          </div>

          {filtersVisible ? (
            <aside className="tm-filter-side-panel" role="dialog" aria-label="絞り込み">
              <div className="tm-filter-side-header">
                <h2 className="tm-filter-side-title">絞り込み</h2>
                <button
                  className="tm-filter-side-close"
                  type="button"
                  onClick={() => setShowFilterPanel(false)}
                  aria-label="閉じる"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="tm-filter-side-body">
                <section className="tm-filter-section">
                  <p className="tm-filter-section-heading">キーワード</p>
                  <input
                    className="tm-filter-text-input"
                    value={keywordQuery}
                    onChange={(event) => setKeywordQuery(event.target.value)}
                    placeholder="キーワードを入力..."
                  />
                  <p className="tm-filter-help-text">カード、メンバー、ラベルなどを絞り込み。</p>
                </section>

                <section className="tm-filter-section">
                  <p className="tm-filter-section-heading">メンバー</p>
                  <label className="tm-filter-check-row">
                    <input
                      className="tm-filter-checkbox"
                      type="checkbox"
                      checked={memberFilters.unassigned}
                      onChange={(event) =>
                        setMemberFilters((current) => ({ ...current, unassigned: event.target.checked }))
                      }
                    />
                    <span className="tm-filter-icon-circle tm-filter-icon-circle-neutral">M</span>
                    <span className="tm-filter-check-text">メンバーはありません</span>
                  </label>
                  <label className="tm-filter-check-row">
                    <input
                      className="tm-filter-checkbox"
                      type="checkbox"
                      checked={memberFilters.assignedToMe}
                      onChange={(event) =>
                        setMemberFilters((current) => ({ ...current, assignedToMe: event.target.checked }))
                      }
                    />
                    <span className="tm-filter-icon-circle" style={{ backgroundColor: currentUserAvatarColor, color: "#fff" }}>
                      {userInitial}
                    </span>
                    <span className="tm-filter-check-text">自分に割り当てられたカード</span>
                  </label>
                  {initialData.members.map((member) => {
                    const name = member.profile?.display_name ?? member.profile?.email ?? member.user_id;
                    const initial = name.charAt(0).toUpperCase();
                    const avatarColor = resolveAvatarColor(member.profile?.avatar_color);
                    return (
                      <label key={member.user_id} className="tm-filter-check-row">
                        <input
                          className="tm-filter-checkbox"
                          type="checkbox"
                          checked={memberFilters.memberIds.includes(member.user_id)}
                          onChange={() => toggleMemberIdFilter(member.user_id)}
                        />
                        <span className="tm-filter-icon-circle" style={{ backgroundColor: avatarColor, color: "#fff" }}>
                          {initial}
                        </span>
                        <span className="tm-filter-check-text">{name}</span>
                      </label>
                    );
                  })}
                </section>

                <section className="tm-filter-section">
                  <p className="tm-filter-section-heading">Card status</p>
                  <label className="tm-filter-check-row">
                    <input
                      className="tm-filter-checkbox"
                      type="checkbox"
                      checked={statusFilters.completed}
                      onChange={(event) =>
                        setStatusFilters((current) => ({ ...current, completed: event.target.checked }))
                      }
                    />
                    <span className="tm-filter-icon-circle tm-filter-icon-circle-success">完</span>
                    <span className="tm-filter-check-text">完了済み</span>
                  </label>
                  <label className="tm-filter-check-row">
                    <input
                      className="tm-filter-checkbox"
                      type="checkbox"
                      checked={statusFilters.nonCompleted}
                      onChange={(event) =>
                        setStatusFilters((current) => ({ ...current, nonCompleted: event.target.checked }))
                      }
                    />
                    <span className="tm-filter-icon-circle tm-filter-icon-circle-warning">未</span>
                    <span className="tm-filter-check-text">完了以外</span>
                  </label>
                </section>

                <section className="tm-filter-section">
                  <p className="tm-filter-section-heading">期限</p>
                  {DUE_FILTER_OPTIONS.map((option) => (
                    <label key={option.value} className="tm-filter-check-row">
                      <input
                        className="tm-filter-checkbox"
                        type="checkbox"
                        checked={dueFilters.includes(option.value)}
                        onChange={() => toggleDueFilter(option.value)}
                      />
                      <span className={`tm-filter-icon-circle tm-filter-icon-circle-${option.tone}`}>期</span>
                      <span className="tm-filter-check-text">{option.label}</span>
                    </label>
                  ))}
                </section>

                <section className="tm-filter-section">
                  <p className="tm-filter-section-heading">リスト</p>
                  {sortedLists.map((list) => (
                    <label key={list.id} className="tm-filter-check-row">
                      <input
                        className="tm-filter-checkbox"
                        type="checkbox"
                        checked={listFilters.listIds.includes(list.id)}
                        onChange={() => toggleListIdFilter(list.id)}
                      />
                      <span className="tm-filter-icon-circle tm-filter-icon-circle-neutral">列</span>
                      <span className="tm-filter-check-text">{list.name}</span>
                    </label>
                  ))}
                </section>

                <section className="tm-filter-section">
                  <p className="tm-filter-section-heading">ラベル</p>
                  <label className="tm-filter-check-row">
                    <input
                      className="tm-filter-checkbox"
                      type="checkbox"
                      checked={labelFilters.noLabel}
                      onChange={(event) =>
                        setLabelFilters((current) => ({ ...current, noLabel: event.target.checked }))
                      }
                    />
                    <span className="tm-filter-icon-circle tm-filter-icon-circle-neutral">L</span>
                    <span className="tm-filter-check-text">ラベルなし</span>
                  </label>
                  {labels.map((label) => (
                    <label key={label.id} className="tm-filter-check-row tm-filter-label-row">
                      <input
                        className="tm-filter-checkbox"
                        type="checkbox"
                        checked={labelFilters.labelIds.includes(label.id)}
                        onChange={() => toggleLabelIdFilter(label.id)}
                      />
                      <span className="tm-filter-label-swatch" style={{ backgroundColor: label.color }} />
                      <span className="tm-filter-check-text">{label.name || "（無題ラベル）"}</span>
                    </label>
                  ))}
                </section>
              </div>

              <div className="tm-filter-side-footer">
                <button className="tm-filter-clear-button" type="button" onClick={clearFilters} disabled={!hasActiveFilters}>
                  フィルターをクリア
                </button>
              </div>
            </aside>
          ) : null}

          <DndContext
            id={dndContextId}
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragCancel={onDragCancel}
            onDragEnd={onDragEnd}
          >
            {viewMode === "calendar" ? (
              <section className="tm-view-card">
                <CalendarView
                  cards={filteredCards}
                  cardMetaById={cardMetaById}
                  onSelectCard={openCard}
                />
              </section>
            ) : null}

            {viewMode === "table" ? (
              <section className="tm-view-card tm-view-card-table">
                <TableView
                  rows={tableRows}
                  customFieldColumns={tableCustomFieldColumns}
                  lists={tableLists}
                  labels={tableLabels}
                  members={tableMembers}
                  savingByCardId={tableSavingByCardId}
                  sortState={effectiveTableSortState}
                  onSort={handleTableSort}
                  onSelectCard={openCard}
                  onListChange={handleTableListChange}
                  onLabelsChange={handleTableLabelsChange}
                  onAssigneesChange={handleTableAssigneesChange}
                  onDueDateChange={handleTableDueDateChange}
                  onStatusChange={handleTableStatusChange}
                />
              </section>
            ) : null}

            {viewMode === "timeline" ? (
              <section className="tm-view-card">
                <TimelineView
                  cards={filteredCards}
                  lists={sortedLists}
                  cardMetaById={cardMetaById}
                  onSelectCard={openCard}
                  onCreateUnscheduledCard={createUnscheduledCard}
                  onPlaceUnscheduledCard={placeUnscheduledCard}
                />
              </section>
            ) : null}

            {viewMode === "board" ? (
              <section className="tm-board-lists-wrap">
                <SortableContext items={sortableListColumnIds} strategy={horizontalListSortingStrategy}>
                  <div className="tm-board-lists tm-board-lists-app">
                    {sortedLists.map((list) => (
                      <Column
                        key={list.id}
                        list={list}
                        cards={cardsByList.get(list.id) ?? []}
                        boardCode={boardCode}
                        cardMetaById={cardMetaById}
                        onOpen={openCard}
                        canArchive={canManageBoardUi}
                        onArchive={(target) => void archiveList(target)}
                        onRename={(id, name) => setLists((current) => current.map((l) => (l.id === id ? { ...l, name } : l)))}
                        draft={cardDrafts[list.id] ?? ""}
                        onDraft={(value) => setCardDrafts((current) => ({ ...current, [list.id]: value }))}
                        onCreate={(event) => {
                          event.preventDefault();
                          const title = (cardDrafts[list.id] ?? "").trim();
                          if (!title) return;
                          void createCard(list.id, title);
                          setCardDrafts((current) => ({ ...current, [list.id]: "" }));
                        }}
                      />
                    ))}
                    <div className="tm-list-adder">
                      {showListComposer ? (
                        <form
                          className="tm-list-composer"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (!newListName.trim()) return;
                            void createList(newListName.trim());
                            setNewListName("");
                            setShowListComposer(false);
                          }}
                        >
                          <input
                            autoFocus
                            className="tm-input"
                            value={newListName}
                            onChange={(event) => setNewListName(event.target.value)}
                            placeholder={"\u65b0\u3057\u3044\u30ea\u30b9\u30c8\u3092\u8ffd\u52a0"}
                          />
                          <div className="flex items-center gap-2">
                            <button className="tm-button tm-button-primary" type="submit">
                              {"\u30ea\u30b9\u30c8\u3092\u8ffd\u52a0"}
                            </button>
                            <button
                              className="tm-button tm-button-secondary"
                              type="button"
                              onClick={() => {
                                setShowListComposer(false);
                                setNewListName("");
                              }}
                            >
                              {"\u30ad\u30e3\u30f3\u30bb\u30eb"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button className="tm-add-list-trigger" type="button" onClick={() => setShowListComposer(true)}>
                          {"+ \u3082\u30461\u3064\u30ea\u30b9\u30c8\u3092\u8ffd\u52a0"}
                        </button>
                      )}
                    </div>
                  </div>
                </SortableContext>
              </section>
            ) : null}

            <DragOverlay zIndex={120}>
              {activeDragCard ? (
                <article className="tm-card tm-card-overlay tm-card-draggable" aria-hidden="true">
                  <CardPresentation card={activeDragCard} boardCode={boardCode} meta={cardMetaById.get(activeDragCard.id)} />
                </article>
              ) : null}
            </DragOverlay>
          </DndContext>

        </section>
      </div>

      {!selectedCard && !boardChatMobileOpen ? (
        <button
          type="button"
          className="tm-board-chat-mobile-fab"
          aria-label="ボード内チャットを開く"
          onClick={() => setBoardChatMobileOpen(true)}
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      ) : null}

      {!selectedCard && boardChatMobileOpen ? (
        <>
          <div className="tm-board-chat-mobile-overlay" onClick={() => setBoardChatMobileOpen(false)} />
          <div className="tm-board-chat-mobile-sheet" role="dialog" aria-label="ボード内チャット">
            <BoardChatPanel
              className="tm-board-chat-mobile-panel"
              members={initialData.members}
              messages={boardChatMessages}
              currentUserId={currentUserId}
              collapsed={false}
              sending={boardChatSending}
              loadingMore={boardChatLoadingMore}
              hasMore={boardChatHasMore}
              deletingMessageIds={boardChatDeletingIds}
              error={boardChatError}
              onToggleCollapsed={() => setBoardChatMobileOpen(false)}
              onSend={sendBoardChatMessage}
              onDeleteMessage={deleteBoardChatMessage}
              onLoadMore={loadOlderBoardChatMessages}
              onClearError={() => setBoardChatError(null)}
            />
          </div>
        </>
      ) : null}

      {selectedCard ? (
        <div className="fixed right-20 top-5 z-[70] flex items-center gap-2">
          <button
            type="button"
            onClick={refreshSelectedCardDetail}
            disabled={selectedCardDetailLoading}
            className="rounded-md border border-[#d0d4db] bg-[#f1f2f4] px-3 py-1.5 text-xs font-semibold text-[#172b4d] hover:bg-[#dfe1e6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {selectedCardDetailLoading ? "更新中..." : "更新"}
          </button>
          <button
            type="button"
            onClick={() => void copyCardShareLink(selectedCard.id)}
            className="rounded-md border border-[#d0d4db] bg-[#f1f2f4] px-3 py-1.5 text-xs font-semibold text-[#172b4d] hover:bg-[#dfe1e6]"
          >
            {shareLinkCopied ? "コピー済み" : "リンクをコピー"}
          </button>
        </div>
      ) : null}

      {selectedCard ? (
        <CardDetailDrawer
          key={selectedCard.id}
          workspaceId={initialData.workspace.id}
          boardId={initialData.board.id}
          boardCode={boardCode}
          card={selectedCard}
          lists={sortedLists}
          members={initialData.members}
          labels={labels}
          customFields={sortedCustomFields}
          cardCustomFieldValues={cardCustomFieldValues}
          cardAssignees={cardAssignees}
          cardLabels={cardLabels}
          cardWatchers={selectedCardWatcherIds}
          currentUserId={currentUserId}
          comments={comments}
          checklists={checklists}
          checklistItems={checklistItems}
          attachments={attachments}
          detailLoading={selectedCardDetailLoading}
          onClose={closeCard}
          onCardPatched={(updatedCard) =>
            setCards((current) => current.map((value) => (value.id === updatedCard.id ? updatedCard : value)))
          }
          onCardRelationshipPatched={(nextAssigneeIds, nextLabelIds) => {
            setCardAssignees((current) => [
              ...current.filter((item) => item.card_id !== selectedCard.id),
              ...nextAssigneeIds.map((userId) => ({ card_id: selectedCard.id, user_id: userId })),
            ]);
            setCardLabels((current) => [
              ...current.filter((item) => item.card_id !== selectedCard.id),
              ...nextLabelIds.map((labelId) => ({ card_id: selectedCard.id, label_id: labelId })),
            ]);
          }}
          onLabelCreated={(createdLabel) => {
            setLabels((current) =>
              current.some((label) => label.id === createdLabel.id)
                ? current
                : [...current, createdLabel],
            );
          }}
          onLabelUpdated={(updatedLabel) => {
            setLabels((current) =>
              current.map((label) => (label.id === updatedLabel.id ? updatedLabel : label)),
            );
          }}
          onWatchersPatched={(watching) => {
            setCardWatchers((current: CardWatcher[]) => {
              const rest = current.filter((value) => !(value.card_id === selectedCard.id && value.user_id === currentUserId));
              return watching ? [...rest, { card_id: selectedCard.id, user_id: currentUserId }] : rest;
            });
          }}
          onCommentCreated={(comment) => setComments((current) => [...current, comment])}
          onChecklistCreated={(checklist) => setChecklists((current) => [...current, checklist])}
          onChecklistDeleted={(checklistId) => {
            setChecklists((current) => current.filter((value) => value.id !== checklistId));
            setChecklistItems((current) =>
              current.filter((value) => value.checklist_id !== checklistId),
            );
          }}
          onChecklistItemCreated={(item) => setChecklistItems((current) => [...current, item])}
          onChecklistItemPatched={(item) =>
            setChecklistItems((current) => current.map((value) => (value.id === item.id ? item : value)))
          }
          onChecklistItemDeleted={(itemId) =>
            setChecklistItems((current) => current.filter((value) => value.id !== itemId))
          }
          onChecklistItemConverted={(createdCard, nextAssigneeIds) => {
            setCards((current) =>
              current.some((value) => value.id === createdCard.id) ? current : [...current, createdCard],
            );
            if (!nextAssigneeIds.length) return;
            setCardAssignees((current) => {
              const existing = new Set(current.map((value) => `${value.card_id}:${value.user_id}`));
              const additions = nextAssigneeIds
                .filter((userId) => !existing.has(`${createdCard.id}:${userId}`))
                .map((userId) => ({ card_id: createdCard.id, user_id: userId }));
              return additions.length ? [...current, ...additions] : current;
            });
          }}
          onAttachmentCreated={(attachment) => setAttachments((current) => [...current, attachment])}
          onCustomFieldValuesPatched={(values) =>
            setCardCustomFieldValues((current) => [
              ...current.filter((value) => value.card_id !== selectedCard.id),
              ...values,
            ])
          }
        />
      ) : null}

      <CreateBoardForm
        workspaceId={initialData.workspace.id}
        mode="modal"
        open={showCreateBoardModal}
        onClose={() => setShowCreateBoardModal(false)}
      />

      {error ? <div className="tm-error-banner">{error}</div> : null}
    </main>
  );
}
