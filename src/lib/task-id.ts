const BOARD_CODE_PATTERN = /^[A-Z0-9_-]{2,10}$/;

export function normalizeBoardCodeInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 10);
}

export function isValidBoardCode(value: string): boolean {
  return BOARD_CODE_PATTERN.test(value);
}

export function formatTaskDisplayId(boardCode: string, taskNumber: number): string {
  const normalizedBoardCode = normalizeBoardCodeInput(boardCode);
  const safeTaskNumber = Number.isFinite(taskNumber) && taskNumber > 0 ? Math.floor(taskNumber) : 0;
  return `${normalizedBoardCode}-${String(safeTaskNumber).padStart(4, "0")}`;
}
