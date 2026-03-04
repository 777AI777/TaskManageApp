import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarView } from "@/components/board/calendar-view";

describe("CalendarView", () => {
  it("renders date labels as number plus day suffix", () => {
    const { container } = render(<CalendarView cards={[]} cardMetaById={new Map()} onSelectCard={vi.fn()} />);

    const dayLabels = Array.from(container.querySelectorAll(".tm-calendar-date-label"));
    expect(dayLabels.length).toBeGreaterThan(0);

    for (const label of dayLabels) {
      const text = label.textContent ?? "";
      expect(text).toMatch(/^\d+\u65e5$/);
      expect(text).not.toContain("\\u65e5");
    }
  });

  it("renders weekday headers in Japanese order", () => {
    const { container } = render(<CalendarView cards={[]} cardMetaById={new Map()} onSelectCard={vi.fn()} />);

    const weekdayLabels = Array.from(container.querySelectorAll(".tm-calendar-weekday")).map((label) =>
      (label.textContent ?? "").trim(),
    );

    expect(weekdayLabels).toEqual(["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"]);
  });
});
