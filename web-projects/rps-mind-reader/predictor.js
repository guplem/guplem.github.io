// Pure adaptive opponent for rock-paper-scissors. No DOM access -- safe to import
// from tests. It predicts the player's NEXT move and plays the counter.
//
// This algorithm was selected by an objective benchmark (see benchmark.js) after a
// from-scratch exploration: it beat the previous Markov/rotation-expert ensemble on
// a 12-opponent battery (mean net +72% vs +64%) and on a held-out battery of unseen
// opponents, with the best worst-case robustness. See ADR 0010 for the decision.
//
// ALGORITHM -- a Bayesian-style mixture of variable-order CONTEXT MODELS, each
// weighted by how well it has PREDICTED the player lately (recency-decayed
// log-likelihood), with every model voting for the move that maximizes expected
// game value against its own forecast.
//
//   1. CONTEXT MODELS. Each conditions the player's next-move distribution on a
//      different slice of recent history, estimated with Krichevsky-Trofimov add-K
//      smoothing (a principled low-count estimator):
//        - p0..p5 : the player's own last 0..5 moves -> variable-order Markov / PPM
//                   family (p0 = unconditional frequency).
//        - pa1,pa2: the last 1-2 (player,AI) pairs   -> players who react to the bot.
//        - o1,o2  : the last 1-2 outcomes            -> win-stay / lose-shift.
//        - po1    : (last player move, last outcome) -> the exact win/lose-shift sig.
//        - ai1    : the AI's last move               -> players who chase/counter us.
//
//   2. BAYESIAN MODEL WEIGHTING. Each model carries a recency-decayed sum of the
//      LOG-LIKELIHOOD it assigned to the moves that actually occurred; its weight is
//      exp(LL_ETA * score) -- a softmax over predictive accuracy. This promotes
//      models that forecast well and down-weights high-order models that overfit
//      when the true pattern is low-order. Exponential forgetting tracks a player
//      who changes tactics.
//
//   3. EXPECTED-VALUE VOTING. Each model votes (with its weight) for the AI move
//      that maximizes expected game value against ITS forecast; we play the move
//      with the most weighted votes. Reasoning over the full DISTRIBUTION (not just
//      the single most likely move) is what beats 50/50 opponents -- e.g. "never
//      repeat", where one reply is uniquely EV-optimal though no move is "most
//      likely".
//
// ROBUSTNESS. Versus a uniform-random player every context's log-likelihood
// converges to log(1/3), weights stay ~uniform, and (since the opponent is
// independent of us) every move is EV-0, so we cannot be exploited (worst-case net
// ~0). The only randomness is the cold-start fallback before any context has data.
//
// FAIRNESS + PERSISTENCE CONTRACT (matches the rest of the project):
//   decide(model, rng)  -- PURE: reads only the model, never the live player move.
//   learn(model, p, a)  -- DETERMINISTIC (no Math.random / Date), so replaying the
//                          stored rounds rebuilds the exact model (see ADR 0009).
// Only depends on ./game.js. Lightweight: integer count bumps + decayed-score
// updates per round -- runs in microseconds on a phone.

import { MOVES, shift, gameValue, judge } from "./game.js";

// ---- Tunables (chosen via the benchmark battery + held-out opponents) -----

const CTX_DECAY = 0.96; // exponential forgetting for the log-likelihood scores
const LL_ETA = 1.1; // softmax sharpness over predictive accuracy
const MAX_ORDER = 5; // deepest player-move context (variable-order Markov / PPM)
const KT = 0.15; // Krichevsky-Trofimov-style add-K smoothing pseudo-count
const UNIFORM_LL = Math.log(1 / 3); // log-likelihood credited to an abstaining model

function zeroCounts() {
  return { rock: 0, paper: 0, scissors: 0 };
}

export function createModel() {
  return {
    n: 0,
    llScores: {}, // contextId -> recency-decayed log-likelihood of realized moves
    tables: {}, // tableName -> (contextKey -> next-player-move counts)
    pHist: [], // player moves (most recent last)
    aHist: [], // AI moves
    oHist: [], // outcomes, player view: "win" | "loss" | "tie"
    lastAI: null,
    lastOutcome: null,
  };
}

// ---- Context definitions --------------------------------------------------
// Each context: id, tableName (namespaces its counts), key(model) -> lookup key,
// or null to abstain (not enough history yet).

function tailKey(hist, order) {
  if (hist.length < order) return null;
  if (order === 0) return ""; // unconditional frequency
  return hist.slice(-order).join("");
}

const CONTEXTS = [];

// Player's own recent moves, orders 0..MAX_ORDER (variable-order Markov / PPM).
for (let order = 0; order <= MAX_ORDER; order++) {
  CONTEXTS.push({ id: "p" + order, tableName: "p" + order, key: (m) => tailKey(m.pHist, order) });
}

// Recent (player, AI) interaction pairs, orders 1..2.
for (let order = 1; order <= 2; order++) {
  CONTEXTS.push({
    id: "pa" + order,
    tableName: "pa" + order,
    key: (m) => {
      if (m.pHist.length < order) return null;
      const parts = [];
      for (let i = 0; i < order; i++) {
        const idx = m.pHist.length - order + i;
        parts.push(m.pHist[idx] + m.aHist[idx]);
      }
      return parts.join("|");
    },
  });
}

// Recent outcomes (win/loss/tie), orders 1..2: win-stay / lose-shift behaviour.
for (let order = 1; order <= 2; order++) {
  CONTEXTS.push({ id: "o" + order, tableName: "o" + order, key: (m) => tailKey(m.oHist, order) });
}

