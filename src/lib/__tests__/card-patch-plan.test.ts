import { describe, expect, it } from "vitest";

import { buildCardPatchExecutionPlan } from "@/lib/card-patch-plan";

describe("buildCardPatchExecutionPlan", () => {
  it("does not require relation lookups for lightweight field updates", () => {
    const plan = buildCardPatchExecutionPlan(
      {
        title: "Rename card",
      },
      "user-1",
    );

    expect(plan).toEqual({
      shouldUpdateAssignees: false,
      shouldUpdateLabels: false,
      shouldRunLabelAutomation: false,
      shouldLookupAssigneesForAutomation: false,
      shouldNotifyAssignees: false,
      shouldResolveWorkspace: false,
    });
  });

  it("requests assignee lookup only when labels change without explicit assignee patch", () => {
    const plan = buildCardPatchExecutionPlan(
      {
        labelIds: ["label-1"],
      },
      "user-1",
    );

    expect(plan.shouldUpdateAssignees).toBe(false);
    expect(plan.shouldRunLabelAutomation).toBe(true);
    expect(plan.shouldLookupAssigneesForAutomation).toBe(true);
    expect(plan.shouldResolveWorkspace).toBe(true);
  });

  it("requests notifications and workspace lookup when assigning another member", () => {
    const plan = buildCardPatchExecutionPlan(
      {
        assigneeIds: ["user-2"],
      },
      "user-1",
    );

    expect(plan.shouldUpdateAssignees).toBe(true);
    expect(plan.shouldNotifyAssignees).toBe(true);
    expect(plan.shouldResolveWorkspace).toBe(true);
  });
});
