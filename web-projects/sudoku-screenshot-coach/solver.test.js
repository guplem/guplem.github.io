import { describe, test, expect } from "bun:test";
import { cellAt, emptyBoard, formatBoard, isConsistent, parseBoard } from "./board.js";
import { analyseBoard, countSolutions, solve } from "./solver.js";

const EASY =
  "530070000" + "600195000" + "098000060" + "800060003" + "400803001" + "700020006" + "060000280" + "000419005" + "000080079";
const EASY_SOLVED =
  "534678912" + "672195348" + "198342567" + "859761423" + "426853791" + "713924856" + "961537284" + "287419635" + "345286179";

// A 17-clue puzzle. It has one solution and needs search, not just singles.
const HARD =
  "000000010" + "400000000" + "020000000" + "000050407" + "008000300" + "001090000" + "300400200" + "050100000" + "000806000";

describe("solve", () => {
  test("solves a puzzle and returns the completed grid", () => {
    expect(formatBoard(solve(parseBoard(EASY)))).toBe(EASY_SOLVED);
  });

  test("solves a 17-clue puzzle", () => {
    const solution = solve(parseBoard(HARD));
    expect(solution).not.toBeNull();
    expect(isConsistent(solution)).toBe(true);
    expect(formatBoard(solution)).not.toContain(".");
  });

  test("leaves the input board untouched", () => {
    const board = parseBoard(EASY);
    solve(board);
    expect(formatBoard(board, "0")).toBe(EASY);
  });

  test("returns null when no completion exists", () => {
    const board = parseBoard(EASY);
    board[cellAt(0, 2)] = 1;
    board[cellAt(1, 2)] = 2;
    board[cellAt(2, 0)] = 1; // r3c1 = 1 clashes with the 1 now forced elsewhere in box 1
    board[cellAt(0, 5)] = 1;
    expect(solve(board)).toBeNull();
  });

  test("returns null for a grid that already repeats a digit", () => {
    const board = parseBoard(EASY);
    board[cellAt(0, 2)] = 5; // second 5 in row 1
    expect(solve(board)).toBeNull();
  });
});

describe("countSolutions", () => {
  test("counts exactly one for a proper puzzle", () => {
    expect(countSolutions(parseBoard(EASY))).toBe(1);
    expect(countSolutions(parseBoard(HARD))).toBe(1);
  });

  test("counts zero for a broken grid", () => {
    const board = parseBoard(EASY);
    board[cellAt(0, 2)] = 5;
    expect(countSolutions(board)).toBe(0);
  });

  test("stops at the limit instead of enumerating every solution", () => {
    // The empty grid has billions of solutions; the count must stop at 2.
    expect(countSolutions(emptyBoard(), 2)).toBe(2);
    expect(countSolutions(emptyBoard(), 5)).toBe(5);
  });

  test("detects a puzzle with more than one solution", () => {
    const board = parseBoard(EASY_SOLVED);
    // r1c4/r1c5 hold 6 and 7, r4c4/r4c5 hold 7 and 6. Emptying all four leaves
    // two valid ways to fill them: the classic "unavoidable set".
    board[cellAt(0, 3)] = 0;
    board[cellAt(0, 4)] = 0;
    board[cellAt(3, 3)] = 0;
    board[cellAt(3, 4)] = 0;
    expect(countSolutions(board)).toBeGreaterThan(1);
  });
});

describe("analyseBoard", () => {
  test("accepts a proper puzzle and returns its solution", () => {
    const result = analyseBoard(parseBoard(EASY));
    expect(result.status).toBe("ok");
    expect(formatBoard(result.solution)).toBe(EASY_SOLVED);
    expect(result.conflicts).toEqual([]);
  });

  test("reports a repeated digit as a conflict", () => {
    const board = parseBoard(EASY);
    board[cellAt(0, 2)] = 5;
    const result = analyseBoard(board);
    expect(result.status).toBe("conflict");
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.solution).toBeNull();
    expect(result.message).toContain("5");
  });

  test("reports an unsolvable grid that has no repeated digit", () => {
    const board = emptyBoard();
    // 1-8 across row 1 and a 9 in column 1 leave r1c1 with no digit at all.
    for (let col = 1; col <= 8; col += 1) board[cellAt(0, col)] = col;
    board[cellAt(4, 0)] = 9;
    const result = analyseBoard(board);
    expect(result.status).toBe("unsolvable");
    expect(result.solution).toBeNull();
  });

  test("reports a puzzle with several solutions", () => {
    const board = parseBoard(EASY_SOLVED);
    board[cellAt(0, 3)] = 0;
    board[cellAt(0, 4)] = 0;
    board[cellAt(3, 3)] = 0;
    board[cellAt(3, 4)] = 0;
    const result = analyseBoard(board);
    expect(result.status).toBe("multiple");
    expect(result.solution).not.toBeNull(); // one of them, so the coach can still help
  });

  test("reports a finished grid as complete", () => {
    const result = analyseBoard(parseBoard(EASY_SOLVED));
    expect(result.status).toBe("solved");
  });
});
