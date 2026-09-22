import { describe, expect, test } from "bun:test";
import { TOOLTIP_DELAY_MS, TOOLTIP_GAP, tipPlacement } from "./tooltip.js";

const viewport = { width: 1000, height: 800 };
const anchor = (left, top, width = 100, height = 20) => ({ left, top, width, height });
const tip = { width: 200, height: 40 };

describe("tipPlacement", () => {
  test("sits above the thing it is about, centred on it", () => {
    const at = tipPlacement(anchor(400, 400), tip, viewport);
    expect(at.side).toBe("top");
    expect(at.left).toBe(350);
    expect(at.top).toBe(400 - 40 - TOOLTIP_GAP);
  });

  // A card at the top of a column, or a heading: above the anchor there is no
  // room, and a tooltip drawn off the screen says nothing.
  test("flips under the thing when there is no room above", () => {
    const at = tipPlacement(anchor(400, 10), tip, viewport);
    expect(at.side).toBe("bottom");
    expect(at.top).toBe(10 + 20 + TOOLTIP_GAP);
  });

  test("keeps to the screen at the left and the right", () => {
    expect(tipPlacement(anchor(0, 400, 20), tip, viewport).left).toBe(TOOLTIP_GAP);
    expect(tipPlacement(anchor(990, 400, 20), tip, viewport).left).toBe(1000 - 200 - TOOLTIP_GAP);
  });

  // A tooltip taller than the screen has nowhere good to go, and the top of it
  // is the half worth reading.
  test("never leaves the top of the screen", () => {
    const at = tipPlacement(anchor(400, 5), { width: 200, height: 900 }, viewport);
    expect(at.top).toBeGreaterThanOrEqual(TOOLTIP_GAP);
  });

  test("never throws, whatever it is handed", () => {
    expect(tipPlacement(null, null, null)).toEqual({ left: TOOLTIP_GAP, top: TOOLTIP_GAP, side: "bottom" });
    expect(tipPlacement(anchor(400, 400), tip, { width: 0, height: 0 }).left).toBe(TOOLTIP_GAP);
  });
});

describe("how long the pointer rests first", () => {
  // Long enough that a pointer crossing the board leaves nothing behind it,
  // short enough that somebody asking a question gets an answer.
  test("the wait is a wait, and it is short", () => {
    expect(TOOLTIP_DELAY_MS).toBeGreaterThanOrEqual(150);
    expect(TOOLTIP_DELAY_MS).toBeLessThanOrEqual(600);
  });
});
