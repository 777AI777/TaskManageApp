"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Tag, Clock, CheckSquare, User, Paperclip, MapPin, LayoutGrid, AlignLeft } from "lucide-react";
import type { Activity, Attachment, BoardCard, BoardList, BoardMember, CardAssignee, CardComment, CardCustomFieldValue, CardLabel, Checklist, ChecklistItem, CustomField, Label } from "@/components/board/board-types";
import { resolveAvatarColor } from "@/lib/avatar-color";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
type ActivePanel = "addMenu" | "labels" | "dates" | "checklist" | "members" | "attachment" | "location" | "customFields" | null;
type LabelPanelMode = "list" | "create";
type Props = {
  workspaceId: string;
  boardId: string;
  card: BoardCard;
  lists: BoardList[];
  members: BoardMember[];
  labels: Label[];
  customFields: CustomField[];
  cardCustomFieldValues: CardCustomFieldValue[];
  cardAssignees: CardAssignee[];
  cardLabels: CardLabel[];
  cardWatchers: string[];
  currentUserId: string | null;
  comments: CardComment[];
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
  attachments: Attachment[];
  activities: Activity[];
  detailLoading?: boolean;
  onClose: () => void;
  onCardPatched: (card: BoardCard) => void;
  onCommentCreated: (comment: CardComment) => void;
  onChecklistCreated: (checklist: Checklist) => void;
  onChecklistItemCreated: (item: ChecklistItem) => void;
  onChecklistItemPatched: (item: ChecklistItem) => void;
  onChecklistDeleted?: (checklistId: string) => void;
  onChecklistItemDeleted?: (itemId: string) => void;
  onChecklistItemConverted?: (card: BoardCard, assigneeIds: string[]) => void;
  onAttachmentCreated: (attachment: Attachment) => void;
  onCardRelationshipPatched?: (assigneeIds: string[], labelIds: string[]) => void;
  onCustomFieldValuesPatched?: (values: CardCustomFieldValue[]) => void;
  onWatchersPatched?: (watching: boolean) => void;
  onLabelCreated?: (label: Label) => void;
  onLabelUpdated?: (label: Label) => void;
};
const ADD_MENU_OPTIONS: Array<{
  key: ActivePanel;
  icon: ReactNode;
  label: string;
  desc: string;
}> = [{
  key: "labels",
  icon: <Tag className="w-4 h-4" />,
  label: "ラベル",
  desc: "整理、分類、優先順位付け"
}, {
  key: "dates",
  icon: <Clock className="w-4 h-4" />,
  label: "日付",
  desc: "開始日、期限、リマインダー"
}, {
  key: "checklist",
  icon: <CheckSquare className="w-4 h-4" />,
  label: "チェックリスト",
  desc: "サブタスクを追加"
}, {
  key: "members",
  icon: <User className="w-4 h-4" />,
  label: "メンバー",
  desc: "メンバーをアサイン"
}, {
  key: "attachment",
  icon: <Paperclip className="w-4 h-4" />,
  label: "添付ファイル",
  desc: "リンク、ページ、作業項目などを追加"
}, {
  key: "location",
  icon: <MapPin className="w-4 h-4" />,
  label: "場所",
  desc: "このカードをマップで見る"
}, {
  key: "customFields",
  icon: <LayoutGrid className="w-4 h-4" />,
  label: "カスタムフィールド",
  desc: "独自のフィールドを作成"
}];
const PANEL_LABELS: Record<string, string> = {
  labels: "ラベル",
  dates: "日付",
  checklist: "チェックリスト",
  members: "メンバー",
  attachment: "添付ファイル",
  location: "場所",
  customFields: "カスタム日付フィールド"
};
const LABEL_PICKER_COLORS = ["#4bce97", "#f5cd47", "#fea362", "#f87168", "#9f8fef", "#579dff"] as const;
const LABEL_CREATE_COLOR_OPTIONS = ["#9dd9c3", "#d8d06d", "#d9c98a", "#e6b8b8", "#c8b6d8", "#4bce97", "#e2c61f", "#f5a400", "#ef6b60", "#a463d8", "#1f845a", "#9d7600", "#c25f00", "#c9372c", "#8f4bb8", "#b3c7e6", "#9fc9da", "#b7d68f", "#ddb6d3", "#c5c7cd", "#579dff", "#5fb5d5", "#8ec048", "#cd5fa8", "#8a8f99", "#2b6ed4", "#2f85a5", "#5d8a24", "#aa4c8b", "#6e727a"] as const;
function pickNextLabelColor(existingLabels: Label[]): string {
  const usedColors = new Set(existingLabels.map(label => label.color.toLowerCase()));
  const unused = LABEL_PICKER_COLORS.find(color => !usedColors.has(color.toLowerCase()));
  if (unused) return unused;
  return LABEL_PICKER_COLORS[existingLabels.length % LABEL_PICKER_COLORS.length];
}
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes} 分前`;
  if (hours < 24) return `${hours} 時間前`;
  return `${days} 日前`;
}
function formatActivityDateTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const datePart = date.toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric"
  });
  const timePart = date.toLocaleTimeString("ja-JP", {
    hour: "numeric",
    minute: "2-digit"
  });
  return `${datePart} ${timePart}`;
}
function getListNameById(lists: BoardList[], value: unknown): string | null {
  if (typeof value !== "string") return null;
  return lists.find(list => list.id === value)?.name ?? null;
}
function formatCardUpdatedMessage(metadata: Record<string, unknown>, lists: BoardList[]): string {
  if ("dueAt" in metadata) {
    if (metadata.dueAt === null) return "このカードの期限を削除しました。";
    const dueLabel = formatActivityDateTime(metadata.dueAt);
    if (dueLabel) return `このカードの期限を${dueLabel}に変更しました。`;
    return "このカードの期限を更新しました。";
  }
  if ("startAt" in metadata) {
    if (metadata.startAt === null) return "このカードの開始日を削除しました。";
    const startLabel = formatActivityDateTime(metadata.startAt);
    if (startLabel) return `このカードの開始日を${startLabel}に変更しました。`;
    return "このカードの開始日を更新しました。";
  }
  if ("title" in metadata && typeof metadata.title === "string") {
    return `このカードのタイトルを「${metadata.title}」に変更しました。`;
  }
  if ("description" in metadata) {
    return metadata.description === null ? "このカードの内容を削除しました。" : "このカードの内容を更新しました。";
  }
  if ("listId" in metadata) {
    const listName = getListNameById(lists, metadata.listId);
    if (listName) return `このカードを「${listName}」に移動しました。`;
    return "このカードを別のリストに移動しました。";
  }
  if ("assigneeIds" in metadata) return "このカードの担当メンバーを変更しました。";
  if ("labelIds" in metadata) return "このカードのラベルを変更しました。";
  if ("isCompleted" in metadata && typeof metadata.isCompleted === "boolean") {
    return metadata.isCompleted ? "このカードを完了にしました。" : "このカードを未完了に戻しました。";
  }
  if ("archived" in metadata && typeof metadata.archived === "boolean") {
    return metadata.archived ? "このカードをアーカイブしました。" : "このカードをアーカイブから戻しました。";
  }
  if ("priority" in metadata) return "このカードの優先度を変更しました。";
  if ("estimatePoints" in metadata) return "このカードの見積もりポイントを変更しました。";
  return "このカードを更新しました。";
}
function formatChecklistItemUpdatedMessage(metadata: Record<string, unknown>): string {
  if ("isCompleted" in metadata && typeof metadata.isCompleted === "boolean") {
    return metadata.isCompleted ? "チェックリスト項目を完了にしました。" : "チェックリスト項目を未完了に戻しました。";
  }
  if ("dueAt" in metadata) {
    if (metadata.dueAt === null) return "チェックリスト項目の期限を削除しました。";
    const dueLabel = formatActivityDateTime(metadata.dueAt);
    if (dueLabel) return `チェックリスト項目の期限を${dueLabel}に変更しました。`;
    return "チェックリスト項目の期限を更新しました。";
  }
  if ("assigneeId" in metadata) return "チェックリスト項目の担当者を変更しました。";
  if ("content" in metadata) return "チェックリスト項目の内容を変更しました。";
  return "チェックリスト項目を更新しました。";
}
function formatActivityMessage(action: string, metadata: Record<string, unknown>, lists: BoardList[]): string {
  if (action === "card_updated") return formatCardUpdatedMessage(metadata, lists);
  if (action === "card_created") return "このカードを作成しました。";
  if (action === "card_moved") {
    const toListName = getListNameById(lists, metadata.toListId);
    if (toListName) return `このカードを「${toListName}」に移動しました。`;
    return "このカードを移動しました。";
  }
  if (action === "card_archived") return "このカードをアーカイブしました。";
  if (action === "card_unarchived") return "このカードをアーカイブから戻しました。";
  if (action === "card_completed") return "このカードを完了にしました。";
  if (action === "card_reopened") return "このカードを未完了に戻しました。";
  if (action === "card_watching_started") return "このカードのウォッチを開始しました。";
  if (action === "card_watching_stopped") return "このカードのウォッチを解除しました。";
  if (action === "checklist_created") return "チェックリストを追加しました。";
  if (action === "checklist_item_created") return "チェックリスト項目を追加しました。";
  if (action === "checklist_item_updated") return formatChecklistItemUpdatedMessage(metadata);
  if (action === "checklist_item_deleted") return "チェックリスト項目を削除しました。";
  if (action === "card_custom_fields_updated") return "カスタムフィールドを更新しました。";
  if (action === "attachment_added") {
    if (typeof metadata.name === "string" && metadata.name) {
      return `添付ファイル「${metadata.name}」を追加しました。`;
    }
    return "添付ファイルを追加しました。";
  }
  if (action === "comment_created") return "コメントを追加しました。";
  return action;
}
type CustomFieldDraft = {
  valueText?: string;
  valueNumber?: string;
  valueDate?: string;
  valueBoolean?: boolean;
  valueOption?: string;
};
type ChecklistItemDraft = {
  content: string;
  assigneeId: string | null;
  dueDate: string;
};
type ChecklistPopoverState =
  | {
      type: "draft-assignee" | "draft-due";
      checklistId: string;
    }
  | {
      type: "item-assignee" | "item-due";
      checklistId: string;
      itemId: string;
    }
  | null;
const EMPTY_CHECKLIST_ITEM_DRAFT: ChecklistItemDraft = {
  content: "",
  assigneeId: null,
  dueDate: "",
};
function toDateTimeInputValue(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
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
function formatDueDateLabel(value: string): string {
  return new Date(value).toLocaleDateString("ja-JP");
}
function getMemberDisplayName(member: BoardMember): string {
  return member.profile?.display_name ?? member.profile?.email ?? member.user_id;
}
function getMemberAvatarColor(member: BoardMember | null | undefined): string {
  return resolveAvatarColor(member?.profile?.avatar_color);
}
function getChecklistDraft(
  draft: Record<string, ChecklistItemDraft>,
  checklistId: string,
): ChecklistItemDraft {
  return draft[checklistId] ?? EMPTY_CHECKLIST_ITEM_DRAFT;
}
function getAssigneeIdsForCard(cardAssignees: CardAssignee[], cardId: string): string[] {
  return cardAssignees.filter(entry => entry.card_id === cardId).map(entry => entry.user_id);
}
function getLabelIdsForCard(cardLabels: CardLabel[], cardId: string): string[] {
  return cardLabels.filter(entry => entry.card_id === cardId).map(entry => entry.label_id);
}
function buildCustomFieldDrafts(customFields: CustomField[], cardCustomFieldValues: CardCustomFieldValue[], cardId: string): Record<string, CustomFieldDraft> {
  const values = cardCustomFieldValues.filter(value => value.card_id === cardId);
  const valueMap = new Map(values.map(value => [value.custom_field_id, value]));
  const drafts: Record<string, CustomFieldDraft> = {};
  customFields.forEach(field => {
    const value = valueMap.get(field.id);
    drafts[field.id] = {
      valueText: value?.value_text ?? "",
      valueNumber: value?.value_number?.toString() ?? "",
      valueDate: value?.value_date ? new Date(value.value_date).toISOString().slice(0, 16) : "",
      valueBoolean: value?.value_boolean ?? false,
      valueOption: value?.value_option ?? ""
    };
  });
  return drafts;
}
export function CardDetailDrawer({
  workspaceId,
  boardId,
  card,
  lists,
  members,
  labels,
  customFields,
  cardCustomFieldValues,
  cardAssignees,
  cardLabels,
  cardWatchers,
  currentUserId,
  comments,
  checklists,
  checklistItems,
  attachments,
  activities,
  detailLoading = false,
  onClose,
  onCardPatched,
  onCommentCreated,
  onChecklistCreated,
  onChecklistDeleted,
  onChecklistItemCreated,
  onChecklistItemPatched,
  onAttachmentCreated,
  onCardRelationshipPatched,
  onCustomFieldValuesPatched,
  onWatchersPatched,
  onLabelCreated,
  onLabelUpdated
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [listId, setListId] = useState(card.list_id);
  const [startAt, setStartAt] = useState(toDateTimeInputValue(card.start_at));
  const [dueAt, setDueAt] = useState(toDateTimeInputValue(card.due_at));
  const [coverColor, setCoverColor] = useState(card.cover_value ?? card.cover_color ?? "#2b6cb0");
  const [locationName, setLocationName] = useState(card.location_name ?? "");
  const [locationLat, setLocationLat] = useState(card.location_lat?.toString() ?? "");
  const [locationLng, setLocationLng] = useState(card.location_lng?.toString() ?? "");
  const incomingAssigneeIds = useMemo(() => getAssigneeIdsForCard(cardAssignees, card.id), [cardAssignees, card.id]);
  const incomingLabelIds = useMemo(() => getLabelIdsForCard(cardLabels, card.id), [cardLabels, card.id]);
  const [assigneeIds, setAssigneeIds] = useState(incomingAssigneeIds);
  const [labelIds, setLabelIds] = useState(incomingLabelIds);
  const [customFieldDrafts, setCustomFieldDrafts] = useState<Record<string, CustomFieldDraft>>(() => buildCustomFieldDrafts(customFields, cardCustomFieldValues, card.id));
  const [commentText, setCommentText] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [checklistItemDraft, setChecklistItemDraft] = useState<Record<string, ChecklistItemDraft>>({});
  const [checklistPopover, setChecklistPopover] = useState<ChecklistPopoverState>(null);
  const [checklistMemberQuery, setChecklistMemberQuery] = useState("");
  const [checklistDueDateDraft, setChecklistDueDateDraft] = useState("");
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [showSidebarDetails, setShowSidebarDetails] = useState(true);
  const [pendingChecklistCreateByChecklistId, setPendingChecklistCreateByChecklistId] = useState<
    Record<string, boolean>
  >({});
  const [pendingChecklistPatchByItemId, setPendingChecklistPatchByItemId] = useState<
    Record<string, boolean>
  >({});
  const [showCardActions, setShowCardActions] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localLabels, setLocalLabels] = useState(labels);
  const [labelQuery, setLabelQuery] = useState("");
  const [labelPanelMode, setLabelPanelMode] = useState<LabelPanelMode>("list");
  const [labelDraftTitle, setLabelDraftTitle] = useState("");
  const [labelDraftColor, setLabelDraftColor] = useState<string | null>(null);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const cardActionsRef = useRef<HTMLDivElement | null>(null);
  const filteredLabels = useMemo(() => {
    const normalizedQuery = labelQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return localLabels;
    return localLabels.filter(label => label.name.toLocaleLowerCase().includes(normalizedQuery));
  }, [labelQuery, localLabels]);
  const filteredChecklistMembers = useMemo(() => {
    const normalizedQuery = checklistMemberQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return members;
    return members.filter(member => getMemberDisplayName(member).toLocaleLowerCase().includes(normalizedQuery));
  }, [checklistMemberQuery, members]);
  const cardComments = useMemo(() => comments.filter(c => c.card_id === card.id), [comments, card.id]);
  const cardChecklists = useMemo(() => checklists.filter(c => c.card_id === card.id).sort((a, b) => a.position - b.position), [checklists, card.id]);
  const cardAttachments = useMemo(() => attachments.filter(a => a.card_id === card.id), [attachments, card.id]);
  const cardActivities = useMemo(() => activities.filter(a => a.card_id === card.id), [activities, card.id]);
  const isWatching = currentUserId ? cardWatchers.includes(currentUserId) : false;
  const isPastDue = card.due_at ? new Date(card.due_at) < new Date() : false;
  const hasCoverBand = card.cover_type === "color" && Boolean(card.cover_value);
  const activityFeed = useMemo(() => {
    const items = [...cardComments.map(c => ({
      id: c.id,
      type: "comment" as const,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id
    })), ...cardActivities.map(a => ({
      id: a.id,
      type: "activity" as const,
      content: formatActivityMessage(a.action, a.metadata ?? {}, lists),
      created_at: a.created_at,
      user_id: a.actor_id
    }))];
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [cardComments, cardActivities, lists]);
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showCardActions) {
          setShowCardActions(false);
        } else if (checklistPopover) {
          setChecklistPopover(null);
        } else if (activePanel) {
          setActivePanel(null);
        } else if (editingTitle) {
          setEditingTitle(false);
          setTitle(card.title);
        } else if (editingDescription) {
          setEditingDescription(false);
          setDescription(card.description ?? "");
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCardActions, checklistPopover, activePanel, editingTitle, editingDescription, card.title, card.description, onClose]); /* LWW sync: keep local edits while editing, otherwise immediately reflect server state. */
  useEffect(() => {
    if (!editingTitle) {
      setTitle(card.title);
    }
  }, [card.title, editingTitle]);
  useEffect(() => {
    if (!editingDescription) {
      setDescription(card.description ?? "");
    }
  }, [card.description, editingDescription]);
  useEffect(() => {
    setListId(card.list_id);
  }, [card.list_id]);
  useEffect(() => {
    if (activePanel === "dates") return;
    setStartAt(toDateTimeInputValue(card.start_at));
    setDueAt(toDateTimeInputValue(card.due_at));
  }, [activePanel, card.start_at, card.due_at]);
  useEffect(() => {
    setCoverColor(card.cover_value ?? card.cover_color ?? "#2b6cb0");
  }, [card.cover_color, card.cover_value]);
  useEffect(() => {
    if (activePanel === "location") return;
    setLocationName(card.location_name ?? "");
    setLocationLat(card.location_lat?.toString() ?? "");
    setLocationLng(card.location_lng?.toString() ?? "");
  }, [activePanel, card.location_lat, card.location_lng, card.location_name]);
  useEffect(() => {
    if (activePanel === "members") return;
    setAssigneeIds(incomingAssigneeIds);
  }, [activePanel, incomingAssigneeIds]);
  useEffect(() => {
    if (activePanel === "labels") return;
    setLabelIds(incomingLabelIds);
  }, [activePanel, incomingLabelIds]);
  useEffect(() => {
    setLocalLabels(labels);
  }, [labels]);
  useEffect(() => {
    if (activePanel !== "labels") {
      setLabelPanelMode("list");
      setLabelDraftTitle("");
      setLabelDraftColor(null);
      return;
    }
    if (labelPanelMode === "create" && !labelDraftColor) {
      setLabelDraftColor(pickNextLabelColor(localLabels));
    }
  }, [activePanel, labelDraftColor, labelPanelMode, localLabels]);
  useEffect(() => {
    if (activePanel === "customFields") return;
    setCustomFieldDrafts(buildCustomFieldDrafts(customFields, cardCustomFieldValues, card.id));
  }, [activePanel, card.id, cardCustomFieldValues, customFields]);
  useEffect(() => {
    if (!showCardActions) return;
    function handlePointerDown(event: MouseEvent) {
      if (cardActionsRef.current && !cardActionsRef.current.contains(event.target as Node)) {
        setShowCardActions(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showCardActions]);
  function togglePanel(panel: ActivePanel) {
    setChecklistPopover(null);
    setActivePanel(current => current === panel ? null : panel);
  }
  async function patchFields(fields: Record<string, unknown>): Promise<BoardCard> {
    const response = await fetch(`/api/cards/${card.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(fields)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? "Failed to update card.");
    return body.data as BoardCard;
  }
  async function saveTitle() {
    if (!title.trim() || title === card.title) return;
    try {
      const updated = await patchFields({
        title: title.trim()
      });
      onCardPatched(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save title.");
      setTitle(card.title);
    }
  }
  async function saveDescription() {
    try {
      const updated = await patchFields({
        description: description.trim() || null
      });
      onCardPatched(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save description.");
    }
  }
  async function saveAssignees(nextIds: string[]) {
    try {
      const updated = await patchFields({
        assigneeIds: nextIds
      });
      onCardPatched(updated);
      onCardRelationshipPatched?.(nextIds, labelIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save members.");
      setAssigneeIds(incomingAssigneeIds);
    }
  }
  async function saveLabels(nextIds: string[]) {
    try {
      const updated = await patchFields({
        labelIds: nextIds
      });
      onCardPatched(updated);
      onCardRelationshipPatched?.(assigneeIds, nextIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save labels.");
      setLabelIds(incomingLabelIds);
    }
  }
  function openCreateLabelPanel() {
    setLabelDraftTitle(labelQuery.trim());
    setLabelDraftColor(pickNextLabelColor(localLabels));
    setLabelPanelMode("create");
  }
  async function createLabelFromDraft() {
    const name = labelDraftTitle.trim() || "\u65b0\u3057\u3044\u30e9\u30d9\u30eb";
    if (creatingLabel) return;
    setCreatingLabel(true);
    try {
      const response = await fetch(`/api/boards/${boardId}/labels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          color: labelDraftColor ?? "#64748b"
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to create label.");
      }
      const createdLabel = body.data as Label;
      setLocalLabels(current => {
        if (current.some(label => label.id === createdLabel.id)) return current;
        return [...current, createdLabel];
      });
      onLabelCreated?.(createdLabel);
      const nextLabelIds = labelIds.includes(createdLabel.id) ? labelIds : [...labelIds, createdLabel.id];
      setLabelIds(nextLabelIds);
      await saveLabels(nextLabelIds);
      setLabelQuery("");
      setLabelPanelMode("list");
      setLabelDraftTitle("");
      setLabelDraftColor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create label.");
    } finally {
      setCreatingLabel(false);
    }
  }
  async function updateLabel(labelId: string, fields: {
    name?: string;
    color?: string;
  }) {
    const response = await fetch(`/api/boards/${boardId}/labels/${labelId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(fields)
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.error?.message ?? "Failed to update label.");
    }
    const updatedLabel = body.data as Label;
    setLocalLabels(current => current.map(label => label.id === updatedLabel.id ? updatedLabel : label));
    onLabelUpdated?.(updatedLabel);
  }
  async function saveDates() {
    try {
      const updated = await patchFields({
        startAt: startAt ? new Date(startAt).toISOString() : null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null
      });
      onCardPatched(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save dates.");
      setStartAt(toDateTimeInputValue(card.start_at));
      setDueAt(toDateTimeInputValue(card.due_at));
    }
  }
  async function saveLocation() {
    try {
      const updated = await patchFields({
        locationName: locationName.trim() || null,
        locationLat: locationLat ? Number(locationLat) : null,
        locationLng: locationLng ? Number(locationLng) : null
      });
      onCardPatched(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save location.");
      setLocationName(card.location_name ?? "");
      setLocationLat(card.location_lat?.toString() ?? "");
      setLocationLng(card.location_lng?.toString() ?? "");
    }
  }
  async function saveCustomFields() {
    if (!customFields.length) return;
    const values = customFields.map(field => {
      const draft = customFieldDrafts[field.id] ?? {};
      if (field.field_type === "text") {
        return {
          customFieldId: field.id,
          valueText: draft.valueText?.trim() || null
        };
      }
      if (field.field_type === "number") {
        const n = draft.valueNumber !== undefined && draft.valueNumber !== "" ? Number(draft.valueNumber) : null;
        return {
          customFieldId: field.id,
          valueNumber: n !== null && Number.isFinite(n) ? n : null
        };
      }
      if (field.field_type === "date") {
        return {
          customFieldId: field.id,
          valueDate: draft.valueDate ? new Date(draft.valueDate).toISOString() : null
        };
      }
      if (field.field_type === "checkbox") {
        return {
          customFieldId: field.id,
          valueBoolean: Boolean(draft.valueBoolean)
        };
      }
      return {
        customFieldId: field.id,
        valueOption: draft.valueOption?.trim() || null
      };
    });
    const response = await fetch(`/api/cards/${card.id}/custom-fields`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values
      })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to update custom fields.");
      return;
    }
    onCustomFieldValuesPatched?.((body.data ?? []) as CardCustomFieldValue[]);
  }
  async function toggleWatch() {
    const response = await fetch(`/api/cards/${card.id}/watch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        watch: !isWatching
      })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to update watch state.");
      return;
    }
    onWatchersPatched?.(body.data.watching);
  }
  async function toggleComplete() {
    const nextIsCompleted = !card.is_completed;
    const confirmed = window.confirm(nextIsCompleted ? "このカードを完了にしますか？" : "このカードを未完了に戻しますか？");
    if (!confirmed) return;

    const response = await fetch(`/api/cards/${card.id}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        isCompleted: nextIsCompleted
      })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to update completion.");
      return;
    }
    onCardPatched(body.data);
  }
  async function toggleArchive() {
    const response = await fetch(`/api/cards/${card.id}/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        archived: !card.archived
      })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to update archive state.");
      return;
    }
    onCardPatched(body.data);
  }
  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentText.trim()) return;
    const response = await fetch(`/api/cards/${card.id}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: commentText
      })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to create comment.");
      return;
    }
    onCommentCreated(body.data);
    setCommentText("");
  }
  async function createChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newChecklistTitle.trim()) return;
    const response = await fetch(`/api/cards/${card.id}/checklists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: newChecklistTitle
      })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to create checklist.");
      return;
    }
    onChecklistCreated(body.data);
    setNewChecklistTitle("");
    setActivePanel(null);
  }
  function closeChecklistPopover() {
    setChecklistPopover(null);
    setChecklistMemberQuery("");
    setChecklistDueDateDraft("");
  }
  function updateChecklistDraft(
    checklistId: string,
    patch: Partial<ChecklistItemDraft>,
  ) {
    setChecklistItemDraft(current => ({
      ...current,
      [checklistId]: {
        ...getChecklistDraft(current, checklistId),
        ...patch,
      },
    }));
  }
  function clearChecklistDraft(checklistId: string) {
    setChecklistItemDraft(current => ({
      ...current,
      [checklistId]: { ...EMPTY_CHECKLIST_ITEM_DRAFT },
    }));
  }
  function openChecklistDraftAssigneePopover(checklistId: string) {
    setChecklistMemberQuery("");
    setChecklistPopover({ type: "draft-assignee", checklistId });
  }
  function openChecklistDraftDuePopover(checklistId: string) {
    setChecklistDueDateDraft(getChecklistDraft(checklistItemDraft, checklistId).dueDate);
    setChecklistPopover({ type: "draft-due", checklistId });
  }
  function openChecklistItemAssigneePopover(checklistId: string, itemId: string) {
    setChecklistMemberQuery("");
    setChecklistPopover({ type: "item-assignee", checklistId, itemId });
  }
  function openChecklistItemDuePopover(checklistId: string, item: ChecklistItem) {
    setChecklistDueDateDraft(toDateInputValue(item.due_at));
    setChecklistPopover({ type: "item-due", checklistId, itemId: item.id });
  }
  async function patchChecklistItem(itemId: string, payload: Record<string, unknown>) {
    setPendingChecklistPatchByItemId(current => ({ ...current, [itemId]: true }));
    const response = await fetch(`/api/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    setPendingChecklistPatchByItemId(current => ({ ...current, [itemId]: false }));
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to update checklist item.");
      return null;
    }
    onChecklistItemPatched(body.data);
    return body.data as ChecklistItem;
  }
  async function createChecklistItem(checklistId: string) {
    if (pendingChecklistCreateByChecklistId[checklistId]) return;
    const draft = getChecklistDraft(checklistItemDraft, checklistId);
    const content = draft.content.trim();
    if (!content) return;

    const payload: Record<string, unknown> = { content };
    if (draft.assigneeId !== null) {
      payload.assigneeId = draft.assigneeId;
    }
    if (draft.dueDate) {
      const dueAt = toDueAtIsoFromDate(draft.dueDate);
      if (!dueAt) {
        setError("期限日の形式が正しくありません。");
        return;
      }
      payload.dueAt = dueAt;
    }

    setPendingChecklistCreateByChecklistId(current => ({ ...current, [checklistId]: true }));
    const response = await fetch(`/api/checklists/${checklistId}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    setPendingChecklistCreateByChecklistId(current => ({ ...current, [checklistId]: false }));
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to create checklist item.");
      return;
    }
    onChecklistItemCreated(body.data);
    clearChecklistDraft(checklistId);
    closeChecklistPopover();
  }
  async function toggleChecklistItem(item: ChecklistItem) {
    await patchChecklistItem(item.id, { isCompleted: !item.is_completed });
  }
  async function saveChecklistItemAssignee(item: ChecklistItem, assigneeId: string | null) {
    const updated = await patchChecklistItem(item.id, { assigneeId });
    if (!updated) return;
    closeChecklistPopover();
  }
  async function saveChecklistItemDueDate(item: ChecklistItem, dueDate: string | null) {
    const dueAt = dueDate ? toDueAtIsoFromDate(dueDate) : null;
    if (dueDate && !dueAt) {
      setError("期限日の形式が正しくありません。");
      return;
    }
    const updated = await patchChecklistItem(item.id, { dueAt: dueAt ?? null });
    if (!updated) return;
    closeChecklistPopover();
  }
  function renderChecklistAssigneePopover({
    selectedAssigneeId,
    onSelect,
    disabled = false,
  }: {
    selectedAssigneeId: string | null;
    onSelect: (assigneeId: string | null) => void;
    disabled?: boolean;
  }) {
    return (
      <>
        <div className="fixed inset-0 z-10" onClick={closeChecklistPopover} />
        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-[#d0d4db] bg-white p-3 shadow-xl">
          <input
            type="search"
            value={checklistMemberQuery}
            onChange={event => setChecklistMemberQuery(event.target.value)}
            placeholder="メンバーを検索"
            className="w-full rounded-md border border-[#0c66e4] bg-white px-3 py-2 text-sm text-[#172b4d] outline-none focus:ring-2 focus:ring-[#0c66e4]/20"
          />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#44546f]">カードメンバー</p>
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => onSelect(null)}
              disabled={disabled}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-left ${
                selectedAssigneeId === null ? "bg-[#deebff] text-[#0c66e4]" : "text-[#172b4d] hover:bg-[#f1f2f4]"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              割り当てなし
            </button>
            {filteredChecklistMembers.length === 0 ? (
              <p className="px-2 py-1 text-sm text-[#626f86]">メンバーが見つかりません。</p>
            ) : (
              filteredChecklistMembers.map(member => {
                const name = getMemberDisplayName(member);
                const avatarColor = getMemberAvatarColor(member);
                const selected = selectedAssigneeId === member.user_id;
                return (
                  <button
                    key={member.user_id}
                    type="button"
                    onClick={() => onSelect(member.user_id)}
                    disabled={disabled}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-left ${
                      selected ? "bg-[#deebff] text-[#0c66e4]" : "text-[#172b4d] hover:bg-[#f1f2f4]"
                    } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </>
    );
  }
  function renderChecklistDuePopover({
    onSave,
    onDelete,
    disabled = false,
  }: {
    onSave: (dueDate: string | null) => void;
    onDelete?: () => void;
    disabled?: boolean;
  }) {
    return (
      <>
        <div className="fixed inset-0 z-10" onClick={closeChecklistPopover} />
        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-[#d0d4db] bg-white p-3 shadow-xl">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#44546f]">期限</label>
          <input
            type="date"
            value={checklistDueDateDraft}
            onChange={event => setChecklistDueDateDraft(event.target.value)}
            className="w-full rounded-md border border-[#d0d4db] bg-white px-3 py-2 text-sm text-[#172b4d] outline-none focus:border-[#0c66e4]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSave(checklistDueDateDraft || null)}
              disabled={disabled}
              className="rounded-md bg-[#0c66e4] px-4 py-2 text-sm font-medium text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60"
            >
              保存
            </button>
            <button
              type="button"
              onClick={closeChecklistPopover}
              className="rounded-md px-3 py-2 text-sm text-[#172b4d] hover:bg-[#dfe1e6]"
            >
              キャンセル
            </button>
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={disabled}
                className="ml-auto rounded-md px-3 py-2 text-sm text-[#c9372c] hover:bg-[#ffeceb] disabled:cursor-not-allowed disabled:opacity-60"
              >
                削除
              </button>
            ) : null}
          </div>
        </div>
      </>
    );
  }
  async function uploadAttachment(file: File) {
    setUploading(true);
    try {
      const safeName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const storagePath = `workspace/${workspaceId}/board/${boardId}/card/${card.id}/${safeName}`;
      const {
        error: uploadError
      } = await supabase.storage.from("attachments").upload(storagePath, file, {
        upsert: false
      });
      if (uploadError) throw uploadError;
      const response = await fetch(`/api/cards/${card.id}/attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: file.name,
          storagePath,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          previewUrl: null
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Failed to upload attachment.");
      onAttachmentCreated(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload attachment.");
    } finally {
      setUploading(false);
    }
  }
  async function openAttachment(attachmentId: string) {
    const response = await fetch(`/api/attachments/sign?attachmentId=${attachmentId}`);
    const body = await response.json();
    if (!response.ok || !body.data?.signedUrl) {
      setError(body?.error?.message ?? "Failed to get attachment URL.");
      return;
    }
    window.open(body.data.signedUrl, "_blank", "noopener,noreferrer");
  }
  return <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto py-8" style={{
    background: "rgba(9, 30, 66, 0.52)"
  }} onClick={e => {
    if (e.target === e.currentTarget) onClose();
  }}>      <div className="relative w-full max-w-[900px] mx-4 self-start rounded-xl bg-[#f1f2f4] shadow-2xl min-h-96">        {/* Cover band */}        {hasCoverBand ? <div className="h-40 rounded-t-xl" style={{
        backgroundColor: card.cover_value ?? undefined
      }} /> : null}        {/* Close button */}        <div className="absolute top-3 right-12 z-20" ref={cardActionsRef}>          <button type="button" aria-label={"カードアクション"} aria-haspopup="menu" aria-expanded={showCardActions} onClick={() => setShowCardActions(prev => !prev)} className="w-8 h-8 flex items-center justify-center rounded-full text-[#44546f] bg-[#f1f2f4] hover:bg-[#dfe1e6] text-xl leading-none">            {"\u2026"}          </button>          {showCardActions ? <div role="menu" className="absolute right-0 mt-1 w-48 rounded-lg border border-[#d0d4db] bg-white p-1 shadow-xl">              <button type="button" role="menuitem" onClick={() => {
            setShowCardActions(false);
            void toggleArchive();
          }} className="w-full rounded-md px-3 py-2 text-left text-sm text-[#172b4d] hover:bg-[#f1f2f4]">                {card.archived ? "アーカイブを解除" : "カードをアーカイブ"}              </button>            </div> : null}        </div>        <button type="button" onClick={onClose} aria-label={"\u9589\u3058\u308b"} className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full text-[#44546f] bg-[#f1f2f4] hover:bg-[#dfe1e6] text-xl leading-none font-bold">          {"\u00d7"}        </button>        {/* Body: two columns */}        <div className={`flex gap-0 p-5 min-h-[480px] ${hasCoverBand ? "pt-4" : "pt-14"}`}>          {/* ===== MAIN COLUMN ===== */}          <div className="flex-1 min-w-0 pr-6 space-y-5">            {/* Title */}            <div className="flex items-start gap-3">              <div className="mt-3 text-[#44546f] shrink-0 text-base">📋</div>              <div className="flex-1 min-w-0">                {editingTitle ? <textarea className="w-full text-xl font-bold rounded-lg px-2 py-1.5 resize-none text-[#172b4d] leading-snug border-2 border-[#0c66e4] bg-white focus:outline-none" value={title} rows={2} onChange={e => setTitle(e.target.value)} onBlur={() => {
                setEditingTitle(false);
                void saveTitle();
              }} onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setEditingTitle(false);
                  void saveTitle();
                }
              }} autoFocus /> : <h2 className="text-xl font-bold text-[#172b4d] rounded-lg px-2 py-1.5 hover:bg-white/70 cursor-pointer leading-snug" onClick={() => setEditingTitle(true)}>                    {title}                  </h2>}                <p className="text-xs text-[#44546f] px-2 mt-1">                  <span className="font-semibold">                    {lists.find(l => l.id === listId)?.name ?? "リスト"}                  </span>{" "}                  のカード                </p>              </div>            </div>            {detailLoading ? <span className="sr-only" aria-live="polite">詳細を更新しています</span> : null}            {/* Metadata row */}            {assigneeIds.length > 0 || labelIds.length > 0 || card.due_at ? <div className="flex flex-wrap gap-5 pl-8">                {assigneeIds.length > 0 && <div>                    <p className="text-xs font-semibold text-[#44546f] uppercase tracking-wide mb-2">                      メンバー                    </p>                    <ul className="space-y-1">                      {assigneeIds.map(id => {
                  const member = members.find(m => m.user_id === id);
                  const name = member ? getMemberDisplayName(member) : id;
                  const avatarColor = getMemberAvatarColor(member);
                  return <li key={id} className="flex items-center gap-2">                          <div title={name} className="w-8 h-8 rounded-full border-2 border-[#f1f2f4] flex items-center justify-center text-white text-xs font-bold shrink-0" style={{
                    backgroundColor: avatarColor
                  }}>                            {name.charAt(0).toUpperCase()}                          </div>                          <span className="text-sm text-[#172b4d] break-all">{name}</span>                        </li>;
                })}                    </ul>                  </div>}                {labelIds.length > 0 && <div>                    <p className="text-xs font-semibold text-[#44546f] uppercase tracking-wide mb-2">                      ラベル                    </p>                    <div className="flex flex-wrap gap-1">                      {labelIds.map(id => {
                  const label = localLabels.find(l => l.id === id);
                  if (!label) return null;
                  return <span key={id} className="h-8 rounded px-3 text-sm font-semibold text-white flex items-center" style={{
                    backgroundColor: label.color
                  }}>                            {label.name}                          </span>;
                })}                    </div>                  </div>}                {card.due_at && <div>                    <p className="text-xs font-semibold text-[#44546f] uppercase tracking-wide mb-2">                      期限                    </p>                    <span className={`inline-flex items-center rounded h-8 px-3 text-sm font-semibold ${card.is_completed ? "bg-[#4bce97] text-white" : isPastDue ? "bg-[#ffeceb] text-[#c9372c]" : "bg-[#dfe1e6] text-[#172b4d]"}`}>                      {new Date(card.due_at).toLocaleDateString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}                      {isPastDue && !card.is_completed ? " (期限切れ)" : ""}                    </span>                  </div>}                <div>                    <p className="text-xs font-semibold text-[#44546f] uppercase tracking-wide mb-2">                      完了マーク                    </p>                    <button type="button" onClick={() => void toggleComplete()} className={`inline-flex items-center gap-1.5 rounded h-8 px-3 text-sm font-semibold transition-colors ${card.is_completed ? "bg-[#4bce97] text-white" : "bg-[#dfe1e6] text-[#172b4d] hover:bg-[#ced3da]"}`} aria-label={card.is_completed ? "未完了に戻す" : "完了としてマーク"}>                      <input type="checkbox" checked={card.is_completed} onChange={() => void toggleComplete()} className="accent-[#0c66e4] pointer-events-none" readOnly />                      <span>{card.is_completed ? "完了" : "未完了"}</span>                    </button>                  </div>              </div> : null}            {/* Action buttons row */}            <div className="relative pl-8 flex items-center gap-2 flex-wrap">              <button type="button" onClick={() => togglePanel("addMenu")} className="flex items-center gap-1.5 rounded-full bg-[#0c66e4] text-white px-4 py-1.5 text-sm font-medium hover:bg-[#0055cc] transition-colors">                + 追加              </button>              {([{
              key: "labels" as const,
              label: "🏷ラベル"
            }, {
              key: "checklist" as const,
              label: "☑ チェックリスト"
            }, {
              key: "members" as const,
              label: "👤 メンバー"
            }] as const).map(btn => <button key={btn.key} type="button" onClick={() => togglePanel(btn.key)} className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${activePanel === btn.key ? "bg-[#dfe1e6] border-[#b3b9c4] text-[#172b4d]" : "bg-white border-[#d0d4db] text-[#172b4d] hover:bg-[#f7f8f9]"}`}>                  {btn.label}                </button>)}              {/* Add Menu Popup */}              {activePanel === "addMenu" && <>                  {/* Backdrop to close addMenu */}                  <div className="fixed inset-0 z-20" onClick={() => setActivePanel(null)} />                  <div className="absolute top-full left-0 mt-1 z-30 w-64 bg-white rounded-xl shadow-xl border border-[#d0d4db]">                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#dfe1e6]">                      <span className="text-sm font-semibold text-[#172b4d]">                        カードに追加                      </span>                      <button type="button" onClick={() => setActivePanel(null)} className="text-[#626f86] hover:text-[#172b4d] w-6 h-6 flex items-center justify-center text-lg leading-none">                        ×                      </button>                    </div>                    <div className="p-1.5">                      {ADD_MENU_OPTIONS.map(opt => <button key={String(opt.key)} type="button" onClick={() => setActivePanel(opt.key)} className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-[#f7f8f9] text-left">                          <span className="text-base mt-0.5 w-5 text-center shrink-0">                            {opt.icon}                          </span>                          <div>                            <div className="text-sm font-medium text-[#172b4d]">                              {opt.label}                            </div>                            <div className="text-xs text-[#626f86] mt-0.5">                              {opt.desc}                            </div>                          </div>                        </button>)}                    </div>                  </div>                </>}            </div>            {/* Inline action panel */}            {activePanel && activePanel !== "addMenu" && <div className="ml-8 rounded-xl bg-white border border-[#d0d4db] shadow-sm overflow-hidden">                <div className="flex items-center justify-between px-4 py-3 bg-[#f7f8f9] border-b border-[#dfe1e6]">                  <div className="w-6">                    {activePanel === "labels" && labelPanelMode === "create" ? <button type="button" onClick={() => setLabelPanelMode("list")} className="text-[#44546f] hover:text-[#172b4d] w-6 h-6 flex items-center justify-center text-lg leading-none" aria-label={"\u30e9\u30d9\u30eb\u4e00\u89a7\u306b\u623b\u308b"}>                        {"\u2039"}                      </button> : null}                  </div>                  <span className="text-sm font-semibold text-[#172b4d]">                    {activePanel === "labels" && labelPanelMode === "create" ? "\u30e9\u30d9\u30eb\u3092\u4f5c\u6210" : PANEL_LABELS[activePanel] ?? ""}                  </span>                  <button type="button" onClick={() => setActivePanel(null)} className="text-[#626f86] hover:text-[#172b4d] w-6 h-6 flex items-center justify-center text-lg leading-none" aria-label={"\u9589\u3058\u308b"}>                    {"\u00d7"}                  </button>                </div>                <div className="p-4">                  {/* Labels panel */}                  {activePanel === "labels" && labelPanelMode === "list" && <div className="space-y-3">                      <input type="search" value={labelQuery} onChange={event => setLabelQuery(event.target.value)} placeholder={"\u30e9\u30d9\u30eb\u3092\u691c\u7d22"} className="w-full rounded-md border border-[#0c66e4] bg-white px-3 py-2 text-sm text-[#172b4d] outline-none focus:ring-2 focus:ring-[#0c66e4]/20" />                      <p className="text-xs font-semibold text-[#44546f] uppercase tracking-wide">                        {"\u30e9\u30d9\u30eb"}                      </p>                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">                        {filteredLabels.length === 0 ? <p className="py-2 text-sm text-[#626f86]">                            {"\u30e9\u30d9\u30eb\u304c\u3042\u308a\u307e\u305b\u3093"}                          </p> : filteredLabels.map(label => <label key={label.id} className="flex items-center gap-3 rounded-md p-1.5 hover:bg-[#f1f2f4] cursor-pointer">                              <input type="checkbox" checked={labelIds.includes(label.id)} onChange={() => {
                      const next = labelIds.includes(label.id) ? labelIds.filter(id => id !== label.id) : [...labelIds, label.id];
                      setLabelIds(next);
                      void saveLabels(next);
                    }} className="h-4 w-4 accent-[#0c66e4]" />                              <span className="flex h-9 flex-1 items-center rounded-md px-3 text-sm font-semibold text-[#172b4d] shadow-[inset_0_0_0_1px_rgba(9,30,66,0.08)]" style={{
                      backgroundColor: label.color
                    }}>                                {label.name || "\u540d\u524d\u306a\u3057\u30e9\u30d9\u30eb"}                              </span>                              <button type="button" aria-label={"\u30e9\u30d9\u30eb\u3092\u7de8\u96c6"} onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      const nextName = window.prompt("\u30e9\u30d9\u30eb\u540d\u3092\u7de8\u96c6", label.name);
                      if (nextName === null) return;
                      const trimmedName = nextName.trim();
                      if (!trimmedName || trimmedName === label.name) return;
                      void updateLabel(label.id, {
                        name: trimmedName
                      }).catch(e => {
                        setError(e instanceof Error ? e.message : "Failed to update label.");
                      });
                    }} className="inline-flex h-7 w-7 items-center justify-center rounded text-[#44546f] hover:bg-[#dfe1e6]">                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">                                  <path d="M12 20h9" />                                  <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />                                </svg>                              </button>                            </label>)}                      </div>                      <button type="button" onClick={openCreateLabelPanel} className="w-full rounded-md bg-[#f1f2f4] px-3 py-2 text-sm font-semibold text-[#172b4d] hover:bg-[#dfe1e6]">                        {"\u65b0\u3057\u3044\u30e9\u30d9\u30eb\u3092\u4f5c\u6210"}                      </button>                    </div>}                  {activePanel === "labels" && labelPanelMode === "create" && <div className="space-y-4">                      <div className="h-10 rounded-md border border-[#d0d4db]" style={{
                  backgroundColor: labelDraftColor ?? "#dfe1e6"
                }} />                      <div>                        <label className="block text-sm font-semibold text-[#172b4d] mb-1.5">                          {"\u30bf\u30a4\u30c8\u30eb"}                        </label>                        <input type="text" value={labelDraftTitle} onChange={event => setLabelDraftTitle(event.target.value)} className="w-full rounded-md border border-[#a5adba] bg-white px-3 py-2 text-sm text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" placeholder={"\u30e9\u30d9\u30eb\u540d"} autoFocus onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createLabelFromDraft();
                    }
                  }} />                      </div>                      <div>                        <p className="text-sm font-semibold text-[#172b4d] mb-2">                          {"\u8272\u3092\u9078\u629e"}                        </p>                        <div className="grid grid-cols-5 gap-2">                          {LABEL_CREATE_COLOR_OPTIONS.map(color => <button key={color} type="button" onClick={() => setLabelDraftColor(color)} className={`h-8 rounded-md border transition ${labelDraftColor === color ? "border-[#0c66e4] ring-2 ring-[#0c66e4]/30" : "border-transparent hover:border-[#a5adba]"}`} style={{
                      backgroundColor: color
                    }} aria-label={`${"\u8272"} ${color}`} />)}                        </div>                      </div>                      <button type="button" onClick={() => setLabelDraftColor(null)} className="w-full rounded-md bg-[#f1f2f4] px-3 py-2 text-sm font-semibold text-[#44546f] hover:bg-[#dfe1e6]">                        {"\u00d7 \u8272\u3092\u524a\u9664"}                      </button>                      <div className="border-t border-[#dfe1e6] pt-3">                        <button type="button" onClick={() => void createLabelFromDraft()} disabled={creatingLabel} className="rounded-md bg-[#0c66e4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60">                          {creatingLabel ? "\u4f5c\u6210\u4e2d..." : "\u4f5c\u6210"}                        </button>                      </div>                    </div>}                  {/* Dates panel */}                  {activePanel === "dates" && <div className="space-y-3">                      <div>                        <label className="text-xs font-semibold text-[#44546f] uppercase tracking-wide block mb-1.5">                          開始日                        </label>                        <input type="datetime-local" className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={startAt} onChange={e => setStartAt(e.target.value)} />                      </div>                      <div>                        <label className="text-xs font-semibold text-[#44546f] uppercase tracking-wide block mb-1.5">                          期限日                        </label>                        <input type="datetime-local" className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={dueAt} onChange={e => setDueAt(e.target.value)} />                      </div>                      <div className="flex gap-2 flex-wrap">                        <button type="button" onClick={() => {
                    void saveDates();
                    setActivePanel(null);
                  }} className="bg-[#0c66e4] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0055cc]">                          保存                        </button>                        <button type="button" onClick={() => {
                    setStartAt(card.start_at ? new Date(card.start_at).toISOString().slice(0, 16) : "");
                    setDueAt(card.due_at ? new Date(card.due_at).toISOString().slice(0, 16) : "");
                    setActivePanel(null);
                  }} className="text-[#172b4d] hover:bg-[#dfe1e6] rounded-lg px-3 py-2 text-sm">                          キャンセル                        </button>                        {(startAt || dueAt) && <button type="button" onClick={() => {
                    setStartAt("");
                    setDueAt("");
                    void patchFields({
                      startAt: null,
                      dueAt: null
                    }).then(onCardPatched);
                  }} className="text-[#c9372c] hover:bg-[#ffeceb] rounded-lg px-3 py-2 text-sm ml-auto">                            日付を削除                          </button>}                      </div>                    </div>}                  {/* Checklist panel */}                  {activePanel === "checklist" && <form onSubmit={createChecklist} className="space-y-3">                      <div>                        <label className="text-xs font-semibold text-[#44546f] uppercase tracking-wide block mb-1.5">                          タイトル                        </label>                        <input className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={newChecklistTitle} onChange={e => setNewChecklistTitle(e.target.value)} placeholder="チェックリスト" autoFocus />                      </div>                      <button type="submit" className="bg-[#0c66e4] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0055cc]">                        追加                      </button>                    </form>}                  {/* Members panel */}                  {activePanel === "members" && <div className="space-y-1">                      {members.length === 0 && <p className="text-sm text-[#626f86]">メンバーがいません</p>}                      {members.map(member => {
                  const name = member.profile?.display_name ?? member.profile?.email ?? member.user_id;
                  const avatarColor = getMemberAvatarColor(member);
                  return <label key={member.user_id} className="flex items-center gap-3 rounded-md p-2 hover:bg-[#f7f8f9] cursor-pointer">                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{
                    backgroundColor: avatarColor
                  }}>                              {name.charAt(0).toUpperCase()}                            </div>                            <span className="flex-1 text-sm text-[#172b4d]">{name}</span>                            <input type="checkbox" checked={assigneeIds.includes(member.user_id)} onChange={() => {
                      const next = assigneeIds.includes(member.user_id) ? assigneeIds.filter(id => id !== member.user_id) : [...assigneeIds, member.user_id];
                      setAssigneeIds(next);
                      void saveAssignees(next);
                    }} className="w-4 h-4 accent-[#0c66e4]" />                          </label>;
                })}                    </div>}                  {/* Attachment panel */}                  {activePanel === "attachment" && <label className="cursor-pointer block">                      <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${uploading ? "border-[#0c66e4] bg-[#f0f7ff]" : "border-[#d0d4db] hover:border-[#0c66e4] hover:bg-[#f7f8f9]"}`}>                        <p className="text-sm font-medium text-[#172b4d]">                          {uploading ? "アップロード中..." : "ファイルを選択またはドロップ"}                        </p>                        <p className="text-xs text-[#626f86] mt-1">最大 10MB まで</p>                      </div>                      <input type="file" className="hidden" disabled={uploading} onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void uploadAttachment(file);
                  e.currentTarget.value = "";
                }} />                    </label>}                  {/* Location panel */}                  {activePanel === "location" && <div className="space-y-3">                      <div>                        <label className="text-xs font-semibold text-[#44546f] uppercase tracking-wide block mb-1.5">                          場所の名前                        </label>                        <input className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="例: 東京オフィス" />                      </div>                      <div className="grid grid-cols-2 gap-3">                        <div>                          <label className="text-xs font-semibold text-[#44546f] uppercase tracking-wide block mb-1.5">                            緯度                          </label>                          <input type="number" step="0.000001" className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={locationLat} onChange={e => setLocationLat(e.target.value)} placeholder="35.6895" />                        </div>                        <div>                          <label className="text-xs font-semibold text-[#44546f] uppercase tracking-wide block mb-1.5">                            経度                          </label>                          <input type="number" step="0.000001" className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={locationLng} onChange={e => setLocationLng(e.target.value)} placeholder="139.6917" />                        </div>                      </div>                      {card.location_name && <p className="text-xs text-[#44546f]">                          現在: {card.location_name}                        </p>}                      <div className="flex gap-2">                        <button type="button" onClick={() => {
                    void saveLocation();
                    setActivePanel(null);
                  }} className="bg-[#0c66e4] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0055cc]">                          保存                        </button>                        <button type="button" onClick={() => setActivePanel(null)} className="text-[#172b4d] hover:bg-[#dfe1e6] rounded-lg px-3 py-2 text-sm">                          キャンセル                        </button>                      </div>                    </div>}                  {/* Custom Fields panel */}                  {activePanel === "customFields" && <div className="space-y-3">                      {customFields.length === 0 && <p className="text-sm text-[#626f86]">                          カスタムフィールドがありません                        </p>}                      {customFields.map(field => {
                  const options = Array.isArray(field.options) ? field.options.map(item => typeof item === "string" ? {
                    id: item,
                    label: item
                  } : item) : [];
                  return <div key={field.id}>                            <label className="text-xs font-semibold text-[#44546f] uppercase tracking-wide block mb-1.5">                              {field.name}                            </label>                            {field.field_type === "text" && <input className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={customFieldDrafts[field.id]?.valueText ?? ""} onChange={e => setCustomFieldDrafts(p => ({
                      ...p,
                      [field.id]: {
                        ...p[field.id],
                        valueText: e.target.value
                      }
                    }))} />}                            {field.field_type === "number" && <input type="number" className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={customFieldDrafts[field.id]?.valueNumber ?? ""} onChange={e => setCustomFieldDrafts(p => ({
                      ...p,
                      [field.id]: {
                        ...p[field.id],
                        valueNumber: e.target.value
                      }
                    }))} />}                            {field.field_type === "date" && <input type="datetime-local" className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={customFieldDrafts[field.id]?.valueDate ?? ""} onChange={e => setCustomFieldDrafts(p => ({
                      ...p,
                      [field.id]: {
                        ...p[field.id],
                        valueDate: e.target.value
                      }
                    }))} />}                            {field.field_type === "checkbox" && <label className="flex items-center gap-2 cursor-pointer">                                <input type="checkbox" className="w-4 h-4 accent-[#0c66e4]" checked={Boolean(customFieldDrafts[field.id]?.valueBoolean)} onChange={e => setCustomFieldDrafts(p => ({
                        ...p,
                        [field.id]: {
                          ...p[field.id],
                          valueBoolean: e.target.checked
                        }
                      }))} />                                <span className="text-sm text-[#172b4d]">                                  {customFieldDrafts[field.id]?.valueBoolean ? "True" : "False"}                                </span>                              </label>}                            {field.field_type === "select" && <select className="w-full border border-[#d0d4db] rounded-lg px-3 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={customFieldDrafts[field.id]?.valueOption ?? ""} onChange={e => setCustomFieldDrafts(p => ({
                      ...p,
                      [field.id]: {
                        ...p[field.id],
                        valueOption: e.target.value
                      }
                    }))}>                                <option value="">-</option>                                {options.map(opt => <option key={opt.id} value={opt.label}>                                    {opt.label}                                  </option>)}                              </select>}                          </div>;
                })}                      {customFields.length > 0 && <div className="flex gap-2">                          <button type="button" onClick={() => {
                    void saveCustomFields();
                    setActivePanel(null);
                  }} className="bg-[#0c66e4] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0055cc]">                            保存                          </button>                          <button type="button" onClick={() => setActivePanel(null)} className="text-[#172b4d] hover:bg-[#dfe1e6] rounded-lg px-3 py-2 text-sm">                            キャンセル                          </button>                        </div>}                    </div>}                </div>              </div>}            {/* Description */}            <div className="pl-8">              <div className="flex items-center gap-2 mb-2">                <AlignLeft className="w-4 h-4 text-[#44546f] shrink-0" />                <h3 className="text-sm font-semibold text-[#172b4d] flex-1">説明</h3>                {!editingDescription && description && <button type="button" onClick={() => setEditingDescription(true)} className="text-xs border border-[#d0d4db] rounded px-2 py-1 bg-white text-[#44546f] hover:bg-[#f7f8f9]">                    編集                  </button>}              </div>              {editingDescription ? <div className="space-y-2">                  <textarea className="w-full min-h-28 bg-white border-2 border-[#0c66e4] rounded-lg px-3 py-2 text-sm text-[#172b4d] resize-y focus:outline-none" value={description} onChange={e => setDescription(e.target.value)} placeholder="詳しい説明を追加" autoFocus />                  <div className="flex gap-2">                    <button type="button" onClick={() => {
                  void saveDescription();
                  setEditingDescription(false);
                }} className="bg-[#0c66e4] text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-[#0055cc]">                      保存                    </button>                    <button type="button" onClick={() => {
                  setDescription(card.description ?? "");
                  setEditingDescription(false);
                }} className="text-[#172b4d] hover:bg-[#dfe1e6] rounded-md px-3 py-1.5 text-sm">                      キャンセル                    </button>                  </div>                </div> : <div className="min-h-12 bg-white border border-[#d0d4db] hover:border-[#b3b9c4] rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors" onClick={() => setEditingDescription(true)}>                  {description ? <p className="text-[#172b4d] whitespace-pre-wrap">{description}</p> : <p className="text-[#626f86]">詳しい説明を追加</p>}                </div>}            </div>            {/* Checklists */}            {cardChecklists.map(checklist => {
            const items = checklistItems.filter(item => item.checklist_id === checklist.id).sort((a, b) => a.position - b.position);
            const completedCount = items.filter(i => i.is_completed).length;
            const pct = items.length ? Math.round(completedCount / items.length * 100) : 0;
            const draft = getChecklistDraft(checklistItemDraft, checklist.id);
            const isCreatingItem = Boolean(pendingChecklistCreateByChecklistId[checklist.id]);
            return <div key={checklist.id} className="pl-8">                  <div className="mb-2 flex items-center gap-2">                    <span className="shrink-0 text-base text-[#44546f]">☑</span>                    <h3 className="flex-1 text-sm font-semibold text-[#172b4d]">                      {checklist.title}                    </h3>                  </div>                  <div className="mb-3 flex items-center gap-2">                    <span className={`w-8 shrink-0 text-right text-xs font-medium ${pct === 100 ? "text-[#1f845a]" : "text-[#44546f]"}`}>                      {pct}%                    </span>                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#dfe1e6]">                      <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-[#4bce97]" : "bg-[#0c66e4]"}`} style={{
                    width: `${pct}%`
                  }} />                    </div>                  </div>                  <div className="space-y-2">                    {items.map(item => {
                    const assignee = members.find(member => member.user_id === item.assignee_id) ?? null;
                    const assigneeName = assignee ? getMemberDisplayName(assignee) : null;
                    const hasDueDate = Boolean(item.due_at);
                    const isOverdue = Boolean(item.due_at) && !item.is_completed && new Date(item.due_at as string) < new Date();
                    const isPatchingItem = Boolean(pendingChecklistPatchByItemId[item.id]);
                    return <div key={item.id} className="rounded-lg px-2 py-2 hover:bg-[#e9ecf0]">                          <div className="flex items-start gap-3">                            <input type="checkbox" checked={item.is_completed} disabled={isPatchingItem} onChange={() => void toggleChecklistItem(item)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#d0d4db] accent-[#0c66e4]" />                            <span className={`flex-1 text-sm ${item.is_completed ? "line-through text-[#626f86]" : "text-[#172b4d]"}`}>                              {item.content}                            </span>                          </div>                          <div className="relative ml-7 mt-2 flex flex-wrap items-center gap-2">                            <button type="button" onClick={() => openChecklistItemAssigneePopover(checklist.id, item.id)} disabled={isPatchingItem} className={`rounded-full border px-2 py-1 text-xs font-medium transition-colors ${assigneeName ? "border-[#cce0ff] bg-[#deebff] text-[#0c66e4]" : "border-[#d0d4db] bg-white text-[#44546f] hover:bg-[#f7f8f9]"} ${isPatchingItem ? "cursor-not-allowed opacity-60" : ""}`}>                              {assigneeName ? `👤 ${assigneeName}` : "👤 割り当て"}                            </button>                            <button type="button" onClick={() => openChecklistItemDuePopover(checklist.id, item)} disabled={isPatchingItem} className={`rounded-full border px-2 py-1 text-xs font-medium transition-colors ${hasDueDate ? isOverdue ? "border-[#ffd2d2] bg-[#ffeceb] text-[#c9372c]" : "border-[#d0d4db] bg-[#f1f2f4] text-[#172b4d]" : "border-[#d0d4db] bg-white text-[#44546f] hover:bg-[#f7f8f9]"} ${isPatchingItem ? "cursor-not-allowed opacity-60" : ""}`}>                              {hasDueDate ? `🕒 ${formatDueDateLabel(item.due_at as string)}` : "🕒 期限"}                            </button>                            {checklistPopover?.type === "item-assignee" && checklistPopover.checklistId === checklist.id && checklistPopover.itemId === item.id ? renderChecklistAssigneePopover({
                        selectedAssigneeId: item.assignee_id,
                        onSelect: assigneeId => {
                          void saveChecklistItemAssignee(item, assigneeId);
                        },
                        disabled: isPatchingItem
                      }) : null}                            {checklistPopover?.type === "item-due" && checklistPopover.checklistId === checklist.id && checklistPopover.itemId === item.id ? renderChecklistDuePopover({
                        onSave: dueDate => {
                          void saveChecklistItemDueDate(item, dueDate);
                        },
                        onDelete: item.due_at ? () => {
                          void saveChecklistItemDueDate(item, null);
                        } : undefined,
                        disabled: isPatchingItem
                      }) : null}                          </div>                        </div>;
                  })}                  </div>                  <div className="mt-3 rounded-lg border border-[#d0d4db] bg-white p-3">                    <input className="w-full rounded-md border border-[#d0d4db] px-3 py-2 text-sm text-[#172b4d] focus:border-[#0c66e4] focus:outline-none" value={draft.content} onChange={event => updateChecklistDraft(checklist.id, {
                    content: event.target.value
                  })} placeholder="アイテムを追加" onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createChecklistItem(checklist.id);
                    }
                  }} />                    <div className="relative mt-2 flex flex-wrap items-center gap-2">                      <button type="button" onClick={() => void createChecklistItem(checklist.id)} disabled={isCreatingItem || !draft.content.trim()} className="rounded-md bg-[#0c66e4] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60">                        {isCreatingItem ? "追加中..." : "追加"}                      </button>                      <button type="button" onClick={() => {
                    clearChecklistDraft(checklist.id);
                    closeChecklistPopover();
                  }} className="rounded-md px-3 py-1.5 text-sm text-[#172b4d] hover:bg-[#dfe1e6]">                        キャンセル                      </button>                      <button type="button" onClick={() => openChecklistDraftAssigneePopover(checklist.id)} className={`rounded-full border px-2 py-1 text-xs font-medium transition-colors ${draft.assigneeId ? "border-[#cce0ff] bg-[#deebff] text-[#0c66e4]" : "border-[#d0d4db] bg-white text-[#44546f] hover:bg-[#f7f8f9]"}`}>                        {draft.assigneeId ? (() => {
                      const selected = members.find(member => member.user_id === draft.assigneeId);
                      const selectedName = selected ? getMemberDisplayName(selected) : draft.assigneeId;
                      return `👤 ${selectedName}`;
                    })() : "👤 割り当て"}                      </button>                      <button type="button" onClick={() => openChecklistDraftDuePopover(checklist.id)} className={`rounded-full border px-2 py-1 text-xs font-medium transition-colors ${draft.dueDate ? "border-[#d0d4db] bg-[#f1f2f4] text-[#172b4d]" : "border-[#d0d4db] bg-white text-[#44546f] hover:bg-[#f7f8f9]"}`}>                        {draft.dueDate ? `🕒 ${draft.dueDate.replace(/-/g, "/")}` : "🕒 期限"}                      </button>                      {checklistPopover?.type === "draft-assignee" && checklistPopover.checklistId === checklist.id ? renderChecklistAssigneePopover({
                    selectedAssigneeId: draft.assigneeId,
                    onSelect: assigneeId => {
                      updateChecklistDraft(checklist.id, { assigneeId });
                      closeChecklistPopover();
                    }
                  }) : null}                      {checklistPopover?.type === "draft-due" && checklistPopover.checklistId === checklist.id ? renderChecklistDuePopover({
                    onSave: dueDate => {
                      updateChecklistDraft(checklist.id, { dueDate: dueDate ?? "" });
                      closeChecklistPopover();
                    },
                    onDelete: draft.dueDate ? () => {
                      updateChecklistDraft(checklist.id, { dueDate: "" });
                      closeChecklistPopover();
                    } : undefined
                  }) : null}                    </div>                  </div>                </div>;
          })}            {/* Attachments */}            {cardAttachments.length > 0 && <div className="pl-8">                <div className="flex items-center gap-2 mb-3">                  <span className="text-[#44546f] shrink-0">📎</span>                  <h3 className="text-sm font-semibold text-[#172b4d]">添付ファイル</h3>                </div>                <div className="space-y-2">                  {cardAttachments.map(attachment => <button key={attachment.id} type="button" onClick={() => void openAttachment(attachment.id)} className="w-full flex items-center gap-3 rounded-lg border border-[#d0d4db] bg-white p-2.5 text-left hover:bg-[#f7f8f9] transition-colors">                      <div className="w-16 h-12 rounded-md bg-[#dfe1e6] flex items-center justify-center text-xs font-bold text-[#626f86] shrink-0">                        {attachment.mime_type.startsWith("image/") ? "IMG" : "FILE"}                      </div>                      <div>                        <p className="text-sm font-semibold text-[#172b4d]">                          {attachment.name}                        </p>                        <p className="text-xs text-[#626f86] mt-0.5">                          {new Date(attachment.created_at).toLocaleDateString("ja-JP")} ·{" "}                          {(attachment.size_bytes / 1024).toFixed(1)} KB                        </p>                      </div>                    </button>)}                </div>              </div>}          </div>          {/* ===== RIGHT SIDEBAR ===== */}          <div className="w-[220px] shrink-0 space-y-5">            {/* コメントとアクティビティ */}            <div>              <div className="flex items-center justify-between mb-3">                <h3 className="text-sm font-semibold text-[#172b4d]">                  コメントとアクティビティ                </h3>                <button type="button" onClick={() => setShowSidebarDetails(prev => !prev)} className="text-xs border border-[#d0d4db] rounded px-2 py-1 bg-white text-[#44546f] hover:bg-[#f7f8f9]">                  {showSidebarDetails ? "詳細を非表示" : "詳細を表示"}                </button>              </div>              {showSidebarDetails ? <>                  {/* Comment input */}                  <form onSubmit={createComment} className="mb-4">                    <textarea className="w-full border border-[#d0d4db] rounded-lg px-3 py-2.5 text-sm bg-white text-[#172b4d] resize-none focus:outline-none focus:border-[#0c66e4] transition-colors" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="コメントを入力してください" rows={commentText ? 3 : 2} />                    {commentText && <button type="submit" className="mt-1.5 bg-[#0c66e4] text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-[#0055cc]">                        保存                      </button>}                  </form>                  {/* Activity feed */}                  <div className="space-y-4 max-h-96 overflow-y-auto pr-1">                    {activityFeed.length === 0 && <p className="text-xs text-[#626f86]">アクティビティはまだありません</p>}                    {activityFeed.map(({
                  id,
                  type,
                  content,
                  created_at,
                  user_id
                }) => {
                  const member = members.find(m => m.user_id === user_id);
                  const name = member?.profile?.display_name ?? member?.profile?.email ?? "ユーザー";
                  const avatarColor = getMemberAvatarColor(member);
                  return <div key={`${type}-${id}`} className="flex gap-2.5">                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{
                    backgroundColor: avatarColor
                  }}>                            {name.charAt(0).toUpperCase()}                          </div>                          <div className="flex-1 min-w-0">                            <p className="text-sm text-[#172b4d] leading-snug break-words">                              <span className="font-bold">{name}</span>                              {type === "activity" ? "さんが " : " "}                              {content}                            </p>                            <p className="text-xs text-[#626f86] mt-0.5">                              {formatRelativeTime(created_at)}                            </p>                          </div>                        </div>;
                })}                  </div>                </> : <p className="text-xs text-[#626f86]">コメントとアクティビティを非表示にしています</p>}            </div>            {/* カードに追加 */}            <div className="hidden">              <h4 className="text-xs font-semibold text-[#44546f] uppercase tracking-wider mb-2">                カードに追加              </h4>              {ADD_MENU_OPTIONS.map(btn => <button key={String(btn.key)} type="button" onClick={() => togglePanel(btn.key)} className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left mb-1 transition-colors ${activePanel === btn.key ? "bg-[#dfe1e6] text-[#172b4d] font-medium" : "bg-[#e9ecf0] hover:bg-[#dfe1e6] text-[#172b4d]"}`}>                  <span className="shrink-0">{btn.icon}</span>                  {btn.label}                </button>)}            </div>            {/* アクション */}            <div className="hidden">              <h4 className="text-xs font-semibold text-[#44546f] uppercase tracking-wider mb-2">                アクション              </h4>              <button type="button" onClick={() => void toggleWatch()} className="w-full flex items-center gap-2 bg-[#e9ecf0] hover:bg-[#dfe1e6] text-[#172b4d] px-3 py-2 text-sm rounded-md mb-1 transition-colors">                <span>👁</span>                {isWatching ? "ウォッチを解除" : "ウォッチ"}              </button>              <button type="button" onClick={() => void toggleComplete()} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md mb-1 transition-colors ${card.is_completed ? "bg-[#4bce97]/20 hover:bg-[#4bce97]/30 text-[#1f845a]" : "bg-[#e9ecf0] hover:bg-[#dfe1e6] text-[#172b4d]"}`}>                <span>?</span>                {card.is_completed ? "未完了にする" : "完了にする"}              </button>              <button type="button" onClick={() => void toggleArchive()} className="w-full flex items-center gap-2 bg-[#e9ecf0] hover:bg-[#dfe1e6] text-[#172b4d] px-3 py-2 text-sm rounded-md mb-1 transition-colors">                <span>📦</span>                {card.archived ? "アーカイブを解除" : "アーカイブ"}              </button>              {/* List mover */}              <div className="mt-3">                <label className="text-xs font-semibold text-[#44546f] uppercase tracking-wider block mb-1.5">                  リストに移動                </label>                <select className="w-full border border-[#d0d4db] rounded-lg px-2 py-2 text-sm bg-white text-[#172b4d] focus:outline-none focus:border-[#0c66e4]" value={listId} onChange={e => {
                const nextListId = e.target.value;
                setListId(nextListId);
                void patchFields({
                  listId: nextListId
                }).then(onCardPatched);
              }}>                  {lists.map(list => <option key={list.id} value={list.id}>                      {list.name}                    </option>)}                </select>              </div>            </div>          </div>        </div>        {/* Error banner */}        {error && <div className="mx-5 mb-4 rounded-lg bg-[#ffeceb] border border-[#ffd2d2] text-[#c9372c] px-4 py-3 text-sm flex items-center justify-between">            <span>{error}</span>            <button type="button" onClick={() => setError(null)} className="ml-2 font-bold text-base leading-none">              ×            </button>          </div>}      </div>    </div>;
}
