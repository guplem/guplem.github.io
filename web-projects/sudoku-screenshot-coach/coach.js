// The coach: it checks the grid, picks the next move to teach, and can walk a
// whole puzzle from start to finish.
//
// The rule for "next best move" is the rule a good human teacher follows: always
// show the easiest technique that makes progress. A player who is stuck rarely
// needs a clever pattern. They need the simple move they missed.

import {
  CELL_COUNT,
  bitOf,
  cellName,
  cloneBoard,
  computeCandidates,
  emptyCount,
  isComplete,
  makeState,
} from "./board.js";
import { explainMove, moveSummary } from "./explain.js";
import { DEFAULT_LANGUAGE, t } from "./i18n.js";
import { analyseBoard, solve } from "./solver.js";
import { TECHNIQUES, findEasiestMove, techniqueInfo } from "./techniques.js";

/**
 * How hard a puzzle is, from the hardest technique its solution needs.
 * The labels live in `i18n.js`; `rateDifficulty` fills them in.
 */
export const DIFFICULTY_TIERS = [
  { maxRank: 2, key: "easy" },
  { maxRank: 4, key: "medium" },
  { maxRank: 9, key: "hard" },
  { maxRank: 13, key: "expert" },
  { maxRank: Number.POSITIVE_INFINITY, key: "beyond" },
];

/** The tier a technique rank falls into, with its words filled in. */
export function rateDifficulty(rank, lang = DEFAULT_LANGUAGE) {
  const tier = DIFFICULTY_TIERS.find((candidate) => rank <= candidate.maxRank);
  return {
    ...tier,
    label: t(lang, `difficulty.${tier.key}`),
    blurb: t(lang, `difficulty.${tier.key}.blurb`),
  };
}

/**
 * Apply a move to a fresh copy of the state.
 * A placement writes the digit and rebuilds the candidates around it. An
 * elimination only clears candidate bits, because the board does not change.
 * @returns {{board: Int8Array, cands: Uint16Array}} a new state; the input is untouched
 */
export function applyMoveToState(state, move) {
  const board = cloneBoard(state.board);
  for (const { cell, digit } of move.placements) board[cell] = digit;
  const cands = state.cands && move.placements.length === 0 ? Uint16Array.from(state.cands) : computeCandidates(board);
  for (const { cell, digit } of move.eliminations) cands[cell] &= ~bitOf(digit);
  return { board, cands };
}

/**
 * The move to show the player right now.
 * @returns {{status: string, message: string, analysis: object,
 *   explanation: object|null, unlocks: object|null, fallback: {cell: number, digit: number}|null}}
 *   `status` is "ok" with a move, "solved", "stuck" (valid but past the known
 *   techniques), or one of the problem states from `analyseBoard`.
 */
export function nextHint(board, lang = DEFAULT_LANGUAGE) {
  const analysis = analyseBoard(board, lang);
  if (analysis.status === "conflict" || analysis.status === "unsolvable") {
    return { status: analysis.status, message: analysis.message, analysis, explanation: null, unlocks: null, fallback: null };
  }
  if (analysis.status === "solved") {
    return {
      status: "solved",
      message: t(lang, "coach.solved"),
      analysis,
      explanation: null,
      unlocks: null,
      fallback: null,
    };
  }

  const ambiguous = analysis.status === "multiple";
  const state = makeState(board);
  const move = findEasiestMove(state);
  if (!move) {
    // No known technique fits. Offer the verified digit so the player is never
    // left without a next step, and say plainly where it came from. A grid with
    // several solutions gets no such digit: there is no single right answer to
    // give, and the real problem is the ambiguity itself.
    let fallback = null;
    if (!ambiguous && analysis.solution) {
      for (let cell = 0; cell < CELL_COUNT; cell += 1) {
        if (board[cell] === 0) {
          fallback = { cell, digit: analysis.solution[cell] };
          break;
        }
      }
    }
    let message = t(lang, "coach.stuck.short");
    if (ambiguous) message = analysis.message;
    else if (fallback) {
      message = t(lang, "coach.stuck", {
        count: TECHNIQUES.length,
        digit: fallback.digit,
        cell: cellName(fallback.cell),
      });
    }
    return { status: ambiguous ? "multiple" : "stuck", message, analysis, explanation: null, unlocks: null, fallback };
  }

  const explanation = explainMove(move, state, lang);
  // An elimination is progress, not a placement. Say what it opens up, so the
  // player sees why the step is worth making.
  let unlocks = null;
  if (move.placements.length === 0) {
    const after = applyMoveToState(state, move);
    const followUp = findEasiestMove(after);
    if (followUp && followUp.placements.length > 0) unlocks = explainMove(followUp, after, lang);
  }

  const message = ambiguous
    ? analysis.message
    : t(lang, emptyCount(board) === 1 ? "coach.next.one" : "coach.next", {
        count: emptyCount(board),
        technique: explanation.technique.name,
      });
  return { status: ambiguous ? "multiple" : "ok", message, analysis, explanation, unlocks, fallback: null };
}

/**
 * Walk the puzzle from its current state to the end, one technique at a time.
 * @returns {{status: string, solved: boolean, usedSearch: boolean, steps: Array,
 *   finalBoard: Int8Array|null, hardestTechnique: object|null, difficulty: object}}
 *   `usedSearch` is true when the techniques ran out and the rest of the grid
 *   came from the solver instead.
 */
export function solvePath(board, lang = DEFAULT_LANGUAGE, maxSteps = 400) {
  const analysis = analyseBoard(board, lang);
  if (analysis.status === "conflict" || analysis.status === "unsolvable") {
    return {
      status: analysis.status,
      solved: false,
      usedSearch: false,
      steps: [],
      finalBoard: null,
      hardestTechnique: null,
      difficulty: rateDifficulty(0, lang),
      message: analysis.message,
    };
  }

  let state = makeState(cloneBoard(board));
  const steps = [];
  let hardestRank = 0;
  let hardestTechnique = null;

  while (steps.length < maxSteps && !isComplete(state.board)) {
    const move = findEasiestMove(state);
    if (!move) break;
    const explanation = explainMove(move, state, lang);
    steps.push({ index: steps.length + 1, move, explanation, summary: moveSummary(move, lang), remaining: emptyCount(state.board) });
    if (move.rank > hardestRank) {
      hardestRank = move.rank;
      hardestTechnique = techniqueInfo(move.technique, lang);
    }
    state = applyMoveToState(state, move);
  }

  const solvedByTechniques = isComplete(state.board);
  let finalBoard = state.board;
  let usedSearch = false;
  if (!solvedByTechniques) {
    const solution = analysis.solution ?? solve(state.board);
    if (solution) {
      finalBoard = solution;
      usedSearch = true;
    }
  }

  const difficulty = usedSearch ? rateDifficulty(Number.POSITIVE_INFINITY, lang) : rateDifficulty(hardestRank, lang);
  return {
    status: analysis.status === "multiple" ? "multiple" : "ok",
    solved: isComplete(finalBoard),
    usedSearch,
    steps,
    finalBoard,
    hardestTechnique,
    difficulty,
    message: usedSearch
      ? t(lang, "coach.searchUsed", { count: steps.filter((step) => step.move.placements.length > 0).length })
      : analysis.message,
  };
}
