// Test-only. One grid per technique in the catalogue, built to hold that pattern
// and nothing harder.
//
// Two test files read this module. `techniques.test.js` checks that each finder
// reports the move the fixture was built for. `explain.test.js` checks that each
// move turns into finished sentences in every language. Keeping the grids in one
// place means a new technique needs one fixture, and both checks then cover it.
//
// Most fixtures are candidate grids rather than real puzzles: the board is empty
// and the candidates are set by hand, so one pattern stands alone. The two
// uniqueness techniques need more. They argue from the puzzle having exactly one
// answer, so their fixtures are real grids and carry `unique: true`.

import { ALL_DIGITS, CELL_COUNT, cellAt, computeCandidates, emptyBoard, maskOf, parseBoard } from "./board.js";

/**
 * A state whose board is empty and whose candidates start as "anything", then
 * get narrowed by the given overrides.
 * @param {Record<number, number[]>} overrides cell index -> allowed digits
 * @param {Array<{cells: number[], remove: number[]}>} strips digits to drop from cells
 */
export function candState(overrides = {}, strips = []) {
  const cands = new Uint16Array(CELL_COUNT).fill(ALL_DIGITS);
  for (const strip of strips) {
    for (const cell of strip.cells) for (const digit of strip.remove) cands[cell] &= ~(1 << (digit - 1));
  }
  for (const [cell, digits] of Object.entries(overrides)) cands[Number(cell)] = maskOf(digits);
  return { board: emptyBoard(), cands, unique: false };
}

const rowCells = (row) => Array.from({ length: 9 }, (_, col) => cellAt(row, col));
const colCells = (col) => Array.from({ length: 9 }, (_, row) => cellAt(row, col));
const boxCells = (box) => {
  const top = Math.floor(box / 3) * 3;
  const left = (box % 3) * 3;
  const cells = [];
  for (let dr = 0; dr < 3; dr += 1) for (let dc = 0; dc < 3; dc += 1) cells.push(cellAt(top + dr, left + dc));
  return cells;
};

/** Keep the digit in `keep` only, across the cells of `cells`. */
const only = (cells, keep, digit) => ({ cells: cells.filter((cell) => !keep.includes(cell)), remove: [digit] });

/** A real grid, with the candidates the rules alone give it. */
function boardState(text, unique = true) {
  const board = parseBoard(text);
  return { board, cands: computeCandidates(board), unique };
}

/** Row 1 holds 1 to 8, so r1c9 can only be 9. */
function nakedSingleState() {
  const board = emptyBoard();
  for (let col = 0; col < 8; col += 1) board[cellAt(0, col)] = col + 1;
  return { board, cands: computeCandidates(board), unique: false };
}

// A grid whose plain candidates are a BUG+1: every empty cell holds two
// candidates except r9c8, which holds three. Found by walking real puzzles and
// checking the shape at every step. Its one solution puts 6 in r9c8.
export const BUG_PLUS_ONE_GRID =
  "2653489..37125948698467132565298713484.12365.13..6.8.2423.9.7..79..125.351.73.2..";

/**
 * One fixture per technique id, keyed by id.
 * `expect` records what the fixture was built to produce, so a test can state
 * the pattern once and check the finder against it.
 */
