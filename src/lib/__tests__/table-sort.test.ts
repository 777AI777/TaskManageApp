import { describe, expect, it } from "vitest";

import {
  TABLE_SORT_DIR_QUERY_PARAM,
  TABLE_SORT_KEY_QUERY_PARAM,
  applyTableSortStateToSearchParams,
  getNextTableSortState,
  parseTableSortState,
  type TableSortState,
} from "@/lib/table-sort";

describe("parseTableSortState", () => {
  it("parses valid standard key and direction", () => {
    const params = new URLSearchParams({
      [TABLE_SORT_KEY_QUERY_PARAM]: "title",
      [TABLE_SORT_DIR_QUERY_PARAM]: "asc",
    });

    expect(parseTableSortState(params, [])).toEqual({
      key: "title",
      direction: "asc",
    });
  });

  it("parses taskId as a valid standard key", () => {
    const params = new URLSearchParams({
      [TABLE_SORT_KEY_QUERY_PARAM]: "taskId",
      [TABLE_SORT_DIR_QUERY_PARAM]: "desc",
    });

    expect(parseTableSortState(params, [])).toEqual({
      key: "taskId",
      direction: "desc",
    });
  });

  it("parses valid custom key when custom field id exists", () => {
    const params = new URLSearchParams({
      [TABLE_SORT_KEY_QUERY_PARAM]: "custom:cf-1",
      [TABLE_SORT_DIR_QUERY_PARAM]: "desc",
    });

    expect(parseTableSortState(params, ["cf-1", "cf-2"])).toEqual({
      key: "custom:cf-1",
      direction: "desc",
    });
  });

  it("returns null when key or direction are invalid", () => {
    const invalidDirection = new URLSearchParams({
      [TABLE_SORT_KEY_QUERY_PARAM]: "title",
      [TABLE_SORT_DIR_QUERY_PARAM]: "invalid",
    });
    const invalidKey = new URLSearchParams({
      [TABLE_SORT_KEY_QUERY_PARAM]: "unknown",
      [TABLE_SORT_DIR_QUERY_PARAM]: "asc",
    });
    const invalidCustom = new URLSearchParams({
      [TABLE_SORT_KEY_QUERY_PARAM]: "custom:not-present",
      [TABLE_SORT_DIR_QUERY_PARAM]: "asc",
    });

    expect(parseTableSortState(invalidDirection, [])).toBeNull();
    expect(parseTableSortState(invalidKey, [])).toBeNull();
    expect(parseTableSortState(invalidCustom, ["cf-1"])).toBeNull();
  });
});

describe("getNextTableSortState", () => {
  it("starts with ascending when key changes or current is null", () => {
    expect(getNextTableSortState(null, "title")).toEqual({
      key: "title",
      direction: "asc",
    });

    expect(getNextTableSortState(null, "taskId")).toEqual({
      key: "taskId",
      direction: "asc",
    });

    const current: TableSortState = { key: "title", direction: "desc" };
    expect(getNextTableSortState(current, "status")).toEqual({
      key: "status",
      direction: "asc",
    });
  });

  it("toggles direction when same key is clicked", () => {
    expect(getNextTableSortState({ key: "title", direction: "asc" }, "title")).toEqual({
      key: "title",
      direction: "desc",
    });
    expect(getNextTableSortState({ key: "title", direction: "desc" }, "title")).toEqual({
      key: "title",
      direction: "asc",
    });
  });
});

describe("applyTableSortStateToSearchParams", () => {
  it("keeps existing query params and writes sort params", () => {
    const current = new URLSearchParams({
      view: "table",
      card: "123",
    });

    const next = applyTableSortStateToSearchParams(current, { key: "dueAt", direction: "desc" });
    expect(next.get("view")).toBe("table");
    expect(next.get("card")).toBe("123");
    expect(next.get(TABLE_SORT_KEY_QUERY_PARAM)).toBe("dueAt");
    expect(next.get(TABLE_SORT_DIR_QUERY_PARAM)).toBe("desc");
  });

  it("removes sort params when state is null", () => {
    const current = new URLSearchParams({
      view: "table",
      [TABLE_SORT_KEY_QUERY_PARAM]: "title",
      [TABLE_SORT_DIR_QUERY_PARAM]: "asc",
    });

    const next = applyTableSortStateToSearchParams(current, null);
    expect(next.get("view")).toBe("table");
    expect(next.get(TABLE_SORT_KEY_QUERY_PARAM)).toBeNull();
    expect(next.get(TABLE_SORT_DIR_QUERY_PARAM)).toBeNull();
  });
});
