import { describe, test, expect } from "bun:test";
import {
  addOutline,
  addShading,
  blankPixels,
  countPainted,
  mirrorShape,
  paintedBounds,
  parseColor,
  rasterise,
  shiftColor,
  toHex,
} from "./pixelArt.js";

const RED = "#c03030";

describe("colours", () => {
  test("read and write the same value back", () => {
    expect(toHex(parseColor("#3f7a2e"))).toBe("#3f7a2e");
  });

  test("accept a value with no hash", () => {
    expect(parseColor("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  test("fall back to black for anything unreadable", () => {
    expect(parseColor("not a colour")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor(null)).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor("#fff")).toEqual({ r: 0, g: 0, b: 0 });
  });

  test("lighten and darken", () => {
    expect(shiftColor("#808080", 16)).toBe("#909090");
    expect(shiftColor("#808080", -16)).toBe("#707070");
  });

  test("never run past white or black", () => {
    expect(shiftColor("#ffffff", 90)).toBe("#ffffff");
    expect(shiftColor("#000000", -90)).toBe("#000000");
  });
});

describe("a blank picture", () => {
  test("is the size asked for and completely transparent", () => {
    const pixels = blankPixels(4, 3);
    expect(pixels.length).toBe(3);
    expect(pixels[0].length).toBe(4);
    expect(countPainted(pixels)).toBe(0);
  });
});

describe("shapes", () => {
  test("a rectangle fills exactly its own area", () => {
    const pixels = rasterise({
      w: 8,
      h: 8,
      shade: false,
      shapes: [{ k: "rect", x: 2, y: 2, w: 3, h: 2, c: RED }],
    });
    expect(countPainted(pixels)).toBe(6);
    expect(pixels[2][2]).toBe(RED);
    expect(pixels[3][4]).toBe(RED);
    expect(pixels[4][2]).toBeNull();
  });

  test("an ellipse is round and centred where it is told", () => {
    const pixels = rasterise({
      w: 11,
      h: 11,
      shade: false,
      shapes: [{ k: "ellipse", cx: 5, cy: 5, rx: 4, ry: 4, c: RED }],
    });
    expect(pixels[5][5]).toBe(RED);
    expect(pixels[5][1]).toBe(RED);
    expect(pixels[0][0]).toBeNull();
    const bounds = paintedBounds(pixels);
    expect(bounds).toEqual({ x: 1, y: 1, w: 9, h: 9 });
  });

  test("an ellipse with no size paints nothing", () => {
    const pixels = rasterise({
      w: 4,
      h: 4,
      shade: false,
      shapes: [{ k: "ellipse", cx: 2, cy: 2, rx: 0, ry: 3, c: RED }],
    });
    expect(countPainted(pixels)).toBe(0);
  });

  test("a line joins its two ends", () => {
    const pixels = rasterise({
      w: 8,
      h: 8,
      shade: false,
      shapes: [{ k: "line", pts: [[1, 1], [6, 6]], c: RED }],
    });
    expect(pixels[1][1]).toBe(RED);
    expect(pixels[6][6]).toBe(RED);
    expect(pixels[3][3]).toBe(RED);
  });

  test("a thick line is thicker than a thin one", () => {
    const thin = rasterise({
      w: 12,
      h: 12,
      shade: false,
      shapes: [{ k: "line", pts: [[1, 6], [10, 6]], c: RED }],
    });
    const thick = rasterise({
      w: 12,
      h: 12,
      shade: false,
      shapes: [{ k: "line", pts: [[1, 6], [10, 6]], c: RED, w: 3 }],
    });
    expect(countPainted(thick)).toBeGreaterThan(countPainted(thin));
  });

  test("a polygon fills the shape its corners describe", () => {
    const pixels = rasterise({
      w: 9,
      h: 9,
      shade: false,
      shapes: [{ k: "poly", pts: [[4, 1], [7, 7], [1, 7]], c: RED }],
    });
    expect(pixels[6][4]).toBe(RED);
    expect(pixels[1][0]).toBeNull();
    expect(countPainted(pixels)).toBeGreaterThan(8);
  });

  test("a polygon with too few corners paints nothing", () => {
    const pixels = rasterise({
      w: 6,
      h: 6,
      shade: false,
      shapes: [{ k: "poly", pts: [[1, 1], [4, 4]], c: RED }],
    });
    expect(countPainted(pixels)).toBe(0);
  });

  test("single pixels land exactly where they are put", () => {
    const pixels = rasterise({
      w: 6,
      h: 6,
      shade: false,
      shapes: [{ k: "px", pts: [[1, 2], [4, 5]], c: RED }],
    });
    expect(pixels[2][1]).toBe(RED);
    expect(pixels[5][4]).toBe(RED);
    expect(countPainted(pixels)).toBe(2);
  });

  test("noise scatters inside its own box and nowhere else", () => {
    const pixels = rasterise({
      w: 10,
      h: 10,
      shade: false,
      shapes: [{ k: "noise", x: 2, y: 2, w: 4, h: 4, c: RED, density: 0.5, seed: 7 }],
    });
    const bounds = paintedBounds(pixels);
    expect(bounds.x).toBeGreaterThanOrEqual(2);
    expect(bounds.y).toBeGreaterThanOrEqual(2);
    expect(bounds.x + bounds.w).toBeLessThanOrEqual(6);
  });

  test("noise gives the same speckles every time, so the ground never flickers", () => {
    const draw = () =>
      rasterise({
        w: 10,
        h: 10,
        shade: false,
        shapes: [{ k: "noise", x: 0, y: 0, w: 10, h: 10, c: RED, density: 0.3, seed: 3 }],
      });
    expect(draw()).toEqual(draw());
  });

  test("a shape it does not know is skipped, not thrown", () => {
    const pixels = rasterise({
      w: 4,
      h: 4,
      shade: false,
      shapes: [{ k: "hologram", c: RED }, { k: "px", pts: [[1, 1]], c: RED }],
    });
    expect(countPainted(pixels)).toBe(1);
  });

  test("anything drawn outside the picture is dropped quietly", () => {
    const pixels = rasterise({
      w: 4,
      h: 4,
      shade: false,
      shapes: [{ k: "rect", x: -5, y: -5, w: 3, h: 3, c: RED }, { k: "px", pts: [[99, 99]], c: RED }],
    });
    expect(countPainted(pixels)).toBe(0);
  });

  test("a later shape paints over an earlier one", () => {
    const pixels = rasterise({
      w: 4,
      h: 4,
      shade: false,
      shapes: [
        { k: "rect", x: 0, y: 0, w: 4, h: 4, c: RED },
        { k: "px", pts: [[2, 2]], c: "#ffffff" },
      ],
    });
    expect(pixels[2][2]).toBe("#ffffff");
  });
});

describe("mirroring", () => {
  test("flips a single pixel to the other side", () => {
    const pixels = rasterise({
      w: 8,
      h: 4,
      shade: false,
      shapes: [{ k: "px", pts: [[1, 1]], c: RED, sym: true }],
    });
    expect(pixels[1][1]).toBe(RED);
    expect(pixels[1][6]).toBe(RED);
  });

  test("keeps a rectangle the same width on both sides", () => {
    const pixels = rasterise({
      w: 10,
      h: 4,
      shade: false,
      shapes: [{ k: "rect", x: 1, y: 1, w: 3, h: 1, c: RED, sym: true }],
    });
    expect(pixels[1].slice(1, 4).every((c) => c === RED)).toBe(true);
    expect(pixels[1].slice(6, 9).every((c) => c === RED)).toBe(true);
  });

  test("produces a picture that is the same read either way", () => {
    const pixels = rasterise({
      w: 12,
      h: 12,
      shade: false,
      shapes: [
        { k: "ellipse", cx: 4, cy: 6, rx: 2, ry: 3, c: RED, sym: true },
        { k: "poly", pts: [[2, 1], [5, 1], [3, 4]], c: "#204080", sym: true },
      ],
    });
    for (const row of pixels) expect(row).toEqual([...row].reverse());
  });

  test("mirrorShape does not change the shape it was given", () => {
    const shape = { k: "rect", x: 1, y: 1, w: 2, h: 2, c: RED, sym: true };
    mirrorShape(shape, 10);
    expect(shape.x).toBe(1);
    expect(shape.sym).toBe(true);
  });

  test("a mirrored shape is not mirrored again, which would loop forever", () => {
    expect(mirrorShape({ k: "px", pts: [[1, 1]], c: RED, sym: true }, 8).sym).toBe(false);
  });
});

describe("the outline pass", () => {
  test("wraps a shape in the colour given", () => {
    const pixels = rasterise({
      w: 7,
      h: 7,
      shade: false,
      outline: "#000000",
      shapes: [{ k: "rect", x: 3, y: 3, w: 1, h: 1, c: RED }],
    });
    expect(pixels[3][3]).toBe(RED);
    expect(pixels[2][3]).toBe("#000000");
    expect(pixels[3][2]).toBe("#000000");
    // Corners stay clear: the outline only follows the four straight sides.
    expect(pixels[2][2]).toBeNull();
  });

  test("grows the shape by exactly one pixel", () => {
    const shapes = [{ k: "ellipse", cx: 8, cy: 8, rx: 4, ry: 4, c: RED }];
    const plain = paintedBounds(rasterise({ w: 17, h: 17, shade: false, shapes }));
    const outlined = paintedBounds(
      rasterise({ w: 17, h: 17, shade: false, outline: "#000000", shapes }),
    );
    expect(outlined.w).toBe(plain.w + 2);
    expect(outlined.h).toBe(plain.h + 2);
  });

  test("never paints over the shape itself", () => {
    const before = rasterise({
      w: 9,
      h: 9,
      shade: false,
      shapes: [{ k: "ellipse", cx: 4, cy: 4, rx: 3, ry: 3, c: RED }],
    });
    const after = addOutline(before, "#000000");
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (before[y][x] !== null) expect(after[y][x]).toBe(before[y][x]);
      }
    }
  });

  test("leaves an empty picture empty", () => {
    expect(countPainted(addOutline(blankPixels(5, 5), "#000000"))).toBe(0);
  });
});

