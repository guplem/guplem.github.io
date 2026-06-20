// Dev-only simulation harness for comparing RPS prediction algorithms.
// NOT loaded by the game (index.html / stats.html never import this) -- it exists
// purely to measure and improve predictor.js over time.
//
// Run:  bun benchmark.js          (benchmarks predictor.js, and ./candidate.js if present)
// Use:  import { benchmark } from "./benchmark.js"
//
// A "predictor" is any module exposing the SAME interface as predictor.js:
//   createModel() -> model
//   decide(model, rng) -> { aiMove }            // must read history only, never the live move
//   learn(model, playerMove, aiMove) -> model   // mutates; must be deterministic (replayable)
//
// An "opponent" is a player strategy: next(history, rng) -> move, where history is the
// array of past rounds { p, a, o } (player move, AI move, outcome from the PLAYER's view).
// Opponents never see the current AI move (simultaneous reveal), matching the real game.
//
// Metric: from the AI's perspective, net = (AI wins - AI losses) / rounds, per opponent.
//   * vs a truly random opponent the best achievable net is ~0 (you cannot beat noise).
//   * vs an exploitable opponent a good predictor drives net well above 0.
//   * an opponent that drives net NEGATIVE means the predictor is being exploited.
// Summary: meanNet (higher = exploits patterns better) and worstNet (closer to / above 0
// = harder to exploit). A strong algorithm maximizes meanNet while keeping worstNet >= ~0.

import { MOVES, judge, shift, counter } from "./game.js";
import * as baseline from "./predictor.js";

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randMove(rng) {
  return MOVES[Math.floor(rng() * MOVES.length)] || MOVES[0];
}

// ---- Opponent battery -----------------------------------------------------
// `make` returns a fresh, possibly-stateful strategy function per match.

export const opponents = [
  { name: "always-rock", make: () => () => "rock" },

  { name: "fixed-cycle", make: () => { let i = 0; return () => MOVES[i++ % 3]; } },

  { name: "uniform-random", make: () => (_h, rng) => randMove(rng) },

  { name: "biased-70-rock", make: () => (_h, rng) =>
      rng() < 0.7 ? "rock" : rng() < 0.5 ? "paper" : "scissors" },

  { name: "win-stay-lose-shift", make: () => (h, rng) => {
      if (!h.length) return randMove(rng);
      const last = h[h.length - 1];
      return last.o === "win" ? last.p : shift(last.p, 1 + Math.floor(rng() * 2));
  } },

  { name: "beat-last-ai", make: () => (h, rng) =>
      h.length ? counter(h[h.length - 1].a) : randMove(rng) },

  { name: "copy-last-ai", make: () => (h, rng) =>
      h.length ? h[h.length - 1].a : randMove(rng) },

  { name: "anti-repeat", make: () => (h, rng) => {
      if (!h.length) return randMove(rng);
      const others = MOVES.filter((m) => m !== h[h.length - 1].p);
      return others[Math.floor(rng() * others.length)];
  } },

  { name: "habit-markov", make: () => {
      const habit = { rock: "paper", paper: "scissors", scissors: "rock" };
      return (h, rng) => {
        if (!h.length) return "rock";
        const last = h[h.length - 1].p;
        return rng() < 0.8 ? habit[last] : randMove(rng);
      };
  } },

  { name: "pattern-RRPS-noisy", make: () => {
      const pat = ["rock", "rock", "paper", "scissors"];
      let i = 0;
      return (_h, rng) => { const m = pat[i++ % pat.length]; return rng() < 0.85 ? m : randMove(rng); };
  } },

  { name: "switch-every-40", make: () => {
      let c = 0, i = 0;
      return (_h, rng) => {
        const phase = Math.floor(c++ / 40) % 2;
        return phase === 0 ? "rock" : MOVES[i++ % 3];
      };
  } },

  { name: "adaptive-counter", make: () => {
      const aiCounts = { rock: 0, paper: 0, scissors: 0 };
      return (h, rng) => {
        if (h.length) aiCounts[h[h.length - 1].a]++;
        let top = null, n = 0;
        for (const m of MOVES) if (aiCounts[m] > n) { n = aiCounts[m]; top = m; }
        return top ? counter(top) : randMove(rng);
      };
  } },

  // Strategy-switching opponents (post-switch adaptation). Promoted from the dev
  // switching battery (bench/opponents.js) so the committed gate
  // sees the two hardest cases. Both stay net-positive overall; their value is
  // exercising the multi-round transient right after the player changes tactics --
  // the failure COUNT_DECAY was added to fix (see ADR 0001).

  // Phase 1 (40 rounds): 70% rock bias. Phase 2: beat the AI's last move (reactive).
  // The match91-style case: p0..p5 are blind to a reactive player after a bias phase.
  { name: "bias-then-beatlastai-40", make: () => {
      let c = 0;
      return (h, rng) => {
        const phase = Math.floor(c++ / 40) % 2;
        if (phase === 0) return rng() < 0.7 ? "rock" : randMove(rng);
        return h.length ? counter(h[h.length - 1].a) : randMove(rng);
      };
  } },

  // 60-round phases alternating rock/scissors bias at 20% per-round noise -- the worst
  // post-switch case in the dev battery (noise horizon longer than a safe decay window).
  { name: "noisy-rock-scissors-p60", make: () => {
      let c = 0;
      return (_h, rng) => {
        const phase = Math.floor(c++ / 60) % 2;
        const bias = phase === 0 ? "rock" : "scissors";
        if (rng() < 0.2) return randMove(rng);
        return rng() < 0.8 ? bias : randMove(rng);
      };
  } },
];

