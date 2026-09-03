import { describe, expect, test } from "bun:test";
import {
  DROP,
  KEEP,
  combineMask,
  contentBounds,
  createMask,
  dilate,
  erode,
  feather,
  fillHoles,
  keepLargestIsland,
  maskFromRect,
  paintCircle,
  removeSmallIslands,
  touchesEdge,
} from "./mask.js";

/** A mask laid out as rows of characters, so a test can be read as a picture. */
function maskFromRows(rows) {
  const width = rows[0].length;
  const mask = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      mask[y * width + x] = cell === "#" ? KEEP : DROP;
    });
  });
  return { mask, width, height: rows.length };
}

/** Draw a mask back out as rows, for a readable assertion. */
function rowsFromMask(mask, width, height) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    let row = "";
    for (let x = 0; x < width; x += 1) row += mask[y * width + x] >= 128 ? "#" : ".";
    rows.push(row);
  }
  return rows;
}

describe("createMask", () => {
  test("keeps everything by default", () => {
    const mask = createMask(3, 2);
    expect(mask.length).toBe(6);
    expect([...mask]).toEqual([KEEP, KEEP, KEEP, KEEP, KEEP, KEEP]);
  });

  test("can start with everything dropped", () => {
    expect([...createMask(2, 1, DROP)]).toEqual([DROP, DROP]);
  });

  test("names its two ends so no caller has to guess", () => {
    // 255 keeps the pixel and 0 drops it, which matches how alpha reads.
    expect(KEEP).toBe(255);
    expect(DROP).toBe(0);
  });
});

describe("maskFromRect", () => {
  test("keeps the pixels inside the rectangle and drops the rest", () => {
    const mask = maskFromRect(4, 3, { x: 1, y: 1, width: 2, height: 2 });
    expect(rowsFromMask(mask, 4, 3)).toEqual(["....", ".##.", ".##."]);
  });

  test("clips a rectangle that runs off the edge", () => {
    const mask = maskFromRect(3, 3, { x: 2, y: 2, width: 5, height: 5 });
    expect(rowsFromMask(mask, 3, 3)).toEqual(["...", "...", "..#"]);
  });
});

describe("paintCircle", () => {
  test("drops a round patch where the brush went", () => {
    const mask = createMask(7, 7);
    paintCircle(mask, 7, 7, { x: 3, y: 3, radius: 2, value: DROP });
    // A disc, not a square: the corners of the brush box stay untouched.
    expect(rowsFromMask(mask, 7, 7)).toEqual([
      "#######",
      "###.###",
      "##...##",
      "#.....#",
      "##...##",
      "###.###",
      "#######",
    ]);
  });

  test("restores a patch when painted with keep", () => {
    const mask = createMask(7, 7, DROP);
    paintCircle(mask, 7, 7, { x: 3, y: 3, radius: 2, value: KEEP });
    expect(mask[3 * 7 + 3]).toBe(KEEP);
    expect(mask[0]).toBe(DROP);
  });

  test("leaves a soft rim when hardness is below one", () => {
    const mask = createMask(21, 1);
    paintCircle(mask, 21, 1, { x: 10, y: 0, radius: 8, value: DROP, hardness: 0.25 });
    // The centre is fully dropped, the rim is part way, and outside is intact.
    expect(mask[10]).toBe(DROP);
    expect(mask[16]).toBeGreaterThan(DROP);
    expect(mask[16]).toBeLessThan(KEEP);
    expect(mask[19]).toBe(KEEP);
  });

  test("makes a hard brush change nothing outside its radius", () => {
    const mask = createMask(21, 1);
    paintCircle(mask, 21, 1, { x: 10, y: 0, radius: 3, value: DROP, hardness: 1 });
    expect(mask[6]).toBe(KEEP);
    expect(mask[7]).toBe(DROP);
    expect(mask[13]).toBe(DROP);
    expect(mask[14]).toBe(KEEP);
  });

  test("survives a brush centred outside the image", () => {
    const mask = createMask(4, 4);
    // A finger dragged off the canvas must not throw or wrap to the far side.
    paintCircle(mask, 4, 4, { x: -2, y: 2, radius: 3, value: DROP });
    expect(mask[2 * 4 + 0]).toBe(DROP);
    expect(mask[2 * 4 + 3]).toBe(KEEP);
  });
});

