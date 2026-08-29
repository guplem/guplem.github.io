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
// A "strong link" (also called a conjugate pair) is a house in which a digit has
// exactly two places left, so one of the two must hold it.
//
// Two techniques argue from the fact that the puzzle has exactly one answer.
// They run only when `state.unique` is true, because on a grid with two answers
// their reasoning is wrong. See ADR 0007.

import {
  BOX_HOUSES,
  CELL_COUNT,
  COL_HOUSES,
  HOUSES,
  HOUSES_OF_CELL,
  PEERS,
  ROW_HOUSES,
  SIZE,
  bitOf,
  boxOf,
  cellAt,
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
function findNakedSubset(size, id) {
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
function findHiddenSubset(size, id) {
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
function findFish(size, id) {
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

/** Cells that still allow the digit and see both `first` and `second`. */
function seenByBoth(state, digit, first, second, skip) {
  const eliminations = [];
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (skip.includes(cell)) continue;
    if (state.board[cell] !== 0 || !hasDigit(state.cands[cell], digit)) continue;
    if (sees(cell, first) && sees(cell, second)) eliminations.push({ cell, digit });
  }
  return eliminations;
}

/** Every house in which the digit has exactly two places left. */
function strongLinks(state, digit) {
  const links = [];
  for (const house of HOUSES) {
    if (houseHasDigit(house, state.board, digit)) continue;
    const places = placesFor(house, state, digit);
    if (places.length === 2) links.push({ cells: places, house });
  }
  return links;
}

// --- Single-digit chains ---------------------------------------------------

/**
 * Skyscraper: one digit, two rows (or two columns) that each keep only two
 * places for it. One place of each row sits in the same column, so at most one
 * of that pair is the digit. The two other places are the roof, and at least one
 * of them must be the digit, so it leaves every cell that sees both.
 */
function findSkyscraper(state) {
  for (const digit of DIGITS) {
    for (const type of ["row", "col"]) {
      const lines = (type === "row" ? ROW_HOUSES : COL_HOUSES)
        .filter((house) => !houseHasDigit(house, state.board, digit))
        .map((house) => ({ house, places: placesFor(house, state, digit) }))
        .filter((line) => line.places.length === 2);
      const crossIndex = type === "row" ? colOf : rowOf;
      for (const [first, second] of combinations(lines, 2)) {
        for (let a = 0; a < 2; a += 1) {
          for (let b = 0; b < 2; b += 1) {
            if (crossIndex(first.places[a]) !== crossIndex(second.places[b])) continue;
            const roof = [first.places[1 - a], second.places[1 - b]];
            // Two roof cells on one line make an X-Wing, which is easier and is
            // reported by its own technique.
            if (crossIndex(roof[0]) === crossIndex(roof[1])) continue;
            const pattern = [...first.places, ...second.places];
            const eliminations = seenByBoth(state, digit, roof[0], roof[1], pattern);
            const move = withEliminations(
              {
                technique: "skyscraper",
                digits: [digit],
                houses: [first.house.id, second.house.id],
                patternCells: [...pattern].sort((x, y) => x - y),
                witnesses: [],
                roof,
                baseCells: [first.places[a], second.places[b]],
                baseHouse: houseIdOf(first.places[a], type === "row" ? "col" : "row"),
              },
              eliminations
            );
            if (move) return move;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Two-String Kite: one digit, a row with two places and a column with two
 * places. One place of the row and one place of the column share a box, so at
 * most one of those two is the digit. The far end of the row and the far end of
 * the column are then the pair that must hold one, so the digit leaves every
 * cell that sees both ends.
 */
function findTwoStringKite(state) {
  for (const digit of DIGITS) {
    const linesOf = (houses) =>
      houses
        .filter((house) => !houseHasDigit(house, state.board, digit))
        .map((house) => ({ house, places: placesFor(house, state, digit) }))
        .filter((line) => line.places.length === 2);
    const rows = linesOf(ROW_HOUSES);
    const cols = linesOf(COL_HOUSES);
    for (const row of rows) {
      for (const col of cols) {
        for (let a = 0; a < 2; a += 1) {
          for (let b = 0; b < 2; b += 1) {
            const hinge = [row.places[a], col.places[b]];
            if (hinge[0] === hinge[1] || boxOf(hinge[0]) !== boxOf(hinge[1])) continue;
            const ends = [row.places[1 - a], col.places[1 - b]];
            // Both ends must sit outside the hinge box, or the line is locked
            // inside one box and a Pointing Pair already covers it.
            if (boxOf(ends[0]) === boxOf(hinge[0]) || boxOf(ends[1]) === boxOf(hinge[0])) continue;
            if (ends[0] === ends[1]) continue;
            const pattern = [...row.places, ...col.places];
            const eliminations = seenByBoth(state, digit, ends[0], ends[1], pattern);
            const move = withEliminations(
              {
                technique: "two-string-kite",
                digits: [digit],
                houses: [row.house.id, col.house.id],
                patternCells: [...new Set(pattern)].sort((x, y) => x - y),
                witnesses: [],
                ends,
                hinge,
                baseHouse: houseIdOf(hinge[0], "box"),
              },
              eliminations
            );
            if (move) return move;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Simple Coloring: follow one digit through its strong links. Paint the two ends
 * of every link in opposite colours. Inside one chain, one colour is true and
 * the other is false.
 *
 * Two results follow. When two cells of the same colour see each other, that
 * colour is false everywhere (a "wrap"). When an outside cell sees both colours,
 * one of them is true, so that cell loses the digit (a "trap").
 */
function findSimpleColoring(state) {
  for (const digit of DIGITS) {
    const neighbours = new Map();
    for (const link of strongLinks(state, digit)) {
      const [a, b] = link.cells;
      if (!neighbours.has(a)) neighbours.set(a, []);
      if (!neighbours.has(b)) neighbours.set(b, []);
      neighbours.get(a).push(b);
      neighbours.get(b).push(a);
    }
    const colour = new Map();
    for (const start of neighbours.keys()) {
      if (colour.has(start)) continue;
      const chain = [start];
      colour.set(start, 0);
      const queue = [start];
      while (queue.length > 0) {
        const current = queue.shift();
        for (const next of neighbours.get(current)) {
          if (colour.has(next)) continue;
          colour.set(next, 1 - colour.get(current));
          chain.push(next);
          queue.push(next);
        }
      }
      const groups = [chain.filter((cell) => colour.get(cell) === 0), chain.filter((cell) => colour.get(cell) === 1)];
      for (const group of groups) {
        for (const [a, b] of combinations(group, 2)) {
          if (!sees(a, b)) continue;
          return {
            technique: "simple-coloring",
            placements: [],
            eliminations: group.map((cell) => ({ cell, digit })),
            digits: [digit],
            houses: [],
            patternCells: [...chain].sort((x, y) => x - y),
            witnesses: [],
            variant: "wrap",
            clash: [a, b],
            colours: groups,
          };
        }
      }
      const eliminations = [];
      for (let cell = 0; cell < CELL_COUNT; cell += 1) {
        if (chain.includes(cell) || state.board[cell] !== 0 || !hasDigit(state.cands[cell], digit)) continue;
        if (groups[0].some((other) => sees(other, cell)) && groups[1].some((other) => sees(other, cell))) {
          eliminations.push({ cell, digit });
        }
      }
      const move = withEliminations(
        {
          technique: "simple-coloring",
          digits: [digit],
          houses: [],
          patternCells: [...chain].sort((x, y) => x - y),
          witnesses: [],
          variant: "trap",
          colours: groups,
        },
        eliminations
      );
      if (move) return move;
    }
  }
  return null;
}

// --- Chains of two-candidate cells -----------------------------------------

/** How far a chain of two-candidate cells may reach. Keeps the search quick. */
const MAX_CHAIN_CELLS = 8;

/**
 * W-Wing: two cells that hold the same pair {a,b} and do not see each other. A
 * house somewhere keeps only two places for b, one seen by each cell. One of
 * those two places is b, so the cell that sees it cannot be b and must be a.
 * Either way one of the two cells is a, so a leaves every cell that sees both.
 */
function findWWing(state) {
  const pairs = cellsWithCandidateCount(state, 2);
  for (const [first, second] of combinations(pairs, 2)) {
    if (state.cands[first] !== state.cands[second] || sees(first, second)) continue;
    const [a, b] = digitsOf(state.cands[first]);
    for (const linkDigit of [a, b]) {
      const digit = linkDigit === a ? b : a;
      for (const link of strongLinks(state, linkDigit)) {
        const [p, q] = link.cells;
        if ([p, q].includes(first) || [p, q].includes(second)) continue;
        const joined = (sees(p, first) && sees(q, second)) || (sees(p, second) && sees(q, first));
        if (!joined) continue;
        const eliminations = seenByBoth(state, digit, first, second, [first, second]);
        const move = withEliminations(
          {
            technique: "w-wing",
            digits: [digit],
            houses: [link.house.id],
            patternCells: [first, second].sort((x, y) => x - y),
            witnesses: [],
            ends: [first, second],
            link: link.cells,
            linkDigit,
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
 * Remote Pairs: a run of cells that all hold the same pair {a,b}, each one
 * seeing the next. The values alternate along the run, so two cells an odd
 * number of steps apart always differ. Any cell that sees both ends therefore
 * sees an a and a b, and loses them both.
 */
function findRemotePairs(state) {
  const pairs = cellsWithCandidateCount(state, 2);
  for (const start of pairs) {
    const mask = state.cands[start];
    const stack = [[start]];
    while (stack.length > 0) {
      const path = stack.pop();
      const last = path[path.length - 1];
      // An even number of cells means an odd number of steps, so the two ends
      // hold different digits.
      if (path.length >= 4 && path.length % 2 === 0 && !sees(start, last)) {
        const eliminations = [];
        for (const digit of digitsOf(mask)) eliminations.push(...seenByBoth(state, digit, start, last, path));
        if (eliminations.length > 0) {
          return {
            technique: "remote-pairs",
            placements: [],
            eliminations,
            digits: digitsOf(mask),
            houses: [],
            patternCells: [...path],
            witnesses: [],
            ends: [start, last],
            chain: [...path],
          };
        }
      }
      if (path.length >= MAX_CHAIN_CELLS) continue;
      for (const next of pairs) {
        if (state.cands[next] !== mask || path.includes(next) || !sees(last, next)) continue;
        stack.push([...path, next]);
      }
    }
  }
  return null;
}

/**
 * XY-Chain: a run of two-candidate cells, each seeing the next and sharing a
 * digit with it. Both ends hold the same digit z. Whichever way the chain falls,
 * one end ends up as z, so z leaves every cell that sees both ends.
 */
function findXyChain(state) {
  const pairs = cellsWithCandidateCount(state, 2);
  for (const start of pairs) {
    for (const z of digitsOf(state.cands[start])) {
      const other = digitsOf(state.cands[start]).find((digit) => digit !== z);
      const stack = [{ cell: start, need: other, path: [start] }];
      while (stack.length > 0) {
        const current = stack.pop();
        for (const next of pairs) {
          if (current.path.includes(next) || !sees(current.cell, next)) continue;
          if (!hasDigit(state.cands[next], current.need)) continue;
          const nextNeed = digitsOf(state.cands[next]).find((digit) => digit !== current.need);
          const path = [...current.path, next];
          if (nextNeed === z && path.length >= 3 && !sees(start, next)) {
            const eliminations = seenByBoth(state, z, start, next, path);
            if (eliminations.length > 0) {
              return {
                technique: "xy-chain",
                placements: [],
                eliminations,
                digits: [z],
                houses: [],
                patternCells: [...path],
                witnesses: [],
                ends: [start, next],
                chain: path,
              };
            }
          }
          if (path.length < MAX_CHAIN_CELLS) stack.push({ cell: next, need: nextNeed, path });
        }
      }
    }
  }
  return null;
}

// --- Uniqueness ------------------------------------------------------------

/**
 * Rectangles of four empty cells that sit in two rows, two columns and exactly
 * two boxes, and that all still allow the same two digits {a,b}.
 *
 * Such a rectangle is the shape of a deadly pattern. If those four cells ended
 * up holding only a and b, the two digits could be swapped around the rectangle
 * and the puzzle would have two answers. A puzzle with one answer therefore
 * cannot let that happen, and that is what every Unique Rectangle move uses.
 */
function* uniqueRectangles(state) {
  for (let rowA = 0; rowA < SIZE; rowA += 1) {
    for (let rowB = rowA + 1; rowB < SIZE; rowB += 1) {
      for (let colA = 0; colA < SIZE; colA += 1) {
        for (let colB = colA + 1; colB < SIZE; colB += 1) {
          const cells = [cellAt(rowA, colA), cellAt(rowA, colB), cellAt(rowB, colA), cellAt(rowB, colB)];
          if (cells.some((cell) => state.board[cell] !== 0)) continue;
          if (new Set(cells.map(boxOf)).size !== 2) continue;
          for (const [a, b] of combinations(DIGITS, 2)) {
            const mask = bitOf(a) | bitOf(b);
            if (!cells.every((cell) => (state.cands[cell] & mask) === mask)) continue;
            const floor = cells.filter((cell) => state.cands[cell] === mask);
            const roof = cells.filter((cell) => state.cands[cell] !== mask);
            if (floor.length < 2) continue;
            yield { cells, a, b, mask, floor, roof };
          }
        }
      }
    }
  }
}

/**
 * Unique Rectangle, in the four shapes a player meets most often. Each one asks
 * the same question: what has to be true so that the deadly pattern cannot form?
 *
 * Type 1: one corner carries extra digits. It has to take one of them, so it
 *   loses both rectangle digits.
 * Type 2: two corners carry the same one extra digit. One of the two must take
 *   it, so that digit leaves every cell both corners see.
 * Type 3: two corners carry extra digits and share a house. Together they act as
 *   one cell holding those extras, which can complete a naked subset.
 * Type 4: two corners share a house in which one rectangle digit has no other
 *   place. That digit fills one of them, so the other rectangle digit leaves
 *   both.
 */
function findUniqueRectangle(state) {
  if (!state.unique) return null;
  for (const frame of uniqueRectangles(state)) {
    const { a, b, mask, floor, roof } = frame;
    const base = {
      technique: "unique-rectangle",
      digits: [a, b],
      patternCells: frame.cells,
      witnesses: [],
      floor,
      roof,
    };

    if (roof.length === 1) {
      const eliminations = digitsOf(state.cands[roof[0]] & mask).map((digit) => ({ cell: roof[0], digit }));
      const move = withEliminations({ ...base, houses: [], variant: "1" }, eliminations);
      if (move) return move;
      continue;
    }
    if (roof.length !== 2) continue;

    const [first, second] = roof;
    const firstExtra = state.cands[first] & ~mask;
    const secondExtra = state.cands[second] & ~mask;

    if (firstExtra === secondExtra && countDigits(firstExtra) === 1) {
      const extra = digitsOf(firstExtra)[0];
      const eliminations = seenByBoth(state, extra, first, second, roof);
      const move = withEliminations({ ...base, houses: [], variant: "2", extra }, eliminations);
      if (move) return move;
    }

    if (!sees(first, second)) continue;
    const sharedHouses = HOUSES.filter((house) => house.cells.includes(first) && house.cells.includes(second));
    const extras = firstExtra | secondExtra;
    const size = countDigits(extras);

    for (const house of sharedHouses) {
      const others = emptyCellsOf(house, state.board).filter(
        (cell) => !roof.includes(cell) && countDigits(state.cands[cell]) >= 2
      );
      if (size < 2 || others.length < size - 1) continue;
      for (const group of combinations(others, size - 1)) {
        let subsetMask = extras;
        for (const cell of group) subsetMask |= state.cands[cell];
        if (countDigits(subsetMask) !== size) continue;
        const eliminations = [];
        for (const cell of others) {
          if (group.includes(cell)) continue;
          for (const digit of digitsOf(state.cands[cell] & subsetMask)) eliminations.push({ cell, digit });
        }
        // The two corners belong to the subset, so any candidate of theirs that
        // is neither a rectangle digit nor a subset digit is impossible too.
        for (const cell of roof) {
          for (const digit of digitsOf(state.cands[cell] & ~mask & ~subsetMask)) eliminations.push({ cell, digit });
        }
        const move = withEliminations(
          {
            ...base,
            houses: [house.id],
            variant: "3",
            subsetCells: [...group],
            subsetDigits: digitsOf(subsetMask),
          },
          eliminations
        );
        if (move) return move;
      }
    }

    for (const house of sharedHouses) {
      for (const [keep, drop] of [
        [a, b],
        [b, a],
      ]) {
        const places = placesFor(house, state, keep);
        if (places.length !== 2 || !places.includes(first) || !places.includes(second)) continue;
        const eliminations = roof
          .filter((cell) => hasDigit(state.cands[cell], drop))
          .map((cell) => ({ cell, digit: drop }));
        const move = withEliminations({ ...base, houses: [house.id], variant: "4", keep, drop }, eliminations);
        if (move) return move;
      }
    }
  }
  return null;
}

/**
 * BUG+1: every empty cell holds two candidates except one, which holds three.
 *
 * A grid where every empty cell holds two candidates and every digit has an even
 * number of places in every house always has two answers. This puzzle has one,
 * so the odd cell must break that shape. It takes the digit that appears an odd
 * number of times in its row, its column and its box.
 */
function findBugPlusOne(state) {
  if (!state.unique) return null;
  let odd = null;
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (state.board[cell] !== 0) continue;
    const count = countDigits(state.cands[cell]);
    if (count === 2) continue;
    if (count === 3 && odd === null) {
      odd = cell;
      continue;
    }
    return null;
  }
  if (odd === null) return null;
  for (const digit of digitsOf(state.cands[odd])) {
    const houses = ["row", "col", "box"].map((type) => HOUSES[houseIdOf(odd, type)]);
    if (!houses.every((house) => placesFor(house, state, digit).length % 2 === 1)) continue;
    return {
      technique: "bug-plus-one",
      placements: [{ cell: odd, digit }],
      eliminations: [],
      digits: [digit],
      houses: houses.map((house) => house.id),
      patternCells: [odd],
      witnesses: [],
    };
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
 *
 * The rank lives here and nowhere else. The catalogue stamps it onto every move
 * a finder returns, so a finder can never disagree with the order the coach
 * teaches in.
 */
const CATALOGUE = [
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
    find: findNakedSubset(2, "naked-pair"),
  },
  {
    id: "hidden-pair",
    rank: 6,
    categoryKey: "subset",
    find: findHiddenSubset(2, "hidden-pair"),
  },
  {
    id: "naked-triple",
    rank: 7,
    categoryKey: "subset",
    find: findNakedSubset(3, "naked-triple"),
  },
  {
    id: "hidden-triple",
    rank: 8,
    categoryKey: "subset",
    find: findHiddenSubset(3, "hidden-triple"),
  },
  {
    id: "naked-quad",
    rank: 9,
    categoryKey: "subset",
    find: findNakedSubset(4, "naked-quad"),
  },
  {
    id: "hidden-quad",
    rank: 10,
    categoryKey: "subset",
    find: findHiddenSubset(4, "hidden-quad"),
  },
  {
    id: "x-wing",
    rank: 11,
    categoryKey: "fish",
    find: findFish(2, "x-wing"),
  },
  {
    id: "y-wing",
    rank: 12,
    categoryKey: "wing",
    find: findYWing,
  },
  {
    id: "swordfish",
    rank: 13,
    categoryKey: "fish",
    find: findFish(3, "swordfish"),
  },
  {
    id: "xyz-wing",
    rank: 14,
    categoryKey: "wing",
    find: findXyzWing,
  },
  {
    id: "skyscraper",
    rank: 15,
    categoryKey: "chain",
    find: findSkyscraper,
  },
  {
    id: "two-string-kite",
    rank: 16,
    categoryKey: "chain",
    find: findTwoStringKite,
  },
  {
    id: "w-wing",
    rank: 17,
    categoryKey: "wing",
    find: findWWing,
  },
  {
    id: "jellyfish",
    rank: 18,
    categoryKey: "fish",
    find: findFish(4, "jellyfish"),
  },
  {
    id: "remote-pairs",
    rank: 19,
    categoryKey: "chain",
    find: findRemotePairs,
  },
  {
    id: "simple-coloring",
    rank: 20,
    categoryKey: "chain",
    find: findSimpleColoring,
  },
  {
    id: "unique-rectangle",
    rank: 21,
    categoryKey: "uniqueness",
    find: findUniqueRectangle,
  },
  {
    id: "bug-plus-one",
    rank: 22,
    categoryKey: "uniqueness",
    find: findBugPlusOne,
  },
  {
    id: "xy-chain",
    rank: 23,
    categoryKey: "chain",
    find: findXyChain,
  },
].sort((a, b) => a.rank - b.rank);

export const TECHNIQUES = CATALOGUE.map((technique) => ({
  ...technique,
  find(state) {
    const move = technique.find(state);
    return move ? { ...move, rank: technique.rank } : null;
  },
}));

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
