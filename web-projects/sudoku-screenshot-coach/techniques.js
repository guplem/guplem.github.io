// The solving techniques a human player uses, in the order a human tries them.
//
// Every technique is a `find(state)` function that returns a Move or null. A
// Move never guesses: it reports only what the rules force, together with the
// evidence that forces it. `explain.js` turns that evidence into sentences, so
// this file stays free of prose.
//
// Move shape:
//   technique     stable id, matches the catalogue entry
//   rank          difficulty order, 1 is the easiest
//   placements    [{cell, digit}] digits the move writes into the grid
//   eliminations  [{cell, digit}] candidates the move rules out
//   digits        the digits the pattern is about
//   houses        ids of the houses the pattern lives in
//   patternCells  the cells that form the pattern
//   witnesses     [{cell, digit, target}] a placed digit that blocks `target`
//   coverHouses   for fish patterns, the houses the eliminations happen in
//
// Terms used below: a "house" is a row, a column or a box. A "candidate" is a
// digit a cell can still take. A cell "sees" another when they share a house.

import {
  BOX_HOUSES,
  CELL_COUNT,
  COL_HOUSES,
  HOUSES,
  HOUSES_OF_CELL,
  PEERS,
  ROW_HOUSES,
  bitOf,
  boxOf,
  colOf,
  countDigits,
  digitsOf,
  hasDigit,
  houseIdOf,
  rowOf,
  sees,
} from "./board.js";
import { DEFAULT_LANGUAGE, t } from "./i18n.js";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Cells of a house that are still empty. */
const emptyCellsOf = (house, board) => house.cells.filter((cell) => board[cell] === 0);

/** Empty cells of a house that still allow the digit. */
const placesFor = (house, state, digit) =>
  house.cells.filter((cell) => state.board[cell] === 0 && hasDigit(state.cands[cell], digit));

/** True when the digit already sits somewhere in the house. */
const houseHasDigit = (house, board, digit) => house.cells.some((cell) => board[cell] === digit);

/** Every combination of `size` items, as arrays of items. */
function* combinations(items, size, start = 0, picked = []) {
  if (picked.length === size) {
    yield picked;
    return;
  }
  for (let i = start; i <= items.length - (size - picked.length); i += 1) {
    picked.push(items[i]);
    yield* combinations(items, size, i + 1, picked);
    picked.pop();
  }
}

/** Drop eliminations that would not change anything, and the move with them. */
function withEliminations(move, eliminations) {
  if (eliminations.length === 0) return null;
  return { ...move, placements: [], eliminations };
}

/**
 * A placed digit that stops `target` from taking `digit`. Prefers a peer in the
 * given house type, because that reads better in the explanation.
 */
function blockerFor(board, target, digit, preferType = null) {
  let fallback = null;
  for (const peer of PEERS[target]) {
    if (board[peer] !== digit) continue;
    const shared = HOUSES_OF_CELL[peer].find((id) => HOUSES_OF_CELL[target].includes(id));
    const type = HOUSES[shared].type;
    if (preferType && type === preferType) return { cell: peer, digit, target, house: shared };
    if (!fallback) fallback = { cell: peer, digit, target, house: shared };
  }
  return fallback;
}

// --- Singles ---------------------------------------------------------------

/** A cell with one candidate left. The digit is forced because nothing else fits. */
function findNakedSingle(state) {
  const { board, cands } = state;
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (board[cell] !== 0 || countDigits(cands[cell]) !== 1) continue;
    const digit = digitsOf(cands[cell])[0];
    const witnesses = [];
    for (const other of DIGITS) {
      if (other === digit) continue;
      const blocker = blockerFor(board, cell, other);
      if (blocker) witnesses.push(blocker);
    }
    return {
      technique: "naked-single",
      rank: 1,
      placements: [{ cell, digit }],
      eliminations: [],
      digits: [digit],
      houses: [],
      patternCells: [cell],
      witnesses,
    };
  }
  return null;
}

