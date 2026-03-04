const STORAGE_KEY = "tm:shared-sidebar-width-px";
const MIN_WIDTH_PX = 220;
const FALLBACK_MAX_WIDTH_PX = 520;

function resolveMaxWidthPx(viewportWidth?: number): number {
  if (Number.isFinite(viewportWidth) && (viewportWidth ?? 0) > 0) {
    return Math.max(MIN_WIDTH_PX, Math.floor((viewportWidth as number) * 0.9));
  }
  if (typeof window !== "undefined" && Number.isFinite(window.innerWidth) && window.innerWidth > 0) {
    return Math.max(MIN_WIDTH_PX, Math.floor(window.innerWidth * 0.9));
  }
  return FALLBACK_MAX_WIDTH_PX;
}

export function clampSharedSidebarWidth(width: number, viewportWidth?: number): number {
  if (!Number.isFinite(width)) return MIN_WIDTH_PX;
  const maxWidth = resolveMaxWidthPx(viewportWidth);
  return Math.min(maxWidth, Math.max(MIN_WIDTH_PX, Math.round(width)));
}

export function readSharedSidebarWidthFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return null;
  return clampSharedSidebarWidth(parsed);
}

export function writeSharedSidebarWidthToStorage(width: number): void {
  if (typeof window === "undefined") return;
  const clamped = clampSharedSidebarWidth(width, window.innerWidth);
  window.localStorage.setItem(STORAGE_KEY, String(clamped));
}