// (last player move, last outcome): the precise win-stay / lose-shift signature.
CONTEXTS.push({
  id: "po1",
  tableName: "po1",
  key: (m) =>
    m.pHist.length && m.lastOutcome != null
      ? m.pHist[m.pHist.length - 1] + ":" + m.lastOutcome
      : null,
});

// AI's last move alone: players who chase or counter the bot's last throw.
CONTEXTS.push({ id: "ai1", tableName: "ai1", key: (m) => (m.lastAI == null ? null : m.lastAI) });

// ---- Estimation helpers ---------------------------------------------------

function getCounts(model, tableName, key) {
  if (key == null) return null;
  const tbl = model.tables[tableName];
  if (!tbl) return null;
  return tbl[key] || null;
}

// KT-smoothed distribution over the player's next move. Null when the context has
// never been seen (so it abstains entirely).
function distFromCounts(counts) {
  if (!counts) return null;
  const total = counts.rock + counts.paper + counts.scissors;
  if (total <= 0) return null;
  const denom = total + 3 * KT;
  return {
    rock: (counts.rock + KT) / denom,
    paper: (counts.paper + KT) / denom,
    scissors: (counts.scissors + KT) / denom,
  };
}

// Expected game value (AI perspective) of playing `aiMove` against a player dist.
function evOfMove(aiMove, dist) {
  return (
    dist.rock * gameValue(aiMove, "rock") +
    dist.paper * gameValue(aiMove, "paper") +
    dist.scissors * gameValue(aiMove, "scissors")
  );
}

// AI move maximizing EV against `dist`. Ties break by MOVES order -> deterministic.
function bestResponse(dist) {
  let best = MOVES[0];
  let bestEv = -Infinity;
  for (const m of MOVES) {
    const ev = evOfMove(m, dist);
    if (ev > bestEv) {
      bestEv = ev;
      best = m;
    }
  }
  return best;
}

export function randomMove(rng = Math.random) {
  return MOVES[Math.floor(rng() * MOVES.length)] || MOVES[0];
}

// Weighted vote over candidate AI moves: every context that has data votes (with
// its softmax weight) for the EV-best response to its own forecast. Returns the
// vote tallies, or null when no context has data yet (cold start).
function aggregate(model) {
  const votes = zeroCounts();
  let any = false;
  for (const c of CONTEXTS) {
    const dist = distFromCounts(getCounts(model, c.tableName, c.key(model)));
    if (!dist) continue;
    const w = Math.exp(LL_ETA * (model.llScores[c.id] || 0));
    votes[bestResponse(dist)] += w;
    any = true;
  }
  return any ? votes : null;
}

// Decide the AI move. PURE: never mutates the model, never sees the live move.
export function decide(model, rng = Math.random) {
  const votes = aggregate(model);
  if (!votes) {
    // Cold start: no context has data yet -> play uniformly at random.
    return { aiMove: randomMove(rng), predictedPlayerMove: null, confident: false };
  }
  let best = MOVES[0];
  let bestV = -Infinity;
  for (const m of MOVES) {
    if (votes[m] > bestV) {
      bestV = votes[m];
      best = m;
    }
  }
  // Report the move the AI actually counters, so the UI's "I predicted X" always
  // matches the move played: aiMove === counter(predictedPlayerMove).
  return { aiMove: best, predictedPlayerMove: shift(best, 2), confident: true };
}

// Feed a revealed round back in. Mutates + returns the model. DETERMINISTIC so that
// replaying stored rounds reproduces the model exactly (persistence). Each context
// is scored by the LOG-LIKELIHOOD it assigned to the realized move (using its
// distribution as it stood BEFORE this round); then the tables + rolling features
// are advanced.
export function learn(model, playerMove, aiMove) {
  if (!MOVES.includes(playerMove) || !MOVES.includes(aiMove)) return model;

  for (const c of CONTEXTS) {
    const dist = distFromCounts(getCounts(model, c.tableName, c.key(model)));
    const ll = dist == null ? UNIFORM_LL : Math.log(dist[playerMove]);
    model.llScores[c.id] = CTX_DECAY * (model.llScores[c.id] || 0) + ll;
  }

  for (const c of CONTEXTS) {
    const key = c.key(model);
    if (key == null) continue;
    model.tables[c.tableName] = model.tables[c.tableName] || {};
    const tbl = model.tables[c.tableName];
    tbl[key] = tbl[key] || zeroCounts();
    tbl[key][playerMove] += 1;
  }

  const outcome = judge(playerMove, aiMove);
  model.pHist.push(playerMove);
  model.aHist.push(aiMove);
  model.oHist.push(outcome);
  const cap = MAX_ORDER + 1;
  while (model.pHist.length > cap) model.pHist.shift();
  while (model.aHist.length > cap) model.aHist.shift();
  while (model.oHist.length > cap) model.oHist.shift();
  model.lastAI = aiMove;
  model.lastOutcome = outcome;
  model.n++;
  return model;
}

// Rebuild a model by replaying stored rounds. Because learn() is deterministic this
// reproduces the exact live model -- which is how persistence works: we store
// rounds, not the model (see ADR 0009).
export function rebuildModel(rounds) {
  const model = createModel();
  if (!Array.isArray(rounds)) return model;
  for (const r of rounds) {
    if (r && MOVES.includes(r.p) && MOVES.includes(r.a)) learn(model, r.p, r.a);
  }
  return model;
}
