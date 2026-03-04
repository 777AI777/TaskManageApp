import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TableView } from "@/components/board/table-view";

function renderTableView(overrides?: Partial<Parameters<typeof TableView>[0]>) {
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
    onSelectCard,
    onListChange,
    onLabelsChange,
    onAssigneesChange,
    onDueDateChange,
    onStatusChange,
  };
}

describe("TableView", () => {
  it("calls select handler when title is clicked", async () => {
    const user = userEvent.setup();
    const { onSelectCard } = renderTableView();

    await user.click(screen.getByRole("button", { name: "Task 1" }));
    expect(onSelectCard).toHaveBeenCalledWith("card-1");
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

    fireEvent.change(screen.getByLabelText("期限"), { target: { value: "2026-03-05" } });
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

    await user.click(screen.getByRole("button", { name: "担当を編集" }));
    await user.click(screen.getByRole("checkbox", { name: "Alice" }));

    expect(onAssigneesChange).toHaveBeenCalledWith("card-1", ["member-1"]);
  });

  it("disables row controls while saving", () => {
    renderTableView({ savingByCardId: { "card-1": true } });

    expect(screen.getByLabelText("リスト")).toBeDisabled();
    expect(screen.getByLabelText("期限")).toBeDisabled();
    expect(screen.getByRole("button", { name: "クリア" })).toBeDisabled();
    expect(screen.getByLabelText("状態")).toBeDisabled();
    expect(screen.getByRole("button", { name: "ラベルを編集" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "担当を編集" })).toBeDisabled();
  });
});
