// Dev-only: measure the predictor against REAL recorded human play (exported via
// the game's "Export" button). NOT loaded by the game.
//
// Run:  bun realplay-bench.js [export.json ...]
//   With no args it scans ./sample-plays/*.json.
//
// For each session it reports, from the AI's perspective (net = win% - loss%):
//   - recorded     : the bot you ACTUALLY faced when this was recorded
//                    (negative = you beat it).
//   - replay       : the current predictor vs your FIXED move sequence. A rough
//                    LOWER BOUND only -- it ignores that a real human reacts to the
//                    AI's moves, so a reactive sequence looks near-unbeatable here.
//   - vs model     : the current predictor LIVE against a reactive model built from
//                    this session's (lastMove, lastAImove, lastOutcome) -> next-move
//                    statistics. The realistic "vs a player like this" estimate.
//   - oracle ceiling: the best net achievable by a predictor that KNOWS that model
//                    exactly -- i.e. how much edge is even available against this
//                    style. (A well-mixed human keeps this low.)

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { MOVES, judge } from "./game.js";
import * as predictor from "./predictor.js";
import { playMatch } from "./benchmark.js";

const DIR = dirname(fileURLToPath(import.meta.url));
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" }; // move -> what it beats
const zero = () => ({ rock: 0, paper: 0, scissors: 0 });

function loadSessions(args) {
  if (args.length) return args.map((p) => [p, JSON.parse(readFileSync(p, "utf8"))]);
  const dir = join(DIR, "sample-plays");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8"))]);
}

function norm(counts, eps) {
  const o = {};
  let s = 0;
  for (const m of MOVES) {
    o[m] = (counts?.[m] || 0) + eps;
    s += o[m];
  }
  for (const m of MOVES) o[m] /= s;
  return o;
}

function sample(dist, rng) {
  let x = rng();
  for (const m of MOVES) {
    if (x < dist[m]) return m;
    x -= dist[m];
  }
  return MOVES[MOVES.length - 1];
}

// Reactive model of the player: next move conditioned on (lastPlayer, lastAI,
// lastOutcome), backing off to overall frequency when that situation is unseen.
function reactiveModel(rounds) {
  const freq = zero();
  for (const r of rounds) freq[r.p]++;
  const joint = {};
  for (let i = 1; i < rounds.length; i++) {
    const k = rounds[i - 1].p + "|" + rounds[i - 1].a + "|" + rounds[i - 1].o;
    (joint[k] ??= zero())[rounds[i].p]++;
  }
  const freqN = norm(freq, 0);
  const dist = (last) => {
    const c = joint[last.p + "|" + last.a + "|" + last.o];
    const n = c ? c.rock + c.paper + c.scissors : 0;
    return n >= 3 ? norm(c, 0.3) : freqN;
  };
  return { freqN, dist, make: () => (h, rng) => (h.length ? sample(dist(h[h.length - 1]), rng) : sample(freqN, rng)) };
}

// A predictor that already knows the reactive model and plays the EV-best counter.
function oraclePredictor(model) {
  return {
    createModel: () => ({ last: null }),
    learn: (m, p, a) => {
      m.last = { p, a, o: judge(p, a) };
      return m;
    },
    decide: (m, rng) => {
      if (!m.last) return { aiMove: sample(model.freqN, rng) };
      const d = model.dist(m.last);
      let best = MOVES[0];
      let bestEv = -Infinity;
      for (const am of MOVES) {
        let ev = 0;
        for (const pm of MOVES) ev += d[pm] * (BEATS[am] === pm ? 1 : BEATS[pm] === am ? -1 : 0);
        if (ev > bestEv) {
          bestEv = ev;
          best = am;
        }
      }
      return { aiMove: best };
    },
  };
}

function replayNet(pred, playerMoves) {
  const m = pred.createModel();
  let w = 0;
  let l = 0;
  for (let i = 0; i < playerMoves.length; i++) {
    const d = pred.decide(m, () => 0.5);
    const o = judge(playerMoves[i], d.aiMove);
    if (o === "loss") w++;
    else if (o === "win") l++;
    pred.learn(m, playerMoves[i], d.aiMove);
  }
  return (w - l) / playerMoves.length;
}

function liveNet(pred, make, rounds = 500, seeds = 120) {
  let w = 0;
  let l = 0;
  for (let s = 0; s < seeds; s++) {
    const r = playMatch(pred, make, rounds, 1000 + s * 7919);
    w += r.win;
    l += r.loss;
  }
  return (w - l) / (rounds * seeds);
}

const pct = (x) => (x >= 0 ? "+" : "") + (100 * x).toFixed(1) + "%";

function main() {
  const sessions = loadSessions(process.argv.slice(2));
  for (const [name, data] of sessions) {
    const rounds = (data.rounds || []).filter((r) => MOVES.includes(r.p) && MOVES.includes(r.a));
    if (rounds.length < 10) {
      console.log("\n=== " + name + " -- only " + rounds.length + " valid rounds, skipping ===");
      continue;
    }
    const model = reactiveModel(rounds);
    let rw = 0;
    let rl = 0;
    for (const r of rounds) {
      if (r.o === "loss") rw++;
      else if (r.o === "win") rl++;
    }
    console.log("\n=== " + name + " (" + rounds.length + " rounds) ===");
    console.log("  recorded bot you faced : " + pct((rw - rl) / rounds.length) + "  (negative = you beat it)");
    console.log("  current bot, replay    : " + pct(replayNet(predictor, rounds.map((r) => r.p))) + "  (lower bound -- ignores your reactions)");
    console.log("  current bot vs model   : " + pct(liveNet(predictor, model.make)));
    console.log("  oracle ceiling         : " + pct(liveNet(oraclePredictor(model), model.make)) + "  (max edge available vs this style)");
  }
}

if (import.meta.main) main();
