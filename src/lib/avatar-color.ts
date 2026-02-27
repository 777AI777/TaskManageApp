const DEFAULT_AVATAR_COLOR = "#0c66e4";
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function resolveAvatarColor(color: string | null | undefined): string {
  if (!color) return DEFAULT_AVATAR_COLOR;
  const normalized = color.trim();
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : DEFAULT_AVATAR_COLOR;
}
