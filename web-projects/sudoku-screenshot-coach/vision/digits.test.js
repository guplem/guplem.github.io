import { describe, test, expect } from "bun:test";
import { toGray } from "./imaging.js";
import { findGrid } from "./detect.js";
import { GLYPH_SIZE, classifyGlyph, cellRegion, inkBoundingBox, normalizeGlyph, readGrid } from "./digits.js";
import { fontTemplates, glyphMask, renderSudokuScreenshot } from "./testFixtures.js";

const PUZZLE =
  "530070000" + "600195000" + "098000060" + "800060003" + "400803001" + "700020006" + "060000280" + "000419005" + "000080079";
const DENSE = "123456789456789123789123456214365897365897214897214365531642978642978531978531642";

const TEMPLATES = fontTemplates(normalizeGlyph, GLYPH_SIZE);

/** Read a rendered screenshot end to end and return the digits as one string. */
function readScreenshot(options) {
  const shot = renderSudokuScreenshot(options);
  const gray = toGray(shot.rgba, shot.width, shot.height);
  const found = findGrid(gray, shot.width, shot.height);
  expect(found).not.toBeNull();
  return { shot, found, result: readGrid(found.warped, found.warpSize, TEMPLATES) };
}

describe("cellRegion", () => {
  test("splits the flattened grid into 81 equal cells", () => {
    const region = cellRegion(0, 0, 432);
    expect(region.size).toBe(48);
    expect(region).toMatchObject({ x: 0, y: 0 });
    expect(cellRegion(8, 8, 432)).toMatchObject({ x: 384, y: 384, size: 48 });
  });
});

describe("inkBoundingBox", () => {
  test("wraps the ink tightly", () => {
    const mask = new Uint8Array(10 * 10);
    for (let y = 3; y < 7; y += 1) for (let x = 2; x < 5; x += 1) mask[y * 10 + x] = 1;
    expect(inkBoundingBox(mask, 10, 10)).toEqual({ x: 2, y: 3, width: 3, height: 4, count: 12 });
  });

  test("returns null for a blank patch", () => {
    expect(inkBoundingBox(new Uint8Array(16), 4, 4)).toBeNull();
  });
});

