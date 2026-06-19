// Extended benchmark harness for rps-mind-reader predictor evaluation.
// Tests adaptation speed and post-switch recovery -- metrics NOT captured by benchmark.js.
//
// Usage:
//   bun bench-ext.js                              # baseline predictor.js
//   bun bench-ext.js --predictor ./candidate.js   # any alternate predictor
//   bun bench-ext.js --seeds 80                   # more seeds for tighter CI
//   bun bench-ext.js --rounds 80                  # session-length (default: 80)
//   bun bench-ext.js --postWindow 10              # post-switch window width (default: 10)
//   bun bench-ext.js --mode summary               # summary only (default: full)
//   bun bench-ext.js --mode switching-only        # skip standard battery
//
// Output metrics (all AI-perspective net = (wins-losses)/rounds):
//   meanNet300       -- standard 300-round battery (same as benchmark.js meanNet)
//   worstNet300      -- same for worst opponent
//   switchMeanNet80  -- mean over switching opponents, 80-round sessions
//   switchWorstNet80 -- worst switching opponent at 80 rounds
//   switchPostW10    -- post-switch net, W=10 window, averaged across switching opponents
//   switchPostW15    -- same with W=15 window
//   liveNetMatch91   -- vs-model net on match91.json reactive model (from realplay-bench)
//   replayMatch91    -- replay net on match91.json (fixed sequence)
//
// Acceptance criteria (from config.md + agent-4 anti-overfitting protocol):
//   meanNet300   >= 71% (no regression)
//   worstNet300  >= 0%
//   switchMeanNet80 >= baseline (or same within noise)
//   switchPostW10   > -21.5% baseline (any improvement accepted)
//
// This is a READ-ONLY harness. It imports predictors but never modifies them.

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { existsSync, readFileSync } from "fs";
import { MOVES, judge, counter, shift } from "../../game.js";
import { mulberry32, playMatch, opponents as stdOpponents } from "../../benchmark.js";
import { switchingOpponents, randMove } from "./opponents-ext.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");

// ---- CLI argument parsing -------------------------------------------------

function parseArgs(argv) {
  const args = { predictorPath: null, seeds: 40, rounds: 80, postWindow: 10, mode: "full" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--predictor" && argv[i + 1]) args.predictorPath = argv[++i];
    else if (argv[i] === "--seeds" && argv[i + 1]) args.seeds = parseInt(argv[++i]);
    else if (argv[i] === "--rounds" && argv[i + 1]) args.rounds = parseInt(argv[++i]);
    else if (argv[i] === "--postWindow" && argv[i + 1]) args.postWindow = parseInt(argv[++i]);
    else if (argv[i] === "--mode" && argv[i + 1]) args.mode = argv[++i];
  }
  return args;
}

// ---- Runner helpers -------------------------------------------------------

