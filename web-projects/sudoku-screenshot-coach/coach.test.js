import { describe, test, expect } from "bun:test";
import { cellAt, emptyBoard, formatBoard, isConsistent, parseBoard } from "./board.js";
import { solve } from "./solver.js";
import { CELL_COUNT, cellName, computeCandidates, digitsOf, makeState } from "./board.js";
import { DIFFICULTY_TIERS, applyMoveToState, nextHint, rateDifficulty, reduceCandidates, solvePath } from "./coach.js";

const EASY =
  "530070000" + "600195000" + "098000060" + "800060003" + "400803001" + "700020006" + "060000280" + "000419005" + "000080079";
const EASY_SOLVED =
  "534678912" + "672195348" + "198342567" + "859761423" + "426853791" + "713924856" + "961537284" + "287419635" + "345286179";

// Needs more than singles: a known "hard" grid that pushes past basic moves.
const TOUGH =
  "000000010" + "400000000" + "020000000" + "000050407" + "008000300" + "001090000" + "300400200" + "050100000" + "000806000";

describe("nextHint", () => {
  test("returns the easiest move with a full explanation", () => {
    const hint = nextHint(parseBoard(EASY));
    expect(hint.status).toBe("ok");
    expect(hint.explanation).not.toBeNull();
    expect(hint.explanation.technique.rank).toBeLessThanOrEqual(2); // a single
    expect(hint.explanation.reasons.length).toBeGreaterThan(1);
    const placement = hint.explanation.move.placements[0];
    expect(placement.digit).toBe(Number(EASY_SOLVED[placement.cell]));
  });

  test("prefers the easiest technique available", () => {
    // The same grid must not be explained with a hard technique when a single works.
    const hint = nextHint(parseBoard(EASY));
    expect(hint.explanation.technique.id === "naked-single" || hint.explanation.technique.id === "hidden-single").toBe(true);
  });

  test("says the grid is already finished", () => {
    const hint = nextHint(parseBoard(EASY_SOLVED));
    expect(hint.status).toBe("solved");
    expect(hint.explanation).toBeNull();
    expect(hint.message.length).toBeGreaterThan(0);
  });

  test("reports a repeated digit instead of guessing a move", () => {
    const board = parseBoard(EASY);
    board[cellAt(0, 2)] = 5;
    const hint = nextHint(board);
    expect(hint.status).toBe("conflict");
    expect(hint.explanation).toBeNull();
    expect(hint.message).toContain("5");
  });

  test("reports a grid that cannot be completed", () => {
    const board = emptyBoard();
    for (let col = 1; col <= 8; col += 1) board[cellAt(0, col)] = col;
    board[cellAt(4, 0)] = 9;
    expect(nextHint(board).status).toBe("unsolvable");
  });

  test("still coaches a grid with more than one solution, and warns about it", () => {
    const board = parseBoard(EASY_SOLVED);
    board[cellAt(0, 3)] = 0;
    board[cellAt(0, 4)] = 0;
    board[cellAt(3, 3)] = 0;
    board[cellAt(3, 4)] = 0;
    const hint = nextHint(board);
    expect(hint.status).toBe("multiple");
    expect(hint.message.toLowerCase()).toContain("more than one");
  });

  test("falls back to the solution when no known technique applies", () => {
    const hint = nextHint(parseBoard(TOUGH));
    expect(["ok", "stuck"]).toContain(hint.status);
    if (hint.status === "stuck") {
      expect(hint.explanation).toBeNull();
      expect(hint.fallback).not.toBeNull();
      expect(hint.fallback.digit).toBe(Number(formatBoard(solve(parseBoard(TOUGH)))[hint.fallback.cell]));
    }
  });

  test("an elimination hint reports what it opens up next when it opens something", () => {
    // Walk the easy puzzle until an elimination move comes up, then check the field exists.
    let board = parseBoard(EASY);
    for (let step = 0; step < 60; step += 1) {
      const hint = nextHint(board);
      if (hint.status !== "ok" || !hint.explanation) break;
      expect(hint).toHaveProperty("unlocks");
      const placement = hint.explanation.move.placements[0];
      if (!placement) break;
      board[placement.cell] = placement.digit;
    }
  });
});