/** A digit that fits only one cell of a house. Every other cell is blocked. */
function findHiddenSingle(state) {
  const { board } = state;
  for (const house of HOUSES) {
    for (const digit of DIGITS) {
      if (houseHasDigit(house, board, digit)) continue;
      const places = placesFor(house, state, digit);
      if (places.length !== 1) continue;
      const cell = places[0];
      const witnesses = [];
      for (const other of emptyCellsOf(house, board)) {
        if (other === cell) continue;
        const blocker = blockerFor(board, other, digit);
        if (blocker) witnesses.push(blocker);
      }
      return {
        technique: "hidden-single",
        rank: 2,
        placements: [{ cell, digit }],
        eliminations: [],
        digits: [digit],
        houses: [house.id],
        patternCells: [cell],
        witnesses,
      };
    }
  }
  return null;
}

// --- Locked candidates -----------------------------------------------------

/**
 * Pointing: inside one box, every place left for a digit sits in one row or one
 * column. The digit must land in the box, so it leaves that line everywhere else.
 */
function findPointing(state) {
  for (const box of BOX_HOUSES) {
    for (const digit of DIGITS) {
      if (houseHasDigit(box, state.board, digit)) continue;
      const places = placesFor(box, state, digit);
      if (places.length < 2) continue;
      for (const type of ["row", "col"]) {
        const lineIndex = type === "row" ? rowOf(places[0]) : colOf(places[0]);
        const sameLine = places.every((cell) => (type === "row" ? rowOf(cell) : colOf(cell)) === lineIndex);
        if (!sameLine) continue;
        const line = HOUSES[houseIdOf(places[0], type)];
        const eliminations = line.cells
          .filter((cell) => boxOf(cell) !== box.index && state.board[cell] === 0 && hasDigit(state.cands[cell], digit))
          .map((cell) => ({ cell, digit }));
        const move = withEliminations(
          {
            technique: "pointing",
            rank: 3,
            digits: [digit],
            houses: [box.id, line.id],
            patternCells: places,
            witnesses: [],
            baseHouse: box.id,
            coverHouses: [line.id],
          },
          eliminations
        );
        if (move) return move;
      }
    }
  }
  return null;
}

/**
 * Claiming: inside one row or column, every place left for a digit sits in one
 * box. The digit must land in that line, so it leaves the rest of the box.
 */
function findClaiming(state) {
  for (const line of [...ROW_HOUSES, ...COL_HOUSES]) {
    for (const digit of DIGITS) {
      if (houseHasDigit(line, state.board, digit)) continue;
      const places = placesFor(line, state, digit);
      if (places.length < 2) continue;
      const box = boxOf(places[0]);
      if (!places.every((cell) => boxOf(cell) === box)) continue;
      const boxHouse = HOUSES[houseIdOf(places[0], "box")];
      const eliminations = boxHouse.cells
        .filter((cell) => !line.cells.includes(cell) && state.board[cell] === 0 && hasDigit(state.cands[cell], digit))
        .map((cell) => ({ cell, digit }));
      const move = withEliminations(
        {
          technique: "claiming",
          rank: 4,
          digits: [digit],
          houses: [line.id, boxHouse.id],
          patternCells: places,
          witnesses: [],
          baseHouse: line.id,
          coverHouses: [boxHouse.id],
        },
        eliminations
      );
      if (move) return move;
    }
  }
  return null;
}

// --- Subsets ---------------------------------------------------------------

/**
 * Naked subset: `size` cells of a house share exactly `size` candidates between
 * them. Those cells take those digits, so no other cell of the house can.
 */
