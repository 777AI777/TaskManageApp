import { describe, expect, it } from "vitest";

import {
  buildCardPatchExecutionPlan,
  buildCardUpdatedActivityMetadata,
} from "@/lib/card-patch-plan";

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

describe("buildCardUpdatedActivityMetadata", () => {
  it("keeps only changed relation arrays in metadata", () => {
    const payload = {
      title: "New title",
      assigneeIds: ["user-1"],
      labelIds: ["label-1"],
    };
    const metadata = buildCardUpdatedActivityMetadata(payload, {
      shouldUpdateAssignees: true,
      shouldUpdateLabels: false,
    });

    expect(metadata).toEqual({
      title: "New title",
      assigneeIds: ["user-1"],
    });
  });
});
