import { describe, it, expect } from "bun:test";
import { nextNavScrollState, isPointerInNavRevealZone } from "./navReveal.js";

const hiddenAtTop = { revealed: false, anchorY: 0 };

describe("nextNavScrollState", () => {
  it("reveals the nav once the reader scrolls down past the threshold", () => {
    expect(nextNavScrollState(hiddenAtTop, 20, 16)).toEqual({ revealed: true, anchorY: 20 });
  });

  it("hides the nav once the reader scrolls up past the threshold", () => {
    const revealed = { revealed: true, anchorY: 500 };
    expect(nextNavScrollState(revealed, 480, 16)).toEqual({ revealed: false, anchorY: 480 });
  });

  it("ignores small movements below the threshold", () => {
    expect(nextNavScrollState(hiddenAtTop, 10, 16)).toEqual(hiddenAtTop);
  });

  it("moves the anchor along while the reader keeps going the same way", () => {
    const revealed = { revealed: true, anchorY: 100 };
    expect(nextNavScrollState(revealed, 400, 16)).toEqual({ revealed: true, anchorY: 400 });
    const hidden = { revealed: false, anchorY: 400 };
    expect(nextNavScrollState(hidden, 100, 16)).toEqual({ revealed: false, anchorY: 100 });
  });

  it("measures a direction change from the furthest point, not from the last flip", () => {
    // Down to 400 (anchor follows), then up 10px: too small to hide.
    let state = nextNavScrollState({ revealed: true, anchorY: 0 }, 400, 16);
    state = nextNavScrollState(state, 390, 16);
    expect(state.revealed).toBe(true);
    // A further 10px up adds to the first 10px and crosses the threshold.
    state = nextNavScrollState(state, 380, 16);
    expect(state.revealed).toBe(false);
  });

  it("hides the nav at the very top of the page, where scrolling up is impossible", () => {
    const revealed = { revealed: true, anchorY: 8 };
    expect(nextNavScrollState(revealed, 0, 16)).toEqual({ revealed: false, anchorY: 0 });
  });
});

describe("isPointerInNavRevealZone", () => {
  it("is true near the top edge of the window", () => {
    expect(isPointerInNavRevealZone(0, 80)).toBe(true);
    expect(isPointerInNavRevealZone(80, 80)).toBe(true);
  });

  it("is false below the zone", () => {
    expect(isPointerInNavRevealZone(81, 80)).toBe(false);
  });
});
