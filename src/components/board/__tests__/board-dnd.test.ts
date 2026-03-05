import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRAG_DISTANCE_PX,
  MOBILE_CARD_LONG_PRESS_DELAY_MS,
  MOBILE_CARD_LONG_PRESS_TOLERANCE_PX,
  getCardDndId,
  parseCardDndId,
  resolveBoardPointerActivationConstraint,
} from "@/components/board/board-dnd";

function createPointerLikeEvent(pointerType: string): Event {
  const event = new Event("pointerdown");
  Object.defineProperty(event, "pointerType", {
    configurable: true,
    value: pointerType,
  });
  return event;
}

describe("board-dnd", () => {
  it("creates and parses card dnd id", () => {
    const dndId = getCardDndId("abc");

    expect(dndId).toBe("card:abc");
    expect(parseCardDndId(dndId)).toBe("abc");
  });

  it("returns null for invalid card dnd id", () => {
    expect(parseCardDndId("card:")).toBeNull();
    expect(parseCardDndId("list:1")).toBeNull();
  });

  it("uses long press activation for touch card drags", () => {
    const event = createPointerLikeEvent("touch");
    const constraint = resolveBoardPointerActivationConstraint("card:task-1", event);

    expect(constraint).toEqual({
      delay: MOBILE_CARD_LONG_PRESS_DELAY_MS,
      tolerance: MOBILE_CARD_LONG_PRESS_TOLERANCE_PX,
    });
  });

  it("keeps distance activation for touch non-card drags", () => {
    const event = createPointerLikeEvent("touch");
    const constraint = resolveBoardPointerActivationConstraint("list-column:list-1", event);

    expect(constraint).toEqual({ distance: DEFAULT_DRAG_DISTANCE_PX });
  });

  it("keeps distance activation for mouse card drags", () => {
    const event = createPointerLikeEvent("mouse");
    const constraint = resolveBoardPointerActivationConstraint("card:task-1", event);

    expect(constraint).toEqual({ distance: DEFAULT_DRAG_DISTANCE_PX });
  });
});