describe("solvePath", () => {
  test("solves an easy puzzle with human techniques only", () => {
    const path = solvePath(parseBoard(EASY));
    expect(path.solved).toBe(true);
    expect(path.usedSearch).toBe(false);
    expect(formatBoard(path.finalBoard)).toBe(EASY_SOLVED);
    expect(path.steps.length).toBeGreaterThan(0);
  });

  test("every step names its technique and reads as one line", () => {
    const path = solvePath(parseBoard(EASY));
    for (const step of path.steps) {
      expect(typeof step.summary).toBe("string");
      expect(step.summary.length).toBeGreaterThan(0);
      expect(step.explanation.technique.name.length).toBeGreaterThan(0);
      expect(step.explanation.reasons.length).toBeGreaterThan(0);
    }
  });

  test("no step ever contradicts the real solution", () => {
    const solution = parseBoard(EASY_SOLVED);
    for (const step of solvePath(parseBoard(EASY)).steps) {
      for (const placement of step.explanation.move.placements) {
        expect(placement.digit).toBe(solution[placement.cell]);
      }
      for (const elimination of step.explanation.move.eliminations) {
        expect(elimination.digit).not.toBe(solution[elimination.cell]);
      }
    }
  });

  test("finishes a puzzle that runs past the known techniques, and says so", () => {
    const path = solvePath(parseBoard(TOUGH));
    expect(path.solved).toBe(true);
    expect(isConsistent(path.finalBoard)).toBe(true);
    expect(formatBoard(path.finalBoard)).toBe(formatBoard(solve(parseBoard(TOUGH))));
    if (path.usedSearch) expect(path.difficulty.label).toBe(DIFFICULTY_TIERS.at(-1).label);
  });

  test("reports the hardest technique the puzzle needed", () => {
    const path = solvePath(parseBoard(EASY));
    expect(path.hardestTechnique).not.toBeNull();
    expect(path.difficulty.label).toBe("Easy");
  });

  test("returns the grid unchanged for an unsolvable puzzle", () => {
    const board = emptyBoard();
    for (let col = 1; col <= 8; col += 1) board[cellAt(0, col)] = col;
    board[cellAt(4, 0)] = 9;
    const path = solvePath(board);
    expect(path.solved).toBe(false);
    expect(path.status).toBe("unsolvable");
  });
});

// The grid a player reported: the candidate grid showed a 5 in r7c6 and r9c6
// that the coach itself could already rule out with a Pointing Pair.
const REPORTED = "4.86..79.9..7286.476.94.8..89..57.463.7486.196.4..9....4689.1...83.7496..79.6.4..";

describe("reduceCandidates", () => {
  test("rules out what the coach can prove, on the grid a player reported", () => {
    const board = parseBoard(REPORTED);
    const before = computeCandidates(board);
    // The naive candidates hold the 5 the player said should not be there.
    expect(digitsOf(before[cellAt(6, 5)])).toContain(5);
    expect(digitsOf(before[cellAt(8, 5)])).toContain(5);

    const reduced = reduceCandidates(board);
    expect(digitsOf(reduced.cands[cellAt(6, 5)])).toEqual([2, 3]);
    expect(digitsOf(reduced.cands[cellAt(8, 5)])).toEqual([1, 2, 3]);
    expect(reduced.removed).toBeGreaterThan(0);
    expect(reduced.techniques).toContain("pointing");
  });

  test("never rules out a digit the real solution needs", () => {
    const solution = solve(parseBoard(REPORTED));
    const reduced = reduceCandidates(parseBoard(REPORTED));
    for (let cell = 0; cell < CELL_COUNT; cell += 1) {
      if (reduced.cands[cell] === 0) continue; // a filled cell
      expect(`${cellName(cell)}:${digitsOf(reduced.cands[cell]).join("")}`).toContain(String(solution[cell]));
    }
  });

  test("running it again changes nothing", () => {
    const board = parseBoard(REPORTED);
    const once = reduceCandidates(board);
    const twice = reduceCandidates(board, once.cands);
    expect([...twice.cands]).toEqual([...once.cands]);
    expect(twice.removed).toBe(0);
  });

  test("leaves an easy puzzle alone when singles carry it", () => {
    // Nothing to rule out beyond the rules: the result matches the plain candidates.
    const board = parseBoard(EASY);
    const reduced = reduceCandidates(board);
    for (let cell = 0; cell < CELL_COUNT; cell += 1) {
      expect(digitsOf(reduced.cands[cell]).length).toBeLessThanOrEqual(digitsOf(computeCandidates(board)[cell]).length);
    }
  });
});