describe("normalizeGlyph", () => {
  test("produces the same picture whatever size the digit was drawn at", () => {
    const small = glyphMask(7, 3);
    const large = glyphMask(7, 9);
    const a = normalizeGlyph(small.mask, small.width, small.height, { x: 0, y: 0, width: small.width, height: small.height }, GLYPH_SIZE);
    const b = normalizeGlyph(large.mask, large.width, large.height, { x: 0, y: 0, width: large.width, height: large.height }, GLYPH_SIZE);
    let difference = 0;
    for (let i = 0; i < a.vector.length; i += 1) difference += Math.abs(a.vector[i] - b.vector[i]);
    expect(difference / a.vector.length).toBeLessThan(0.12);
    expect(a.aspect).toBeCloseTo(b.aspect, 2);
  });

  test("ignores ink that lies outside the box it was given", () => {
    // A narrow digit, such as a 1, is scaled up a lot to fill the square. Without
    // a hard edge at the box, the sampling reaches sideways into whatever else
    // the cell holds, and the picture stops being the digit.
    const width = 40;
    const height = 40;
    const patch = new Uint8Array(width * height);
    for (let y = 8; y < 32; y += 1) for (let x = 19; x < 22; x += 1) patch[y * width + x] = 1; // the "1"
    const box = { x: 19, y: 8, width: 3, height: 24 };
    const clean = normalizeGlyph(patch, width, height, box, GLYPH_SIZE);

    // Now add a pencil mark to the side, well outside the box.
    for (let y = 8; y < 14; y += 1) for (let x = 2; x < 8; x += 1) patch[y * width + x] = 1;
    const withNoise = normalizeGlyph(patch, width, height, box, GLYPH_SIZE);

    expect([...withNoise.vector]).toEqual([...clean.vector]);
  });

  test("keeps the vector inside 0 and 1", () => {
    const { mask, width, height } = glyphMask(8, 4);
    const glyph = normalizeGlyph(mask, width, height, { x: 0, y: 0, width, height }, GLYPH_SIZE);
    expect(glyph.vector).toHaveLength(GLYPH_SIZE * GLYPH_SIZE);
    for (const value of glyph.vector) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("classifyGlyph", () => {
  test("recognises every digit it was trained on", () => {
    for (let digit = 1; digit <= 9; digit += 1) {
      const { mask, width, height } = glyphMask(digit, 7);
      const glyph = normalizeGlyph(mask, width, height, { x: 0, y: 0, width, height }, GLYPH_SIZE);
      const guess = classifyGlyph(glyph, TEMPLATES);
      expect(guess.digit).toBe(digit);
      expect(guess.confidence).toBeGreaterThan(0);
    }
  });

  test("reports a runner-up so a doubtful cell can be repaired later", () => {
    const { mask, width, height } = glyphMask(8, 6);
    const guess = classifyGlyph(normalizeGlyph(mask, width, height, { x: 0, y: 0, width, height }, GLYPH_SIZE), TEMPLATES);
    expect(guess.runnerUp).toBeGreaterThanOrEqual(1);
    expect(guess.runnerUp).not.toBe(guess.digit);
  });

  test("returns nothing when there are no templates", () => {
    const { mask, width, height } = glyphMask(3, 4);
    expect(classifyGlyph(normalizeGlyph(mask, width, height, { x: 0, y: 0, width, height }, GLYPH_SIZE), [])).toBeNull();
  });
});

describe("readGrid", () => {
  test("reads every digit of a clean screenshot", () => {
    const { result } = readScreenshot({ puzzle: PUZZLE, clutter: false });
    expect(result.text).toBe(PUZZLE.replace(/0/g, "."));
  });

  test("reads the puzzle out of a cluttered screenshot", () => {
    const { result } = readScreenshot({ puzzle: PUZZLE, clutter: true });
    expect(result.text).toBe(PUZZLE.replace(/0/g, "."));
  });

  test("reads a full grid, with no cell mistaken for empty", () => {
    const { result } = readScreenshot({ puzzle: DENSE, clutter: true });
    expect(result.text).toBe(DENSE);
    expect(result.filled).toBe(81);
  });

  test("reads a light-on-dark screenshot", () => {
    const { result } = readScreenshot({ puzzle: PUZZLE, clutter: true, darkMode: true });
    expect(result.text).toBe(PUZZLE.replace(/0/g, "."));
  });

  test("reads a small puzzle inside a large screenshot", () => {
    const { result } = readScreenshot({
      puzzle: PUZZLE,
      cell: 30,
      originX: 380,
      originY: 260,
      width: 1000,
      height: 820,
      clutter: true,
    });
    expect(result.text).toBe(PUZZLE.replace(/0/g, "."));
  });

  test("marks every empty cell as empty and gives it no confidence", () => {
    const { result } = readScreenshot({ puzzle: ".".repeat(81), clutter: true });
    expect(result.text).toBe(".".repeat(81));
    expect(result.filled).toBe(0);
    for (const confidence of result.confidences) expect(confidence).toBe(0);
  });

  // A player's pencil marks are the hardest thing in a real screenshot: they are
  // digits, drawn in the same font, inside the cells. They are told apart by
  // size, so the reader measures the digits it can see and rejects anything much
  // shorter. See adr/0003.
  test("ignores the pencil marks a player writes in the corners", () => {
    const notes = {
      0: [5, 8],
      1: [8],
      9: [5, 7],
      20: [3, 6],
      21: [6],
      40: [2, 3],
      41: [6],
      60: [1, 8],
      75: [7],
      80: [1, 8],
    };
    const { result } = readScreenshot({ puzzle: PUZZLE, cell: 54, clutter: true, notes });
    expect(result.text).toBe(PUZZLE.replace(/0/g, "."));
  });

  test("ignores pencil marks that sit in the same cell as a digit", () => {
    // r1c1 holds a 5 in this puzzle; the marks around it must not change it.
    const { result } = readScreenshot({ puzzle: PUZZLE, cell: 54, clutter: false, notes: { 0: [2, 4] } });
    expect(result.text).toBe(PUZZLE.replace(/0/g, "."));
  });

  test("ignores the solid block an app paints on the selected cell", () => {
    const { result } = readScreenshot({ puzzle: PUZZLE, cell: 54, clutter: true, selectedCell: 2 });
    expect(result.text).toBe(PUZZLE.replace(/0/g, "."));
  });

  test("reports a confidence and a runner-up for every digit it reads", () => {
    const { result } = readScreenshot({ puzzle: PUZZLE, clutter: false });
    for (let cell = 0; cell < 81; cell += 1) {
      if (result.digits[cell] === 0) continue;
      expect(result.confidences[cell]).toBeGreaterThan(0);
      expect(result.alternates[cell]).toBeGreaterThanOrEqual(1);
    }
  });
});