function pctSigned(x) { return (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%"; }

// Run standard battery (same as benchmark.js) to get meanNet/worstNet at 300 rounds.
function runStandardBattery(predictor, seeds = 40) {
  let sumNet = 0, worstNet = Infinity;
  const results = [];
  for (const o of stdOpponents) {
    let w = 0, l = 0, t = 0;
    for (let s = 0; s < seeds; s++) {
      const r = playMatch(predictor, o.make, 300, 1000 + s * 7919);
      w += r.win; l += r.loss; t += r.tie;
    }
    const total = w + l + t;
    const net = (w - l) / total;
    results.push({ opponent: o.name, net });
    sumNet += net;
    worstNet = Math.min(worstNet, net);
  }
  return { meanNet: sumNet / results.length, worstNet, results };
}

// Compute post-switch net for a single match.
// switchPositions: array of 0-indexed round numbers where a phase begins (exclusive).
// Returns array of net values over [sw, sw+W) for each switch position.
function postSwitchNets(history, switchPositions, W) {
  const nets = [];
  for (const sw of switchPositions) {
    if (sw + W > history.length) continue;
    let w = 0, l = 0;
    for (let i = sw; i < sw + W; i++) {
      const o = history[i].o; // player perspective
      if (o === "loss") w++;   // AI wins
      else if (o === "win") l++; // AI loses
    }
    nets.push((w - l) / W);
  }
  return nets;
}

// Run a single switching opponent across seeds and compute switching metrics.
function runSwitchingOpponent(predictor, opp, rounds, seeds, postWindow) {
  let sumNet = 0;
  let allPostW = [];
  let allPostW15 = [];

  for (let s = 0; s < seeds; s++) {
    const aiRng = mulberry32(1000 + s * 7919);
    const oppRng = mulberry32(((1000 + s * 7919) ^ 0x9e3779b9) >>> 0);
    const oppFn = opp.make();
    const model = predictor.createModel();
    const history = [];
    let win = 0, loss = 0, tie = 0;

    for (let i = 0; i < rounds; i++) {
      const aiMove = predictor.decide(model, aiRng).aiMove;
      const playerMove = oppFn(history, oppRng);
      const out = judge(playerMove, aiMove);
      if (out === "loss") win++;
      else if (out === "win") loss++;
      else tie++;
      history.push({ p: playerMove, a: aiMove, o: out });
      predictor.learn(model, playerMove, aiMove);
    }

    sumNet += (win - loss) / rounds;

    const switchPos = opp.switchPositions(rounds);
    const psNets = postSwitchNets(history, switchPos, postWindow);
    const psNets15 = postSwitchNets(history, switchPos, 15);
    allPostW.push(...psNets);
    allPostW15.push(...psNets15);
  }

  const meanNet = sumNet / seeds;
  const meanPostW = allPostW.length ? allPostW.reduce((a, b) => a + b, 0) / allPostW.length : null;
  const meanPostW15 = allPostW15.length ? allPostW15.reduce((a, b) => a + b, 0) / allPostW15.length : null;

  return { opponent: opp.name, failureMode: opp.failureMode, meanNet, meanPostW, meanPostW15 };
}

// ---- Real-session metrics -------------------------------------------------
// These replicate the realplay-bench.js methodology locally so bench-ext.js
// is self-contained (doesn't shell out to realplay-bench.js).

function buildReactiveModel(rounds) {
  const freq = { rock: 0, paper: 0, scissors: 0 };
  for (const r of rounds) freq[r.p]++;

  const joint = {};
  for (let i = 1; i < rounds.length; i++) {
    const k = rounds[i - 1].p + "|" + rounds[i - 1].a + "|" + rounds[i - 1].o;
    if (!joint[k]) joint[k] = { rock: 0, paper: 0, scissors: 0 };
    joint[k][rounds[i].p]++;
  }

  function norm(counts, eps) {
    const o = {};
    let s = 0;
    for (const m of MOVES) { o[m] = (counts?.[m] || 0) + eps; s += o[m]; }
    for (const m of MOVES) o[m] /= s;
    return o;
  }

  const freqN = norm(freq, 0);

  function dist(last) {
    const c = joint[last.p + "|" + last.a + "|" + last.o];
    const n = c ? c.rock + c.paper + c.scissors : 0;
    return n >= 3 ? norm(c, 0.3) : freqN;
  }

  return {
    freqN,
    dist,
    make: () => (h, rng) => {
      if (!h.length) {
        let x = rng();
        for (const m of MOVES) {
          if (x < freqN[m]) return m;
          x -= freqN[m];
        }
        return MOVES[MOVES.length - 1];
      }
      const d = dist(h[h.length - 1]);
      let x = rng();
      for (const m of MOVES) {
        if (x < d[m]) return m;
        x -= d[m];
      }
      return MOVES[MOVES.length - 1];
    },
  };
}

function liveNet(predictor, make, rounds = 500, seeds = 120) {
  let w = 0, l = 0;
  for (let s = 0; s < seeds; s++) {
    const r = playMatch(predictor, make, rounds, 1000 + s * 7919);
    w += r.win; l += r.loss;
  }
  return (w - l) / (rounds * seeds);
}

function replayNet(predictor, playerMoves) {
  const m = predictor.createModel();
  let w = 0, l = 0;
  for (let i = 0; i < playerMoves.length; i++) {
    const d = predictor.decide(m, () => 0.5);
    const o = judge(playerMoves[i], d.aiMove);
    if (o === "loss") w++;
    else if (o === "win") l++;
    predictor.learn(m, playerMoves[i], d.aiMove);
  }
  return (w - l) / playerMoves.length;
}

function loadSession(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  return (data.rounds || []).filter(r => MOVES.includes(r.p) && MOVES.includes(r.a));
}

// ---- Main entry point ----------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Load predictor
  let predictorPath;
  if (args.predictorPath) {
    predictorPath = resolve(process.cwd(), args.predictorPath);
  } else {
    predictorPath = resolve(__dirname, "../../predictor.js");
  }

  if (!existsSync(predictorPath)) {
    console.error("ERROR: predictor not found at", predictorPath);
    process.exit(1);
  }

  const predictor = await import(predictorPath);
  const predictorName = args.predictorPath ? args.predictorPath : "predictor.js (production)";
  console.log("\n=== bench-ext.js : " + predictorName + " ===");
  console.log("seeds=" + args.seeds + "  rounds=" + args.rounds + "  postWindow=" + args.postWindow);

  // 1. Standard battery (300 rounds, matching benchmark.js)
  if (args.mode !== "switching-only") {
    console.log("\n--- Standard Battery (300 rounds, " + args.seeds + " seeds) ---");
    const std = runStandardBattery(predictor, args.seeds);
    for (const r of std.results) {
      console.log("  " + r.opponent.padEnd(24) + pctSigned(r.net).padStart(8));
    }
    console.log("  " + "MEAN".padEnd(24) + pctSigned(std.meanNet).padStart(8) +
                "   WORST " + pctSigned(std.worstNet));
    console.log("\n  KEY: meanNet300=" + pctSigned(std.meanNet) +
                "  worstNet300=" + pctSigned(std.worstNet));
  }

  // 2. Switching opponent battery
  console.log("\n--- Switching Battery (" + args.rounds + " rounds, " + args.seeds + " seeds, W=" + args.postWindow + ") ---");
  console.log("  " + "Opponent".padEnd(40) + "Mode".padEnd(12) +
              "net@" + args.rounds + "  PS@W" + args.postWindow + "   PS@W15");

  const switchResults = [];
  for (const opp of switchingOpponents) {
    const r = runSwitchingOpponent(predictor, opp, args.rounds, args.seeds, args.postWindow);
    switchResults.push(r);
    const psW = r.meanPostW !== null ? pctSigned(r.meanPostW) : " N/A ";
    const psW15 = r.meanPostW15 !== null ? pctSigned(r.meanPostW15) : " N/A ";
    console.log("  " + r.opponent.padEnd(40) + r.failureMode.padEnd(12) +
                pctSigned(r.meanNet).padStart(8) + "  " + psW.padStart(8) + "  " + psW15.padStart(8));
  }

  const validPS = switchResults.filter(r => r.meanPostW !== null);
  const switchMeanNet = switchResults.reduce((a, b) => a + b.meanNet, 0) / switchResults.length;
  const switchWorstNet = Math.min(...switchResults.map(r => r.meanNet));
  const switchMeanPostW = validPS.length
    ? validPS.reduce((a, b) => a + b.meanPostW, 0) / validPS.length
    : null;
  const switchMeanPostW15 = validPS.length
    ? validPS.reduce((a, b) => a + b.meanPostW15, 0) / validPS.length
    : null;
  const switchWorstPostW = validPS.length
    ? Math.min(...validPS.map(r => r.meanPostW))
    : null;

  console.log("\n  KEY SWITCHING METRICS:");
  console.log("    switchMeanNet80  = " + pctSigned(switchMeanNet));
  console.log("    switchWorstNet80 = " + pctSigned(switchWorstNet));
  if (switchMeanPostW !== null)
    console.log("    switchPostW" + args.postWindow + "    = " + pctSigned(switchMeanPostW));
  if (switchMeanPostW15 !== null)
    console.log("    switchPostW15    = " + pctSigned(switchMeanPostW15));
  if (switchWorstPostW !== null)
    console.log("    switchWorstPostW" + args.postWindow + " = " + pctSigned(switchWorstPostW));

  // 3. By failure mode breakdown
  const modes = [...new Set(switchResults.map(r => r.failureMode))];
  console.log("\n  BY FAILURE MODE:");
  for (const mode of modes) {
    const byMode = switchResults.filter(r => r.failureMode === mode);
    const modeNet = byMode.reduce((a, b) => a + b.meanNet, 0) / byMode.length;
    const modePS = byMode.filter(r => r.meanPostW !== null);
    const modePostW = modePS.length
      ? modePS.reduce((a, b) => a + b.meanPostW, 0) / modePS.length
      : null;
    console.log("    " + mode.padEnd(12) + " net=" + pctSigned(modeNet) +
                (modePostW !== null ? "  postW=" + pctSigned(modePostW) : ""));
  }

  // 4. Real-session metrics
  const match91Path = join(__dirname, "../../../sample-plays/match91.json");
  const session1Path = join(__dirname, "../../../sample-plays/human-session-1.json");

  if (existsSync(match91Path) || existsSync("/tmp/claude-0/-home-user-guplem-github-io/322a05da-68ea-528b-80f9-efea070f4cb3/scratchpad/match91.json")) {
    const actualPath = existsSync(match91Path) ? match91Path :
      "/tmp/claude-0/-home-user-guplem-github-io/322a05da-68ea-528b-80f9-efea070f4cb3/scratchpad/match91.json";
    console.log("\n--- Real Session: match91 (91 rounds, REAL HUMAN CAPTURE) ---");
    const m91rounds = loadSession(actualPath);
    const m91model = buildReactiveModel(m91rounds);
    const m91replay = replayNet(predictor, m91rounds.map(r => r.p));
    const m91live = liveNet(predictor, m91model.make);
    console.log("  replay net   : " + pctSigned(m91replay));
    console.log("  vs-model net : " + pctSigned(m91live));
  }

  if (existsSync(session1Path)) {
    console.log("\n--- Real Session: human-session-1 (80 rounds, real human capture) ---");
    const s1rounds = loadSession(session1Path);
    const s1model = buildReactiveModel(s1rounds);
    const s1replay = replayNet(predictor, s1rounds.map(r => r.p));
    const s1live = liveNet(predictor, s1model.make);
    console.log("  replay net   : " + pctSigned(s1replay));
    console.log("  vs-model net : " + pctSigned(s1live));
  }

  // 5. Summary scoreboard
  console.log("\n--- SCOREBOARD SUMMARY ---");
  console.log("  Use this table for cross-agent comparison:");
  console.log("  | Metric            | Value    |");
  console.log("  |-------------------|----------|");
  if (args.mode !== "switching-only") {
    // These would have been computed above
  }
  console.log("  | switchMeanNet80   | " + pctSigned(switchMeanNet).padStart(8) + " |");
  console.log("  | switchWorstNet80  | " + pctSigned(switchWorstNet).padStart(8) + " |");
  if (switchMeanPostW !== null)
    console.log("  | switchPostW" + args.postWindow + "     | " + pctSigned(switchMeanPostW).padStart(8) + " |");
  if (switchMeanPostW15 !== null)
    console.log("  | switchPostW15     | " + pctSigned(switchMeanPostW15).padStart(8) + " |");
}

if (import.meta.main) {
  main().catch(console.error);
}

export { runStandardBattery, runSwitchingOpponent, switchingOpponents, postSwitchNets };