export const TECHNIQUE_FIXTURES = {
  "naked-single": {
    state: nakedSingleState(),
    expect: { placements: [{ cell: cellAt(0, 8), digit: 9 }] },
  },

  "hidden-single": {
    // 7 fits only in r1c1 across row 1.
    state: candState({}, [{ cells: rowCells(0).slice(1), remove: [7] }]),
    expect: { placements: [{ cell: cellAt(0, 0), digit: 7 }] },
  },

  pointing: {
    // In box 1, 5 fits only in r1c1 and r1c3, which share row 1.
    state: candState({}, [only(boxCells(0), [cellAt(0, 0), cellAt(0, 2)], 5)]),
    expect: { digits: [5], eliminationCount: 6 },
  },

  claiming: {
    // In row 1, 5 fits only in the first three cells, which share box 1.
    state: candState({}, [{ cells: rowCells(0).slice(3), remove: [5] }]),
    expect: { digits: [5], eliminationCount: 6 },
  },

  "naked-pair": {
    state: candState({ [cellAt(0, 0)]: [1, 2], [cellAt(0, 1)]: [1, 2] }),
    expect: { digits: [1, 2], eliminationCount: 14 },
  },

  "hidden-pair": {
    // 4 and 5 live only in r1c1 and r1c2 across row 1.
    state: candState({ [cellAt(0, 0)]: [1, 2, 4, 5], [cellAt(0, 1)]: [3, 4, 5] }, [
      { cells: rowCells(0).slice(2), remove: [4, 5] },
    ]),
    expect: { digits: [4, 5], eliminationCount: 3 },
  },

  "naked-triple": {
    state: candState({ [cellAt(0, 0)]: [1, 2], [cellAt(0, 1)]: [2, 3], [cellAt(0, 2)]: [1, 3] }),
    expect: { digits: [1, 2, 3], eliminationCount: 18 },
  },

  "hidden-triple": {
    state: candState({ [cellAt(0, 0)]: [1, 4, 5], [cellAt(0, 1)]: [2, 5, 6], [cellAt(0, 2)]: [3, 4, 6] }, [
      { cells: rowCells(0).slice(3), remove: [4, 5, 6] },
    ]),
    expect: { digits: [4, 5, 6], eliminationCount: 3 },
  },

  "naked-quad": {
    state: candState({
      [cellAt(0, 0)]: [1, 2],
      [cellAt(0, 1)]: [2, 3],
      [cellAt(0, 2)]: [3, 4],
      [cellAt(0, 3)]: [1, 4],
    }),
    expect: { digits: [1, 2, 3, 4], eliminationCount: 20 },
  },

  "hidden-quad": {
    // 4, 5, 6 and 7 fit only in the first four cells of row 1.
    state: candState(
      {
        [cellAt(0, 0)]: [1, 4, 5],
        [cellAt(0, 1)]: [2, 5, 6],
        [cellAt(0, 2)]: [3, 6, 7],
        [cellAt(0, 3)]: [1, 4, 7],
      },
      [{ cells: rowCells(0).slice(4), remove: [4, 5, 6, 7] }]
    ),
    expect: { digits: [4, 5, 6, 7], eliminationCount: 4 },
  },

  "x-wing": {
    // 3 sits only in columns 2 and 7 of rows 1 and 5.
    state: candState({}, [
      only([...rowCells(0), ...rowCells(4)], [cellAt(0, 1), cellAt(0, 6), cellAt(4, 1), cellAt(4, 6)], 3),
    ]),
    expect: { digits: [3], eliminationCount: 14 },
  },

  "y-wing": {
    state: candState({
      [cellAt(0, 0)]: [1, 2], // pivot
      [cellAt(0, 4)]: [1, 3], // pincer in the same row
      [cellAt(4, 0)]: [2, 3], // pincer in the same column
    }),
    expect: { digits: [3], eliminationCount: 1 },
  },

  swordfish: {
    state: candState({}, [
      only(
        [...rowCells(0), ...rowCells(3), ...rowCells(6)],
        [cellAt(0, 1), cellAt(0, 4), cellAt(3, 4), cellAt(3, 7), cellAt(6, 1), cellAt(6, 7)],
        3
      ),
    ]),
    expect: { digits: [3], eliminationCount: 18 },
  },

  "xyz-wing": {
    state: candState({
      [cellAt(0, 0)]: [1, 2, 3], // pivot, three candidates
      [cellAt(0, 1)]: [1, 3], // pincer in the same row and box
      [cellAt(4, 0)]: [2, 3], // pincer in the same column
    }),
    expect: { digits: [3], eliminationCount: 2 },
  },

  skyscraper: {
    // 5 has two places in row 1 and two in row 2. One place of each sits in
    // column 1, so the roof is r1c5 and r2c6.
    state: candState({}, [
      only(rowCells(0), [cellAt(0, 0), cellAt(0, 4)], 5),
      only(rowCells(1), [cellAt(1, 0), cellAt(1, 5)], 5),
    ]),
    expect: { digits: [5], eliminationCount: 3 },
  },

  "two-string-kite": {
    // 4 has two places in row 3 and two in column 2. r3c1 and r1c2 share box 1,
    // so the far ends are r3c8 and r6c2.
    state: candState({}, [
      only(rowCells(2), [cellAt(2, 0), cellAt(2, 7)], 4),
      only(colCells(1), [cellAt(0, 1), cellAt(5, 1)], 4),
    ]),
    expect: { digits: [4], eliminationCount: 1 },
  },

  "w-wing": {
    // r1c1 and r5c5 both hold {1,2}. In row 9, 2 has only two places, one seen
    // by each of them, so one of the two cells has to be 1.
    state: candState({ [cellAt(0, 0)]: [1, 2], [cellAt(4, 4)]: [1, 2] }, [
      only(rowCells(8), [cellAt(8, 0), cellAt(8, 4)], 2),
    ]),
    expect: { digits: [1], eliminationCount: 2 },
  },

  jellyfish: {
    // 3 sits only in columns 2, 4, 6 and 8 across rows 1, 3, 5 and 7.
    state: candState({}, [
      only(
        [...rowCells(0), ...rowCells(2), ...rowCells(4), ...rowCells(6)],
        [
          cellAt(0, 1), cellAt(0, 3),
          cellAt(2, 3), cellAt(2, 5),
          cellAt(4, 5), cellAt(4, 7),
          cellAt(6, 7), cellAt(6, 1),
        ],
        3
      ),
    ]),
    expect: { digits: [3], eliminationCount: 20 },
  },

  "remote-pairs": {
    // Four cells holding {3,4}, each seeing the next. The ends r1c1 and r5c6 do
    // not see each other, so they always differ.
    state: candState({
      [cellAt(0, 0)]: [3, 4],
      [cellAt(0, 1)]: [3, 4],
      [cellAt(4, 1)]: [3, 4],
      [cellAt(4, 5)]: [3, 4],
    }),
    expect: { digits: [3, 4], eliminationCount: 4 },
  },

  "simple-coloring": {
    // 6 has two places in row 1, two in column 1 and two in row 6. The chain
    // covers r1c1, r1c5, r6c1 and r6c3, in two colours.
    state: candState({}, [
      only(rowCells(0), [cellAt(0, 0), cellAt(0, 4)], 6),
      only(colCells(0), [cellAt(0, 0), cellAt(5, 0)], 6),
      only(rowCells(5), [cellAt(5, 0), cellAt(5, 2)], 6),
    ]),
    expect: { digits: [6], eliminationCount: 4, variant: "trap" },
  },

  "unique-rectangle": {
    // r1c1, r1c5, r2c1 and r2c5 all allow {1,2}, and only r2c5 holds anything
    // else. It has to take that extra digit. This is a Type 1.
    state: candState(
      {
        [cellAt(0, 0)]: [1, 2],
        [cellAt(0, 4)]: [1, 2],
        [cellAt(1, 0)]: [1, 2],
        [cellAt(1, 4)]: [1, 2, 5],
      },
      [{ cells: Array.from({ length: CELL_COUNT }, (_, cell) => cell), remove: [1, 2] }]
    ),
    unique: true,
    expect: { digits: [1, 2], eliminationCount: 2, variant: "1" },
  },

  "bug-plus-one": {
    state: boardState(BUG_PLUS_ONE_GRID),
    expect: { placements: [{ cell: cellAt(8, 7), digit: 6 }] },
  },

  "xy-chain": {
    // {1,2} to {2,3} to {3,4} to {4,1}: both ends still allow 1.
    state: candState({
      [cellAt(0, 0)]: [1, 2],
      [cellAt(0, 4)]: [2, 3],
      [cellAt(4, 4)]: [3, 4],
      [cellAt(4, 8)]: [1, 4],
    }),
    expect: { digits: [1], eliminationCount: 2 },
  },
};

/**
 * The fixture state for a technique, with `unique` already set the way that
 * technique needs it.
 */
export function fixtureState(id) {
  const fixture = TECHNIQUE_FIXTURES[id];
  if (!fixture) throw new Error(`No fixture for technique: ${id}`);
  return { ...fixture.state, unique: fixture.unique === true || fixture.state.unique === true };
}