function findNakedSubset(size, id, rank) {
  return function find(state) {
    for (const house of HOUSES) {
      const open = emptyCellsOf(house, state.board);
      // The house needs a cell outside the subset for the subset to remove
      // anything from.
      if (open.length <= size) continue;
      const cells = open.filter((cell) => {
        const count = countDigits(state.cands[cell]);
        return count >= 2 && count <= size;
      });
      if (cells.length < size) continue;
      for (const group of combinations(cells, size)) {
        let mask = 0;
        for (const cell of group) mask |= state.cands[cell];
        if (countDigits(mask) !== size) continue;
        const digits = digitsOf(mask);
        const eliminations = [];
        for (const cell of emptyCellsOf(house, state.board)) {
          if (group.includes(cell)) continue;
          for (const digit of digits) if (hasDigit(state.cands[cell], digit)) eliminations.push({ cell, digit });
        }
        const move = withEliminations(
          {
            technique: id,
            rank,
            digits,
            houses: [house.id],
            patternCells: [...group],
            witnesses: [],
          },
          eliminations
        );
        if (move) return move;
      }
    }
    return null;
  };
}

/**
 * Hidden subset: `size` digits of a house fit in only `size` cells between them.
 * Those digits fill those cells, so every other candidate leaves them.
 */
function findHiddenSubset(size, id, rank) {
  return function find(state) {
    for (const house of HOUSES) {
      const open = DIGITS.filter((digit) => !houseHasDigit(house, state.board, digit)).filter((digit) => {
        const count = placesFor(house, state, digit).length;
        return count >= 2 && count <= size;
      });
      if (open.length < size) continue;
      for (const digits of combinations(open, size)) {
        const cellSet = new Set();
        for (const digit of digits) for (const cell of placesFor(house, state, digit)) cellSet.add(cell);
        if (cellSet.size !== size) continue;
        const keepMask = digits.reduce((mask, digit) => mask | bitOf(digit), 0);
        const eliminations = [];
        for (const cell of cellSet) {
          for (const digit of digitsOf(state.cands[cell] & ~keepMask)) eliminations.push({ cell, digit });
        }
        const move = withEliminations(
          {
            technique: id,
            rank,
            digits: [...digits],
            houses: [house.id],
            patternCells: [...cellSet].sort((a, b) => a - b),
            witnesses: [],
          },
          eliminations
        );
        if (move) return move;
      }
    }
    return null;
  };
}

// --- Fish (X-Wing, Swordfish) ---------------------------------------------

/**
 * Fish of the given size: `size` rows in which a digit fits only inside the same
 * `size` columns. The digit fills one cell per row, so it uses up all those
 * columns and leaves them everywhere else. Size 2 is an X-Wing, size 3 a
 * Swordfish. The same search runs with rows and columns swapped.
 */
function findFish(size, id, rank) {
  return function find(state) {
    for (const orientation of ["row", "col"]) {
      const baseHouses = orientation === "row" ? ROW_HOUSES : COL_HOUSES;
      const coverHouses = orientation === "row" ? COL_HOUSES : ROW_HOUSES;
      const coverIndex = orientation === "row" ? colOf : rowOf;
      for (const digit of DIGITS) {
        const lines = baseHouses
          .filter((house) => !houseHasDigit(house, state.board, digit))
          .map((house) => ({ house, places: placesFor(house, state, digit) }))
          .filter((line) => line.places.length >= 2 && line.places.length <= size);
        if (lines.length < size) continue;
        for (const group of combinations(lines, size)) {
          const covers = new Set();
          for (const line of group) for (const cell of line.places) covers.add(coverIndex(cell));
          if (covers.size !== size) continue;
          const baseCells = new Set(group.flatMap((line) => line.places));
          const eliminations = [];
          for (const cover of covers) {
            for (const cell of coverHouses[cover].cells) {
              if (baseCells.has(cell)) continue;
              if (state.board[cell] !== 0 || !hasDigit(state.cands[cell], digit)) continue;
              eliminations.push({ cell, digit });
            }
          }
          const move = withEliminations(
            {
              technique: id,
              rank,
              digits: [digit],
              houses: group.map((line) => line.house.id),
              patternCells: [...baseCells].sort((a, b) => a - b),
              witnesses: [],
              orientation,
              coverHouses: [...covers].map((cover) => coverHouses[cover].id),
            },
            eliminations
          );
          if (move) return move;
        }
      }
    }
    return null;
  };
}

// --- Wings -----------------------------------------------------------------

