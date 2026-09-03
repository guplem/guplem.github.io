// The move-choosing algorithms. Each one takes a position and the engine of
// whichever rule set is being played, and answers with a pit to lift. None of
// them know which game they are playing, which is why the same six opponents
// work for both rule sets.
//
// From simplest to strongest:
//
//   randomMove     any legal move.
//   greedyMove     the move that scores most seeds right now.
//   heuristicMove  the move that leaves the best position after one move.
//   minimaxMove    look several moves ahead and assume the opponent plays
//                  their best answer. Alpha-beta pruning skips the branches
//                  that cannot change the decision.
//   mctsMove       Monte Carlo tree search: play the rest of the game out at
//                  random thousands of times and keep the move that wins most.
//
// One detail matters in Kalah and would be a bug if it were missed: a move can
// give the SAME player another turn. So the search must look at whose turn it
// is in each position, not assume the players alternate.

import { evaluate, WIN_SCORE } from "./evaluate.js";
import { pickOne } from "./rng.js";

/** How much Monte Carlo tree search prefers an unexplored move. */
export const UCT_C = 1.4;

/**
 * Any legal move.
 * @param {Object} state the position
 * @param {Object} rules the engine of the rule set being played
 * @param {() => number} rng a random-number generator
 * @returns {number} a pit index
 */
export function randomMove(state, rules, rng) {
  return pickOne(rules.legalMoves(state), rng);
}

/**
 * The move that scores the most seeds this turn. It counts an extra turn as
 * worth a little, and in Ba-awa it subtracts the seeds the move would hand to
 * the opponent, because sowing into their three-seed pits pays them.
 * @param {Object} state the position
 * @param {Object} rules the engine of the rule set being played
 * @param {() => number} rng a random-number generator
 * @returns {number} a pit index
 */
export function greedyMove(state, rules, rng) {
  return bestOf(rules.legalMoves(state), rng, (move) => {
    const look = rules.describeMove(state, move);
    const gain = look.gain ?? 0;
    const given = look.given ?? 0;
    return gain - given + (look.extraTurn ? 1.5 : 0);
  });
}

/**
 * The move that leaves the best position, judged one move deep by the
 * rule set's evaluation function.
 * @param {Object} state the position
 * @param {Object} rules the engine of the rule set being played
 * @param {() => number} rng a random-number generator
 * @returns {number} a pit index
 */
export function heuristicMove(state, rules, rng) {
  const player = state.turn;
  return bestOf(rules.legalMoves(state), rng, (move) =>
    evaluate(rules.applyMove(state, move).state, player)
  );
}

/**
 * Look ahead. Give `depth` to search exactly that many moves deep, or
 * `budgetMs` to deepen one level at a time until the time runs out.
 * @param {Object} state the position
 * @param {Object} rules the engine of the rule set being played
 * @param {{depth?: number, budgetMs?: number, maxDepth?: number, rng?: () => number}} options
 * @returns {number} a pit index
 */
export function minimaxMove(state, rules, options = {}) {
  const rng = options.rng ?? Math.random;
  const moves = rules.legalMoves(state);
  if (moves.length <= 1) return moves[0];

  const fixed = options.depth;
  if (fixed) {
    const search = searcher(rules, Infinity);
    return bestOf(moves, rng, (move) => valueOf(state, move, fixed, search));
  }

  // Iterative deepening: search two moves deep, then three, then four, and
  // keep the answer from the last depth that FINISHED. A pass that runs out of
  // time is thrown away, because a half-searched depth can be worse than a
  // fully searched shallower one.
  const deadline = Date.now() + (options.budgetMs ?? 300);
  const maxDepth = options.maxDepth ?? 12;
  const search = searcher(rules, deadline);
  let best = pickOne(moves, rng);
  for (let depth = 2; depth <= maxDepth; depth += 1) {
    try {
      best = bestOf(moves, rng, (move) => valueOf(state, move, depth, search));
    } catch (error) {
      if (error !== OUT_OF_TIME) throw error;
      break;
    }
    if (Date.now() >= deadline) break;
  }
  return best;
}

/**
 * What one move is worth to the player making it, searched `depth` deep.
 * @param {Object} state the position
 * @param {number} move the pit to lift
 * @param {number} depth plies to search, including this move
 * @param {Function} search a searcher from `searcher()`
 * @returns {number}
 */
function valueOf(state, move, depth, search) {
  const child = search.rules.applyMove(state, move).state;
  return search(child, depth - 1, -Infinity, Infinity, state.turn);
}

/** Thrown to abandon a search that has run out of time. */
const OUT_OF_TIME = Symbol("out of time");

/**
 * Build a minimax searcher with alpha-beta pruning. It always scores from
 * `root`'s point of view, and it gives up by throwing once the deadline
 * passes, which is what lets iterative deepening keep its promise about time.
 * @param {Object} rules the engine of the rule set being played
 * @param {number} deadline a Date.now() value to stop at
 * @returns {Function} the search function, with `.rules` attached
 */
