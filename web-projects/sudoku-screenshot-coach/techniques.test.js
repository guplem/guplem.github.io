import { describe, test, expect } from "bun:test";
import {
  ALL_DIGITS,
  CELL_COUNT,
  cellAt,
  cellName,
  digitsOf,
  emptyBoard,
  maskOf,
  parseBoard,
  makeState,
} from "./board.js";
import { LANGUAGE_CODES } from "./i18n.js";
import { TECHNIQUES, findTechnique, findAllMoves, techniqueCatalogue, techniqueInfo } from "./techniques.js";
import { solve } from "./solver.js";

/**
 * A state whose board is empty and whose candidates start as "anything", then
 * get narrowed by the given overrides. It isolates one pattern so a test can
 * check a single technique without building a whole puzzle.
 * @param {Record<number, number[]>} overrides cell index -> allowed digits
 * @param {Array<{cells: number[], remove: number[]}>} strips digits to drop from cells
 */
function candState(overrides = {}, strips = []) {
  const cands = new Uint16Array(CELL_COUNT).fill(ALL_DIGITS);
  for (const strip of strips) {
    for (const cell of strip.cells) for (const digit of strip.remove) cands[cell] &= ~(1 << (digit - 1));
  }
  for (const [cell, digits] of Object.entries(overrides)) cands[Number(cell)] = maskOf(digits);
  return { board: emptyBoard(), cands };
}

const rowCells = (row) => Array.from({ length: 9 }, (_, col) => cellAt(row, col));
const colCells = (col) => Array.from({ length: 9 }, (_, row) => cellAt(row, col));
const elimPairs = (move) => move.eliminations.map((e) => `${cellName(e.cell)}#${e.digit}`).sort();

const find = (id, state) => findTechnique(id, state);