/** Cells with exactly `count` candidates left. */
const cellsWithCandidateCount = (state, count) => {
  const cells = [];
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (state.board[cell] === 0 && countDigits(state.cands[cell]) === count) cells.push(cell);
  }
  return cells;
};

/**
 * Y-Wing (also called XY-Wing): a pivot cell holds {a,b}. Two pincers the pivot
 * sees hold {a,c} and {b,c}. Whatever the pivot turns out to be, one pincer
 * becomes c, so c leaves every cell both pincers see.
 */
function findYWing(state) {
  const pairs = cellsWithCandidateCount(state, 2);
  for (const pivot of pairs) {
    const [a, b] = digitsOf(state.cands[pivot]);
    for (const first of pairs) {
      if (first === pivot || !sees(pivot, first)) continue;
      const firstDigits = digitsOf(state.cands[first]);
      if (!firstDigits.includes(a) || firstDigits.includes(b)) continue;
      const c = firstDigits.find((digit) => digit !== a);
      for (const second of pairs) {
        if (second === pivot || second === first || !sees(pivot, second)) continue;
        const secondDigits = digitsOf(state.cands[second]);
        if (secondDigits.length !== 2 || !secondDigits.includes(b) || !secondDigits.includes(c)) continue;
        const eliminations = [];
        for (let cell = 0; cell < CELL_COUNT; cell += 1) {
          if (cell === pivot || cell === first || cell === second) continue;
          if (state.board[cell] !== 0 || !hasDigit(state.cands[cell], c)) continue;
          if (sees(cell, first) && sees(cell, second)) eliminations.push({ cell, digit: c });
        }
        const move = withEliminations(
          {
            technique: "y-wing",
            rank: 11,
            digits: [c],
            houses: [],
            patternCells: [pivot, first, second],
            witnesses: [],
            pivot,
            pincers: [first, second],
            pivotDigits: [a, b],
          },
          eliminations
        );
        if (move) return move;
      }
    }
  }
  return null;
}

/**
 * XYZ-Wing: the pivot holds {a,b,c} and its two pincers hold {a,c} and {b,c}.
 * One of the three must be c, so c leaves every cell that sees all three.
 */
function findXyzWing(state) {
  const triples = cellsWithCandidateCount(state, 3);
  const pairs = cellsWithCandidateCount(state, 2);
  for (const pivot of triples) {
    const pivotDigits = digitsOf(state.cands[pivot]);
    for (const first of pairs) {
      if (!sees(pivot, first)) continue;
      const firstDigits = digitsOf(state.cands[first]);
      if (!firstDigits.every((digit) => pivotDigits.includes(digit))) continue;
      for (const second of pairs) {
        if (second === first || !sees(pivot, second)) continue;
        const secondDigits = digitsOf(state.cands[second]);
        if (!secondDigits.every((digit) => pivotDigits.includes(digit))) continue;
        const shared = firstDigits.filter((digit) => secondDigits.includes(digit));
        if (shared.length !== 1) continue;
        const union = new Set([...firstDigits, ...secondDigits]);
        if (union.size !== 3) continue;
        const c = shared[0];
        const eliminations = [];
        for (let cell = 0; cell < CELL_COUNT; cell += 1) {
          if (cell === pivot || cell === first || cell === second) continue;
          if (state.board[cell] !== 0 || !hasDigit(state.cands[cell], c)) continue;
          if (sees(cell, pivot) && sees(cell, first) && sees(cell, second)) eliminations.push({ cell, digit: c });
        }
        const move = withEliminations(
          {
            technique: "xyz-wing",
            rank: 13,
            digits: [c],
            houses: [],
            patternCells: [pivot, first, second],
            witnesses: [],
            pivot,
            pincers: [first, second],
            pivotDigits,
          },
          eliminations
        );
        if (move) return move;
      }
    }
  }
  return null;
}

// --- Catalogue -------------------------------------------------------------

