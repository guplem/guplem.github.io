import { describe, test, expect } from "bun:test";
import {
  ALL_DIGITS,
  BOX_HOUSES,
  CELL_COUNT,
  COL_HOUSES,
  HOUSES,
  HOUSES_OF_CELL,
  PEERS,
  ROW_HOUSES,
  boxOf,
  cellAt,
  cellName,
  cloneBoard,
  colOf,
  computeCandidates,
  countDigits,
  digitsOf,
  emptyBoard,
  emptyCount,
  findConflicts,
  findDeadCells,
  formatBoard,
  hasDigit,
  houseIdOf,
  houseName,
  isComplete,
  isConsistent,
  lineWord,
  relationWord,
  makeState,
  maskOf,
  parseBoard,
  rowOf,
  sees,
} from "./board.js";

// A well-formed puzzle with a single solution, used across the engine tests.
const EASY =
  "530070000" + "600195000" + "098000060" + "800060003" + "400803001" + "700020006" + "060000280" + "000419005" + "000080079";

describe("cell coordinates", () => {
  test("maps index to row, column and box", () => {
    expect([rowOf(0), colOf(0), boxOf(0)]).toEqual([0, 0, 0]);
    expect([rowOf(80), colOf(80), boxOf(80)]).toEqual([8, 8, 8]);
    expect([rowOf(40), colOf(40), boxOf(40)]).toEqual([4, 4, 4]);
    expect(boxOf(cellAt(1, 5))).toBe(1);
    expect(boxOf(cellAt(7, 2))).toBe(6);
  });

  test("names cells the way solvers write them", () => {
    expect(cellName(0)).toBe("r1c1");
    expect(cellName(cellAt(3, 6))).toBe("r4c7");
    expect(cellName(80)).toBe("r9c9");
  });
});

