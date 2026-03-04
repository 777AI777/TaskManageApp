import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TableView } from "@/components/board/table-view";
import type { TableSortState } from "@/lib/table-sort";

function setViewportHeight(height: number) {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
}

function createRect(top: number, bottom: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom,
    left: 0,
    right: 180,
    width: 180,
    height: Math.max(0, bottom - top),
    toJSON: () => ({}),
  } as DOMRect;
}

function mockTriggerRect(top: number, bottom: number) {
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function mockRect() {
    if (this instanceof HTMLElement && this.classList.contains("tm-table-multiselect-trigger")) {
      return createRect(top, bottom);
    }
    return createRect(0, 0);
  });
}

function renderTableView(overrides?: Partial<Parameters<typeof TableView>[0]>) {
  const onSort = vi.fn();
  const onSelectCard = vi.fn();
  const onListChange = vi.fn();
  const onLabelsChange = vi.fn();
  const onAssigneesChange = vi.fn();
  const onDueDateChange = vi.fn();
  const onStatusChange = vi.fn();

  render(
    <TableView
      rows={[
        {
          id: "card-1",
          taskId: "AWS-0001",
          title: "Task 1",
          listId: "list-1",
          listName: "Todo",
          labelIds: [],
          labels: [],
          dueAt: "2026-03-01T09:00:00.000Z",
          dueDateValue: "2026-03-01",
          dueLabel: "3/1",
          deadlineState: "due-today",
          isCompleted: false,
          assigneeIds: [],
          assigneePrimary: null,
          assigneeExtraCount: 0,
          customFieldValues: {},
        },
      ]}
      customFieldColumns={[]}
      lists={[
        { id: "list-1", name: "Todo" },
        { id: "list-2", name: "Doing" },
      ]}
      labels={[
        { id: "label-1", name: "Bug" },
        { id: "label-2", name: "Feature" },
      ]}
      members={[
        { id: "member-1", name: "Alice" },
        { id: "member-2", name: "Bob" },
      ]}
      savingByCardId={{}}
      sortState={null}
      onSort={onSort}
      onSelectCard={onSelectCard}
      onListChange={onListChange}
      onLabelsChange={onLabelsChange}
      onAssigneesChange={onAssigneesChange}
      onDueDateChange={onDueDateChange}
      onStatusChange={onStatusChange}
      {...overrides}
    />,
  );

  return {
    onSort,
    onSelectCard,
    onListChange,
    onLabelsChange,
    onAssigneesChange,
    onDueDateChange,
    onStatusChange,
  };
}

