import { describe, test, expect } from "bun:test";
import {
  affordable,
  barWidth,
  cameraFor,
  clampScroll,
  fieldMenuItems,
  healthColor,
  isCritical,
  messagePage,
  moveCursor,
  moveGridCursor,
  pixelScale,
  stepProgress,
  stepQuantity,
} from "./ui.js";

describe("moveCursor", () => {
  test("moves up and down a list", () => {
    expect(moveCursor(1, 1, 4)).toBe(2);
    expect(moveCursor(1, -1, 4)).toBe(0);
  });

  test("wraps round both ends by default", () => {
    expect(moveCursor(3, 1, 4)).toBe(0);
    expect(moveCursor(0, -1, 4)).toBe(3);
  });

  test("stops at both ends when told not to wrap", () => {
    expect(moveCursor(3, 1, 4, false)).toBe(3);
    expect(moveCursor(0, -1, 4, false)).toBe(0);
  });

  test("stays at zero for an empty list", () => {
    expect(moveCursor(0, 1, 0)).toBe(0);
    expect(moveCursor(5, -1, 0)).toBe(0);
  });
});

describe("moveGridCursor", () => {
  // Four moves laid out two across and two down.
  test("moves around a full grid", () => {
    expect(moveGridCursor(0, "right", 2, 4)).toBe(1);
    expect(moveGridCursor(0, "down", 2, 4)).toBe(2);
    expect(moveGridCursor(3, "left", 2, 4)).toBe(2);
    expect(moveGridCursor(3, "up", 2, 4)).toBe(1);
  });

  test("stays put at every edge rather than wrapping round", () => {
    expect(moveGridCursor(0, "up", 2, 4)).toBe(0);
    expect(moveGridCursor(0, "left", 2, 4)).toBe(0);
    expect(moveGridCursor(3, "down", 2, 4)).toBe(3);
    expect(moveGridCursor(3, "right", 2, 4)).toBe(3);
  });

  test("stays put rather than landing on a move the creature does not have", () => {
    // Three moves: the fourth slot is empty, so right from slot 2 goes nowhere.
    expect(moveGridCursor(2, "right", 2, 3)).toBe(2);
    expect(moveGridCursor(1, "down", 2, 3)).toBe(1);
  });

  test("copes with an empty list and an unknown direction", () => {
    expect(moveGridCursor(0, "right", 2, 0)).toBe(0);
    expect(moveGridCursor(1, "sideways", 2, 4)).toBe(1);
  });
});

describe("clampScroll", () => {
  test("does not scroll a list that already fits", () => {
    expect(clampScroll(3, 0, 6, 4)).toBe(0);
  });

  test("follows the cursor down and back up", () => {
    expect(clampScroll(4, 0, 4, 10)).toBe(1);
    expect(clampScroll(0, 3, 4, 10)).toBe(0);
  });

  test("never scrolls past the end of the list", () => {
    expect(clampScroll(9, 0, 4, 10)).toBe(6);
    expect(clampScroll(9, 99, 4, 10)).toBe(6);
  });
});

describe("health bars", () => {
  test("are full at full health and empty at none", () => {
    expect(barWidth(20, 20, 48)).toBe(48);
    expect(barWidth(0, 20, 48)).toBe(0);
  });

  test("never round a creature that is still alive down to nothing", () => {
    expect(barWidth(1, 500, 48)).toBe(1);
  });

  test("never go past the end of the bar, whatever the numbers say", () => {
    expect(barWidth(50, 20, 48)).toBe(48);
    expect(barWidth(-5, 20, 48)).toBe(0);
    expect(barWidth(10, 0, 48)).toBe(0);
  });

  test("change colour as the health falls", () => {
    expect(healthColor(20, 20)).toBe("#4fbf46");
    expect(healthColor(8, 20)).toBe("#e3b23a");
    expect(healthColor(2, 20)).toBe("#c0392b");
  });

  test("call a creature critical only while it is still standing", () => {
    expect(isCritical(4, 20)).toBe(true);
    expect(isCritical(12, 20)).toBe(false);
    expect(isCritical(0, 20)).toBe(false);
  });
});

