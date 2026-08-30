import { describe, test, expect } from "bun:test";
import {
  affordable,
  barWidth,
  cameraFor,
  clampScroll,
  fieldMenuItems,
  healthColor,
  isCritical,
  layoutMode,
  messagePage,
  moveCursor,
  moveGridCursor,
  optionRows,
  padActionAt,
  pixelScale,
  tileVariant,
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
    expect(pixelScale(4000, 4000, 240, 160, { max: 6 })).toBe(6);
  });

  test("only ever gives whole numbers on a screen with big pixels", () => {
    for (let w = 200; w < 2000; w += 37) {
      expect(Number.isInteger(pixelScale(w, w, 240, 160))).toBe(true);
    }
  });

  // A phone is the reason the fraction exists. 390 wide is a common phone, and
  // a whole number there means scale 1: the game fills 240 of the 390 and looks
  // like a stamp. The screen is dense enough that nobody can see the seam.
  test("fills the width on a dense screen when a whole number would waste it", () => {
    expect(pixelScale(390, 700, 240, 160, { pixelRatio: 3 })).toBeCloseTo(1.625);
  });

  test("keeps the whole number on a dense screen when it wastes little", () => {
    // 1000 wide is 4.16 times 240. Scale 4 uses 96% of the room, so the fraction
    // buys almost nothing and costs an even pixel.
    expect(pixelScale(1000, 700, 240, 160, { pixelRatio: 3 })).toBe(4);
  });

  test("never fills on a screen with big pixels, however much room is wasted", () => {
    expect(pixelScale(390, 700, 240, 160, { pixelRatio: 1 })).toBe(1);
  });

  test("still stops at the ceiling when it is allowed to fill", () => {
    expect(pixelScale(4000, 4000, 240, 160, { max: 6, pixelRatio: 3 })).toBe(6);
  });

  test("never returns a scale that overflows the room it was given", () => {
    for (let w = 240; w < 2000; w += 13) {
      const scale = pixelScale(w, 4000, 240, 160, { pixelRatio: 3 });
      expect(scale * 240).toBeLessThanOrEqual(w);
    }
  });
});

describe("layoutMode", () => {
  test("puts the pad over the screen in fullscreen, whatever the shape", () => {
    expect(layoutMode({ fullscreen: true, width: 390, height: 844, coarsePointer: true })).toBe(
      "overlay",
    );
    expect(layoutMode({ fullscreen: true, width: 1440, height: 900, coarsePointer: false })).toBe(
      "overlay",
    );
  });

  // A phone held sideways is about 390 tall. The screen alone wants 390 of that,
  // so there is no room under it for a pad. The pad has to float.
  test("puts the pad over the screen on a touch screen held sideways", () => {
    expect(layoutMode({ fullscreen: false, width: 844, height: 390, coarsePointer: true })).toBe(
      "overlay",
    );
  });

  test("puts the pad at the bottom on a touch screen held upright", () => {
    expect(layoutMode({ fullscreen: false, width: 390, height: 844, coarsePointer: true })).toBe(
      "theater",
    );
  });

  test("leaves a machine with a mouse on the ordinary page", () => {
    expect(layoutMode({ fullscreen: false, width: 1440, height: 900, coarsePointer: false })).toBe(
      "page",
    );
    expect(layoutMode({ fullscreen: false, width: 700, height: 1200, coarsePointer: false })).toBe(
      "page",
    );
  });
});