describe("combineMask", () => {
  test("adds a selection back into the mask", () => {
    const base = maskFromRows(["#..", "..."]).mask;
    const selection = maskFromRows(["..#", "..."]).mask;
    expect([...combineMask(base, selection, "add")]).toEqual([KEEP, DROP, KEEP, DROP, DROP, DROP]);
  });

  test("subtracts a selection from the mask", () => {
    const base = maskFromRows(["###", "###"]).mask;
    const selection = maskFromRows([".#.", "..."]).mask;
    expect([...combineMask(base, selection, "subtract")]).toEqual([
      KEEP,
      DROP,
      KEEP,
      KEEP,
      KEEP,
      KEEP,
    ]);
  });

  test("replaces the mask outright", () => {
    const base = maskFromRows(["###"]).mask;
    const selection = maskFromRows([".#."]).mask;
    expect([...combineMask(base, selection, "replace")]).toEqual([DROP, KEEP, DROP]);
  });

  test("keeps a soft edge when adding, rather than snapping to full", () => {
    const base = new Uint8Array([0, 0]);
    const selection = new Uint8Array([120, 0]);
    expect([...combineMask(base, selection, "add")]).toEqual([120, 0]);
  });

  test("does not change the mask it was given", () => {
    // The editor keeps the previous mask for undo, so a combine that wrote
    // through its input would quietly destroy the history.
    const base = maskFromRows(["###"]).mask;
    combineMask(base, maskFromRows(["..."]).mask, "replace");
    expect([...base]).toEqual([KEEP, KEEP, KEEP]);
  });
});

describe("dilate and erode", () => {
  test("dilate grows a kept area by the radius", () => {
    const { mask, width, height } = maskFromRows([".....", ".....", "..#..", ".....", "....."]);
    expect(rowsFromMask(dilate(mask, width, height, 1), width, height)).toEqual([
      ".....",
      ".###.",
      ".###.",
      ".###.",
      ".....",
    ]);
  });

  test("erode shrinks a kept area by the radius", () => {
    const { mask, width, height } = maskFromRows([".....", ".###.", ".###.", ".###.", "....."]);
    expect(rowsFromMask(erode(mask, width, height, 1), width, height)).toEqual([
      ".....",
      ".....",
      "..#..",
      ".....",
      ".....",
    ]);
  });

  test("erode treats outside the image as dropped, so an edge shape shrinks", () => {
    const { mask, width, height } = maskFromRows(["###", "###", "###"]);
    expect(rowsFromMask(erode(mask, width, height, 1), width, height)).toEqual([
      "...",
      ".#.",
      "...",
    ]);
  });

  test("a radius of zero changes nothing", () => {
    const { mask, width, height } = maskFromRows([".#.", "#.#"]);
    expect([...dilate(mask, width, height, 0)]).toEqual([...mask]);
    expect([...erode(mask, width, height, 0)]).toEqual([...mask]);
  });
});

describe("feather", () => {
  test("leaves a deep interior fully kept and far outside fully dropped", () => {
    const rows = Array.from({ length: 15 }, (_, y) =>
      Array.from({ length: 15 }, (_, x) => (x >= 4 && x <= 10 && y >= 4 && y <= 10 ? "#" : ".")).join(""),
    );
    const { mask, width, height } = maskFromRows(rows);
    const soft = feather(mask, width, height, 2);
    expect(soft[7 * 15 + 7]).toBe(KEEP);
    expect(soft[0]).toBe(DROP);
  });

  test("puts part-way values along the boundary", () => {
    const rows = Array.from({ length: 15 }, (_, y) =>
      Array.from({ length: 15 }, (_, x) => (x >= 4 && x <= 10 && y >= 4 && y <= 10 ? "#" : ".")).join(""),
    );
    const { mask, width, height } = maskFromRows(rows);
    const soft = feather(mask, width, height, 2);
    // Right on the old hard edge the value now sits between the two ends,
    // which is what stops a cut-out looking like it was cut with scissors.
    const edge = soft[7 * 15 + 4];
    expect(edge).toBeGreaterThan(DROP);
    expect(edge).toBeLessThan(KEEP);
  });

  test("a radius of zero leaves the mask alone", () => {
    const { mask, width, height } = maskFromRows([".##.", "####"]);
    expect([...feather(mask, width, height, 0)]).toEqual([...mask]);
  });
});