// ---- Runner ---------------------------------------------------------------

export function playMatch(predictor, opponentMake, rounds, seed) {
  const aiRng = mulberry32(seed);
  const oppRng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const opp = opponentMake();
  const model = predictor.createModel();
  const history = [];
  let win = 0, loss = 0, tie = 0; // AI perspective
  for (let i = 0; i < rounds; i++) {
    const aiMove = predictor.decide(model, aiRng).aiMove;
    const playerMove = opp(history, oppRng);
    const out = judge(playerMove, aiMove); // player perspective
    if (out === "loss") win++;
    else if (out === "win") loss++;
    else tie++;
    history.push({ p: playerMove, a: aiMove, o: out });
    predictor.learn(model, playerMove, aiMove);
  }
  return { win, loss, tie, rounds };
}

export function benchmark(predictor, { rounds = 300, seeds = 40 } = {}) {
  const results = [];
  let sumNet = 0, worstNet = Infinity;
  for (const o of opponents) {
    let w = 0, l = 0, t = 0;
    for (let s = 0; s < seeds; s++) {
      const r = playMatch(predictor, o.make, rounds, 1000 + s * 7919);
      w += r.win; l += r.loss; t += r.tie;
    }
    const total = w + l + t;
    const net = (w - l) / total;
    results.push({ opponent: o.name, winRate: w / total, net });
    sumNet += net;
    worstNet = Math.min(worstNet, net);
  }
  return { results, meanNet: sumNet / results.length, worstNet };
}

// ---- CLI ------------------------------------------------------------------

function pctSigned(x) { return (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%"; }

function printReport(name, pred, opts) {
  const { results, meanNet, worstNet } = benchmark(pred, opts);
  console.log("\n=== " + name + " ===");
  for (const r of results) {
    console.log(
      "  " + r.opponent.padEnd(22) +
      " win " + (r.winRate * 100).toFixed(1).padStart(5) + "%" +
      "   net " + pctSigned(r.net).padStart(7)
    );
  }
  console.log("  " + "── MEAN net".padEnd(22) + " " + pctSigned(meanNet) + "   worst net " + pctSigned(worstNet));
  return { meanNet, worstNet };
}

async function main() {
  const opts = { rounds: 300, seeds: 40 };
  printReport("baseline (predictor.js)", baseline, opts);
  try {
    const candidate = await import("./candidate.js");
    printReport("candidate (candidate.js)", candidate, opts);
  } catch {
    // no candidate.js present -- baseline only
  }
}

if (import.meta.main) main();
