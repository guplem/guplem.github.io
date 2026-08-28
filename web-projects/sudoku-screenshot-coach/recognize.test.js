import { describe, test, expect } from "bun:test";
import { cellAt, formatBoard, parseBoard } from "./board.js";
import { GLYPH_SIZE, normalizeGlyph } from "./vision/digits.js";
import { fontTemplates, renderSudokuScreenshot } from "./vision/testFixtures.js";
import { gridQuality, readPuzzleFromImage, repairReading } from "./recognize.js";

const PUZZLE =
  "530070000" + "600195000" + "098000060" + "800060003" + "400803001" + "700020006" + "060000280" + "000419005" + "000080079";
const TEMPLATES = fontTemplates(normalizeGlyph, GLYPH_SIZE);

/** Build the reading object the repair step consumes. */
function reading(text, { low = [], alternates = {} } = {}) {
  const digits = parseBoard(text);
  const confidences = new Float32Array(81);
  const alternateDigits = new Int8Array(81);
  for (let cell = 0; cell < 81; cell += 1) {
    if (digits[cell] === 0) continue;
    confidences[cell] = low.includes(cell) ? 0.05 : 0.9;
    alternateDigits[cell] = alternates[cell] ?? 0;
  }
  return { digits, confidences, alternates: alternateDigits };
}

describe("readPuzzleFromImage", () => {
  test("reads a puzzle out of a screenshot that holds other things", () => {
    const shot = renderSudokuScreenshot({ puzzle: PUZZLE, clutter: true });
    const result = readPuzzleFromImage(shot.rgba, shot.width, shot.height, TEMPLATES);
    expect(result.ok).toBe(true);
    expect(formatBoard(result.digits, "0")).toBe(PUZZLE);
    expect(result.quad).toHaveLength(4);
    expect(result.warped).toHaveLength(result.warpSize * result.warpSize);
    expect(result.score).toBeGreaterThan(0.8);
  });

  test("reports the grid it found, so the page can draw it over the image", () => {
    const shot = renderSudokuScreenshot({ puzzle: PUZZLE, clutter: true });
    const result = readPuzzleFromImage(shot.rgba, shot.width, shot.height, TEMPLATES);
    expect(result.quad[0].x).toBeCloseTo(shot.origin.x, -1);
    expect(result.quad[0].y).toBeCloseTo(shot.origin.y, -1);
  });

  test("explains itself when the image holds no grid", () => {
    const width = 300;
    const height = 200;
    const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
    const result = readPuzzleFromImage(rgba, width, height, TEMPLATES);
    expect(result.ok).toBe(false);
    expect(result.reason.length).toBeGreaterThan(10);
    expect(result.digits).toBeNull();
  });

  test("flags the cells it is least sure about", () => {
    const shot = renderSudokuScreenshot({ puzzle: PUZZLE, clutter: false });
    const result = readPuzzleFromImage(shot.rgba, shot.width, shot.height, TEMPLATES);
    expect(Array.isArray(result.uncertainCells)).toBe(true);
    for (const cell of result.uncertainCells) expect(result.digits[cell]).not.toBe(0);
  });
});

describe("gridQuality", () => {
  test("rates a proper puzzle highest", () => {
    expect(gridQuality(parseBoard(PUZZLE))).toBe(2);
  });

  test("rates a grid with several solutions in the middle", () => {
    const board = parseBoard(PUZZLE);
    board[cellAt(0, 0)] = 0;
    board[cellAt(0, 2)] = 0;
    board[cellAt(1, 0)] = 0;
    board[cellAt(2, 1)] = 0;
    board[cellAt(2, 2)] = 0;
    expect(gridQuality(board)).toBeLessThan(2);
  });

  test("rates a broken grid lowest", () => {
    const board = parseBoard(PUZZLE);
    board[cellAt(0, 2)] = 5; // a second 5 in row 1
    expect(gridQuality(board)).toBe(0);
  });
});

describe("repairReading", () => {
  test("leaves a puzzle that already reads correctly alone", () => {
    const result = repairReading(reading(PUZZLE));
    expect(result.repaired).toBe(false);
    expect(result.repairs).toEqual([]);
    expect(formatBoard(result.digits, "0")).toBe(PUZZLE);
  });

  test("swaps a misread digit for its runner-up when that fixes the grid", () => {
    // Read r1c3 as 5 (a second 5 in row 1) when the runner-up was 6.
    const broken = parseBoard(PUZZLE);
    broken[cellAt(0, 2)] = 5;
    const result = repairReading(
      reading(formatBoard(broken, "0"), { low: [cellAt(0, 2)], alternates: { [cellAt(0, 2)]: 4 } })
    );
    expect(result.repaired).toBe(true);
    expect(result.digits[cellAt(0, 2)]).toBe(4);
    expect(result.repairs[0]).toMatchObject({ cell: cellAt(0, 2), from: 5, to: 4 });
    expect(gridQuality(result.digits)).toBeGreaterThan(0);
  });

  test("blanks a doubtful digit when no other digit works", () => {
    const broken = parseBoard(PUZZLE);
    broken[cellAt(0, 2)] = 5;
    // No useful runner-up: the only way out is to clear the cell.
    const result = repairReading(reading(formatBoard(broken, "0"), { low: [cellAt(0, 2)], alternates: {} }));
    expect(result.repaired).toBe(true);
    expect(result.digits[cellAt(0, 2)]).toBe(0);
    expect(result.repairs[0]).toMatchObject({ from: 5, to: 0 });
  });

  test("prefers changing the cell it was least sure about", () => {
    const broken = parseBoard(PUZZLE);
    broken[cellAt(0, 2)] = 5;
    const result = repairReading(
      reading(formatBoard(broken, "0"), { low: [cellAt(0, 2)], alternates: { [cellAt(0, 2)]: 4 } })
    );
    expect(result.repairs).toHaveLength(1);
    expect(result.repairs[0].cell).toBe(cellAt(0, 2));
  });

  test("gives up cleanly when nothing it tries helps", () => {
    // Every row filled with 1s: no single change can rescue this.
    const digits = new Int8Array(81).fill(1);
    const confidences = new Float32Array(81).fill(0.5);
    const result = repairReading({ digits, confidences, alternates: new Int8Array(81) });
    expect(result.repaired).toBe(false);
    expect(result.digits).toEqual(digits);
  });
});
