// Screenshot in, puzzle out.
//
// This module joins the three vision steps into one call, and then does
// something a plain reader cannot: it checks the answer against the rules of
// sudoku. A misread digit usually breaks the grid, and the rules point straight
// at the cell the reader was least sure about. That check turns "the tool read a
// 5 instead of a 6" from a silent wrong answer into a fixed one.

import { CELL_COUNT, cloneBoard, isConsistent } from "./board.js";
import { DEFAULT_LANGUAGE, t } from "./i18n.js";
import { countSolutions } from "./solver.js";
import { findGrid } from "./vision/detect.js";
import { readGrid } from "./vision/digits.js";
import { toGray } from "./vision/imaging.js";

/** Below this, a reading is worth a second look and gets flagged in the UI. */
export const LOW_CONFIDENCE = 0.18;

/**
 * How well a grid holds up against the rules.
 * @returns {number} 2 when exactly one solution exists, 1 when several do,
 *   0 when the grid breaks a rule or cannot be completed at all.
 */
export function gridQuality(board) {
  if (!isConsistent(board)) return 0;
  const count = countSolutions(board, 2);
  if (count === 0) return 0;
  return count === 1 ? 2 : 1;
}

/** A copy of the board with one cell changed. */
function withChange(board, cell, digit) {
  const next = cloneBoard(board);
  next[cell] = digit;
  return next;
}

/**
 * Try to fix a reading that breaks the rules.
 *
 * It changes the cells the reader was least sure about, one or two at a time,
 * to the runner-up digit or to blank, and keeps the first change that makes the
 * grid solvable again. It never touches a grid that already reads as one proper
 * puzzle.
 *
 * @param {{digits: Int8Array, confidences: Float32Array, alternates: Int8Array}} reading
 * @param {{maxSuspects?: number, maxPairs?: number}} [options]
 * @returns {{digits: Int8Array, repaired: boolean, repairs: Array<{cell, from, to}>, quality: number}}
 */
export function repairReading(reading, options = {}) {
  const { maxSuspects = 10, maxPairs = 5 } = options;
  const original = cloneBoard(reading.digits);
  const startQuality = gridQuality(original);
  if (startQuality === 2) return { digits: original, repaired: false, repairs: [], quality: startQuality };

  // Least confident first: that is where a misreading most likely sits.
  const suspects = [];
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (original[cell] !== 0) suspects.push({ cell, confidence: reading.confidences[cell] ?? 0 });
  }
  suspects.sort((a, b) => a.confidence - b.confidence);
  const shortlist = suspects.slice(0, maxSuspects);

  /** The digits worth trying in a cell: the runner-up first, then blank. */
  const optionsFor = (cell) => {
    const alternate = reading.alternates?.[cell] ?? 0;
    const list = [];
    if (alternate && alternate !== original[cell]) list.push(alternate);
    list.push(0);
    return list;
  };

  let best = null;
  for (const suspect of shortlist) {
    for (const replacement of optionsFor(suspect.cell)) {
      const trial = withChange(original, suspect.cell, replacement);
      const quality = gridQuality(trial);
      if (quality <= startQuality) continue;
      const repairs = [{ cell: suspect.cell, from: original[suspect.cell], to: replacement }];
      if (quality === 2) return { digits: trial, repaired: true, repairs, quality };
      if (!best || quality > best.quality) best = { digits: trial, repaired: true, repairs, quality };
    }
  }

  // Two misreadings at once are rare but do happen, so try the worst few pairs.
  const pairPool = shortlist.slice(0, maxPairs);
  for (let i = 0; i < pairPool.length; i += 1) {
    for (let j = i + 1; j < pairPool.length; j += 1) {
      for (const firstDigit of optionsFor(pairPool[i].cell)) {
        for (const secondDigit of optionsFor(pairPool[j].cell)) {
          const trial = withChange(withChange(original, pairPool[i].cell, firstDigit), pairPool[j].cell, secondDigit);
          const quality = gridQuality(trial);
          if (quality <= startQuality) continue;
          const repairs = [
            { cell: pairPool[i].cell, from: original[pairPool[i].cell], to: firstDigit },
            { cell: pairPool[j].cell, from: original[pairPool[j].cell], to: secondDigit },
          ];
          if (quality === 2) return { digits: trial, repaired: true, repairs, quality };
          if (!best || quality > best.quality) best = { digits: trial, repaired: true, repairs, quality };
        }
      }
    }
  }

  if (best) return best;
  return { digits: original, repaired: false, repairs: [], quality: startQuality };
}

/**
 * Read a puzzle out of a screenshot.
 * @param {Uint8ClampedArray} rgba the raw pixels, four bytes per pixel
 * @param {number} width
 * @param {number} height
 * @param {Array} templates reference pictures of the digits 1-9
 * @returns {{ok: boolean, reason?: string, digits: Int8Array|null, text: string,
 *   confidences: Float32Array|null, uncertainCells: number[], repairs: Array,
 *   quad: Array|null, warped: Uint8ClampedArray|null, warpSize: number, score: number,
 *   inverted: boolean, filled: number}}
 */
export function readPuzzleFromImage(rgba, width, height, templates, lang = DEFAULT_LANGUAGE) {
  const empty = {
    ok: false,
    digits: null,
    text: "",
    confidences: null,
    uncertainCells: [],
    repairs: [],
    quad: null,
    warped: null,
    warpSize: 0,
    score: 0,
    inverted: false,
    filled: 0,
  };

  const gray = toGray(rgba, width, height);
  const found = findGrid(gray, width, height);
  if (!found) {
    return {
      ...empty,
      reason: t(lang, "read.noGrid"),
    };
  }

  const reading = readGrid(found.warped, found.warpSize, templates);
  const repair = repairReading(reading);

  const uncertainCells = [];
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (repair.digits[cell] !== 0 && (reading.confidences[cell] ?? 0) < LOW_CONFIDENCE) uncertainCells.push(cell);
  }

  let text = "";
  for (let cell = 0; cell < CELL_COUNT; cell += 1) text += repair.digits[cell] === 0 ? "." : String(repair.digits[cell]);
  let filled = 0;
  for (let cell = 0; cell < CELL_COUNT; cell += 1) if (repair.digits[cell] !== 0) filled += 1;

  return {
    ok: true,
    digits: repair.digits,
    text,
    confidences: reading.confidences,
    alternates: reading.alternates,
    uncertainCells,
    repairs: repair.repairs,
    quality: repair.quality,
    quad: found.quad,
    warped: found.warped,
    warpSize: found.warpSize,
    score: found.score,
    inverted: found.inverted,
    filled,
  };
}
