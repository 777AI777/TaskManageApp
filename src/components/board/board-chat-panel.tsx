"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronDown, ChevronUp, Loader2, Send } from "lucide-react";
import { KeyboardEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";

import type { BoardChatMessage, BoardMember } from "@/components/board/board-types";
import { resolveAvatarColor } from "@/lib/avatar-color";

type Props = {
  title?: string;
  className?: string;
  members: BoardMember[];
  messages: BoardChatMessage[];
  currentUserId: string;
  collapsed: boolean;
  sending?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  deletingMessageIds?: string[];
  error?: string | null;
  onToggleCollapsed: () => void;
  onSend: (content: string) => Promise<void> | void;
  onDeleteMessage?: (messageId: string) => Promise<void> | void;
  onLoadMore?: () => Promise<void> | void;
  onClearError?: () => void;
};

function getMemberDisplayName(member: BoardMember | null | undefined): string {
  if (!member) return "Unknown User";
  return member.profile?.display_name ?? member.profile?.email ?? member.user_id;
}

export function BoardChatPanel({
  title = "ボード内チャット",
  className = "",
  members,
  messages,
  currentUserId,
  collapsed,
  sending = false,
  loadingMore = false,
  hasMore = false,
  deletingMessageIds = [],
  error = null,
  onToggleCollapsed,
  onSend,
  onDeleteMessage,
  onLoadMore,
  onClearError,
}: Props) {
  const [draft, setDraft] = useState("");
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.user_id, member])),
    [members],
  );
  const deletingIdSet = useMemo(() => new Set(deletingMessageIds), [deletingMessageIds]);

  useEffect(() => {
    const lastMessageId = messages[messages.length - 1]?.id ?? null;
    const previousLastMessageId = previousLastMessageIdRef.current;
    const shouldScrollToBottom =
      !previousLastMessageId || (lastMessageId && lastMessageId !== previousLastMessageId);
    if (shouldScrollToBottom && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
    previousLastMessageIdRef.current = lastMessageId;
  }, [messages]);

  useEffect(() => {
    if (!openMenuMessageId) return;
    if (!messages.some((message) => message.id === openMenuMessageId)) {
      setOpenMenuMessageId(null);
      setMenuPosition(null);
    }
  }, [messages, openMenuMessageId]);

  useEffect(() => {
    if (!openMenuMessageId) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRootRef.current && !menuRootRef.current.contains(event.target as Node)) {
        setOpenMenuMessageId(null);
        setMenuPosition(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuMessageId(null);
        setMenuPosition(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuMessageId]);

  async function submitMessage() {
    const content = draft.trim();
    if (!content || sending) return;
    try {
      await onSend(content);
      setDraft("");
    } catch {
      // Keep draft text when send fails.
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submitMessage();
  }

  async function handleDeleteMenuAction(messageId: string) {
    if (!onDeleteMessage || deletingIdSet.has(messageId)) return;
    try {
      await onDeleteMessage(messageId);
      setOpenMenuMessageId(null);
      setMenuPosition(null);
    } catch {
      // Error text is rendered by parent in the inline chat error box.
    }
  }

  function toggleMessageMenu(event: ReactMouseEvent, messageId: string) {
    event.preventDefault();
    const nextOpen = openMenuMessageId !== messageId;
    if (!nextOpen) {
      setOpenMenuMessageId(null);
      setMenuPosition(null);
      return;
    }

    const triggerRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (triggerRect.width > 0 && triggerRect.height > 0) {
      const estimatedMenuWidth = 56;
      const estimatedMenuHeight = 28;
      const shouldOpenUp = triggerRect.bottom + estimatedMenuHeight + 8 > window.innerHeight;
      const top = shouldOpenUp
        ? Math.max(8, triggerRect.top - estimatedMenuHeight - 6)
        : Math.min(window.innerHeight - estimatedMenuHeight - 8, triggerRect.bottom + 6);
      const left = Math.min(
        window.innerWidth - estimatedMenuWidth - 8,
        Math.max(8, triggerRect.right - estimatedMenuWidth),
      );
      setMenuPosition({ top, left });
    } else {
      setMenuPosition(null);
    }

    setOpenMenuMessageId(messageId);
  }

  const isSubmitDisabled = sending || !draft.trim().length;

  return (
    <section className={`tm-board-chat-dock ${collapsed ? "tm-board-chat-dock-collapsed" : ""} ${className}`.trim()}>
      <header className="tm-board-chat-header">
        <h3 className="tm-board-chat-title">{title}</h3>
        <button
          className="tm-board-chat-collapse"
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Toggle chat panel"
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </header>

      {!collapsed ? (
        <div className="tm-board-chat-body">
          {error ? (
            <div className="tm-board-chat-error" role="alert">
              <span>{error}</span>
              {onClearError ? (
                <button
                  type="button"
                  className="tm-board-chat-error-dismiss"
                  onClick={onClearError}
                  aria-label="Dismiss chat error"
                >
                  ×
                </button>
              ) : null}
            </div>
          ) : null}

          {hasMore && onLoadMore ? (
            <button
              type="button"
              className="tm-board-chat-load-more"
              onClick={() => void onLoadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "読み込み中..." : "過去のメッセージを表示"}
            </button>
          ) : null}

          <div
            className="tm-board-chat-feed"
            ref={feedRef}
            onScroll={() => {
              if (!openMenuMessageId) return;
              setOpenMenuMessageId(null);
              setMenuPosition(null);
            }}
          >
            {!messages.length ? (
              <p className="tm-board-chat-empty">メッセージはありません。</p>
            ) : (
              messages.map((message, index) => {
                const member = memberById.get(message.user_id);
                const displayName = getMemberDisplayName(member);
                const avatarColor = resolveAvatarColor(member?.profile?.avatar_color);
                const isOwnMessage = message.user_id === currentUserId;
                const isDeleting = deletingIdSet.has(message.id);
                const isMenuOpen = openMenuMessageId === message.id;
                const previousMessage = index > 0 ? messages[index - 1] : null;
                const hasSenderBreak = Boolean(previousMessage && previousMessage.user_id !== message.user_id);

                return (
                  <article
                    key={message.id}
                    className={`tm-board-chat-message-row ${
                      isOwnMessage ? "tm-board-chat-message-row-own" : "tm-board-chat-message-row-other"
                    } ${hasSenderBreak ? "tm-board-chat-message-row-break" : ""}`.trim()}
                    data-testid={`chat-row-${message.id}`}
                  >
                    {!isOwnMessage ? (
                      <div className="tm-board-chat-avatar" style={{ backgroundColor: avatarColor }}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    ) : null}

                    <div
                      className={`tm-board-chat-message-col ${
                        isOwnMessage ? "tm-board-chat-message-col-own" : "tm-board-chat-message-col-other"
                      }`}
                    >
                      {!isOwnMessage ? (
                        <p className="tm-board-chat-author" title={displayName}>
                          {displayName}
                        </p>
                      ) : null}

                      <div
                        className={`tm-board-chat-bubble-wrap ${
                          isOwnMessage ? "tm-board-chat-bubble-wrap-own" : "tm-board-chat-bubble-wrap-other"
                        }`}
                      >
                        <div
                          className="tm-board-chat-bubble-anchor"
                          ref={isMenuOpen ? menuRootRef : undefined}
                        >
                          {isOwnMessage && onDeleteMessage ? (
                            <button
                              type="button"
                              className="tm-board-chat-bubble-button"
                              onClick={(event) => toggleMessageMenu(event, message.id)}
                              aria-label="Open message menu"
                            >
                              <span className="tm-board-chat-bubble tm-board-chat-bubble-own">
                                {message.content}
                              </span>
                            </button>
                          ) : (
                            <p className="tm-board-chat-bubble tm-board-chat-bubble-other">{message.content}</p>
                          )}

                          {isOwnMessage && onDeleteMessage && isMenuOpen ? (
                            <div
                              className="tm-board-chat-menu tm-board-chat-menu-floating"
                              role="menu"
                              aria-label="Message menu"
                              style={menuPosition ?? undefined}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="tm-board-chat-menu-item"
                                onClick={() => void handleDeleteMenuAction(message.id)}
                                disabled={isDeleting}
                                aria-label="Delete message"
                              >
                                {isDeleting ? "削除中..." : "削除"}
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <span
                          className={`tm-board-chat-time ${
                            isOwnMessage ? "tm-board-chat-time-own" : "tm-board-chat-time-other"
                          }`}
                        >
                          {formatDistanceToNowStrict(new Date(message.created_at), {
                            locale: ja,
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="tm-board-chat-composer">
            <textarea
              className="tm-board-chat-textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={3}
              placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"
              aria-label="Chat message input"
              disabled={sending}
            />
            <button
              type="button"
              className="tm-board-chat-send"
              onClick={() => void submitMessage()}
              disabled={isSubmitDisabled}
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{sending ? "送信中..." : "送信"}</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
