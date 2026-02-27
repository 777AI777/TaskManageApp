"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  type CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  ChevronDown,
  Clock3,
  GitBranch,
  GripVertical,
  Kanban,
  LayoutDashboard,
  MapPin,
  Table,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CalendarView } from "@/components/board/calendar-view";
import { CardDetailDrawer } from "@/components/board/card-detail-drawer";
import { DashboardView } from "@/components/board/dashboard-view";
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
  Activity,
  CardDetailData,
  BoardDataBundle,
  DashboardTile,
  BoardList,
  CardCustomFieldValue,
  CardWatcher,
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
  applyCardAssigneeSnapshot,
  applyCardLabelSnapshot,
  getActivityCardId,
  parseActivityRelationshipMetadata,
  removeRealtimeCard,
  removeRealtimeList,
  upsertRealtimeCard,
  upsertRealtimeList,
} from "@/lib/board-realtime";
import {
  canManageBoard,
  matchesDueBucket,
  resolveCardDeadlineState,
  type DueBucket,
} from "@/lib/board-utils";
import { resolveAvatarColor } from "@/lib/avatar-color";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
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

type ViewMode = "board" | "calendar" | "table" | "timeline" | "dashboard";
type MemberFilters = {
  unassigned: boolean;
  assignedToMe: boolean;
  memberIds: string[];
};
type StatusFilters = {
  completed: boolean;
  dueIncomplete: boolean;
};
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
  mode: ViewMode | "map";
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
};
const UNIFIED_BOARD_BACKGROUND = "#c0c5d1";
const DEFAULT_MEMBER_FILTERS: MemberFilters = { unassigned: false, assignedToMe: false, memberIds: [] };
const DEFAULT_STATUS_FILTERS: StatusFilters = { completed: false, dueIncomplete: false };
const DEFAULT_LABEL_FILTERS: LabelFilters = { noLabel: false, labelIds: [] };
const DUE_FILTER_OPTIONS: Array<{ value: DueBucket; label: string; tone: "neutral" | "danger" | "warning" }> = [
  { value: "no-due-date", label: "\u671f\u9650\u306a\u3057", tone: "neutral" },
  { value: "overdue", label: "\u671f\u9650\u5207\u308c", tone: "danger" },
  { value: "due-until-next-day", label: "\u660e\u65e5\u307e\u3067\u306e\u671f\u9650\u3042\u308a", tone: "warning" },
  { value: "due-until-next-week", label: "\u6765\u9031\u307e\u3067\u306e\u671f\u9650\u3042\u308a", tone: "neutral" },
  { value: "due-until-next-month", label: "\u6765\u6708\u307e\u3067\u306e\u671f\u9650\u3042\u308a", tone: "neutral" },
];

const VIEW_MENU_ITEMS: ViewMenuItem[] = [
  { mode: "board", label: "\u30dc\u30fc\u30c9", icon: Kanban },
  { mode: "table", label: "\u30c6\u30fc\u30d6\u30eb", icon: Table },
  { mode: "calendar", label: "\u30ab\u30ec\u30f3\u30c0\u30fc", icon: Calendar },
  { mode: "dashboard", label: "\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9", icon: LayoutDashboard },
  { mode: "timeline", label: "\u30bf\u30a4\u30e0\u30e9\u30a4\u30f3", icon: GitBranch },
  { mode: "map", label: "\u30de\u30c3\u30d7", icon: MapPin, disabled: true },
];

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