export function searcher(rules, deadline = Infinity) {
  let nodes = 0;

  /**
   * @param {Object} state the position to score
   * @param {number} depth plies still to search
   * @param {number} alpha the best score `root` is already assured of
   * @param {number} beta the best score the opponent is already assured of
   * @param {number} root the player the score is for
   * @returns {number}
   */
  function search(state, depth, alpha, beta, root) {
    // Reading the clock is not free, so read it once every 512 positions.
    nodes += 1;
    if ((nodes & 511) === 0 && Date.now() > deadline) throw OUT_OF_TIME;

    if (state.over || depth === 0) return evaluate(state, root);
    const moves = rules.legalMoves(state);
    if (moves.length === 0) return evaluate(state, root);

    // Whose turn it is decides the direction, because a Kalah move can hand
    // the same player another turn.
    const maximizing = state.turn === root;

    // Look at the most promising move first: that is what makes the pruning
    // cut most of the tree away.
    const children = moves
      .map((move) => rules.applyMove(state, move).state)
      .map((child) => ({ child, guess: evaluate(child, root) }))
      .sort((a, b) => (maximizing ? b.guess - a.guess : a.guess - b.guess));

    let best = maximizing ? -Infinity : Infinity;
    for (const { child } of children) {
      const value = search(child, depth - 1, alpha, beta, root);
      if (maximizing) {
        if (value > best) best = value;
        if (best > alpha) alpha = best;
      } else {
        if (value < best) best = value;
        if (best < beta) beta = best;
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  search.rules = rules;
  return search;
}

/**
 * Minimax with alpha-beta pruning and no time limit.
 * @param {Object} state the position to score
 * @param {number} depth plies still to search
 * @param {number} alpha the best score `root` is already assured of
 * @param {number} beta the best score the opponent is already assured of
 * @param {number} root the player the score is for
 * @param {Object} rules the engine of the rule set being played
 * @returns {number}
 */
export function alphaBeta(state, depth, alpha, beta, root, rules) {
  return searcher(rules)(state, depth, alpha, beta, root);
}

/**
 * Monte Carlo tree search. It grows a tree of the moves it has tried, and
 * spends its next try where the mix of "wins often" and "barely tried" is
 * highest. Every try ends by playing the game out to the end at random.
 * @param {Object} state the position
 * @param {Object} rules the engine of the rule set being played
 * @param {{iterations?: number, rolloutLimit?: number, rollout?: string, budgetMs?: number, rng?: () => number}} options
 * @returns {number} a pit index
 */
export function mctsMove(state, rules, options = {}) {
  const rng = options.rng ?? Math.random;
  const iterations = options.iterations ?? 600;
  const rolloutLimit = options.rolloutLimit ?? 160;
  const rolloutKind = options.rollout ?? "random";
  const budget = options.budgetMs ?? Infinity;
  const started = Date.now();

  const moves = rules.legalMoves(state);
  if (moves.length <= 1) return moves[0];

  const root = node(state, null, null);
  const rootPlayer = state.turn;

  for (let step = 0; step < iterations; step += 1) {
    if (step % 32 === 0 && Date.now() - started > budget) break;

    let at = root;
    while (at.children && at.children.length > 0) at = select(at, rootPlayer, rng);

    if (!at.state.over && at.visits > 0) {
      at.children = rules
        .legalMoves(at.state)
        .map((move) => node(rules.applyMove(at.state, move).state, move, at));
      if (at.children.length > 0) at = pickOne(at.children, rng);
    }

    const reward = playOut(at.state, rules, rootPlayer, rng, rolloutLimit, rolloutKind);
    for (let up = at; up; up = up.parent) {
      up.visits += 1;
      up.total += reward;
    }
  }

  // The most-visited move, not the best average: a move tried many times is
  // the one the search kept coming back to.
  let best = root.children?.[0];
  for (const child of root.children ?? []) if (child.visits > best.visits) best = child;
  return best ? best.move : pickOne(moves, rng);
}

/** One node of the search tree. */
function node(state, move, parent) {
  return { state, move, parent, children: null, visits: 0, total: 0 };
}

/**
 * The child to explore next, by the UCT rule. A child nobody has tried yet
 * always wins, so every move gets looked at once before any gets looked at
 * twice.
 */
function select(parent, rootPlayer, rng) {
  const forRoot = parent.state.turn === rootPlayer;
  let best = null;
  let bestScore = -Infinity;
  for (const child of parent.children) {
    if (child.visits === 0) return child;
    const won = child.total / child.visits;
    // The reward is always stored from the root player's point of view, so
    // flip it when the player choosing here is the opponent.
    const value = forRoot ? won : 1 - won;
    const score = value + UCT_C * Math.sqrt(Math.log(parent.visits + 1) / child.visits);
    if (score > bestScore || (score === bestScore && rng() < 0.5)) {
      bestScore = score;
      best = child;
    }
  }
  return best ?? parent.children[0];
}

/**
 * Play a position out and say how it went for one player: 1 for a win, 0.5 for
 * a draw, 0 for a loss. A game cut off by the limit is judged on the score.
 */
function playOut(start, rules, player, rng, limit, kind) {
  let state = start;
  let steps = 0;
  while (!state.over && steps < limit) {
    const moves = rules.legalMoves(state);
    if (moves.length === 0) break;
    const move =
      kind === "greedy" && rng() < 0.7 ? greedyMove(state, rules, rng) : pickOne(moves, rng);
    state = rules.applyMove(state, move).state;
    steps += 1;
  }
  const mine = state.scores[player];
  const theirs = state.scores[player === 0 ? 1 : 0];
  if (mine === theirs) return 0.5;
  return mine > theirs ? 1 : 0;
}

/**
 * The highest-scoring item, with ties broken at random so an opponent does not
 * play the same game every time.
 * @param {number[]} moves the moves to choose between
 * @param {() => number} rng a random-number generator
 * @param {(move: number) => number} score how good a move is
 * @returns {number} the chosen move
 */
export function bestOf(moves, rng, score) {
  let best = [];
  let bestScore = -Infinity;
  for (const move of moves) {
    const value = score(move);
    if (value > bestScore) {
      bestScore = value;
      best = [move];
    } else if (value === bestScore) {
      best.push(move);
    }
  }
  return pickOne(best, rng);
}

export { WIN_SCORE };
