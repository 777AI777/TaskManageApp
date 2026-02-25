"use client";

import { FormEvent, useMemo, useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

import type {
  Attachment,
  BoardCard,
  BoardMember,
  CardAssignee,
  CardComment,
  CardLabel,
  Checklist,
  ChecklistItem,
  Label,
} from "@/components/board/board-types";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  workspaceId: string;
  boardId: string;
  card: BoardCard;
  members: BoardMember[];
  labels: Label[];
  cardAssignees: CardAssignee[];
  cardLabels: CardLabel[];
  comments: CardComment[];
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
  attachments: Attachment[];
  onClose: () => void;
  onCardPatched: (card: BoardCard) => void;
  onCommentCreated: (comment: CardComment) => void;
  onChecklistCreated: (checklist: Checklist) => void;
  onChecklistItemCreated: (item: ChecklistItem) => void;
  onChecklistItemPatched: (item: ChecklistItem) => void;
  onAttachmentCreated: (attachment: Attachment) => void;
  onCardRelationshipPatched?: (assigneeIds: string[], labelIds: string[]) => void;
};

export function CardDetailDrawer({
  workspaceId,
  boardId,
  card,
  members,
  labels,
  cardAssignees,
  cardLabels,
  comments,
  checklists,
  checklistItems,
  attachments,
  onClose,
  onCardPatched,
  onCommentCreated,
  onChecklistCreated,
  onChecklistItemCreated,
  onChecklistItemPatched,
  onAttachmentCreated,
  onCardRelationshipPatched,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [dueAt, setDueAt] = useState(
    card.due_at ? format(new Date(card.due_at), "yyyy-MM-dd'T'HH:mm", { locale: ja }) : "",
  );
  const [priority, setPriority] = useState(card.priority);
  const [estimatePoints, setEstimatePoints] = useState(card.estimate_points?.toString() ?? "");
  const [assigneeIds, setAssigneeIds] = useState(
    cardAssignees.filter((item) => item.card_id === card.id).map((item) => item.user_id),
  );
  const [labelIds, setLabelIds] = useState(
    cardLabels.filter((item) => item.card_id === card.id).map((item) => item.label_id),
  );
  const [commentText, setCommentText] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [checklistItemDraft, setChecklistItemDraft] = useState<Record<string, string>>({});
  const [savingCard, setSavingCard] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardComments = comments.filter((comment) => comment.card_id === card.id);
  const cardChecklists = checklists
    .filter((checklist) => checklist.card_id === card.id)
    .sort((a, b) => a.position - b.position);
  const cardAttachments = attachments.filter((attachment) => attachment.card_id === card.id);

  async function patchCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCard(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          priority,
          estimatePoints: estimatePoints ? Number(estimatePoints) : null,
          assigneeIds,
          labelIds,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "カード更新に失敗しました。");
      }
      onCardPatched(body.data);
      onCardRelationshipPatched?.(assigneeIds, labelIds);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "カード更新に失敗しました。");
    } finally {
      setSavingCard(false);
    }
  }

  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentText.trim()) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/cards/${card.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "コメント追加に失敗しました。");
      }
      onCommentCreated(body.data);
      setCommentText("");
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "コメント追加に失敗しました。");
    }
  }

  async function createChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newChecklistTitle.trim()) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/cards/${card.id}/checklists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newChecklistTitle }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "チェックリスト作成に失敗しました。");
      }
      onChecklistCreated(body.data);
      setNewChecklistTitle("");
    } catch (checklistError) {
      setError(checklistError instanceof Error ? checklistError.message : "チェックリスト作成に失敗しました。");
    }
  }

  async function createChecklistItem(checklistId: string) {
    const content = checklistItemDraft[checklistId]?.trim();
    if (!content) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/checklists/${checklistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "チェックリスト項目作成に失敗しました。");
      }
      onChecklistItemCreated(body.data);
      setChecklistItemDraft((current) => ({ ...current, [checklistId]: "" }));
    } catch (itemError) {
      setError(itemError instanceof Error ? itemError.message : "チェックリスト項目作成に失敗しました。");
    }
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    setError(null);
    try {
      const response = await fetch(`/api/checklist-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !item.is_completed }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "チェック状態更新に失敗しました。");
      }
      onChecklistItemPatched(body.data);
    } catch (itemError) {
      setError(itemError instanceof Error ? itemError.message : "チェック状態更新に失敗しました。");
    }
  }

  async function uploadAttachment(file: File) {
    setUploading(true);
    setError(null);
    try {
      const safeName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const storagePath = `workspace/${workspaceId}/board/${boardId}/card/${card.id}/${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(storagePath, file, { upsert: false });
      if (uploadError) {
        throw uploadError;
      }

      const response = await fetch(`/api/cards/${card.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          storagePath,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          previewUrl: null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "添付登録に失敗しました。");
      }
      onAttachmentCreated(body.data);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "添付登録に失敗しました。");
    } finally {
      setUploading(false);
    }
  }

  async function openAttachment(attachmentId: string) {
    const response = await fetch(`/api/attachments/sign?attachmentId=${attachmentId}`);
    const body = await response.json();
    if (!response.ok || !body.data?.signedUrl) {
      setError(body?.error?.message ?? "添付URLの取得に失敗しました。");
      return;
    }
    window.open(body.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function toggleSelection(current: string[], id: string) {
    return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">カード詳細</h2>
            <p className="text-sm muted">{card.id}</p>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            閉じる
          </button>
        </div>

        <form onSubmit={patchCard} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">タイトル</label>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">説明</label>
            <textarea
              className="input min-h-24"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">優先度</label>
              <select
                className="input h-11"
                value={priority}
                onChange={(event) => setPriority(event.target.value as typeof priority)}
              >
                {PRIORITY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">見積</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.5"
                value={estimatePoints}
                onChange={(event) => setEstimatePoints(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">期限</label>
              <input
                className="input"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">担当者</label>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button
                  key={member.user_id}
                  type="button"
                  className={`chip ${assigneeIds.includes(member.user_id) ? "bg-blue-100 text-blue-900" : ""}`}
                  onClick={() => setAssigneeIds((current) => toggleSelection(current, member.user_id))}
                >
                  {member.profile?.display_name ?? member.profile?.email ?? member.user_id}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">ラベル</label>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  className={`chip ${labelIds.includes(label.id) ? "ring-2 ring-offset-1" : ""}`}
                  style={{ backgroundColor: label.color + "33", color: "#1f2937", borderColor: label.color }}
                  onClick={() => setLabelIds((current) => toggleSelection(current, label.id))}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={savingCard}>
            {savingCard ? "保存中..." : "カードを保存"}
          </button>
        </form>

        <section className="mt-6 space-y-3">
          <h3 className="font-semibold">コメント</h3>
          <form className="flex gap-2" onSubmit={createComment}>
            <input
              className="input"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="コメントを入力"
            />
            <button className="btn btn-secondary" type="submit">
              追加
            </button>
          </form>
          <div className="space-y-2">
            {cardComments.map((comment) => (
              <article key={comment.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <p>{comment.content}</p>
                <p className="mt-1 text-xs muted">{new Date(comment.created_at).toLocaleString("ja-JP")}</p>
              </article>
            ))}
            {!cardComments.length ? <p className="text-sm muted">コメントはありません。</p> : null}
          </div>
        </section>

        <section className="mt-6 space-y-3">
          <h3 className="font-semibold">チェックリスト</h3>
          <form className="flex gap-2" onSubmit={createChecklist}>
            <input
              className="input"
              value={newChecklistTitle}
              onChange={(event) => setNewChecklistTitle(event.target.value)}
              placeholder="チェックリスト名"
            />
            <button className="btn btn-secondary" type="submit">
              追加
            </button>
          </form>
          <div className="space-y-2">
            {cardChecklists.map((checklist) => {
              const items = checklistItems
                .filter((item) => item.checklist_id === checklist.id)
                .sort((a, b) => a.position - b.position);
              return (
                <article key={checklist.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium">{checklist.title}</p>
                  <div className="mt-2 space-y-2">
                    {items.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.is_completed}
                          onChange={() => toggleChecklistItem(item)}
                        />
                        <span className={item.is_completed ? "line-through muted" : ""}>{item.content}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="input"
                      value={checklistItemDraft[checklist.id] ?? ""}
                      onChange={(event) =>
                        setChecklistItemDraft((current) => ({
                          ...current,
                          [checklist.id]: event.target.value,
                        }))
                      }
                      placeholder="項目を追加"
                    />
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => createChecklistItem(checklist.id)}
                    >
                      追加
                    </button>
                  </div>
                </article>
              );
            })}
            {!cardChecklists.length ? <p className="text-sm muted">チェックリストはありません。</p> : null}
          </div>
        </section>

        <section className="mt-6 space-y-3">
          <h3 className="font-semibold">添付</h3>
          <label className="btn btn-secondary inline-flex cursor-pointer">
            {uploading ? "アップロード中..." : "ファイルを添付"}
            <input
              className="hidden"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadAttachment(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>
          <div className="space-y-2">
            {cardAttachments.map((attachment) => (
              <button
                key={attachment.id}
                className="block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100"
                onClick={() => openAttachment(attachment.id)}
              >
                <p className="font-medium">{attachment.name}</p>
                <p className="text-xs muted">
                  {(attachment.size_bytes / 1024).toFixed(1)} KB / {attachment.mime_type}
                </p>
              </button>
            ))}
            {!cardAttachments.length ? <p className="text-sm muted">添付はありません。</p> : null}
          </div>
        </section>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