describe("technique catalogue", () => {
  test("every technique carries the parts the engine needs", () => {
    for (const technique of TECHNIQUES) {
      expect(typeof technique.id).toBe("string");
      expect(typeof technique.categoryKey).toBe("string");
      expect(typeof technique.find).toBe("function");
      expect(technique.rank).toBeGreaterThan(0);
    }
  });

  test("every technique has words in every language", () => {
    for (const code of LANGUAGE_CODES) {
      for (const technique of techniqueCatalogue(code)) {
        expect(technique.name.length).toBeGreaterThan(0);
        expect(technique.summary.length).toBeGreaterThan(0);
        expect(technique.howItWorks.length).toBeGreaterThan(20);
        expect(technique.category.length).toBeGreaterThan(0);
        // A key that leaked through instead of being translated.
        expect(technique.name).not.toContain("technique.");
      }
    }
  });

  test("translates the technique names", () => {
    expect(techniqueInfo("naked-single", "en").name).toBe("Naked Single");
    expect(techniqueInfo("naked-single", "es").name).toBe("Única candidata");
    expect(techniqueInfo("nope", "en")).toBeNull();
  });

  test("is ordered from the easiest technique to the hardest", () => {
    const ranks = TECHNIQUES.map((technique) => technique.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(TECHNIQUES[0].id).toBe("naked-single");
    expect(TECHNIQUES[1].id).toBe("hidden-single");
  });

  test("technique ids are unique", () => {
    const ids = TECHNIQUES.map((technique) => technique.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("naked single", () => {
  test("places the only digit a cell can still take", () => {
    // Row 1 holds 1-8, so r1c9 can only be 9.
    const board = emptyBoard();
    for (let col = 0; col < 8; col += 1) board[cellAt(0, col)] = col + 1;
    const move = find("naked-single", makeState(board));
    expect(move.placements).toEqual([{ cell: cellAt(0, 8), digit: 9 }]);
    expect(move.eliminations).toEqual([]);
  });

  test("names a blocking cell for each of the other eight digits", () => {
    const board = emptyBoard();
    for (let col = 0; col < 8; col += 1) board[cellAt(0, col)] = col + 1;
    const move = find("naked-single", makeState(board));
    expect(move.witnesses).toHaveLength(8);
    expect(move.witnesses.map((w) => w.digit).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const witness of move.witnesses) expect(board[witness.cell]).toBe(witness.digit);
  });

  test("finds nothing when every empty cell keeps two or more digits", () => {
    expect(find("naked-single", makeState(emptyBoard()))).toBeNull();
  });
});

describe("hidden single", () => {
  test("places a digit that fits only one cell of a house", () => {
    // 7 is possible only in r1c1 across row 1.
    const state = candState({}, [{ cells: rowCells(0).slice(1), remove: [7] }]);
    const move = find("hidden-single", state);
    expect(move.placements).toEqual([{ cell: cellAt(0, 0), digit: 7 }]);
    expect(move.houses).toHaveLength(1);
  });

  test("names, for every other cell of the house, a digit that blocks it", () => {
    // A real board: box 1 can take 7 only in r3c3.
    const board = emptyBoard();
    board[cellAt(0, 8)] = 7; // blocks row 1
    board[cellAt(1, 7)] = 7; // blocks row 2
    board[cellAt(7, 0)] = 7; // blocks column 1
    board[cellAt(8, 1)] = 7; // blocks column 2
    const move = find("hidden-single", makeState(board));
    expect(move.placements).toEqual([{ cell: cellAt(2, 2), digit: 7 }]);
    // Each witness is a placed 7 that rules the digit out of another box cell.
    for (const witness of move.witnesses) {
      expect(witness.digit).toBe(7);
      expect(board[witness.cell]).toBe(7);
      expect(witness.target).not.toBe(cellAt(2, 2));
    }
    expect(move.witnesses.length).toBeGreaterThan(0);
  });
});

describe("locked candidates", () => {
  test("pointing: a digit locked to one row of a box leaves that row elsewhere", () => {
    // In box 1, 5 fits only in r1c1 and r1c3, both in row 1.
    const boxCells = [0, 1, 2, 9, 10, 11, 18, 19, 20];
    const state = candState({}, [
      { cells: boxCells.filter((cell) => cell !== cellAt(0, 0) && cell !== cellAt(0, 2)), remove: [5] },
    ]);
    const move = find("pointing", state);
    expect(move.digits).toEqual([5]);
    expect(elimPairs(move)).toEqual(
      [3, 4, 5, 6, 7, 8].map((col) => `${cellName(cellAt(0, col))}#5`).sort()
    );
  });

  test("claiming: a digit locked to one box of a row leaves that box elsewhere", () => {
    // In row 1, 5 fits only in the first three cells, all in box 1.
    const state = candState({}, [{ cells: rowCells(0).slice(3), remove: [5] }]);
    const move = find("claiming", state);
    expect(move.digits).toEqual([5]);
    expect(elimPairs(move)).toEqual(
      [cellAt(1, 0), cellAt(1, 1), cellAt(1, 2), cellAt(2, 0), cellAt(2, 1), cellAt(2, 2)]
        .map((cell) => `${cellName(cell)}#5`)
        .sort()
    );
  });

  test("finds nothing when the digit spreads across the box", () => {
    expect(find("pointing", candState())).toBeNull();
    expect(find("claiming", candState())).toBeNull();
  });
});

describe("naked subsets", () => {
  test("naked pair clears both digits from the rest of the house", () => {
    const state = candState({ [cellAt(0, 0)]: [1, 2], [cellAt(0, 1)]: [1, 2] });
    const move = find("naked-pair", state);
    expect(move.digits).toEqual([1, 2]);
    expect(move.patternCells.sort((a, b) => a - b)).toEqual([cellAt(0, 0), cellAt(0, 1)]);
    expect(move.eliminations).toHaveLength(14); // 7 cells x 2 digits
    for (const elimination of move.eliminations) expect([1, 2]).toContain(elimination.digit);
  });

  test("naked triple works when the three cells share three digits between them", () => {
    const state = candState({
      [cellAt(0, 0)]: [1, 2],
      [cellAt(0, 1)]: [2, 3],
      [cellAt(0, 2)]: [1, 3],
    });
    const move = find("naked-triple", state);
    expect(move.digits).toEqual([1, 2, 3]);
    expect(move.eliminations).toHaveLength(18); // 6 cells x 3 digits
  });

  test("naked quad clears four digits from the rest of the house", () => {
    const state = candState({
      [cellAt(0, 0)]: [1, 2],
      [cellAt(0, 1)]: [2, 3],
      [cellAt(0, 2)]: [3, 4],
      [cellAt(0, 3)]: [1, 4],
    });
    const move = find("naked-quad", state);
    expect(move.digits).toEqual([1, 2, 3, 4]);
    expect(move.eliminations).toHaveLength(20); // 5 cells x 4 digits
  });

  test("a pair that removes nothing is not reported", () => {
    // The pair is real, but no other cell of its row or its box still holds 1
    // or 2, so there is nothing left to remove.
    const state = candState({ [cellAt(0, 0)]: [1, 2], [cellAt(0, 1)]: [1, 2] }, [
      { cells: rowCells(0).slice(2), remove: [1, 2] },
      { cells: [cellAt(1, 0), cellAt(1, 1), cellAt(1, 2), cellAt(2, 0), cellAt(2, 1), cellAt(2, 2)], remove: [1, 2] },
    ]);
    expect(find("naked-pair", state)).toBeNull();
  });
});

describe("hidden subsets", () => {
  test("hidden pair strips the extra digits from the two cells that own them", () => {
    // 4 and 5 live only in r1c1 and r1c2 across row 1.
    const state = candState(
      { [cellAt(0, 0)]: [1, 2, 4, 5], [cellAt(0, 1)]: [3, 4, 5] },
      [{ cells: rowCells(0).slice(2), remove: [4, 5] }]
    );
    const move = find("hidden-pair", state);
    expect(move.digits).toEqual([4, 5]);
    expect(elimPairs(move)).toEqual(
      [`${cellName(cellAt(0, 0))}#1`, `${cellName(cellAt(0, 0))}#2`, `${cellName(cellAt(0, 1))}#3`].sort()
    );
  });

  test("hidden triple keeps only the three digits in their three cells", () => {
    const state = candState(
      { [cellAt(0, 0)]: [1, 4, 5], [cellAt(0, 1)]: [2, 5, 6], [cellAt(0, 2)]: [3, 4, 6] },
      [{ cells: rowCells(0).slice(3), remove: [4, 5, 6] }]
    );
    const move = find("hidden-triple", state);
    expect(move.digits).toEqual([4, 5, 6]);
    expect(elimPairs(move)).toEqual(
      [`${cellName(cellAt(0, 0))}#1`, `${cellName(cellAt(0, 1))}#2`, `${cellName(cellAt(0, 2))}#3`].sort()
    );
  });
});

describe("fish patterns", () => {
  test("X-Wing on two rows clears the digit from the two columns", () => {
    // 3 sits only in columns 2 and 7 of rows 1 and 5.
    const keep = new Set([cellAt(0, 1), cellAt(0, 6), cellAt(4, 1), cellAt(4, 6)]);
    const state = candState({}, [
      { cells: [...rowCells(0), ...rowCells(4)].filter((cell) => !keep.has(cell)), remove: [3] },
    ]);
    const move = find("x-wing", state);
    expect(move.digits).toEqual([3]);
    expect(move.patternCells.sort((a, b) => a - b)).toEqual([...keep].sort((a, b) => a - b));
    // 7 other rows x 2 columns.
    expect(move.eliminations).toHaveLength(14);
    for (const elimination of move.eliminations) expect(elimination.digit).toBe(3);
  });

  test("Swordfish on three rows clears the digit from the three columns", () => {
    const keep = new Set([
      cellAt(0, 1), cellAt(0, 4),
      cellAt(3, 4), cellAt(3, 7),
      cellAt(6, 1), cellAt(6, 7),
    ]);
    const state = candState({}, [
      { cells: [...rowCells(0), ...rowCells(3), ...rowCells(6)].filter((cell) => !keep.has(cell)), remove: [3] },
    ]);
    const move = find("swordfish", state);
    expect(move.digits).toEqual([3]);
    expect(move.eliminations).toHaveLength(18); // 6 other rows x 3 columns
  });
});

describe("wings", () => {
  test("Y-Wing clears the shared digit from cells both pincers see", () => {
    const state = candState({
      [cellAt(0, 0)]: [1, 2], // pivot
      [cellAt(0, 4)]: [1, 3], // pincer in the same row
      [cellAt(4, 0)]: [2, 3], // pincer in the same column
    });
    const move = find("y-wing", state);
    expect(move.digits).toEqual([3]);
    expect(elimPairs(move)).toEqual([`${cellName(cellAt(4, 4))}#3`]);
  });

  test("XYZ-Wing clears the digit from cells that see all three cells", () => {
    const state = candState({
      [cellAt(0, 0)]: [1, 2, 3], // pivot, three candidates
      [cellAt(0, 1)]: [1, 3], // pincer in the same row and box
      [cellAt(4, 0)]: [2, 3], // pincer in the same column
    });
    const move = find("xyz-wing", state);
    expect(move.digits).toEqual([3]);
    expect(elimPairs(move)).toEqual([`${cellName(cellAt(1, 0))}#3`, `${cellName(cellAt(2, 0))}#3`].sort());
  });
});

describe("findAllMoves", () => {
  test("returns every technique that applies, easiest first", () => {
    const board = emptyBoard();
    for (let col = 0; col < 8; col += 1) board[cellAt(0, col)] = col + 1;
    const moves = findAllMoves(makeState(board));
    expect(moves.length).toBeGreaterThan(0);
    const ranks = moves.map((move) => move.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(moves[0].technique).toBe("naked-single");
  });
});

// ---------------------------------------------------------------------------
// Soundness: a technique must never remove a digit that the real solution puts
// in that cell, and never place a digit the solution disagrees with. This runs
// every technique against many generated grids, so a wrong rule shows up here
// even when no hand-written example covers it.
// ---------------------------------------------------------------------------

/** Small deterministic pseudo-random generator, so the sweep is reproducible. */
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_SOLUTION = parseBoard(
  "534678912" + "672195348" + "198342567" + "859761423" + "426853791" + "713924856" + "961537284" + "287419635" + "345286179"
);

/** A different but still valid solved grid, made by relabelling and reordering. */
function shuffledSolution(random) {
  const digitMap = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = 9; i > 1; i -= 1) {
    const j = 1 + Math.floor(random() * i);
    [digitMap[i], digitMap[j]] = [digitMap[j], digitMap[i]];
  }
  const rowOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let band = 0; band < 3; band += 1) {
    const a = band * 3 + Math.floor(random() * 3);
    const b = band * 3 + Math.floor(random() * 3);
    [rowOrder[a], rowOrder[b]] = [rowOrder[b], rowOrder[a]];
  }
  const solution = emptyBoard();
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) solution[cellAt(row, col)] = digitMap[BASE_SOLUTION[cellAt(rowOrder[row], col)]];
  }
  return solution;
}

describe("soundness sweep", () => {
  test("no technique ever contradicts the real solution", () => {
    const random = mulberry32(20260828);
    let movesChecked = 0;
    for (let round = 0; round < 60; round += 1) {
      const solution = shuffledSolution(random);
      const board = Int8Array.from(solution);
      const holes = 30 + Math.floor(random() * 30);
      for (let i = 0; i < holes; i += 1) board[Math.floor(random() * CELL_COUNT)] = 0;
      const state = makeState(board);
      for (const move of findAllMoves(state)) {
        movesChecked += 1;
        for (const placement of move.placements) {
          expect(`${cellName(placement.cell)}=${placement.digit}`).toBe(`${cellName(placement.cell)}=${solution[placement.cell]}`);
        }
        for (const elimination of move.eliminations) {
          expect(`${move.technique} ${cellName(elimination.cell)}#${elimination.digit}`).not.toBe(
            `${move.technique} ${cellName(elimination.cell)}#${solution[elimination.cell]}`
          );
        }
      }
    }
    expect(movesChecked).toBeGreaterThan(100);
  });

  test("every reported move actually changes something", () => {
    const random = mulberry32(7);
    for (let round = 0; round < 40; round += 1) {
      const solution = shuffledSolution(random);
      const board = Int8Array.from(solution);
      for (let i = 0; i < 45; i += 1) board[Math.floor(random() * CELL_COUNT)] = 0;
      const state = makeState(board);
      for (const move of findAllMoves(state)) {
        expect(move.placements.length + move.eliminations.length).toBeGreaterThan(0);
        // An elimination must target a digit the cell still holds.
        for (const elimination of move.eliminations) {
          expect(digitsOf(state.cands[elimination.cell])).toContain(elimination.digit);
        }
        // A placement must target an empty cell.
        for (const placement of move.placements) expect(board[placement.cell]).toBe(0);
      }
    }
  });

  test("the generated grids are real solutions", () => {
    const random = mulberry32(1);
    for (let round = 0; round < 5; round += 1) {
      const solution = shuffledSolution(random);
      expect(solve(solution)).not.toBeNull();
    }
  });
});
