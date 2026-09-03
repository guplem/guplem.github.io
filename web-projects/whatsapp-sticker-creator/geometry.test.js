import { describe, expect, test } from "bun:test";
import {
  CANVAS_SIZE,
  DEFAULT_PADDING,
  centredSquare,
  clampCrop,
  fitToCanvas,
  growBox,
  moveCrop,
  placeOnCanvas,
  toSourcePoint,
} from "./geometry.js";

describe("the canvas constants", () => {
  test("use WhatsApp's fixed sticker size", () => {
    expect(CANVAS_SIZE).toBe(512);
  });

  test("leave room for the 8 pixel stroke WhatsApp recommends", () => {
    expect(DEFAULT_PADDING).toBeGreaterThanOrEqual(8);
  });
});

describe("centredSquare", () => {
  test("takes the middle of a wide picture", () => {
    expect(centredSquare(200, 100)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });

  test("takes the middle of a tall picture", () => {
    expect(centredSquare(100, 300)).toEqual({ x: 0, y: 100, width: 100, height: 100 });
  });

  test("takes all of a square picture", () => {
    expect(centredSquare(120, 120)).toEqual({ x: 0, y: 0, width: 120, height: 120 });
  });

  test("returns whole pixels for an odd size", () => {
    const crop = centredSquare(101, 100);
    expect(Number.isInteger(crop.x)).toBe(true);
    expect(crop.width).toBe(100);
  });
});

describe("clampCrop", () => {
  test("leaves a crop that already fits alone", () => {
    const crop = { x: 10, y: 20, width: 50, height: 60 };
    expect(clampCrop(crop, 200, 200)).toEqual(crop);
  });

  test("pulls a crop back inside the picture", () => {
    // Dragged off the right edge: it slides back rather than being refused,
    // because a drag that stops responding at the edge feels broken.
    expect(clampCrop({ x: 180, y: 0, width: 50, height: 50 }, 200, 200)).toEqual({
      x: 150,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  test("pulls a crop back from a negative position", () => {
    expect(clampCrop({ x: -30, y: -10, width: 50, height: 50 }, 200, 200)).toMatchObject({
      x: 0,
      y: 0,
    });
  });

  test("shrinks a crop larger than the picture", () => {
    expect(clampCrop({ x: 0, y: 0, width: 900, height: 900 }, 200, 150)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 150,
    });
  });

  test("grows a crop below the minimum size", () => {
    expect(clampCrop({ x: 0, y: 0, width: 2, height: 2 }, 200, 200, { minSize: 20 })).toMatchObject(
      { width: 20, height: 20 },
    );
  });

  test("turns a crop dragged inside out into a positive one", () => {
    // A drag upwards and to the left produces negative sizes.
    expect(
      clampCrop({ x: 10, y: 10, width: -40, height: -40 }, 200, 200, { minSize: 4 }),
    ).toMatchObject({ width: 40, height: 40 });
  });

  test("keeps a crop square when asked", () => {
    expect(
      clampCrop({ x: 0, y: 0, width: 80, height: 40 }, 200, 200, { square: true }),
    ).toMatchObject({ width: 40, height: 40 });
  });

  test("never asks for a minimum the picture cannot give", () => {
    // A tiny source picture must not produce a crop bigger than itself.
    const crop = clampCrop({ x: 0, y: 0, width: 4, height: 4 }, 8, 8, { minSize: 64 });
    expect(crop.width).toBeLessThanOrEqual(8);
    expect(crop.height).toBeLessThanOrEqual(8);
  });
});

describe("moveCrop", () => {
  test("shifts a crop by the drag", () => {
    expect(moveCrop({ x: 10, y: 10, width: 40, height: 40 }, 5, -5, 200, 200)).toMatchObject({
      x: 15,
      y: 5,
    });
  });

  test("stops at the edge instead of leaving the picture", () => {
    expect(moveCrop({ x: 150, y: 0, width: 50, height: 50 }, 40, 0, 200, 200)).toMatchObject({
      x: 150,
    });
  });

  test("keeps the size while moving", () => {
    expect(moveCrop({ x: 10, y: 10, width: 40, height: 30 }, 500, 500, 200, 200)).toMatchObject({
      width: 40,
      height: 30,
    });
  });
});

describe("placeOnCanvas", () => {
  test("scales a square subject to fill the canvas minus the margin", () => {
    // 512 with 16 either side leaves 480 of room, and a 240 wide subject
    // therefore doubles.
    const placement = placeOnCanvas({ x: 0, y: 0, width: 240, height: 240 });
    expect(placement.scale).toBeCloseTo(2, 5);
    expect(placement.width).toBeCloseTo(480, 5);
  });

  test("centres the subject on the canvas", () => {
    const placement = placeOnCanvas({ x: 0, y: 0, width: 240, height: 240 });
    expect(placement.dx).toBeCloseTo(16, 5);
    expect(placement.dy).toBeCloseTo(16, 5);
  });

  test("scales by the longer side, so nothing is clipped", () => {
    const placement = placeOnCanvas({ x: 0, y: 0, width: 480, height: 240 });
    expect(placement.scale).toBeCloseTo(1, 5);
    expect(placement.width).toBeCloseTo(480, 5);
    expect(placement.height).toBeCloseTo(240, 5);
  });

  test("centres a subject that is not square on both axes", () => {
    const placement = placeOnCanvas({ x: 0, y: 0, width: 480, height: 240 });
    expect(placement.dx).toBeCloseTo(16, 5);
    // 512 minus 240, halved.
    expect(placement.dy).toBeCloseTo(136, 5);
  });

  test("steps back by where the subject starts in the source", () => {
    // The caller draws the whole source in one go, so the offset has to undo
    // the subject's own position. A subject starting at 100 with scale 2
    // needs 200 taken off.
    const placement = placeOnCanvas({ x: 100, y: 50, width: 240, height: 240 });
    expect(placement.scale).toBeCloseTo(2, 5);
    expect(placement.dx).toBeCloseTo(16 - 200, 5);
    expect(placement.dy).toBeCloseTo(16 - 100, 5);
  });

  test("puts the subject exactly inside the margin, whatever its position", () => {
    // The real check: after the transform, does the subject land where the
    // margin says it should?
    for (const content of [
      { x: 0, y: 0, width: 240, height: 240 },
      { x: 37, y: 210, width: 91, height: 400 },
      { x: 500, y: 1, width: 1200, height: 300 },
    ]) {
      const { scale, dx, dy } = placeOnCanvas(content);
      const left = dx + content.x * scale;
      const right = dx + (content.x + content.width) * scale;
      const top = dy + content.y * scale;
      const bottom = dy + (content.y + content.height) * scale;
      expect(left).toBeGreaterThanOrEqual(DEFAULT_PADDING - 0.001);
      expect(top).toBeGreaterThanOrEqual(DEFAULT_PADDING - 0.001);
      expect(right).toBeLessThanOrEqual(CANVAS_SIZE - DEFAULT_PADDING + 0.001);
      expect(bottom).toBeLessThanOrEqual(CANVAS_SIZE - DEFAULT_PADDING + 0.001);
    }
  });

  test("honours a wider margin", () => {
    const placement = placeOnCanvas({ x: 0, y: 0, width: 100, height: 100 }, { padding: 56 });
    expect(placement.width).toBeCloseTo(400, 5);
    expect(placement.dx).toBeCloseTo(56, 5);
  });

  test("refuses to enlarge past a ceiling when given one", () => {
    // A 20 pixel subject stretched to 480 is a blurry mess, so a caller can
    // cap the enlargement and accept a smaller sticker.
    const placement = placeOnCanvas({ x: 0, y: 0, width: 20, height: 20 }, { maxScale: 4 });
    expect(placement.scale).toBe(4);
    expect(placement.width).toBe(80);
    // Still centred, just smaller.
    expect(placement.dx).toBeCloseTo((512 - 80) / 2, 5);
  });

  test("survives an empty box rather than dividing by zero", () => {
    const placement = placeOnCanvas({ x: 0, y: 0, width: 0, height: 0 });
    expect(Number.isFinite(placement.scale)).toBe(true);
    expect(Number.isFinite(placement.dx)).toBe(true);
  });
});

describe("fitToCanvas", () => {
  test("cover fills the square and lets the long side spill", () => {
    const placement = fitToCanvas(1000, 500, { mode: "cover" });
    // Scaling by the shorter side means the height reaches 512 exactly.
    expect(placement.scale).toBeCloseTo(512 / 500, 5);
    expect(placement.height).toBeCloseTo(512, 5);
    expect(placement.width).toBeGreaterThan(512);
  });

  test("cover centres the spill, so the middle survives", () => {
    const placement = fitToCanvas(1000, 500, { mode: "cover" });
    expect(placement.dx).toBeCloseTo((512 - placement.width) / 2, 5);
    expect(placement.dx).toBeLessThan(0);
  });

  test("contain shows all of the picture", () => {
    const placement = fitToCanvas(1000, 500, { mode: "contain" });
    expect(placement.width).toBeLessThanOrEqual(512);
    expect(placement.height).toBeLessThanOrEqual(512);
    expect(placement.width).toBeCloseTo(512, 5);
  });

  test("contain honours a margin", () => {
    const placement = fitToCanvas(1000, 500, { mode: "contain", padding: 16 });
    expect(placement.width).toBeCloseTo(480, 5);
    expect(placement.dx).toBeCloseTo(16, 5);
  });

  test("cover ignores a margin, having no empty space to give", () => {
    const withPadding = fitToCanvas(1000, 500, { mode: "cover", padding: 16 });
    const without = fitToCanvas(1000, 500, { mode: "cover" });
    expect(withPadding.scale).toBe(without.scale);
  });

  test("leaves a square picture square", () => {
    const placement = fitToCanvas(800, 800, { mode: "cover" });
    expect(placement.dx).toBeCloseTo(0, 5);
    expect(placement.width).toBeCloseTo(512, 5);
  });
});

describe("growBox", () => {
  test("adds the same margin on every side", () => {
    expect(growBox({ x: 20, y: 20, width: 10, height: 10 }, 5, 200, 200)).toEqual({
      x: 15,
      y: 15,
      width: 20,
      height: 20,
    });
  });

  test("stops at the edge of the picture", () => {
    expect(growBox({ x: 1, y: 1, width: 10, height: 10 }, 5, 12, 12)).toEqual({
      x: 0,
      y: 0,
      width: 12,
      height: 12,
    });
  });

  test("never produces an empty box", () => {
    const box = growBox({ x: 0, y: 0, width: 1, height: 1 }, 0, 1, 1);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });
});

describe("toSourcePoint", () => {
  test("undoes a placement, so a brush lands where the finger did", () => {
    const placement = placeOnCanvas({ x: 0, y: 0, width: 240, height: 240 });
    // The subject's top left sits at canvas 16, 16.
    expect(toSourcePoint(16, 16, placement)).toEqual({ x: 0, y: 0 });
  });

  test("takes the shown size into account", () => {
    // The editor shows a 512 canvas at 256 on a phone, so every touch is at
    // half the canvas coordinate. Forgetting this puts every stroke in the
    // wrong place, and only on small screens.
    const placement = { scale: 1, dx: 0, dy: 0 };
    expect(toSourcePoint(50, 50, placement, 0.5)).toEqual({ x: 100, y: 100 });
  });

  test("round-trips a point through a placement", () => {
    const content = { x: 33, y: 71, width: 190, height: 260 };
    const placement = placeOnCanvas(content);
    for (const point of [
      { x: 33, y: 71 },
      { x: 100, y: 200 },
      { x: 223, y: 331 },
    ]) {
      const onCanvas = {
        x: placement.dx + point.x * placement.scale,
        y: placement.dy + point.y * placement.scale,
      };
      const back = toSourcePoint(onCanvas.x, onCanvas.y, placement);
      expect(back.x).toBeCloseTo(point.x, 5);
      expect(back.y).toBeCloseTo(point.y, 5);
    }
  });
});
