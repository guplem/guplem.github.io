// AGENT-2 CANDIDATE: COUNT_DECAY=0.99 ONLY (Agent 1's lever, reference implementation)
// Implements exactly as Agent 1 describes: decay counts in learn() before the increment.
// This is the reference to beat -- our portfolio should exceed this.

import { MOVES, shift, gameValue, judge } from "../../game.js";

// ---- Tunables -----
const CTX_DECAY = 0.96;
const LL_ETA = 1.1;
const MAX_ORDER = 5;
const KT = 0.15;
const UNIFORM_LL = Math.log(1 / 3);
const COUNT_DECAY = 0.99; // Agent 1's lever: half-life ~69 rounds

function zeroCounts() {
  return { rock: 0, paper: 0, scissors: 0 };
}

export function createModel() {
  return {
    n: 0,
    llScores: {},
    tables: {},
    pHist: [],
    aHist: [],
    oHist: [],
    lastAI: null,
    lastOutcome: null,
  };
}

function tailKey(hist, order) {
  if (hist.length < order) return null;
  if (order === 0) return "";
  return hist.slice(-order).join("");
}

const CONTEXTS = [];

for (let order = 0; order <= MAX_ORDER; order++) {
  CONTEXTS.push({ id: "p" + order, tableName: "p" + order, key: (m) => tailKey(m.pHist, order) });
}

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

for (let order = 1; order <= 2; order++) {
  CONTEXTS.push({ id: "o" + order, tableName: "o" + order, key: (m) => tailKey(m.oHist, order) });
}

CONTEXTS.push({
  id: "po1",
  tableName: "po1",
  key: (m) =>
    m.pHist.length && m.lastOutcome != null
      ? m.pHist[m.pHist.length - 1] + ":" + m.lastOutcome
      : null,
});

CONTEXTS.push({ id: "ai1", tableName: "ai1", key: (m) => (m.lastAI == null ? null : m.lastAI) });

CONTEXTS.push({
  id: "ao1",
  tableName: "ao1",
  key: (m) => (m.lastAI != null && m.lastOutcome != null ? m.lastAI + "|" + m.lastOutcome : null),
});

CONTEXTS.push({
  id: "pao1",
  tableName: "pao1",
  key: (m) =>
    m.pHist.length && m.lastAI != null && m.lastOutcome != null
      ? m.pHist[m.pHist.length - 1] + "|" + m.lastAI + "|" + m.lastOutcome
      : null,
});

function getCounts(model, tableName, key) {
  if (key == null) return null;
  const tbl = model.tables[tableName];
  if (!tbl) return null;
  return tbl[key] || null;
}

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

function evOfMove(aiMove, dist) {
  return (
    dist.rock * gameValue(aiMove, "rock") +
    dist.paper * gameValue(aiMove, "paper") +
    dist.scissors * gameValue(aiMove, "scissors")
  );
}

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

function aggregate(model) {
  const votes = zeroCounts();
  const mix = zeroCounts();
  let totalW = 0;
  for (const c of CONTEXTS) {
    const dist = distFromCounts(getCounts(model, c.tableName, c.key(model)));
    if (!dist) continue;
    const w = Math.exp(LL_ETA * (model.llScores[c.id] || 0));
    votes[bestResponse(dist)] += w;
    mix.rock += w * dist.rock;
    mix.paper += w * dist.paper;
    mix.scissors += w * dist.scissors;
    totalW += w;
  }
  if (totalW <= 0) return null;
  mix.rock /= totalW;
  mix.paper /= totalW;
  mix.scissors /= totalW;
  return { votes, mix };
}

export function decide(model, rng = Math.random) {
  const agg = aggregate(model);
  if (!agg) {
    return { aiMove: randomMove(rng), predictedPlayerMove: null, confident: false, confidence: null };
  }
  const { votes, mix } = agg;
  let best = MOVES[0];
  let bestV = -Infinity;
  for (const m of MOVES) {
    if (votes[m] > bestV) {
      bestV = votes[m];
      best = m;
    }
  }
  const predictedPlayerMove = shift(best, 2);
  return { aiMove: best, predictedPlayerMove, confident: true, confidence: mix[predictedPlayerMove] };
}

export function learn(model, playerMove, aiMove) {
  if (!MOVES.includes(playerMove) || !MOVES.includes(aiMove)) return model;

  for (const c of CONTEXTS) {
    const dist = distFromCounts(getCounts(model, c.tableName, c.key(model)));
    const ll = dist == null ? UNIFORM_LL : Math.log(dist[playerMove]);
    model.llScores[c.id] = CTX_DECAY * (model.llScores[c.id] || 0) + ll;
  }

  // COUNT_DECAY: age all within-context counts before the new observation.
  // Deterministic (same ops, same order) -- rebuildModel() reproduces exact state.
  if (COUNT_DECAY < 1.0) {
    for (const tableName in model.tables) {
      const tbl = model.tables[tableName];
      for (const key in tbl) {
        const c = tbl[key];
        c.rock    *= COUNT_DECAY;
        c.paper   *= COUNT_DECAY;
        c.scissors *= COUNT_DECAY;
      }
    }
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

export function rebuildModel(rounds) {
  const model = createModel();
  if (!Array.isArray(rounds)) return model;
  for (const r of rounds) {
    if (r && MOVES.includes(r.p) && MOVES.includes(r.a)) learn(model, r.p, r.a);
  }
  return model;
}
