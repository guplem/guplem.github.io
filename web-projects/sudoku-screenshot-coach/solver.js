// Ground-truth solver. It answers three questions the coach cannot answer with
// human techniques alone: does a completion exist, is it the only one, and what
// is it? The coach uses the answer to check the player's grid before it teaches,
// and to finish a puzzle that runs past the techniques it knows.
//
// The method is constraint propagation plus backtracking search: repeatedly fill
// every forced cell, then branch on the cell with the fewest candidates left.

import {
  ALL_DIGITS,
  CELL_COUNT,
  PEERS,
  bitOf,
  cellName,
  cloneBoard,
  computeCandidates,
  countDigits,
  digitsOf,
  emptyCount,
  findConflicts,
  formatBoard,
  houseName,
} from "./board.js";
import { DEFAULT_LANGUAGE, joinList, t } from "./i18n.js";

/**
 * Place a digit and strip it from every peer's candidates.
 * @returns {boolean} false when the placement empties some other cell, which
 *   means this branch of the search is already dead.
 */
function assign(board, cands, cell, digit) {
  board[cell] = digit;
  cands[cell] = 0;
  const bit = bitOf(digit);
  for (const peer of PEERS[cell]) {
    if (board[peer] !== 0) continue;
    if ((cands[peer] & bit) === 0) continue;
    cands[peer] &= ~bit;
    if (cands[peer] === 0) return false;
  }
  return true;
}

/**
 * Fill every cell that has only one candidate left, over and over, until no more
 * appear. This is the cheap part of the search and removes most of the branching.
 * @returns {boolean} false when the grid contradicts itself.
 */
function propagate(board, cands) {
  let progress = true;
  while (progress) {
    progress = false;
    for (let cell = 0; cell < CELL_COUNT; cell += 1) {
      if (board[cell] !== 0) continue;
      const mask = cands[cell];
      if (mask === 0) return false;
      if (countDigits(mask) === 1) {
        if (!assign(board, cands, cell, digitsOf(mask)[0])) return false;
        progress = true;
      }
    }
  }
  return true;
}

/** The empty cell with the fewest candidates, or -1 when the grid is full. */
function bestBranchCell(board, cands) {
  let best = -1;
  let bestCount = 10;
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (board[cell] !== 0) continue;
    const count = countDigits(cands[cell]);
    if (count < bestCount) {
      best = cell;
      bestCount = count;
      if (count === 2) break; // 2 is the smallest a live cell can have here
    }
  }
  return best;
}

/**
 * Depth-first search that reports every completion it finds, up to `limit`.
 * @param {(board: Int8Array) => void} onSolution called with a finished grid
 * @returns {number} how many completions it found
 */
function search(board, cands, limit, onSolution) {
  if (!propagate(board, cands)) return 0;
  const cell = bestBranchCell(board, cands);
  if (cell === -1) {
    onSolution(board);
    return 1;
  }
  let found = 0;
  for (const digit of digitsOf(cands[cell])) {
    const nextBoard = cloneBoard(board);
    const nextCands = Uint16Array.from(cands);
    if (!assign(nextBoard, nextCands, cell, digit)) continue;
    found += search(nextBoard, nextCands, limit - found, onSolution);
    if (found >= limit) break;
  }
  return found;
}

/** True when every placed digit obeys the rules so far. */
function startsLegal(board) {
  return findConflicts(board).length === 0;
}

/**
 * Solve the grid.
 * @returns {Int8Array|null} a completed grid, or null when none exists. The
 *   input board is never modified.
 */
export function solve(board) {
  if (!startsLegal(board)) return null;
  let solution = null;
  search(cloneBoard(board), computeCandidates(board), 1, (found) => {
    solution = cloneBoard(found);
  });
  return solution;
}

/**
 * Count how many ways the grid can be completed, stopping at `limit`. Use the
 * default of 2 to ask the only question that usually matters: is the solution
 * unique?
 */
export function countSolutions(board, limit = 2) {
  if (!startsLegal(board)) return 0;
  return search(cloneBoard(board), computeCandidates(board), limit, () => {});
}

/**
 * True when the grid can be completed in exactly one way.
 *
 * The uniqueness techniques argue from the fact that the puzzle has one answer,
 * so they must never run on a grid that has two. Ask this first.
 */
export function hasOneSolution(board) {
  return countSolutions(board, 2) === 1;
}

/** Plain-language summary of the first conflicts, for the status line. */
function describeConflicts(conflicts, lang) {
  const parts = conflicts.slice(0, 3).map((conflict) =>
    t(lang, "check.conflict.item", {
      digit: conflict.digit,
      house: houseName(conflict.house, lang),
      cells: joinList(lang, conflict.cells.map(cellName)),
    })
  );
  const more = conflicts.length > 3 ? t(lang, "check.conflict.more", { count: conflicts.length - 3 }) : "";
  return t(lang, "check.conflict", { list: `${joinList(lang, parts)}${more}` });
}

/**
 * Check a grid before coaching starts.
 * @param {Int8Array} board the grid to check
 * @param {string} [lang] language for the message
 * @returns {{status: "solved"|"ok"|"conflict"|"unsolvable"|"multiple",
 *   conflicts: Array, solution: Int8Array|null, solutionCount: number, message: string}}
 *   `solution` is one valid completion whenever one exists, even for a puzzle
 *   with several, so the coach can still check the player's entries.
 */
export function analyseBoard(board, lang = DEFAULT_LANGUAGE) {
  const conflicts = findConflicts(board);
  if (conflicts.length > 0) {
    return { status: "conflict", conflicts, solution: null, solutionCount: 0, message: describeConflicts(conflicts, lang) };
  }

  const solutions = [];
  const count = search(cloneBoard(board), computeCandidates(board), 2, (found) => {
    solutions.push(cloneBoard(found));
  });

  if (count === 0) {
    return {
      status: "unsolvable",
      conflicts: [],
      solution: null,
      solutionCount: 0,
      message: t(lang, "check.unsolvable"),
    };
  }
  if (count > 1) {
    return {
      status: "multiple",
      conflicts: [],
      solution: solutions[0],
      solutionCount: count,
      message: t(lang, "check.multiple"),
    };
  }
  if (emptyCount(board) === 0) {
    return { status: "solved", conflicts: [], solution: solutions[0], solutionCount: 1, message: t(lang, "check.solved") };
  }
  return { status: "ok", conflicts: [], solution: solutions[0], solutionCount: 1, message: t(lang, "check.ok") };
}

/** Digits the solution puts in cells the player left empty. Used to verify entries. */
export function wrongEntries(board, solution) {
  const wrong = [];
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (board[cell] !== 0 && solution[cell] !== 0 && board[cell] !== solution[cell]) {
      wrong.push({ cell, placed: board[cell], expected: solution[cell] });
    }
  }
  return wrong;
}

/** Debug helper: a one-line view of a grid. */
export function boardLine(board) {
  return formatBoard(board);
}

/** Every digit stays possible on an empty board; exported so tests can lean on it. */
export const FULL_MASK = ALL_DIGITS;
