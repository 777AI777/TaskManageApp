import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TableView } from "@/components/board/table-view";

describe("TableView", () => {
  it("calls select handler when title is clicked", async () => {
    const user = userEvent.setup();
    const onSelectCard = vi.fn();

    render(
      <TableView
        rows={[
          {
            id: "card-1",
            title: "Task 1",
            listName: "Todo",
            labels: [],
            dueAt: "2026-03-01T09:00:00.000Z",
            dueLabel: "3/1",
            deadlineState: "due-today",
            assigneePrimary: "Alice",
            assigneeExtraCount: 2,
            customFieldValues: {},
          },
        ]}
        customFieldColumns={[]}
        onSelectCard={onSelectCard}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Task 1" }));
    expect(onSelectCard).toHaveBeenCalledWith("card-1");
  });

  it("does not render a completion toggle button in table rows", () => {
    render(
      <TableView
        rows={[
          {
            id: "card-1",
            title: "Task 1",
            listName: "Todo",
            labels: [],
            dueAt: "2026-03-01T09:00:00.000Z",
            dueLabel: "3/1",
            deadlineState: "upcoming",
            assigneePrimary: "Alice",
            assigneeExtraCount: 0,
            customFieldValues: {},
          },
        ]}
        customFieldColumns={[]}
        onSelectCard={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
