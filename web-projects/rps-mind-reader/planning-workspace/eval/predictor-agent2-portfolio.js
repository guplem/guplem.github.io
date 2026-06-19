// AGENT-2 CANDIDATE: Expert Portfolio ONLY (no COUNT_DECAY)
// Round-1 recommendation: fast config (CTX_DECAY=0.92, KT=0.20) + base config (CTX_DECAY=0.96, KT=0.15)
// Doubles context count (28 total) but leaves within-context counts as raw accumulators.

import { MOVES, shift, gameValue, judge } from "../../game.js";

// ---- Tunables -----
const CTX_DECAY = 0.96;
const LL_ETA = 1.1;
const MAX_ORDER = 5;
const KT = 0.15;
const UNIFORM_LL = Math.log(1 / 3);

// Fast expert config
const CTX_DECAY_FAST = 0.92;
const KT_FAST = 0.20;

const CONFIGS = [
  { tag: "base", decay: CTX_DECAY, kt: KT },
  { tag: "fast", decay: CTX_DECAY_FAST, kt: KT_FAST },
];

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

function buildContextsForConfig(cfg) {
  const { tag } = cfg;
  const ctxs = [];

  for (let order = 0; order <= MAX_ORDER; order++) {
    ctxs.push({
      id: `p${order}|${tag}`,
      tableName: `p${order}|${tag}`,
      key: (m) => tailKey(m.pHist, order),
      cfg,
    });
  }

  for (let order = 1; order <= 2; order++) {
    ctxs.push({
      id: `pa${order}|${tag}`,
      tableName: `pa${order}|${tag}`,
      key: (m) => {
        if (m.pHist.length < order) return null;
        const parts = [];
        for (let i = 0; i < order; i++) {
          const idx = m.pHist.length - order + i;
          parts.push(m.pHist[idx] + m.aHist[idx]);
        }
        return parts.join("|");
      },
      cfg,
    });
  }

  for (let order = 1; order <= 2; order++) {
    ctxs.push({
      id: `o${order}|${tag}`,
      tableName: `o${order}|${tag}`,
      key: (m) => tailKey(m.oHist, order),
      cfg,
    });
  }

  ctxs.push({
    id: `po1|${tag}`,
    tableName: `po1|${tag}`,
    key: (m) =>
      m.pHist.length && m.lastOutcome != null
        ? m.pHist[m.pHist.length - 1] + ":" + m.lastOutcome
        : null,
    cfg,
  });

  ctxs.push({
    id: `ai1|${tag}`,
    tableName: `ai1|${tag}`,
    key: (m) => (m.lastAI == null ? null : m.lastAI),
    cfg,
  });

  ctxs.push({
    id: `ao1|${tag}`,
    tableName: `ao1|${tag}`,
    key: (m) => (m.lastAI != null && m.lastOutcome != null ? m.lastAI + "|" + m.lastOutcome : null),
    cfg,
  });

  ctxs.push({
    id: `pao1|${tag}`,
    tableName: `pao1|${tag}`,
    key: (m) =>
      m.pHist.length && m.lastAI != null && m.lastOutcome != null
        ? m.pHist[m.pHist.length - 1] + "|" + m.lastAI + "|" + m.lastOutcome
        : null,
    cfg,
  });

  return ctxs;
}

const ALL_CONTEXTS = CONFIGS.flatMap(buildContextsForConfig);

function getCounts(model, tableName, key) {
  if (key == null) return null;
  const tbl = model.tables[tableName];
  if (!tbl) return null;
  return tbl[key] || null;
}

function distFromCounts(counts, kt) {
  if (!counts) return null;
  const total = counts.rock + counts.paper + counts.scissors;
  if (total <= 0) return null;
  const denom = total + 3 * kt;
  return {
    rock: (counts.rock + kt) / denom,
    paper: (counts.paper + kt) / denom,
    scissors: (counts.scissors + kt) / denom,
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
  for (const c of ALL_CONTEXTS) {
    const dist = distFromCounts(getCounts(model, c.tableName, c.key(model)), c.cfg.kt);
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

  for (const c of ALL_CONTEXTS) {
    const dist = distFromCounts(getCounts(model, c.tableName, c.key(model)), c.cfg.kt);
    const ll = dist == null ? UNIFORM_LL : Math.log(dist[playerMove]);
    model.llScores[c.id] = c.cfg.decay * (model.llScores[c.id] || 0) + ll;
  }

  for (const c of ALL_CONTEXTS) {
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