describe("TableView", () => {
  it("renders task id in the leftmost column", () => {
    renderTableView();
    expect(screen.getByRole("button", { name: "AWS-0001" })).toBeInTheDocument();
  });

  it("calls select handler when ID is clicked", async () => {
    const user = userEvent.setup();
    const { onSelectCard } = renderTableView();

    await user.click(screen.getByRole("button", { name: "AWS-0001" }));
    expect(onSelectCard).toHaveBeenCalledWith("card-1");
  });

  it("renders title as plain text instead of a link button", () => {
    renderTableView();
    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Task 1" })).not.toBeInTheDocument();
  });

  it("calls list change handler when list selection changes", async () => {
    const user = userEvent.setup();
    const { onListChange } = renderTableView();

    await user.selectOptions(screen.getByLabelText("リスト"), "list-2");
    expect(onListChange).toHaveBeenCalledWith("card-1", "list-2");
  });

  it("calls status change handler when status selection changes", async () => {
    const user = userEvent.setup();
    const { onStatusChange } = renderTableView();

    await user.selectOptions(screen.getByLabelText("状態"), "completed");
    expect(onStatusChange).toHaveBeenCalledWith("card-1", true);
  });

  it("calls due date change handler on date pick and clear", async () => {
    const user = userEvent.setup();
    const { onDueDateChange } = renderTableView();

    fireEvent.change(screen.getByLabelText("期限日"), { target: { value: "2026-03-05" } });
    expect(onDueDateChange).toHaveBeenCalledWith("card-1", "2026-03-05");

    await user.click(screen.getByRole("button", { name: "クリア" }));
    expect(onDueDateChange).toHaveBeenCalledWith("card-1", null);
  });

  it("calls label change handler when multiselect checkbox changes", async () => {
    const user = userEvent.setup();
    const { onLabelsChange } = renderTableView();

    await user.click(screen.getByRole("button", { name: "ラベルを編集" }));
    await user.click(screen.getByRole("checkbox", { name: "Bug" }));

    expect(onLabelsChange).toHaveBeenCalledWith("card-1", ["label-1"]);
  });

  it("calls assignee change handler when multiselect checkbox changes", async () => {
    const user = userEvent.setup();
    const { onAssigneesChange } = renderTableView();

    await user.click(screen.getByRole("button", { name: "担当者を編集" }));
    await user.click(screen.getByRole("checkbox", { name: "Alice" }));

    expect(onAssigneesChange).toHaveBeenCalledWith("card-1", ["member-1"]);
  });

  it("opens multiselect upward when there is not enough space below", async () => {
    const user = userEvent.setup();
    const initialHeight = window.innerHeight;
    const rectSpy = mockTriggerRect(760, 792);
    setViewportHeight(800);

    try {
      renderTableView();
      const trigger = document.querySelector<HTMLButtonElement>(".tm-table-multiselect-trigger");
      if (!trigger) {
        throw new Error("Multiselect trigger not found");
      }

      await user.click(trigger);
      await waitFor(() => {
        const menu = document.querySelector(".tm-table-multiselect-menu");
        expect(menu).toBeInTheDocument();
        expect(menu).toHaveClass("tm-table-multiselect-menu-up");
      });
    } finally {
      rectSpy.mockRestore();
      setViewportHeight(initialHeight);
    }
  });

  it("keeps multiselect opening downward when space below is sufficient", async () => {
    const user = userEvent.setup();
    const initialHeight = window.innerHeight;
    const rectSpy = mockTriggerRect(120, 152);
    setViewportHeight(800);

    try {
      renderTableView();
      const trigger = document.querySelector<HTMLButtonElement>(".tm-table-multiselect-trigger");
      if (!trigger) {
        throw new Error("Multiselect trigger not found");
      }

      await user.click(trigger);
      await waitFor(() => {
        const menu = document.querySelector(".tm-table-multiselect-menu");
        expect(menu).toBeInTheDocument();
        expect(menu).not.toHaveClass("tm-table-multiselect-menu-up");
      });
    } finally {
      rectSpy.mockRestore();
      setViewportHeight(initialHeight);
    }
  });

  it("shrinks multiselect menu max height when available space is limited", async () => {
    const user = userEvent.setup();
    const initialHeight = window.innerHeight;
    const rectSpy = mockTriggerRect(80, 112);
    setViewportHeight(200);

    try {
      renderTableView();
      const trigger = document.querySelector<HTMLButtonElement>(".tm-table-multiselect-trigger");
      if (!trigger) {
        throw new Error("Multiselect trigger not found");
      }

      await user.click(trigger);
      await waitFor(() => {
        const menu = document.querySelector(".tm-table-multiselect-menu");
        expect(menu).toBeInTheDocument();
        expect(menu).not.toHaveClass("tm-table-multiselect-menu-up");
        expect(menu).toHaveStyle({ maxHeight: "76px" });
      });
    } finally {
      rectSpy.mockRestore();
      setViewportHeight(initialHeight);
    }
  });

  it("disables row controls while saving", () => {
    renderTableView({ savingByCardId: { "card-1": true } });

    expect(screen.getByLabelText("リスト")).toBeDisabled();
    expect(screen.getByLabelText("期限日")).toBeDisabled();
    expect(screen.getByRole("button", { name: "クリア" })).toBeDisabled();
    expect(screen.getByLabelText("状態")).toBeDisabled();
    expect(screen.getByRole("button", { name: "ラベルを編集" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "担当者を編集" })).toBeDisabled();
  });

  it("calls sort handler with standard key when header is clicked", async () => {
    const user = userEvent.setup();
    const { onSort } = renderTableView();

    await user.click(screen.getByRole("button", { name: "カードで並び替え" }));
    expect(onSort).toHaveBeenCalledWith("title");
  });

  it("calls sort handler with taskId key when ID header is clicked", async () => {
    const user = userEvent.setup();
    const { onSort } = renderTableView();

    await user.click(screen.getByRole("button", { name: "IDで並び替え" }));
    expect(onSort).toHaveBeenCalledWith("taskId");
  });

  it("calls sort handler with custom key when custom header is clicked", async () => {
    const user = userEvent.setup();
    const { onSort } = renderTableView({
      customFieldColumns: [{ id: "cf-priority", name: "優先度" }],
      rows: [
        {
          id: "card-1",
          taskId: "AWS-0001",
          title: "Task 1",
          listId: "list-1",
          listName: "Todo",
          labelIds: [],
          labels: [],
          dueAt: "2026-03-01T09:00:00.000Z",
          dueDateValue: "2026-03-01",
          dueLabel: "3/1",
          deadlineState: "due-today",
          isCompleted: false,
          assigneeIds: [],
          assigneePrimary: null,
          assigneeExtraCount: 0,
          customFieldValues: { "cf-priority": "High" },
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "優先度で並び替え" }));
    expect(onSort).toHaveBeenCalledWith("custom:cf-priority");
  });

  it("reflects aria-sort based on active sort state", () => {
    const sortState: TableSortState = { key: "list", direction: "desc" };
    renderTableView({ sortState });

    const listColumnHeader = screen.getByRole("columnheader", { name: "リスト" });
    expect(listColumnHeader).toHaveAttribute("aria-sort", "descending");

    const cardColumnHeader = screen.getByRole("columnheader", { name: "カード" });
    expect(cardColumnHeader).toHaveAttribute("aria-sort", "none");

    expect(within(listColumnHeader).getByText("▼")).toBeInTheDocument();
  });
});