describe("the shading pass", () => {
  const shapes = [{ k: "rect", x: 2, y: 2, w: 4, h: 4, c: "#808080" }];

  test("lightens the top row and darkens the bottom row", () => {
    const pixels = rasterise({ w: 8, h: 8, shapes });
    expect(pixels[2][3]).toBe(shiftColor("#808080", 26));
    expect(pixels[5][3]).toBe(shiftColor("#808080", -30));
    expect(pixels[3][3]).toBe("#808080");
  });

  test("takes the amounts it is given", () => {
    const pixels = rasterise({ w: 8, h: 8, shade: { light: 10, dark: 10 }, shapes });
    expect(pixels[2][3]).toBe(shiftColor("#808080", 10));
    expect(pixels[5][3]).toBe(shiftColor("#808080", -10));
  });

  test("can be turned off completely", () => {
    const pixels = rasterise({ w: 8, h: 8, shade: false, shapes });
    expect(pixels[2][3]).toBe("#808080");
    expect(pixels[5][3]).toBe("#808080");
  });

  test("leaves the outline dark instead of lightening the line", () => {
    const pixels = rasterise({ w: 8, h: 8, outline: "#101010", shapes });
    expect(pixels[1][3]).toBe("#101010");
    expect(pixels[6][3]).toBe("#101010");
  });

  test("reads the real silhouette, not the outline around it", () => {
    // The top row of the shape must still be lightened even with an outline on.
    const pixels = rasterise({ w: 8, h: 8, outline: "#101010", shapes });
    expect(pixels[2][3]).toBe(shiftColor("#808080", 26));
  });

  test("leaves an empty picture empty", () => {
    const empty = blankPixels(4, 4);
    expect(countPainted(addShading(empty, empty))).toBe(0);
  });
});

describe("paintedBounds", () => {
  test("gives null for a picture with nothing on it", () => {
    expect(paintedBounds(blankPixels(4, 4))).toBeNull();
  });

  test("finds the box round what was painted", () => {
    const pixels = rasterise({
      w: 10,
      h: 10,
      shade: false,
      shapes: [{ k: "px", pts: [[2, 3], [7, 8]], c: RED }],
    });
    expect(paintedBounds(pixels)).toEqual({ x: 2, y: 3, w: 6, h: 6 });
  });
});

describe("a whole drawing", () => {
  test("is the size it says it is", () => {
    const pixels = rasterise({ w: 32, h: 24, shapes: [] });
    expect(pixels.length).toBe(24);
    expect(pixels[0].length).toBe(32);
  });

  test("comes out the same every time it is drawn", () => {
    const drawing = {
      w: 16,
      h: 16,
      outline: "#1a120b",
      shapes: [
        { k: "ellipse", cx: 8, cy: 10, rx: 5, ry: 4, c: "#c2762f", sym: true },
        { k: "noise", x: 2, y: 2, w: 12, h: 6, c: "#e0a050", density: 0.2, seed: 5 },
      ],
    };
    expect(rasterise(drawing)).toEqual(rasterise(drawing));
  });
});
