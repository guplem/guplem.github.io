// Pure adaptive opponent for rock-paper-scissors. No DOM access -- safe to import from tests.
//
// How it works (a lightweight, RPS-tuned alternative to a neural network):
//   * A handful of BASE PREDICTORS each guess the player's NEXT move from history
//     (overall frequency, variable-order Markov chains, and reactions to the AI's
//     last move / the last outcome).
//   * Each base guess `p` spawns three ROTATION EXPERTS recommending shift(p, 1|2|3)
//     as the AI move. Rotation 1 beats the prediction; rotations 2 and 3 cover the
//     "the player is trying to beat the bot" cases. The meta-selector therefore
//     learns the right counter-offset on its own.
//   * A recency-weighted score per expert (exponential DECAY) tracks how well each
//     would have done lately. Each turn the AI follows the best-scoring expert; if
//     none has a positive track record it plays uniformly at random -- an
//     unexploitable baseline that makes the bot start near chance and sharpen as it
//     learns you.
//
// Crucial fairness property: a move is chosen from PAST rounds only. decide() never
// sees the current player move, so the bot predicts -- it does not peek.

import { MOVES, shift, gameValue, judge } from "./game.js";

export const DECAY = 0.9; // recency weighting for expert scores (half-life ~6.6 rounds)
const CONTEXT = 3; // maximum Markov order

function zeroCounts() {
  return { rock: 0, paper: 0, scissors: 0 };
}

export function createModel() {
  return {
    n: 0,
    freq: zeroCounts(),
    markov: { 1: {}, 2: {}, 3: {} }, // order -> (context string -> next-move counts)
    reactAI: {}, // AI's previous move -> player's next-move counts
    reactOutcome: {}, // previous outcome -> player's next-move counts
    scores: {}, // expertId -> recency-weighted score
    recentPlayers: [], // last up to CONTEXT player moves (most recent last)
    lastAI: null,
    lastOutcome: null,
  };
}

// Most frequent move in a counts table, or null if empty. Ties break by MOVES
// order so predictions are deterministic (required for replay-based persistence).
function topMove(counts) {
  if (!counts) return null;
  let best = null;
  let bestN = 0;
  for (const m of MOVES) {
    const c = counts[m] || 0;
    if (c > bestN) {
      bestN = c;
      best = m;
    }
  }
  return bestN > 0 ? best : null;
}

function markovKey(moves, order) {
  if (moves.length < order) return null;
  return moves.slice(-order).join(",");
}

// Each base predictor maps the model to a predicted player move (or null to abstain).
const BASE_PREDICTORS = [
  { id: "freq", predict: (m) => topMove(m.freq) },
  { id: "markov1", predict: (m) => lookup(m.markov[1], markovKey(m.recentPlayers, 1)) },
  { id: "markov2", predict: (m) => lookup(m.markov[2], markovKey(m.recentPlayers, 2)) },
  { id: "markov3", predict: (m) => lookup(m.markov[3], markovKey(m.recentPlayers, 3)) },
  { id: "reactAI", predict: (m) => (m.lastAI == null ? null : topMove(m.reactAI[m.lastAI])) },
  { id: "reactOutcome", predict: (m) => (m.lastOutcome == null ? null : topMove(m.reactOutcome[m.lastOutcome])) },
];

const ROTATIONS = [1, 2, 3];

function lookup(table, key) {
  return key == null ? null : topMove(table[key]);
}

function basePredictions(model) {
  const preds = {};
  for (const bp of BASE_PREDICTORS) preds[bp.id] = bp.predict(model);
  return preds;
}

function expertId(baseId, r) {
  return baseId + ":" + r;
}

export function randomMove(random = Math.random) {
  return MOVES[Math.floor(random() * MOVES.length)] || MOVES[0];
}

// Decide the AI's move from the current model. Pure -- does NOT mutate the model
// and never sees the player's upcoming move.
export function decide(model, random = Math.random) {
  const preds = basePredictions(model);
  let bestId = null;
  let bestScore = 0; // an expert must have a positive track record to be trusted
  let bestMove = null;
  let bestPredicted = null;
  for (const bp of BASE_PREDICTORS) {
    const p = preds[bp.id];
    if (p == null) continue;
    for (const r of ROTATIONS) {
      const score = model.scores[expertId(bp.id, r)] || 0;
      if (score > bestScore) {
        bestScore = score;
        bestId = expertId(bp.id, r);
        bestMove = shift(p, r);
        bestPredicted = p;
      }
    }
  }
  if (bestId == null) {
    return { aiMove: randomMove(random), predictedPlayerMove: null, expertId: null, confident: false };
  }
  return { aiMove: bestMove, predictedPlayerMove: bestPredicted, expertId: bestId, confident: true };
}

// Feed a revealed round back into the model. Mutates and returns the model.
// Scores every expert against what it WOULD have recommended (using the tables as
// they stood before this round), then updates the tables and rolling context.
export function learn(model, playerMove, aiMove) {
  if (!MOVES.includes(playerMove) || !MOVES.includes(aiMove)) return model;

  const preds = basePredictions(model);
  for (const bp of BASE_PREDICTORS) {
    const p = preds[bp.id];
    for (const r of ROTATIONS) {
      const id = expertId(bp.id, r);
      const value = p == null ? 0 : gameValue(shift(p, r), playerMove);
      model.scores[id] = DECAY * (model.scores[id] || 0) + value;
    }
  }

  bump(model.freq, playerMove);
  for (let order = 1; order <= CONTEXT; order++) {
    const k = markovKey(model.recentPlayers, order);
    if (k != null) {
      model.markov[order][k] = model.markov[order][k] || zeroCounts();
      bump(model.markov[order][k], playerMove);
    }
  }
  if (model.lastAI != null) {
    model.reactAI[model.lastAI] = model.reactAI[model.lastAI] || zeroCounts();
    bump(model.reactAI[model.lastAI], playerMove);
  }
  if (model.lastOutcome != null) {
    model.reactOutcome[model.lastOutcome] = model.reactOutcome[model.lastOutcome] || zeroCounts();
    bump(model.reactOutcome[model.lastOutcome], playerMove);
  }

  model.recentPlayers.push(playerMove);
  while (model.recentPlayers.length > CONTEXT) model.recentPlayers.shift();
  model.lastAI = aiMove;
  model.lastOutcome = judge(playerMove, aiMove);
  model.n++;
  return model;
}

function bump(counts, move) {
  counts[move] = (counts[move] || 0) + 1;
}

// Rebuild a model by replaying stored rounds. Because learn() is deterministic in
// its table/score updates, this reproduces the exact live model -- which is how
// persistence works: we store rounds, not the model.
export function rebuildModel(rounds) {
  const model = createModel();
  if (!Array.isArray(rounds)) return model;
  for (const r of rounds) {
    if (r && MOVES.includes(r.p) && MOVES.includes(r.a)) learn(model, r.p, r.a);
  }
  return model;
}