describe("digit masks", () => {
  test("round-trips digit lists", () => {
    expect(digitsOf(maskOf([1, 4, 9]))).toEqual([1, 4, 9]);
    expect(digitsOf(ALL_DIGITS)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(digitsOf(0)).toEqual([]);
  });

  test("counts and tests membership", () => {
    expect(countDigits(maskOf([2, 3, 7]))).toBe(3);
    expect(countDigits(0)).toBe(0);
    expect(hasDigit(maskOf([2, 3]), 3)).toBe(true);
    expect(hasDigit(maskOf([2, 3]), 4)).toBe(false);
  });
});

describe("houses and peers", () => {
  test("holds 27 houses of 9 cells each", () => {
    expect(HOUSES).toHaveLength(27);
    expect(ROW_HOUSES).toHaveLength(9);
    expect(COL_HOUSES).toHaveLength(9);
    expect(BOX_HOUSES).toHaveLength(9);
    for (const house of HOUSES) expect(house.cells).toHaveLength(9);
  });

  test("gives every cell exactly three houses", () => {
    for (let cell = 0; cell < CELL_COUNT; cell += 1) expect(HOUSES_OF_CELL[cell]).toHaveLength(3);
    expect(HOUSES[houseIdOf(cellAt(4, 4), "box")].index).toBe(4);
    expect(HOUSES[houseIdOf(cellAt(4, 4), "row")].index).toBe(4);
  });

  test("gives every cell exactly 20 peers", () => {
    for (let cell = 0; cell < CELL_COUNT; cell += 1) {
      expect(PEERS[cell]).toHaveLength(20);
      expect(PEERS[cell]).not.toContain(cell);
    }
  });

  test("sees() covers row, column and box, and nothing else", () => {
    expect(sees(cellAt(0, 0), cellAt(0, 8))).toBe(true); // same row
    expect(sees(cellAt(0, 0), cellAt(8, 0))).toBe(true); // same column
    expect(sees(cellAt(0, 0), cellAt(2, 2))).toBe(true); // same box
    expect(sees(cellAt(0, 0), cellAt(4, 5))).toBe(false);
    expect(sees(cellAt(3, 3), cellAt(3, 3))).toBe(false); // a cell does not see itself
  });

  test("names houses in words", () => {
    expect(houseName(houseIdOf(cellAt(3, 6), "row"))).toBe("row 4");
    expect(houseName(houseIdOf(cellAt(3, 6), "col"))).toBe("column 7");
    expect(houseName(houseIdOf(cellAt(3, 6), "box"))).toBe("box 6");
  });

  test("names houses in the language asked for", () => {
    expect(houseName(houseIdOf(cellAt(3, 6), "row"), "es")).toBe("la fila 4");
    expect(houseName(houseIdOf(cellAt(3, 6), "box"), "es")).toBe("la caja 6");
    expect(lineWord(houseIdOf(cellAt(3, 6), "col"), "es")).toBe("columna");
    expect(relationWord(houseIdOf(cellAt(3, 6), "row"), "es")).toBe("misma fila");
  });
});

describe("parseBoard / formatBoard", () => {
  test("round-trips an 81-character line", () => {
    expect(formatBoard(parseBoard(EASY), "0")).toBe(EASY);
  });

  test("ignores layout characters and accepts several empty markers", () => {
    const pretty = `
      5 3 . | . 7 . | . . .
      6 . . | 1 9 5 | . . .
      . 9 8 | . . . | . 6 .
      8 . . | . 6 . | . . 3
      4 . . | 8 . 3 | . . 1
      7 . . | . 2 . | . . 6
      . 6 . | . . . | 2 8 .
      . . . | 4 1 9 | . . 5
      . . . | . 8 . | . 7 9`;
    expect(formatBoard(parseBoard(pretty), "0")).toBe(EASY);
    expect(formatBoard(parseBoard(EASY.replace(/0/g, "_")), "0")).toBe(EASY);
  });

  test("rejects the wrong number of cells", () => {
    expect(() => parseBoard("123")).toThrow();
    expect(() => parseBoard(`${EASY}5`)).toThrow();
  });
});

describe("board helpers", () => {
  test("counts empty cells and completion", () => {
    expect(emptyCount(emptyBoard())).toBe(81);
    expect(isComplete(emptyBoard())).toBe(false);
    expect(emptyCount(parseBoard(EASY))).toBe(51);
    const full = parseBoard("1".repeat(81));
    expect(isComplete(full)).toBe(true);
  });

  test("cloneBoard copies without aliasing", () => {
    const board = parseBoard(EASY);
    const copy = cloneBoard(board);
    copy[0] = 9;
    expect(board[0]).toBe(5);
  });

});

describe("candidates", () => {
  test("a filled cell has no candidates", () => {
    const cands = computeCandidates(parseBoard(EASY));
    expect(cands[0]).toBe(0); // r1c1 holds 5
  });

  test("an empty cell keeps every digit no peer holds", () => {
    const board = parseBoard(EASY);
    const cands = computeCandidates(board);
    // r1c3 sees 5, 3, 7 (row 1), 8 (column 3) and 5, 3, 6, 9, 8 (box 1) -> 1, 2, 4 remain.
    expect(digitsOf(cands[cellAt(0, 2)])).toEqual([1, 2, 4]);
  });

  test("an empty board leaves every digit open", () => {
    const cands = computeCandidates(emptyBoard());
    for (let cell = 0; cell < CELL_COUNT; cell += 1) expect(cands[cell]).toBe(ALL_DIGITS);
  });

  test("makeState pairs the board with its candidates", () => {
    const board = parseBoard(EASY);
    const state = makeState(board);
    expect(state.board).toBe(board);
    expect(state.cands).toEqual(computeCandidates(board));
  });
});

describe("validation", () => {
  test("a clean puzzle reports no conflicts", () => {
    expect(findConflicts(parseBoard(EASY))).toEqual([]);
    expect(isConsistent(parseBoard(EASY))).toBe(true);
  });

  test("reports the pair of cells that repeat a digit", () => {
    const board = parseBoard(EASY);
    board[cellAt(0, 2)] = 5; // a second 5 in row 1 and in box 1
    const conflicts = findConflicts(board);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].digit).toBe(5);
    expect(conflicts[0].cells).toContain(cellAt(0, 0));
    expect(conflicts[0].cells).toContain(cellAt(0, 2));
    expect(isConsistent(board)).toBe(false);
  });

  test("finds empty cells that no digit can fill", () => {
    const board = emptyBoard();
    // Surround r1c1 with the digits 1-8 in its row and 9 in its column.
    for (let col = 1; col <= 8; col += 1) board[cellAt(0, col)] = col;
    board[cellAt(4, 0)] = 9;
    expect(findDeadCells(board)).toContain(0);
    expect(findDeadCells(parseBoard(EASY))).toEqual([]);
  });
});