describe("fieldMenuItems", () => {
  test("hides the creature list until the player has one", () => {
    const empty = fieldMenuItems({ party: [], player: { name: "Guillem" } });
    expect(empty.map((entry) => entry.id)).not.toContain("party");
    const withOne = fieldMenuItems({ party: [{}], player: { name: "Guillem" } });
    expect(withOne.map((entry) => entry.id)).toContain("party");
  });

  test("offers the box alongside the creature list, so nothing is stranded", () => {
    const items = fieldMenuItems({ party: [{}], player: { name: "Guillem" } }).map((e) => e.id);
    expect(items).toContain("box");
    const none = fieldMenuItems({ party: [], player: {} }).map((e) => e.id);
    expect(none).not.toContain("box");
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

describe("tileVariant", () => {
  test("always picks a version that exists", () => {
    for (let x = -20; x < 40; x++) {
      for (let y = -20; y < 40; y++) {
        const variant = tileVariant(x, y, 4);
        expect(Number.isInteger(variant)).toBe(true);
        expect(variant).toBeGreaterThanOrEqual(0);
        expect(variant).toBeLessThan(4);
      }
    }
  });

  test("gives the same answer for the same square every time", () => {
    // The ground would crawl under the player if this ever changed.
    expect(tileVariant(7, 12, 4)).toBe(tileVariant(7, 12, 4));
  });

  test("uses every version across a field, and none of them too much", () => {
    const seen = [0, 0, 0, 0];
    for (let x = 0; x < 24; x++) for (let y = 0; y < 24; y++) seen[tileVariant(x, y, 4)]++;
    for (const count of seen) {
      // An even split would be 144. A third of that is loose enough not to be
      // brittle and tight enough to catch a hash that ignores one coordinate.
      expect(count).toBeGreaterThan(48);
    }
  });

  test("does not give neighbours the same version everywhere", () => {
    let same = 0;
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) if (tileVariant(x, y, 4) === tileVariant(x + 1, y, 4)) same++;
    }
    expect(same).toBeLessThan(200);
  });

  test("falls back to the one version there is", () => {
    expect(tileVariant(3, 4, 1)).toBe(0);
    expect(tileVariant(3, 4, 0)).toBe(0);
    expect(tileVariant(3, 4, NaN)).toBe(0);
  });
});

describe("padActionAt", () => {
  // The cross the page draws: four 44 pixel keys around an empty middle.
  const KEY = 44;
  const CROSS = [
    { action: "up", x: KEY, y: 0, w: KEY, h: KEY },
    { action: "left", x: 0, y: KEY, w: KEY, h: KEY },
    { action: "right", x: KEY * 2, y: KEY, w: KEY, h: KEY },
    { action: "down", x: KEY, y: KEY * 2, w: KEY, h: KEY },
  ];

  test("presses the button the finger sits on", () => {
    expect(padActionAt({ x: 66, y: 22 }, CROSS)).toBe("up");
    expect(padActionAt({ x: 22, y: 66 }, CROSS)).toBe("left");
    expect(padActionAt({ x: 110, y: 66 }, CROSS)).toBe("right");
    expect(padActionAt({ x: 66, y: 110 }, CROSS)).toBe("down");
  });

  test("presses the nearest arrow in the empty corners of the cross", () => {
    expect(padActionAt({ x: 36, y: 20 }, CROSS)).toBe("up");
    expect(padActionAt({ x: 20, y: 36 }, CROSS)).toBe("left");
    expect(padActionAt({ x: 96, y: 112 }, CROSS)).toBe("down");
  });

  test("never falls into a hole while a finger slides from one arrow to the next", () => {
    // The straight line from the middle of "up" to the middle of "right".
    for (let step = 0; step <= 20; step++) {
      const share = step / 20;
      const point = { x: 66 + share * 44, y: 22 + share * 44 };
      expect(padActionAt(point, CROSS)).not.toBeNull();
    }
  });

  test("keeps the press when the finger drifts just off the edge", () => {
    expect(padActionAt({ x: 66, y: 140 }, CROSS)).toBe("down");
    expect(padActionAt({ x: -8, y: 66 }, CROSS)).toBe("left");
  });

  test("presses nothing once the finger leaves the cross", () => {
    expect(padActionAt({ x: 66, y: 200 }, CROSS)).toBeNull();
    expect(padActionAt({ x: 300, y: 66 }, CROSS)).toBeNull();
  });

  test("presses nothing when there are no buttons", () => {
    expect(padActionAt({ x: 10, y: 10 }, [])).toBeNull();
  });
});

describe("optionRows", () => {
  test("lists the sound setting and reads its state", () => {
    expect(optionRows({ muted: false, canVibrate: false })).toEqual([
      { id: "sound", label: "Sound: on" },
    ]);
    expect(optionRows({ muted: true, canVibrate: false })[0].label).toBe("Sound: off");
  });

  test("adds the vibration setting only where the browser can vibrate", () => {
    const rows = optionRows({ muted: false, canVibrate: true, vibration: true });
    expect(rows.map((row) => row.id)).toEqual(["sound", "vibration"]);
    expect(rows[1].label).toBe("Vibration: on");
    expect(optionRows({ muted: false, canVibrate: true, vibration: false })[1].label).toBe(
      "Vibration: off",
    );
  });
});
