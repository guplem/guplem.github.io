import { describe, test, expect } from "bun:test";
import {
  CELL_COUNT,
  cellAt,
  cellName,
  digitsOf,
  emptyBoard,
  isComplete,
  parseBoard,
  makeState,
} from "./board.js";
import { applyMoveToState } from "./coach.js";
import { LANGUAGE_CODES } from "./i18n.js";
import {
  TECHNIQUES,
  findTechnique,
  findAllMoves,
  findEasiestMove,
  techniqueCatalogue,
  techniqueInfo,
} from "./techniques.js";
import { BUG_PLUS_ONE_GRID, TECHNIQUE_FIXTURES, candState, fixtureState } from "./techniqueFixtures.js";
import { countSolutions, solve } from "./solver.js";

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

  test("every technique in the catalogue has a fixture that makes it fire", () => {
    // A new technique with no fixture would slip past every check below, and
    // past the explanation check in explain.test.js as well.
    for (const technique of TECHNIQUES) {
      expect(TECHNIQUE_FIXTURES[technique.id]).toBeDefined();
      const move = findTechnique(technique.id, fixtureState(technique.id));
      expect(`${technique.id}: ${move === null ? "no move" : "move"}`).toBe(`${technique.id}: move`);
      expect(move.technique).toBe(technique.id);
      expect(move.rank).toBe(technique.rank);
    }
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

  test("hidden quad keeps only the four digits in their four cells", () => {
    const move = find("hidden-quad", fixtureState("hidden-quad"));
    expect(move.digits).toEqual([4, 5, 6, 7]);
    expect(elimPairs(move)).toEqual(
      [
        `${cellName(cellAt(0, 0))}#1`,
        `${cellName(cellAt(0, 1))}#2`,
        `${cellName(cellAt(0, 2))}#3`,
        `${cellName(cellAt(0, 3))}#1`,
      ].sort()
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

  test("Jellyfish on four rows clears the digit from the four columns", () => {
    const move = find("jellyfish", fixtureState("jellyfish"));
    expect(move.digits).toEqual([3]);
    expect(move.eliminations).toHaveLength(20); // 5 other rows x 4 columns
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

describe("single-digit chains", () => {
  test("Skyscraper clears the digit from the cells both roof ends see", () => {
    const move = find("skyscraper", fixtureState("skyscraper"));
    expect(move.digits).toEqual([5]);
    // The two roof cells share box 2, so the rest of that box loses the 5.
    expect(elimPairs(move)).toEqual(
      [cellAt(2, 3), cellAt(2, 4), cellAt(2, 5)].map((cell) => `${cellName(cell)}#5`).sort()
    );
  });

  test("Two-String Kite clears the digit from the cell both far ends see", () => {
    const move = find("two-string-kite", fixtureState("two-string-kite"));
    expect(move.digits).toEqual([4]);
    expect(elimPairs(move)).toEqual([`${cellName(cellAt(5, 7))}#4`]);
  });

  test("Simple Coloring traps a cell that sees both colours", () => {
    const move = find("simple-coloring", fixtureState("simple-coloring"));
    expect(move.variant).toBe("trap");
    expect(move.digits).toEqual([6]);
    expect(elimPairs(move)).toEqual(
      [cellAt(3, 1), cellAt(3, 2), cellAt(4, 1), cellAt(4, 2)].map((cell) => `${cellName(cell)}#6`).sort()
    );
  });

  test("Simple Coloring drops a whole colour when two of its cells see each other", () => {
    // Four strong links on 7 that close an odd loop: r1c1 and r1c3 end up the
    // same colour and share box 1, so that colour cannot be the true one.
    const state = candState({}, [
      { cells: rowCells(0).filter((cell) => cell !== cellAt(0, 2)), remove: [7] },
      { cells: rowCells(1).filter((cell) => ![cellAt(1, 1), cellAt(1, 5)].includes(cell)), remove: [7] },
      { cells: rowCells(2).filter((cell) => ![cellAt(2, 5), cellAt(2, 2)].includes(cell)), remove: [7] },
      { cells: colCells(5).filter((cell) => ![cellAt(1, 5), cellAt(2, 5)].includes(cell)), remove: [7] },
      { cells: colCells(2).filter((cell) => ![cellAt(2, 2), cellAt(0, 2)].includes(cell)), remove: [7] },
    ]);
    const move = find("simple-coloring", state);
    expect(move.variant).toBe("wrap");
    expect(move.digits).toEqual([7]);
    // Every cell of the losing colour drops the 7.
    expect(elimPairs(move)).toEqual(
      [cellAt(0, 2), cellAt(1, 1), cellAt(2, 5)].map((cell) => `${cellName(cell)}#7`).sort()
    );
  });
});

describe("chains of two-candidate cells", () => {
  test("W-Wing clears the other digit from the cells both wing cells see", () => {
    const move = find("w-wing", fixtureState("w-wing"));
    expect(move.digits).toEqual([1]);
    expect(elimPairs(move)).toEqual([`${cellName(cellAt(0, 4))}#1`, `${cellName(cellAt(4, 0))}#1`].sort());
  });

  test("Remote Pairs clears both digits from the cells both ends see", () => {
    const move = find("remote-pairs", fixtureState("remote-pairs"));
    expect(move.digits).toEqual([3, 4]);
    expect(elimPairs(move)).toEqual(
      [
        `${cellName(cellAt(0, 5))}#3`,
        `${cellName(cellAt(0, 5))}#4`,
        `${cellName(cellAt(4, 0))}#3`,
        `${cellName(cellAt(4, 0))}#4`,
      ].sort()
    );
  });

  test("Remote Pairs needs an odd number of steps between the two ends", () => {
    // Three cells only. The two ends are two steps apart, so they can hold the
    // same digit and nothing follows.
    const state = candState({
      [cellAt(0, 0)]: [3, 4],
      [cellAt(0, 1)]: [3, 4],
      [cellAt(4, 1)]: [3, 4],
    });
    expect(find("remote-pairs", state)).toBeNull();
  });

  test("XY-Chain clears the shared end digit from the cells both ends see", () => {
    const move = find("xy-chain", fixtureState("xy-chain"));
    expect(move.digits).toEqual([1]);
    expect(elimPairs(move)).toEqual([`${cellName(cellAt(0, 8))}#1`, `${cellName(cellAt(4, 0))}#1`].sort());
  });
});

describe("uniqueness techniques", () => {
  const urState = (overrides) =>
    candState(overrides, [{ cells: Array.from({ length: CELL_COUNT }, (_, cell) => cell), remove: [1, 2] }]);

  /** The four corners of one rectangle across box 1 and box 2. */
  const CORNERS = { topLeft: cellAt(0, 0), topRight: cellAt(0, 4), bottomLeft: cellAt(1, 0), bottomRight: cellAt(1, 4) };

  test("Type 1: the one corner with extra digits loses both rectangle digits", () => {
    const move = find("unique-rectangle", { ...fixtureState("unique-rectangle") });
    expect(move.variant).toBe("1");
    expect(elimPairs(move)).toEqual(
      [`${cellName(CORNERS.bottomRight)}#1`, `${cellName(CORNERS.bottomRight)}#2`].sort()
    );
  });

  test("Type 2: the shared extra digit leaves every cell both corners see", () => {
    const state = {
      ...urState({
        [CORNERS.topLeft]: [1, 2],
        [CORNERS.bottomLeft]: [1, 2],
        [CORNERS.topRight]: [1, 2, 5],
        [CORNERS.bottomRight]: [1, 2, 5],
      }),
      unique: true,
    };
    const move = find("unique-rectangle", state);
    expect(move.variant).toBe("2");
    for (const elimination of move.eliminations) expect(elimination.digit).toBe(5);
    // Both corners sit in column 5, so the rest of that column loses the 5.
    expect(move.eliminations.map((elimination) => elimination.cell)).toContain(cellAt(2, 4));
  });

  test("Type 3: the two corners join a cell of their house to make a naked pair", () => {
    const state = {
      ...urState({
        [CORNERS.topLeft]: [1, 2],
        [CORNERS.bottomLeft]: [1, 2],
        [CORNERS.topRight]: [1, 2, 3],
        [CORNERS.bottomRight]: [1, 2, 4],
        [cellAt(5, 4)]: [3, 4],
      }),
      unique: true,
    };
    const move = find("unique-rectangle", state);
    expect(move.variant).toBe("3");
    expect(move.subsetDigits).toEqual([3, 4]);
    expect(move.subsetCells).toEqual([cellAt(5, 4)]);
    for (const elimination of move.eliminations) expect([3, 4]).toContain(elimination.digit);
  });

  test("Type 4: the digit with no other place in the house pushes the other one out", () => {
    const state = {
      ...urState({
        [CORNERS.topLeft]: [1, 2],
        [CORNERS.bottomLeft]: [1, 2],
        [CORNERS.topRight]: [1, 2, 3],
        [CORNERS.bottomRight]: [1, 2, 4],
      }),
      unique: true,
    };
    const move = find("unique-rectangle", state);
    expect(move.variant).toBe("4");
    expect(elimPairs(move)).toEqual(
      [`${cellName(CORNERS.topRight)}#2`, `${cellName(CORNERS.bottomRight)}#2`].sort()
    );
  });

  test("BUG+1 places the digit that appears an odd number of times", () => {
    const move = find("bug-plus-one", fixtureState("bug-plus-one"));
    expect(move.placements).toEqual([{ cell: cellAt(8, 7), digit: 6 }]);
    expect(move.placements[0].digit).toBe(solve(parseBoard(BUG_PLUS_ONE_GRID))[cellAt(8, 7)]);
  });

  test("both stay silent unless the grid is known to have one solution", () => {
    // Their whole argument is "this puzzle has one answer". Without that proof
    // they must report nothing, because on a grid with two answers the
    // reasoning is wrong.
    for (const id of ["unique-rectangle", "bug-plus-one"]) {
      expect(find(id, { ...fixtureState(id), unique: false })).toBeNull();
    }
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

  // The sweep above builds boards by punching random holes, so many of them have
  // several solutions. `makeState` leaves `unique` false, which keeps the
  // uniqueness techniques out of that sweep on purpose: their reasoning is only
  // valid for a grid with one answer. This sweep gives them grids that qualify.
  test("the uniqueness techniques never contradict the one real solution", () => {
    const random = mulberry32(4242);
    let movesChecked = 0;
    for (let round = 0; round < 40; round += 1) {
      const solution = shuffledSolution(random);
      const board = Int8Array.from(solution);
      // Remove a cell only while the grid still has exactly one completion, so
      // the solution above stays the only answer.
      const order = [...Array(CELL_COUNT).keys()];
      for (let i = CELL_COUNT - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (const cell of order) {
        const kept = board[cell];
        board[cell] = 0;
        if (countSolutions(board, 2) !== 1) board[cell] = kept;
      }
      let state = makeState(board, { unique: true });
      for (let step = 0; step < 120 && !isComplete(state.board); step += 1) {
        for (const id of ["unique-rectangle", "bug-plus-one"]) {
          const move = findTechnique(id, state);
          if (!move) continue;
          movesChecked += 1;
          for (const placement of move.placements) {
            expect(`${id} ${cellName(placement.cell)}=${placement.digit}`).toBe(
              `${id} ${cellName(placement.cell)}=${solution[placement.cell]}`
            );
          }
          for (const elimination of move.eliminations) {
            expect(`${id} ${cellName(elimination.cell)}#${elimination.digit}`).not.toBe(
              `${id} ${cellName(elimination.cell)}#${solution[elimination.cell]}`
            );
          }
        }
        const next = findEasiestMove(state);
        if (!next) break;
        state = applyMoveToState(state, next);
      }
    }
    expect(movesChecked).toBeGreaterThan(0);
  });

  test("the generated grids are real solutions", () => {
    const random = mulberry32(1);
    for (let round = 0; round < 5; round += 1) {
      const solution = shuffledSolution(random);
      expect(solve(solution)).not.toBeNull();
    }
  });
});
