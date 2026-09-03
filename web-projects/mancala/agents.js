// The opponents you can play against, weakest first.
//
// Each one is a name, a short description, and a PLAN: plain data saying which
// algorithm from search.js to run and with what settings. The plan is data
// rather than a closure for two reasons. It can be tested without playing a
// game, and `benchmark.js` can scale the thinking time down so a whole
// tournament finishes in minutes while every opponent keeps its own character.
//
// The order and the `tier` numbers are NOT guesses. `benchmark.js` plays every
// opponent against every other opponent, in both rule sets and both seats, and
// prints a table. The order below is the order that table produced. Re-run the
// benchmark after any change to search.js, evaluate.js or either engine, and if
// the order moves, change it here, in README.md and in adr/0004. See adr/0004.

import { randomMove, greedyMove, heuristicMove, minimaxMove, mctsMove } from "./search.js";

/** The value that means a person is playing this seat, not a program. */
export const HUMAN = "human";

/**
 * @typedef {Object} Agent
 * @property {string} id the value stored in the URL and in settings
 * @property {string} name what the player sees
 * @property {number} tier 1 is the weakest; the benchmark decides these
 * @property {string} level a one-word difficulty label
 * @property {string} blurb one sentence on how it thinks
 * @property {number} pauseMs how long the screen waits before a fast opponent
 *   plays, so its move does not appear instantly
 * @property {(mode: string) => Object} plan the algorithm and its settings
 */

/** @type {Agent[]} */
export const AGENTS = [
  {
    id: "random",
    name: "Pebble",
    tier: 1,
    level: "Beginner",
    blurb: "Plays any legal move, with no plan at all.",
    pauseMs: 340,
    plan: () => ({ kind: "random" }),
  },
  {
    id: "greedy",
    name: "Magpie",
    tier: 2,
    level: "Easy",
    blurb: "Grabs the most seeds it can this turn and never looks further.",
    pauseMs: 340,
    plan: () => ({ kind: "greedy" }),
  },
  {
    id: "heuristic",
    name: "Farmer",
    tier: 3,
    level: "Steady",
    blurb: "Judges the whole board after each of its moves and keeps the best one.",
    pauseMs: 320,
    plan: () => ({ kind: "heuristic" }),
  },
  {
    id: "minimax",
    name: "Weaver",
    tier: 4,
    level: "Tricky",
    blurb: "Looks a few moves ahead and expects you to answer well.",
    pauseMs: 240,
    plan: (mode) => ({ kind: "minimax", depth: mode === "baawa" ? 3 : 4 }),
  },
  {
    id: "mcts",
    name: "Dreamer",
    tier: 5,
    level: "Hard",
    blurb: "Plays hundreds of games out in its head and keeps the move that wins most.",
    pauseMs: 120,
    plan: (mode) => ({
      kind: "mcts",
      iterations: mode === "baawa" ? 400 : 1200,
      rolloutLimit: mode === "baawa" ? 120 : 90,
      rollout: "greedy",
      budgetMs: 700,
    }),
  },
  {
    id: "deep",
    name: "Chief",
    tier: 6,
    level: "Expert",
    blurb: "Searches as deep as the clock allows, one level at a time.",
    pauseMs: 80,
    // In Kalah the clock is the limit: 11 levels is more than 450ms reaches.
    // In Ba-awa the CAP is the limit on purpose, and it stops at 7. Ba-awa's
    // tree narrows as pits empty, so the same clock reaches 16 levels, and a
    // measured run says that is worse rather than better: at 16 this opponent
    // drew all six games against the tree-search opponent instead of winning
    // two, its win rate fell from 86.7% to 84.2%, and its thinking time went
    // from 170ms to 282ms a move. Do not "fix" the unused clock. See adr/0004.
    plan: (mode) => ({ kind: "deepening", budgetMs: 450, maxDepth: mode === "baawa" ? 7 : 11 }),
  },
];

/** Every opponent id, weakest first. */
export const AGENT_IDS = AGENTS.map((agent) => agent.id);

/** The opponent a fresh visitor plays against. */
export const DEFAULT_AGENT = "heuristic";

/**
 * Is this an opponent the game knows?
 * @param {string} id a candidate opponent id
 * @returns {boolean}
 */
export function isAgent(id) {
  return AGENT_IDS.includes(id);
}

/**
 * An opponent by id, falling back to the default for anything unknown.
 * @param {string} id an opponent id
 * @returns {Agent}
 */
export function agentById(id) {
  return AGENTS.find((agent) => agent.id === id) ?? AGENTS.find((agent) => agent.id === DEFAULT_AGENT);
}

/**
 * The settings an opponent would search with, scaled by `scale`. A scale below
 * one makes a thinking opponent think for less time; it never changes a fixed
 * search depth, because that would change the algorithm rather than its clock.
 * @param {string} id an opponent id
 * @param {string} mode the rule set being played
 * @param {number} [scale] multiplier for time and for the number of tries
 * @returns {Object} the plan
 */
export function planFor(id, mode, scale = 1) {
  const plan = agentById(id).plan(mode);
  if (scale === 1) return plan;
  const scaled = { ...plan };
  if (typeof plan.budgetMs === "number") scaled.budgetMs = Math.max(20, Math.round(plan.budgetMs * scale));
  if (typeof plan.iterations === "number") {
    scaled.iterations = Math.max(20, Math.round(plan.iterations * scale));
  }
  return scaled;
}

/**
 * Run a plan and get a move out of it.
 * @param {Object} plan a plan from `planFor`
 * @param {Object} state the position
 * @param {Object} rules the engine of the rule set being played
 * @param {() => number} rng a random-number generator
 * @returns {number} the pit it chose
 */
export function runPlan(plan, state, rules, rng) {
  switch (plan.kind) {
    case "random":
      return randomMove(state, rules, rng);
    case "greedy":
      return greedyMove(state, rules, rng);
    case "heuristic":
      return heuristicMove(state, rules, rng);
    case "minimax":
      return minimaxMove(state, rules, { depth: plan.depth, rng });
    case "deepening":
      return minimaxMove(state, rules, { budgetMs: plan.budgetMs, maxDepth: plan.maxDepth, rng });
    case "mcts":
      return mctsMove(state, rules, { ...plan, rng });
    default:
      throw new Error(`unknown plan ${plan.kind}`);
  }
}

/**
 * Ask an opponent for its move.
 * @param {string} id an opponent id
 * @param {Object} state the position
 * @param {Object} rules the engine of the rule set being played
 * @param {() => number} [rng] a random-number generator
 * @param {number} [scale] multiplier for thinking time, used by the benchmark
 * @returns {number} the pit it chose
 */
export function chooseMove(id, state, rules, rng = Math.random, scale = 1) {
  return runPlan(planFor(id, state.mode, scale), state, rules, rng);
}
