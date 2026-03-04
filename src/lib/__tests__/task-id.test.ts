import { describe, expect, it } from "vitest";

import { formatTaskDisplayId, isValidBoardCode, normalizeBoardCodeInput } from "@/lib/task-id";

describe("task-id helpers", () => {
  it("normalizes board code input to uppercase with allowed symbols and max length", () => {
    expect(normalizeBoardCodeInput(" aws-01_xyz! ")).toBe("AWS-01_XYZ");
    expect(normalizeBoardCodeInput("abc1234567890")).toBe("ABC1234567");
  });

  it("validates board code format", () => {
    expect(isValidBoardCode("AWS")).toBe(true);
    expect(isValidBoardCode("OPS01")).toBe(true);
    expect(isValidBoardCode("AWS-01")).toBe(true);
    expect(isValidBoardCode("AWS_APP")).toBe(true);
    expect(isValidBoardCode("A")).toBe(false);
    expect(isValidBoardCode("AWS.APP")).toBe(false);
    expect(isValidBoardCode("ABCDEFGHIJK")).toBe(false);
  });

  it("formats task display ids with zero padded numbers", () => {
    expect(formatTaskDisplayId("aws", 1)).toBe("AWS-0001");
    expect(formatTaskDisplayId("OPS01", 25)).toBe("OPS01-0025");
  });
});