/**
 * Every technique the coach knows, easiest first.
 *
 * The names and the descriptions are not here: they live in `i18n.js`, keyed by
 * the technique id, so the catalogue speaks every language the page does. Call
 * `techniqueInfo(id, lang)` to get them.
 */
export const TECHNIQUES = [
  {
    id: "naked-single",
    rank: 1,
    categoryKey: "single",
    find: findNakedSingle,
  },
  {
    id: "hidden-single",
    rank: 2,
    categoryKey: "single",
    find: findHiddenSingle,
  },
  {
    id: "pointing",
    rank: 3,
    categoryKey: "locked",
    find: findPointing,
  },
  {
    id: "claiming",
    rank: 4,
    categoryKey: "locked",
    find: findClaiming,
  },
  {
    id: "naked-pair",
    rank: 5,
    categoryKey: "subset",
    find: findNakedSubset(2, "naked-pair", 5),
  },
  {
    id: "hidden-pair",
    rank: 6,
    categoryKey: "subset",
    find: findHiddenSubset(2, "hidden-pair", 6),
  },
  {
    id: "naked-triple",
    rank: 7,
    categoryKey: "subset",
    find: findNakedSubset(3, "naked-triple", 7),
  },
  {
    id: "hidden-triple",
    rank: 8,
    categoryKey: "subset",
    find: findHiddenSubset(3, "hidden-triple", 8),
  },
  {
    id: "naked-quad",
    rank: 9,
    categoryKey: "subset",
    find: findNakedSubset(4, "naked-quad", 9),
  },
  {
    id: "x-wing",
    rank: 10,
    categoryKey: "fish",
    find: findFish(2, "x-wing", 10),
  },
  {
    id: "y-wing",
    rank: 11,
    categoryKey: "wing",
    find: findYWing,
  },
  {
    id: "swordfish",
    rank: 12,
    categoryKey: "fish",
    find: findFish(3, "swordfish", 12),
  },
  {
    id: "xyz-wing",
    rank: 13,
    categoryKey: "wing",
    find: findXyzWing,
  },
].sort((a, b) => a.rank - b.rank);

/** Look up a technique by its id. */
export const techniqueById = (id) => TECHNIQUES.find((technique) => technique.id === id) ?? null;

/**
 * A technique with its words filled in, ready for the page.
 * @param {string} id technique id
 * @param {string} [lang] language code
 * @returns {{id, rank, category, name, summary, howItWorks}|null}
 */
export function techniqueInfo(id, lang = DEFAULT_LANGUAGE) {
  const technique = techniqueById(id);
  if (!technique) return null;
  return {
    id: technique.id,
    rank: technique.rank,
    category: t(lang, `category.${technique.categoryKey}`),
    name: t(lang, `technique.${id}.name`),
    summary: t(lang, `technique.${id}.summary`),
    howItWorks: t(lang, `technique.${id}.how`),
  };
}

/** Every technique with its words filled in, easiest first. */
export const techniqueCatalogue = (lang = DEFAULT_LANGUAGE) =>
  TECHNIQUES.map((technique) => techniqueInfo(technique.id, lang));

/** Run one technique by id. Returns its Move or null. */
export function findTechnique(id, state) {
  const technique = techniqueById(id);
  if (!technique) throw new Error(`Unknown technique: ${id}`);
  return technique.find(state);
}

/** The first move the easiest applicable technique reports, or null. */
export function findEasiestMove(state) {
  for (const technique of TECHNIQUES) {
    const move = technique.find(state);
    if (move) return move;
  }
  return null;
}

/**
 * The easiest move that only rules candidates out, or null.
 * Used to reduce a candidate grid without placing any digit.
 */
export function findEasiestElimination(state) {
  for (const technique of TECHNIQUES) {
    const move = technique.find(state);
    if (move && move.eliminations.length > 0) return move;
  }
  return null;
}

/** One move per technique that applies right now, easiest first. */
export function findAllMoves(state) {
  const moves = [];
  for (const technique of TECHNIQUES) {
    const move = technique.find(state);
    if (move) moves.push(move);
  }
  return moves;
}