describe("removeSmallIslands", () => {
  test("drops a kept blob smaller than the limit", () => {
    const { mask, width, height } = maskFromRows([
      "##...",
      "##...",
      ".....",
      "....#",
      ".....",
    ]);
    // The four pixel square stays and the single stray pixel goes.
    expect(rowsFromMask(removeSmallIslands(mask, width, height, 2), width, height)).toEqual([
      "##...",
      "##...",
      ".....",
      ".....",
      ".....",
    ]);
  });

  test("keeps everything when the limit is one", () => {
    const { mask, width, height } = maskFromRows(["#.#", ".#."]);
    expect([...removeSmallIslands(mask, width, height, 1)]).toEqual([...mask]);
  });

  test("joins pixels through their sides, not their corners", () => {
    // Two pixels touching only at a corner are two islands, not one. Corner
    // joining would rescue speckle that the person wants gone.
    const { mask, width, height } = maskFromRows(["#..", ".#.", "..."]);
    expect(rowsFromMask(removeSmallIslands(mask, width, height, 2), width, height)).toEqual([
      "...",
      "...",
      "...",
    ]);
  });
});

describe("fillHoles", () => {
  test("fills a dropped pocket surrounded by kept pixels", () => {
    const { mask, width, height } = maskFromRows(["#####", "#####", "##.##", "#####", "#####"]);
    expect(rowsFromMask(fillHoles(mask, width, height, 4), width, height)).toEqual([
      "#####",
      "#####",
      "#####",
      "#####",
      "#####",
    ]);
  });

  test("leaves a pocket larger than the limit alone", () => {
    const { mask, width, height } = maskFromRows(["#####", "#...#", "#...#", "#...#", "#####"]);
    expect(rowsFromMask(fillHoles(mask, width, height, 4), width, height)).toEqual([
      "#####",
      "#...#",
      "#...#",
      "#...#",
      "#####",
    ]);
  });

  test("never fills the background, however small the image", () => {
    // The outside reaches the border, so it is not a pocket. A fill that
    // ignored that would paint the whole image kept.
    const { mask, width, height } = maskFromRows(["...", ".#.", "..."]);
    expect(rowsFromMask(fillHoles(mask, width, height, 999), width, height)).toEqual([
      "...",
      ".#.",
      "...",
    ]);
  });
});

describe("keepLargestIsland", () => {
  test("keeps the biggest blob and drops the rest", () => {
    const { mask, width, height } = maskFromRows(["###..", "###..", ".....", "....#", "....."]);
    expect(rowsFromMask(keepLargestIsland(mask, width, height), width, height)).toEqual([
      "###..",
      "###..",
      ".....",
      ".....",
      ".....",
    ]);
  });

  test("leaves an empty mask empty", () => {
    const { mask, width, height } = maskFromRows(["...", "..."]);
    expect([...keepLargestIsland(mask, width, height)]).toEqual([...mask]);
  });
});

describe("contentBounds", () => {
  test("finds the box around the kept pixels", () => {
    const { mask, width, height } = maskFromRows(["....", ".##.", ".#..", "...."]);
    expect(contentBounds(mask, width, height)).toEqual({ x: 1, y: 1, width: 2, height: 2 });
  });

  test("returns nothing for an empty mask", () => {
    const { mask, width, height } = maskFromRows(["..", ".."]);
    expect(contentBounds(mask, width, height)).toBeNull();
  });

  test("covers the whole image when everything is kept", () => {
    const { mask, width, height } = maskFromRows(["##", "##"]);
    expect(contentBounds(mask, width, height)).toEqual({ x: 0, y: 0, width: 2, height: 2 });
  });

  test("ignores a nearly invisible pixel", () => {
    // A feathered edge leaves values just above zero. Counting them would
    // make the box bigger than anything a person can see.
    const mask = new Uint8Array([0, 3, 0, 0, 255, 0, 0, 0, 0]);
    expect(contentBounds(mask, 3, 3)).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  });
});

describe("touchesEdge", () => {
  test("is true when a kept pixel sits on the border", () => {
    const { mask, width, height } = maskFromRows(["..#", "...", "..."]);
    expect(touchesEdge(mask, width, height)).toBe(true);
  });

  test("is false when a margin of empty pixels surrounds the drawing", () => {
    const { mask, width, height } = maskFromRows(["...", ".#.", "..."]);
    expect(touchesEdge(mask, width, height)).toBe(false);
  });

  test("can be asked to allow a margin narrower than a given width", () => {
    // WhatsApp suggests room for an 8 pixel stroke round a sticker, so the
    // question is really "is there room", not "does it touch".
    const rows = Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 12 }, (_, x) => (x >= 3 && x <= 8 && y >= 3 && y <= 8 ? "#" : ".")).join(""),
    );
    const { mask, width, height } = maskFromRows(rows);
    expect(touchesEdge(mask, width, height, { margin: 2 })).toBe(false);
    expect(touchesEdge(mask, width, height, { margin: 4 })).toBe(true);
  });
});
