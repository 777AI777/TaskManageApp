import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoardChatPanel } from "@/components/board/board-chat-panel";
import type { BoardChatMessage } from "@/components/board/board-types";

type Overrides = Partial<Parameters<typeof BoardChatPanel>[0]>;

function createMessage(overrides?: Partial<BoardChatMessage>): BoardChatMessage {
  return {
    id: "msg-1",
    board_id: "board-1",
    user_id: "user-1",
    content: "hello team",
    created_at: "2026-03-05T00:00:00.000Z",
    ...overrides,
  };
}

function renderBoardChatPanel(overrides?: Overrides) {
  const onToggleCollapsed = vi.fn();
  const onSend = vi.fn().mockResolvedValue(undefined);
  const onDeleteMessage = vi.fn().mockResolvedValue(undefined);
  const onLoadMore = vi.fn().mockResolvedValue(undefined);
  const onClearError = vi.fn();

  render(
    <BoardChatPanel
      members={[
        {
          user_id: "user-1",
          role: "member",
          profile: {
            id: "user-1",
            display_name: "Alice",
            email: "alice@example.com",
            avatar_url: null,
            avatar_color: null,
          },
        },
        {
          user_id: "user-2",
          role: "member",
          profile: {
            id: "user-2",
            display_name: "Bob",
            email: "bob@example.com",
            avatar_url: null,
            avatar_color: null,
          },
        },
      ]}
      messages={[]}
      currentUserId="user-1"
      collapsed={false}
      onToggleCollapsed={onToggleCollapsed}
      onSend={onSend}
      onDeleteMessage={onDeleteMessage}
      onLoadMore={onLoadMore}
      onClearError={onClearError}
      {...overrides}
    />,
  );

  return { onToggleCollapsed, onSend, onDeleteMessage, onLoadMore, onClearError };
}

describe("BoardChatPanel", () => {
  it("shows empty state when there are no messages", () => {
    renderBoardChatPanel();
    expect(screen.getByText(/.+/, { selector: ".tm-board-chat-empty" })).toBeInTheDocument();
  });

  it("submits message when Enter is pressed", async () => {
    const user = userEvent.setup();
    const { onSend } = renderBoardChatPanel();
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });

    await user.type(textarea, "hello team");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith("hello team");
    });
    expect(textarea).toHaveValue("");
  });

  it("does not submit when Shift+Enter is used", async () => {
    const user = userEvent.setup();
    const { onSend } = renderBoardChatPanel();
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });

    await user.type(textarea, "line1");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(textarea, "line2");

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("line1\nline2");
  });

  it("calls toggle handler when collapse button is clicked", async () => {
    const user = userEvent.setup();
    const { onToggleCollapsed } = renderBoardChatPanel();

    await user.click(screen.getByRole("button", { name: "Toggle chat panel" }));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("disables composer while sending", () => {
    renderBoardChatPanel({ sending: true });

    expect(screen.getByRole("textbox", { name: "Chat message input" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("aligns own message to the right and other messages to the left", () => {
    renderBoardChatPanel({
      messages: [
        createMessage({ id: "msg-own", user_id: "user-1", content: "mine" }),
        createMessage({ id: "msg-other", user_id: "user-2", content: "other" }),
      ],
    });

    expect(screen.getByTestId("chat-row-msg-own")).toHaveClass("tm-board-chat-message-row-own");
    expect(screen.getByTestId("chat-row-msg-other")).toHaveClass("tm-board-chat-message-row-other");
  });

  it("adds larger spacing when sender changes", () => {
    renderBoardChatPanel({
      messages: [
        createMessage({ id: "msg-1", user_id: "user-1" }),
        createMessage({ id: "msg-2", user_id: "user-2" }),
      ],
    });

    expect(screen.getByTestId("chat-row-msg-2")).toHaveClass("tm-board-chat-message-row-break");
  });

  it("opens delete menu when own bubble is clicked", async () => {
    const user = userEvent.setup();
    renderBoardChatPanel({
      messages: [createMessage({ id: "msg-own", user_id: "user-1" })],
    });

    await user.click(screen.getByRole("button", { name: "Open message menu" }));

    expect(screen.getByRole("menuitem", { name: "Delete message" })).toBeInTheDocument();
  });

  it("calls delete handler from menu action", async () => {
    const user = userEvent.setup();
    const { onDeleteMessage } = renderBoardChatPanel({
      messages: [createMessage({ id: "msg-own", user_id: "user-1" })],
    });

    await user.click(screen.getByRole("button", { name: "Open message menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete message" }));

    await waitFor(() => {
      expect(onDeleteMessage).toHaveBeenCalledWith("msg-own");
    });
  });

  it("closes menu when clicking outside", async () => {
    const user = userEvent.setup();
    renderBoardChatPanel({
      messages: [createMessage({ id: "msg-own", user_id: "user-1" })],
    });

    await user.click(screen.getByRole("button", { name: "Open message menu" }));
    expect(screen.getByRole("menuitem", { name: "Delete message" })).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole("menuitem", { name: "Delete message" })).not.toBeInTheDocument();
  });

  it("disables delete menu item while deleting", async () => {
    const user = userEvent.setup();
    renderBoardChatPanel({
      messages: [createMessage({ id: "msg-own", user_id: "user-1" })],
      deletingMessageIds: ["msg-own"],
    });

    await user.click(screen.getByRole("button", { name: "Open message menu" }));
    expect(screen.getByRole("menuitem", { name: "Delete message" })).toBeDisabled();
  });

  it("does not open delete menu for other users messages", async () => {
    const user = userEvent.setup();
    renderBoardChatPanel({
      messages: [createMessage({ id: "msg-other", user_id: "user-2", content: "other" })],
    });

    await user.click(screen.getByText("other"));

    expect(screen.queryByRole("menuitem", { name: "Delete message" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open message menu" })).not.toBeInTheDocument();
  });
});
