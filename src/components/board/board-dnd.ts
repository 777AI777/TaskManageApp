import {
  type PointerActivationConstraint,
  PointerSensor,
  type PointerSensorProps,
} from "@dnd-kit/core";

export const CARD_DND_PREFIX = "card:";
export const DEFAULT_DRAG_DISTANCE_PX = 4;
export const MOBILE_CARD_LONG_PRESS_DELAY_MS = 2000;
export const MOBILE_CARD_LONG_PRESS_TOLERANCE_PX = 10;

export function getCardDndId(cardId: string): string {
  return `${CARD_DND_PREFIX}${cardId}`;
}

export function parseCardDndId(id: string): string | null {
  if (!id.startsWith(CARD_DND_PREFIX)) return null;
  const cardId = id.slice(CARD_DND_PREFIX.length);
  return cardId.length > 0 ? cardId : null;
}

function isTouchPointerEvent(event: Event): boolean {
  return "pointerType" in event && (event as PointerEvent).pointerType === "touch";
}

export function resolveBoardPointerActivationConstraint(
  activeId: string,
  event: Event,
): PointerActivationConstraint {
  if (parseCardDndId(activeId) && isTouchPointerEvent(event)) {
    return {
      delay: MOBILE_CARD_LONG_PRESS_DELAY_MS,
      tolerance: MOBILE_CARD_LONG_PRESS_TOLERANCE_PX,
    };
  }

  return { distance: DEFAULT_DRAG_DISTANCE_PX };
}

export class BoardPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    const activeId = String(props.active);
    const activationConstraint = resolveBoardPointerActivationConstraint(activeId, props.event);

    super({
      ...props,
      options: {
        ...props.options,
        activationConstraint,
      },
    });
  }
}