describe("the shop counter", () => {
  test("works out how many the player can pay for", () => {
    expect(affordable(1000, 200)).toBe(5);
    expect(affordable(199, 200)).toBe(0);
    expect(affordable(1000, 0)).toBe(0);
  });

  test("moves the quantity and wraps at both ends", () => {
    expect(stepQuantity(1, 1, 5)).toBe(2);
    expect(stepQuantity(5, 1, 5)).toBe(1);
    expect(stepQuantity(1, -1, 5)).toBe(5);
  });

  test("stays at nothing when nothing is affordable", () => {
    expect(stepQuantity(1, 1, 0)).toBe(0);
  });
});

describe("messagePage", () => {
  const pages = [["one"], ["two"], ["three"]];

  test("gives the page asked for and says when it is the last", () => {
    expect(messagePage(pages, 0)).toEqual({ page: ["one"], last: false });
    expect(messagePage(pages, 2)).toEqual({ page: ["three"], last: true });
  });

  test("clamps a page number outside the range", () => {
    expect(messagePage(pages, 99).page).toEqual(["three"]);
    expect(messagePage(pages, -3).page).toEqual(["one"]);
  });

  test("gives a blank page rather than nothing at all", () => {
    expect(messagePage([], 0)).toEqual({ page: [""], last: true });
  });
});

describe("stepProgress", () => {
  test("runs from nothing to all the way", () => {
    expect(stepProgress(0, 8)).toBe(0);
    expect(stepProgress(4, 8)).toBe(0.5);
    expect(stepProgress(8, 8)).toBe(1);
  });

  test("never runs past the end, or before the start", () => {
    expect(stepProgress(20, 8)).toBe(1);
    expect(stepProgress(-3, 8)).toBe(0);
    expect(stepProgress(3, 0)).toBe(1);
  });
});

describe("the camera", () => {
  const view = { viewW: 240, viewH: 160 };

  test("puts the player in the middle of a big map", () => {
    const camera = cameraFor({ centreX: 500, centreY: 400, ...view, mapW: 1000, mapH: 800 });
    expect(camera.x).toBe(380);
    expect(camera.y).toBe(320);
  });

  test("never shows past the edge of the map", () => {
    const topLeft = cameraFor({ centreX: 0, centreY: 0, ...view, mapW: 1000, mapH: 800 });
    expect(topLeft).toEqual({ x: 0, y: 0 });
    const bottomRight = cameraFor({ centreX: 1000, centreY: 800, ...view, mapW: 1000, mapH: 800 });
    expect(bottomRight).toEqual({ x: 760, y: 640 });
  });

  test("centres a map smaller than the screen instead of pinning it to a corner", () => {
    const camera = cameraFor({ centreX: 80, centreY: 64, ...view, mapW: 160, mapH: 128 });
    expect(camera.x).toBe(-40);
    expect(camera.y).toBe(-16);
  });
});

describe("pixelScale", () => {
  test("picks the biggest whole number that still fits", () => {
    expect(pixelScale(960, 640, 240, 160)).toBe(4);
    expect(pixelScale(1000, 500, 240, 160)).toBe(3);
  });

  test("never goes below one, however small the window", () => {
    expect(pixelScale(100, 100, 240, 160)).toBe(1);
  });

  test("never goes past the ceiling it is given", () => {
    expect(pixelScale(4000, 4000, 240, 160, 6)).toBe(6);
  });

  test("only ever gives whole numbers, because half a pixel looks muddy", () => {
    for (let w = 200; w < 2000; w += 37) {
      expect(Number.isInteger(pixelScale(w, w, 240, 160))).toBe(true);
    }
  });
});

describe("fieldMenuItems", () => {
  test("hides the creature list until the player has one", () => {
    const empty = fieldMenuItems({ party: [], player: { name: "Guillem" } });
    expect(empty.map((entry) => entry.id)).not.toContain("party");
    const withOne = fieldMenuItems({ party: [{}], player: { name: "Guillem" } });
    expect(withOne.map((entry) => entry.id)).toContain("party");
  });

  test("names the player's own entry after the player", () => {
    const items = fieldMenuItems({ party: [], player: { name: "Nana" } });
    expect(items.find((entry) => entry.id === "player").label).toBe("Nana");
  });

  test("always offers a way to save and a way out", () => {
    const items = fieldMenuItems({ party: [], player: {} }).map((entry) => entry.id);
    expect(items).toContain("save");
    expect(items).toContain("close");
  });

  test("survives a state with almost nothing in it", () => {
    expect(fieldMenuItems({}).length).toBeGreaterThan(0);
  });
});
