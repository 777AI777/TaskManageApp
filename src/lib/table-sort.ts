export type TableSortDirection = "asc" | "desc";
type StandardTableSortKey = "taskId" | "title" | "list" | "labels" | "assignees" | "dueAt" | "status";
export type TableSortKey = StandardTableSortKey | `custom:${string}`;
export type TableSortState =
  | {
      key: TableSortKey;
      direction: TableSortDirection;
    }
  | null;

type SearchParamsLike = {
  get: (key: string) => string | null;
};

export const TABLE_SORT_KEY_QUERY_PARAM = "tableSortKey";
export const TABLE_SORT_DIR_QUERY_PARAM = "tableSortDir";

const STANDARD_TABLE_SORT_KEYS: ReadonlySet<StandardTableSortKey> = new Set([
  "taskId",
  "title",
  "list",
  "labels",
  "assignees",
  "dueAt",
  "status",
]);

function isTableSortDirection(value: string | null): value is TableSortDirection {
  return value === "asc" || value === "desc";
}

function isStandardTableSortKey(value: string): value is StandardTableSortKey {
  return STANDARD_TABLE_SORT_KEYS.has(value as StandardTableSortKey);
}

function isCustomTableSortKey(value: string): value is `custom:${string}` {
  if (!value.startsWith("custom:")) return false;
  return value.length > "custom:".length;
}

export function parseTableSortState(
  params: SearchParamsLike,
  customFieldIds: readonly string[],
): TableSortState {
  const keyValue = params.get(TABLE_SORT_KEY_QUERY_PARAM);
  const directionValue = params.get(TABLE_SORT_DIR_QUERY_PARAM);
  if (!keyValue || !isTableSortDirection(directionValue)) {
    return null;
  }

  if (isStandardTableSortKey(keyValue)) {
    return { key: keyValue, direction: directionValue };
  }

  if (!isCustomTableSortKey(keyValue)) {
    return null;
  }

  const fieldId = keyValue.slice("custom:".length);
  if (!customFieldIds.includes(fieldId)) {
    return null;
  }

  return { key: keyValue, direction: directionValue };
}

export function getNextTableSortState(
  current: TableSortState,
  key: TableSortKey,
): Exclude<TableSortState, null> {
  if (!current || current.key !== key) {
    return {
      key,
      direction: "asc",
    };
  }

  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

export function applyTableSortStateToSearchParams(
  current: URLSearchParams,
  tableSortState: TableSortState,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  if (!tableSortState) {
    next.delete(TABLE_SORT_KEY_QUERY_PARAM);
    next.delete(TABLE_SORT_DIR_QUERY_PARAM);
    return next;
  }

  next.set(TABLE_SORT_KEY_QUERY_PARAM, tableSortState.key);
  next.set(TABLE_SORT_DIR_QUERY_PARAM, tableSortState.direction);
  return next;
}

export function getAriaSortValue(
  sortState: TableSortState,
  key: TableSortKey,
): "none" | "ascending" | "descending" {
  if (!sortState || sortState.key !== key) {
    return "none";
  }
  return sortState.direction === "asc" ? "ascending" : "descending";
}