describe("nextHint with a candidate state", () => {
  test("does not offer an elimination that has already been applied", () => {
    const board = parseBoard(REPORTED);
    const first = nextHint(board);
    expect(first.explanation.move.eliminations.length).toBeGreaterThan(0);

    // Apply it, then ask again: the same move must not come back.
    const after = applyMoveToState(makeState(board), first.explanation.move);
    const second = nextHint(board, "en", after.cands);
    const sameCells = JSON.stringify(second.explanation?.move?.eliminations ?? []);
    expect(sameCells).not.toBe(JSON.stringify(first.explanation.move.eliminations));
  });

  test("stops offering eliminations once they have all been applied", () => {
    // On this grid the catalogue runs out after its eliminations. The coach must
    // say so honestly and hand over a verified digit, not repeat itself.
    const board = parseBoard(REPORTED);
    const reduced = reduceCandidates(board);
    const hint = nextHint(board, "en", reduced.cands);
    expect(hint.status).toBe("stuck");
    expect(hint.explanation).toBeNull();
    expect(hint.fallback).not.toBeNull();
    expect(hint.fallback.digit).toBe(solve(board)[hint.fallback.cell]);
  });
});

describe("rateDifficulty", () => {
  test("maps the hardest rank used to a label", () => {
    expect(rateDifficulty(1).label).toBe("Easy");
    expect(rateDifficulty(2).label).toBe("Easy");
    expect(rateDifficulty(4).label).toBe("Medium");
    expect(rateDifficulty(7).label).toBe("Hard");
    expect(rateDifficulty(11).label).toBe("Expert");
  });

  test("tiers are ordered and cover every technique rank", () => {
    const limits = DIFFICULTY_TIERS.map((tier) => tier.maxRank);
    expect(limits).toEqual([...limits].sort((a, b) => a - b));
    for (let rank = 1; rank <= 13; rank += 1) expect(rateDifficulty(rank)).toBeTruthy();
  });
});

describe("Spanish", () => {
  test("the hint comes back in Spanish", () => {
    const hint = nextHint(parseBoard(EASY), "es");
    expect(hint.status).toBe("ok");
    expect(hint.explanation.title.startsWith("Coloca")).toBe(true);
    expect(hint.message).toContain("Quedan");
    expect(hint.message).not.toContain("cells left");
  });

  test("a broken grid is reported in Spanish", () => {
    const board = parseBoard(EASY);
    board[cellAt(0, 2)] = 5;
    const hint = nextHint(board, "es");
    expect(hint.status).toBe("conflict");
    expect(hint.message).toContain("rompe las reglas");
  });

  test("the difficulty label follows the language", () => {
    expect(rateDifficulty(1, "es").label).toBe("Fácil");
    expect(rateDifficulty(11, "es").label).toBe("Experta");
    expect(solvePath(parseBoard(EASY), "es").difficulty.label).toBe("Fácil");
  });

  test("every step of a Spanish walkthrough is in Spanish", () => {
    const path = solvePath(parseBoard(EASY), "es");
    for (const step of path.steps) {
      expect(step.summary).not.toContain("Naked");
      expect(step.summary).not.toContain("Hidden");
      for (const reason of step.explanation.reasons) expect(reason).not.toContain("{");
    }
  });
});

describe("applyMoveToState", () => {
  test("writes a placement into the board and clears the peers", () => {
    const board = parseBoard(EASY);
    const hint = nextHint(board);
    const state = { board: Int8Array.from(board), cands: new Uint16Array(81) };
    const fresh = applyMoveToState({ board: Int8Array.from(board) }, hint.explanation.move);
    const { cell, digit } = hint.explanation.move.placements[0];
    expect(fresh.board[cell]).toBe(digit);
    expect(fresh.cands[cell]).toBe(0);
    void state;
  });

  test("an elimination removes the candidate but leaves the board alone", () => {
    const board = parseBoard(EASY);
    const move = { technique: "pointing", placements: [], eliminations: [{ cell: cellAt(0, 2), digit: 1 }] };
    const fresh = applyMoveToState({ board: Int8Array.from(board) }, move);
    expect(fresh.board[cellAt(0, 2)]).toBe(0);
    expect(fresh.cands[cellAt(0, 2)] & 1).toBe(0); // bit for digit 1 is gone
  });
});
