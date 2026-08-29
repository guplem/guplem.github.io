// Board model for a 9x9 sudoku.
//
// Two representations travel together through the whole engine:
//   - `board`: an Int8Array of 81 digits, 0 for an empty cell, index = row * 9 + col.
//   - `cands`: a Uint16Array of 81 candidate masks. Bit (d - 1) is set when the
//     digit d is still possible in that cell. A filled cell has a mask of 0.
//
// Masks make the techniques short and fast. Every mask goes back to a digit list
// with `digitsOf` before it reaches text or the DOM.

import { DEFAULT_LANGUAGE, t } from "./i18n.js";

export const SIZE = 9;
export const CELL_COUNT = 81;
/** Mask with all nine digits set. */
export const ALL_DIGITS = 0b111111111;

export const rowOf = (cell) => Math.floor(cell / SIZE);
export const colOf = (cell) => cell % SIZE;
export const boxOf = (cell) => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3);
export const cellAt = (row, col) => row * SIZE + col;

/** Mask bit for one digit (1-9). */
export const bitOf = (digit) => 1 << (digit - 1);
/** True when the mask still allows the digit. */
export const hasDigit = (mask, digit) => (mask & bitOf(digit)) !== 0;
/** Mask built from a list of digits. */
export const maskOf = (digits) => digits.reduce((mask, digit) => mask | bitOf(digit), 0);

/** How many digits a mask allows. */
export function countDigits(mask) {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count += 1;
  }
  return count;
}

/** The digits a mask allows, in ascending order. */
export function digitsOf(mask) {
  const digits = [];
  for (let digit = 1; digit <= SIZE; digit += 1) if (hasDigit(mask, digit)) digits.push(digit);
  return digits;
}

/**
 * The 27 houses (unit groups) of the board: 9 rows, 9 columns, 9 boxes.
 * A house holds the 9 cell indexes that must contain the digits 1-9 once each.
 */
export const HOUSES = (() => {
  const houses = [];
  for (let row = 0; row < SIZE; row += 1) {
    houses.push({ id: houses.length, type: "row", index: row, cells: Array.from({ length: SIZE }, (_, col) => cellAt(row, col)) });
  }
  for (let col = 0; col < SIZE; col += 1) {
    houses.push({ id: houses.length, type: "col", index: col, cells: Array.from({ length: SIZE }, (_, row) => cellAt(row, col)) });
  }
  for (let box = 0; box < SIZE; box += 1) {
    const top = Math.floor(box / 3) * 3;
    const left = (box % 3) * 3;
    const cells = [];
    for (let dr = 0; dr < 3; dr += 1) for (let dc = 0; dc < 3; dc += 1) cells.push(cellAt(top + dr, left + dc));
    houses.push({ id: houses.length, type: "box", index: box, cells });
  }
  return houses;
})();

export const ROW_HOUSES = HOUSES.filter((house) => house.type === "row");
export const COL_HOUSES = HOUSES.filter((house) => house.type === "col");
export const BOX_HOUSES = HOUSES.filter((house) => house.type === "box");

/** For each cell, the ids of its row, column and box house, in that order. */
export const HOUSES_OF_CELL = (() => {
  const map = Array.from({ length: CELL_COUNT }, () => []);
  for (const house of HOUSES) for (const cell of house.cells) map[cell].push(house.id);
  return map;
})();

/** For each cell, the 20 other cells that share a house with it. */
export const PEERS = (() => {
  const peers = Array.from({ length: CELL_COUNT }, () => new Set());
  for (const house of HOUSES) {
    for (const a of house.cells) for (const b of house.cells) if (a !== b) peers[a].add(b);
  }
  return peers.map((set) => Array.from(set).sort((a, b) => a - b));
})();

const PEER_SETS = PEERS.map((list) => new Set(list));

/** True when the two cells share a row, a column or a box. */
export function sees(a, b) {
  return a !== b && PEER_SETS[a].has(b);
}

/** Human name of a cell, in the row-column form solvers use: `r4c7`. */
export function cellName(cell) {
  return `r${rowOf(cell) + 1}c${colOf(cell) + 1}`;
}

/**
 * Human name of a house id: `row 4`, `column 7`, `box 3`, translated.
 * @param {string} [lang] language code
 */
export function houseName(houseId, lang = DEFAULT_LANGUAGE) {
  const house = HOUSES[houseId];
  return t(lang, `house.${house.type}`, { n: house.index + 1 });
}

