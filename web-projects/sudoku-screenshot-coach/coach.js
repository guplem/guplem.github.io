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
  digitsOf,
  emptyCount,
  isComplete,
  makeState,
} from "./board.js";
import { explainMove, moveSummary } from "./explain.js";
import { DEFAULT_LANGUAGE, t } from "./i18n.js";
import { analyseBoard, hasOneSolution, solve } from "./solver.js";
import { TECHNIQUES, findEasiestElimination, findEasiestMove, techniqueInfo } from "./techniques.js";

/**
 * How hard a puzzle is, from the hardest technique its solution needs.
 * The labels live in `i18n.js`; `rateDifficulty` fills them in.
 */
export const DIFFICULTY_TIERS = [
  { maxRank: 2, key: "easy" },
  { maxRank: 4, key: "medium" },
  { maxRank: 10, key: "hard" },
  { maxRank: 18, key: "expert" },
  { maxRank: 23, key: "master" },
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
  // A sound move keeps every solution the grid had, so a unique grid stays unique.
  return { board, cands, unique: state.unique === true };
}

/**
 * Apply every elimination the coach can prove, and hand back the candidates that
 * survive.
 *
 * The plain candidates of a cell come from the rules alone: a digit stays
 * possible until a peer holds it. The coach knows more than that. It can prove,
 * with a Pointing Pair or a Naked Triple, that a digit cannot go somewhere the
 * rules alone still allow. A candidate grid that shows those digits contradicts
 * the coach's own advice, so this brings the two together.
 *
 * No digit is ever placed here. Only candidates are ruled out, and only ones a
 * technique proves impossible, so nothing is guessed.
 *
 * Each step is kept, with the same explanation a hint would carry, because the
 * narrowing is the teaching: it is where Pointing Pairs, Naked Triples and the
 * rest are shown at work.
 *
 * @param {Int8Array} board the grid as it stands
 * @param {Uint16Array} [startCands] candidates to start from; the plain ones by default
 * @param {string} [lang] language for the explanations
 * @param {{unique?: boolean, maxRounds?: number}} [options] `unique` says the grid
 *   has exactly one solution, which the uniqueness techniques need. It is worked
 *   out here when the caller does not pass it.
 * @returns {{cands: Uint16Array, removed: number, techniques: string[], steps: Array}}
 *   `removed` counts the candidates ruled out, `techniques` names the ones that
 *   did it, and `steps` holds each one explained, in the order they were applied.
 */
export function reduceCandidates(board, startCands = computeCandidates(board), lang = DEFAULT_LANGUAGE, options = {}) {
  const { maxRounds = 800 } = options;
  const unique = options.unique ?? hasOneSolution(board);
  const cands = Uint16Array.from(startCands);
  const techniques = [];
  const steps = [];
  let removed = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    const state = { board, cands, unique };
    const move = findEasiestElimination(state);
    if (!move) break;
    // Explain the move against the grid as it stood BEFORE the move, or the
    // candidates it talks about would already be gone from the reasoning.
    const explanation = explainMove(move, { board, cands: Uint16Array.from(cands), unique }, lang);
    let removedThisRound = 0;
    for (const { cell, digit } of move.eliminations) {
      if ((cands[cell] & bitOf(digit)) === 0) continue;
      cands[cell] &= ~bitOf(digit);
      removedThisRound += 1;
    }
    // A technique that changes nothing would loop for ever. It should not
    // happen, because a finder only reports candidates a cell still holds, but
    // stopping here keeps that guarantee cheap to rely on.
    if (removedThisRound === 0) break;
    removed += removedThisRound;
    steps.push({ index: steps.length + 1, move, explanation, summary: moveSummary(move, lang) });
    if (!techniques.includes(move.technique)) techniques.push(move.technique);
  }

  return { cands, removed, techniques, steps };
}

/**
 * The move to show the player right now.
 * @param {Int8Array} board the grid as it stands
 * @param {string} [lang] language code
 * @param {Uint16Array} [cands] the candidates in play; the plain ones by default
 * @returns {{status: string, message: string, analysis: object,
 *   explanation: object|null, unlocks: object|null, fallback: {cell: number, digit: number}|null}}
 *   `status` is "ok" with a move, "solved", "stuck" (valid but past the known
 *   techniques), or one of the problem states from `analyseBoard`.
 */
export function nextHint(board, lang = DEFAULT_LANGUAGE, cands = null) {
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
  // Work from the candidates the page is showing, so the coach never offers an
  // elimination the player has already applied.
  const unique = analysis.status === "ok";
  const state = cands ? { board, cands, unique } : makeState(board, { unique });
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

  let state = makeState(cloneBoard(board), { unique: analysis.status === "ok" });
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
