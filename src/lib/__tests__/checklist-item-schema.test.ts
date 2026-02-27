import { describe, expect, it } from "vitest";

import { checklistItemCreateSchema } from "@/lib/validation/schemas";

describe("checklistItemCreateSchema", () => {
  it("accepts assigneeId and dueAt", () => {
    const result = checklistItemCreateSchema.safeParse({
      checklistId: "11111111-1111-4111-8111-111111111111",
      content: "確認する",
      assigneeId: "22222222-2222-4222-8222-222222222222",
      dueAt: "2026-03-11T14:59:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid dueAt", () => {
    const result = checklistItemCreateSchema.safeParse({
      checklistId: "11111111-1111-4111-8111-111111111111",
      content: "確認する",
      dueAt: "2026/03/11",
    });

    expect(result.success).toBe(false);
  });
});