/** The word for the kind of line a house is: `row` or `column`. */
export function lineWord(houseId, lang = DEFAULT_LANGUAGE) {
  return t(lang, `houseWord.${HOUSES[houseId].type}`);
}

/** `same row`, `same column` or `same box`, for a cell and something it sees. */
export function relationWord(houseId, lang = DEFAULT_LANGUAGE) {
  return t(lang, `relation.${HOUSES[houseId].type}`);
}

/** The id of the house of the given type that holds the cell. */
export function houseIdOf(cell, type) {
  return HOUSES_OF_CELL[cell].find((id) => HOUSES[id].type === type);
}

/**
 * Read a board from text. Digits 1-9 fill a cell; `0`, `.`, `_` and `-` mark an
 * empty one. Every other character is ignored, so a grid pasted with line
 * breaks, pipes or spaces parses without cleanup.
 * @throws {Error} when the text does not hold exactly 81 cell characters.
 */
export function parseBoard(text) {
  const board = new Int8Array(CELL_COUNT);
  let count = 0;
  for (const char of String(text)) {
    let value = null;
    if (char >= "1" && char <= "9") value = Number(char);
    else if (char === "0" || char === "." || char === "_" || char === "-") value = 0;
    if (value === null) continue;
    if (count >= CELL_COUNT) throw new Error(`Too many cells: expected ${CELL_COUNT}`);
    board[count] = value;
    count += 1;
  }
  if (count !== CELL_COUNT) throw new Error(`Expected ${CELL_COUNT} cells, found ${count}`);
  return board;
}

/** Write a board as one line of 81 characters. */
export function formatBoard(board, emptyChar = ".") {
  let text = "";
  for (let cell = 0; cell < CELL_COUNT; cell += 1) text += board[cell] === 0 ? emptyChar : String(board[cell]);
  return text;
}

/** A copy of the board, safe to mutate. */
export function cloneBoard(board) {
  return Int8Array.from(board);
}

/** An empty board. */
export function emptyBoard() {
  return new Int8Array(CELL_COUNT);
}

/** How many cells still hold no digit. */
export function emptyCount(board) {
  let count = 0;
  for (let cell = 0; cell < CELL_COUNT; cell += 1) if (board[cell] === 0) count += 1;
  return count;
}

export function isComplete(board) {
  return emptyCount(board) === 0;
}

/**
 * Candidate masks for every cell. A filled cell gets 0. An empty cell gets every
 * digit that no peer already holds.
 */
export function computeCandidates(board) {
  const cands = new Uint16Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (board[cell] !== 0) continue;
    let mask = ALL_DIGITS;
    for (const peer of PEERS[cell]) if (board[peer] !== 0) mask &= ~bitOf(board[peer]);
    cands[cell] = mask;
  }
  return cands;
}

/**
 * Board plus its candidate masks, the input every technique reads.
 *
 * `unique` says that this grid has exactly one solution. Most techniques do not
 * care. The uniqueness techniques (Unique Rectangle, BUG+1) are sound only when
 * it is true, so it defaults to false and a caller must prove it first.
 * @param {Int8Array} board the grid
 * @param {{unique?: boolean}} [options]
 */
export function makeState(board, { unique = false } = {}) {
  return { board, cands: computeCandidates(board), unique };
}

/**
 * Pairs of filled cells that hold the same digit inside one house.
 * An empty result means the digits placed so far break no rule.
 */
export function findConflicts(board) {
  const conflicts = [];
  for (const house of HOUSES) {
    const seen = new Map();
    for (const cell of house.cells) {
      const digit = board[cell];
      if (digit === 0) continue;
      if (seen.has(digit)) conflicts.push({ digit, cells: [seen.get(digit), cell], house: house.id });
      else seen.set(digit, cell);
    }
  }
  return conflicts;
}

/** True when no house repeats a digit. */
export function isConsistent(board) {
  return findConflicts(board).length === 0;
}

/**
 * Empty cells that no digit can fill any more. They prove the grid is broken
 * even when no two placed digits collide.
 */
export function findDeadCells(board, cands = computeCandidates(board)) {
  const dead = [];
  for (let cell = 0; cell < CELL_COUNT; cell += 1) if (board[cell] === 0 && cands[cell] === 0) dead.push(cell);
  return dead;
}