function normalizeDashboardTiles(tiles: DashboardTile[] | null | undefined): DashboardTile[] {
  if (!Array.isArray(tiles)) return [];
  return [...tiles]
    .filter((tile) => tile && typeof tile.id === "string" && tile.id.length > 0)
    .sort((a, b) => a.position - b.position)
    .map((tile, index): DashboardTile => ({
      ...tile,
      size: tile.size === "full" ? "full" : "half",
      position: index,
    }));
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

function toAssigneeInitial(name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : null;
}

function CardPresentation({
  card,
  meta,
}: {
  card: BoardCard;
  meta: BoardCardMeta | undefined;
}) {
  return (
    <>
      <div className="tm-card-drag-row" aria-hidden="true">
        <span className="tm-card-drag-handle">
          <GripVertical size={14} />
        </span>
      </div>
      {card.cover_type === "color" && card.cover_value ? (
        <div className="mb-2 h-7 rounded-md" style={{ backgroundColor: card.cover_value }} />
      ) : null}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="tm-card-main-row">
          <p className={`text-sm font-semibold truncate ${card.archived ? "opacity-70" : ""}`}>{card.title}</p>
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
        <div className="tm-task-meta-row">
          {meta?.dueLabel ? (
            <span className={`tm-task-state-chip tm-task-state-${meta.deadlineState}`}>
              <Clock3 size={12} />
              <span>{meta.dueLabel}</span>
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

function DnDCard({
  card,
  meta,
  onOpen,
}: {
  card: BoardCard;
  meta: BoardCardMeta | undefined;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `card:${card.id}` });
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
      <CardPresentation card={card} meta={meta} />
    </article>
  );
}
function Column({
  list,
  cards,
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
  cardMetaById: Map<string, BoardCardMeta>;
  onOpen: (id: string) => void;
  draft: string;
  onDraft: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  canArchive: boolean;
  onArchive: (list: BoardList) => void;
  onRename: (id: string, name: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${list.id}` });
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(list.name);
  const [showListActions, setShowListActions] = useState(false);
  const listActionsRef = useRef<HTMLDivElement | null>(null);

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
    <section ref={setNodeRef} className={`tm-list-column ${isOver ? "ring-2 ring-blue-400" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
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
      <div className="flex min-h-24 flex-1 flex-col gap-2">
        {cards.map((card) => (
          <DnDCard
            key={card.id}
            card={card}
            meta={cardMetaById.get(card.id)}
            onOpen={onOpen}
          />
        ))}
      </div>
      <form className="mt-3 space-y-2" onSubmit={onCreate}>
        <input className="tm-input" value={draft} onChange={(event) => onDraft(event.target.value)} placeholder={"\u30ab\u30fc\u30c9\u3092\u8ffd\u52a0"} />
        <button className="tm-button tm-button-secondary w-full" type="submit">
          {"\u30ab\u30fc\u30c9\u3092\u8ffd\u52a0"}
        </button>
      </form>
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
  const dndContextId = `board-dnd-${initialData.board.id}`;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeId = args.active?.id ? String(args.active.id) : "";
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [cardDetailLoadingById, setCardDetailLoadingById] = useState<Record<string, boolean>>({});
  const loadedCardDetailRef = useRef(new Set<string>());
  const cardDetailReloadTimersRef = useRef(new Map<string, number>());
  const selectedCardIdRef = useRef<string | null>(null);
  const checklistsRef = useRef<Checklist[]>([]);

  const [boardName, setBoardName] = useState(initialData.board.name);
  const [boardSlug, setBoardSlug] = useState(initialData.board.slug);
  const [workspaceBoards, setWorkspaceBoards] = useState(initialData.workspaceBoards);
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [boardNameDraft, setBoardNameDraft] = useState(initialData.board.name);
  const [isSavingBoardName, setIsSavingBoardName] = useState(false);
  const [dashboardTiles, setDashboardTiles] = useState<DashboardTile[]>(
    normalizeDashboardTiles(initialData.board.dashboard_tiles),
  );

  const defaultView: ViewMode =
    initialData.preferences?.selected_view === "calendar"
      ? "calendar"
      : initialData.preferences?.selected_view === "table"
        ? "table"
        : initialData.preferences?.selected_view === "timeline"
          ? "timeline"
          : initialData.preferences?.selected_view === "dashboard"
            ? "dashboard"
              : "board";
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(initialData.preferences?.left_rail_collapsed ?? false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showListComposer, setShowListComposer] = useState(false);
  const [showViewPicker, setShowViewPicker] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);

  const [keywordQuery, setKeywordQuery] = useState("");
  const [memberFilters, setMemberFilters] = useState<MemberFilters>(DEFAULT_MEMBER_FILTERS);
  const [statusFilters, setStatusFilters] = useState<StatusFilters>(DEFAULT_STATUS_FILTERS);
  const [dueFilters, setDueFilters] = useState<DueBucket[]>([]);
  const [labelFilters, setLabelFilters] = useState<LabelFilters>(DEFAULT_LABEL_FILTERS);

  const [newListName, setNewListName] = useState("");
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({});
  const [activeDragCardId, setActiveDragCardId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(initialCardId);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageBoardUi = canManageBoard(initialData.currentUser.role);
  const currentUserId = initialData.currentUser.id;

  const sortedLists = useMemo(
    () => [...lists].filter((list) => !list.is_archived).sort((a, b) => a.position - b.position),
    [lists],
  );

  const selectedCard = activeCardId ? cards.find((card) => card.id === activeCardId) ?? null : null;
  const selectedCardId = selectedCard?.id ?? null;

  useEffect(() => {
    setActiveCardId(initialCardId ?? null);
  }, [initialCardId]);

  useEffect(() => {
    selectedCardIdRef.current = selectedCardId;
  }, [selectedCardId]);

  useEffect(() => {
    setShareLinkCopied(false);
  }, [selectedCardId]);

  useEffect(() => {
    checklistsRef.current = checklists;
  }, [checklists]);

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
    const hasStatusFilters = statusFilters.completed || statusFilters.dueIncomplete;
    const hasDueFilters = dueFilters.length > 0;
    const hasLabelFilters = labelFilters.noLabel || labelFilters.labelIds.length > 0;

    return cards.filter((card) => {
      if (card.archived) return false;

      if (normalizedKeyword && !`${card.title} ${card.description ?? ""}`.toLowerCase().includes(normalizedKeyword)) {
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

      if (hasStatusFilters) {
        const matchesStatus =
          (statusFilters.completed && card.is_completed) ||
          (statusFilters.dueIncomplete && Boolean(card.due_at) && !card.is_completed);
        if (!matchesStatus) return false;
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
    dueFilters,
    keywordQuery,
    labelFilters.labelIds,
    labelFilters.noLabel,
    labelIdsByCard,
    memberFilters.assignedToMe,
    memberFilters.memberIds,
    memberFilters.unassigned,
    statusFilters.completed,
    statusFilters.dueIncomplete,
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

  const tableCustomFieldColumns = useMemo(
    () => sortedCustomFields.map((field) => ({ id: field.id, name: field.name })),
    [sortedCustomFields],
  );

  const tableRows = useMemo(() => {
    return [...filteredCards]
      .sort((a, b) => a.position - b.position)
      .map((card) => {
        const meta = cardMetaById.get(card.id);
        const labelIds = cardLabels
          .filter((item) => item.card_id === card.id)
          .map((item) => item.label_id);
        return {
          id: card.id,
          title: card.title,
          listName: listNameById.get(card.list_id) ?? BOARD_COMMON_LABELS.unknown,
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
          dueLabel: meta?.dueLabel ?? null,
          deadlineState: meta?.deadlineState ?? resolveCardDeadlineState(card.due_at, card.is_completed),
        };
      });
  }, [
    filteredCards,
    cardMetaById,
    cardLabels,
    listNameById,
    labelNameById,
    sortedCustomFields,
    customFieldValueByCardAndField,
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
    setActivities((current) => [
      ...current.filter((activity) => activity.card_id !== cardId),
      ...detail.activities,
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

  const scheduleCardDetailRefresh = useCallback(
    (cardId: string) => {
      if (selectedCardIdRef.current !== cardId) return;

      const currentTimer = cardDetailReloadTimersRef.current.get(cardId);
      if (currentTimer !== undefined) {
        window.clearTimeout(currentTimer);
      }

      const timer = window.setTimeout(() => {
        cardDetailReloadTimersRef.current.delete(cardId);
        void fetchCardDetail(cardId, { force: true });
      }, 250);
      cardDetailReloadTimersRef.current.set(cardId, timer);
    },
    [fetchCardDetail],
  );

  useEffect(() => {
    return () => {
      cardDetailReloadTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      cardDetailReloadTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!selectedCardId) return;
    void fetchCardDetail(selectedCardId);
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
              activities: [],
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
              activities: [],
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
          table: "activities",
          filter: `board_id=eq.${boardId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") {
            const removedActivity = payload.old as Partial<Activity>;
            if (!removedActivity.id) return;
            setActivities((current) =>
              current.filter((activity) => activity.id !== removedActivity.id),
            );
            return;
          }

          const nextActivity = payload.new as Partial<Activity>;
          if (!nextActivity.id) return;
          const normalized = nextActivity as Activity;

          setActivities((current) => [
            normalized,
            ...current.filter((activity) => activity.id !== normalized.id),
          ]);

          if (normalized.action === "card_updated" && typeof normalized.card_id === "string") {
            const { assigneeIds, labelIds } = parseActivityRelationshipMetadata(
              (normalized.metadata ?? {}) as Record<string, unknown>,
            );
            if (assigneeIds) {
              setCardAssignees((current) =>
                applyCardAssigneeSnapshot(current, normalized.card_id as string, assigneeIds),
              );
            }
            if (labelIds) {
              setCardLabels((current) =>
                applyCardLabelSnapshot(current, normalized.card_id as string, labelIds),
              );
            }
          }

          const activityCardId = getActivityCardId(normalized);
          if (activityCardId) {
            scheduleCardDetailRefresh(activityCardId);
          }
        },
      );

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applyCardDetailData, initialData.board.id, scheduleCardDetailRefresh, supabase]);


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

  async function updateDashboardTiles(nextTiles: DashboardTile[]) {
    if (!canManageBoardUi) return;
    const previous = dashboardTiles;
    const normalized = normalizeDashboardTiles(nextTiles);
    setDashboardTiles(normalized);

    const response = await fetch(`/api/boards/${initialData.board.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboardTiles: normalized }),
    });
    const body = await response.json();
    if (!response.ok) {
      setDashboardTiles(previous);
      setError(body?.error?.message ?? BOARD_ERROR_MESSAGES.updateDashboardTiles);
      return;
    }
    setDashboardTiles(normalizeDashboardTiles((body.data?.dashboard_tiles ?? normalized) as DashboardTile[]));
  }

  function resetTimelineDragTracking() {
    timelineDragStartXRef.current = null;
    timelineDragSnapshotRef.current = null;
  }

  function onDragStart(event: DragStartEvent) {
    const activeId = event.active?.id ? String(event.active.id) : "";
    const timelineActive = parseTimelineActiveId(activeId);
    const calendarActive = parseCalendarActiveId(activeId);

    setActiveDragCardId(
      activeId.startsWith("card:")
        ? activeId.replace("card:", "")
        : timelineActive?.cardId ?? calendarActive?.cardId ?? null,
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
    if (activeId === overId && overId && !timelineActive && !calendarActive) {
      resetTimelineDragTracking();
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

    const overCard = overId.startsWith("card:") ? cards.find((card) => card.id === overId.replace("card:", "")) : null;
    const targetListId = overId.startsWith("list:") ? overId.replace("list:", "") : overCard?.list_id;
    if (!targetListId || !activeId.startsWith("card:")) return;

    const movingCard = cards.find((card) => card.id === activeId.replace("card:", ""));
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

  function toggleLabelIdFilter(labelId: string) {
    setLabelFilters((current) => ({
      ...current,
      labelIds: current.labelIds.includes(labelId)
        ? current.labelIds.filter((id) => id !== labelId)
        : [...current.labelIds, labelId],
    }));
  }

  const selectedCardActivities = selectedCard
    ? activities.filter((activity) => activity.card_id === selectedCard.id).slice(0, 20)
    : [];

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
      statusFilters.dueIncomplete ||
      dueFilters.length ||
      labelFilters.noLabel ||
      labelFilters.labelIds.length,
  );
  const filtersVisible = showFilterPanel;
  const CurrentViewIcon = VIEW_MENU_ITEMS.find((item) => item.mode === viewMode)?.icon ?? Kanban;

  useEffect(() => {
    if (!showViewPicker && !showFilterPanel) return;

    function handlePointerDown(event: MouseEvent) {
      if (showViewPicker && !viewPickerRef.current?.contains(event.target as Node)) {
        setShowViewPicker(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (showViewPicker) {
        setShowViewPicker(false);
      }
      if (showFilterPanel) {
        setShowFilterPanel(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showFilterPanel, showViewPicker]);

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

      <div className="tm-body">
        <aside className={`tm-left-rail ${leftRailCollapsed ? "w-16" : "w-80"}`}>
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
            <>
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

            </>
          ) : null}
        </aside>

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
                    onClick={() => setShowViewPicker((value) => !value)}
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
                              onClick={() => {
                                if (item.disabled || item.mode === "map") return;
                                selectView(item.mode);
                              }}
                              disabled={item.disabled}
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
              </div>
              <p className="text-sm text-slate-700">{initialData.board.description ?? BOARD_COMMON_LABELS.noDescription}</p>
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
                    <span className="tm-filter-check-text">完了済みにしました</span>
                  </label>
                  <label className="tm-filter-check-row">
                    <input
                      className="tm-filter-checkbox"
                      type="checkbox"
                      checked={statusFilters.dueIncomplete}
                      onChange={(event) =>
                        setStatusFilters((current) => ({ ...current, dueIncomplete: event.target.checked }))
                      }
                    />
                    <span className="tm-filter-icon-circle tm-filter-icon-circle-warning">期</span>
                    <span className="tm-filter-check-text">期限あり・未完了</span>
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
              <section className="tm-view-card">
                <TableView
                  rows={tableRows}
                  customFieldColumns={tableCustomFieldColumns}
                  onSelectCard={openCard}
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

            {viewMode === "dashboard" ? (
              <section className="tm-view-card">
                <DashboardView
                  cards={filteredCards}
                  lists={sortedLists}
                  members={initialData.members}
                  labels={labels}
                  cardAssignees={cardAssignees}
                  cardLabels={cardLabels}
                  tiles={dashboardTiles}
                  canEdit={canManageBoardUi}
                  onTilesChange={updateDashboardTiles}
                />
              </section>
            ) : null}

            {viewMode === "board" ? (
              <section className="tm-board-lists-wrap">
                <div className="tm-board-lists">
                  {sortedLists.map((list) => (
                    <Column
                      key={list.id}
                      list={list}
                      cards={cardsByList.get(list.id) ?? []}
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
              </section>
            ) : null}

            <DragOverlay zIndex={120}>
              {activeDragCard ? (
                <article className="tm-card tm-card-overlay tm-card-draggable" aria-hidden="true">
                  <CardPresentation card={activeDragCard} meta={cardMetaById.get(activeDragCard.id)} />
                </article>
              ) : null}
            </DragOverlay>
          </DndContext>

        </section>
      </div>

      {selectedCard ? (
        <button
          type="button"
          onClick={() => void copyCardShareLink(selectedCard.id)}
          className="fixed right-20 top-5 z-[70] rounded-md border border-[#d0d4db] bg-[#f1f2f4] px-3 py-1.5 text-xs font-semibold text-[#172b4d] hover:bg-[#dfe1e6]"
        >
          {shareLinkCopied ? "コピー済み" : "リンクをコピー"}
        </button>
      ) : null}

      {selectedCard ? (
        <CardDetailDrawer
          key={selectedCard.id}
          workspaceId={initialData.workspace.id}
          boardId={initialData.board.id}
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
          activities={selectedCardActivities}
          detailLoading={Boolean(cardDetailLoadingById[selectedCard.id])}
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
