import { describe, expect, it } from "vitest";

import { ensurePosition, slugify } from "@/lib/utils";

describe("utils", () => {
  it("slugify converts mixed text to kebab-case", () => {
    expect(slugify("Sprint Board 12!")).toBe("sprint-board-12");
  });

  it("ensurePosition returns fallback for invalid values", () => {
    expect(ensurePosition(undefined, 1000)).toBe(1000);
    expect(ensurePosition(Number.NaN, 1000)).toBe(1000);
  });

  it("ensurePosition returns requested for valid values", () => {
    expect(ensurePosition(3000, 1000)).toBe(3000);
  });
});
