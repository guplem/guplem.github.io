// Generates a deterministic synthetic switcher session in the same JSON format
// as the real sample-plays sessions. This serves as a reproducible stand-in
// for any lost real sessions.
//
// The synthetic session mimics the match91 failure profile:
//   - Starts with a mild rock bias (rounds 1-30)
//   - Switches to scissors-then-paper mix (rounds 31-60)
//   - Ends with a reactive phase: beat-last-AI pattern (rounds 61-91)
//   - Total: 91 rounds
//
// Usage: bun gen-synthetic-switcher.js [seed]
// Writes: planning-workspace/eval/synthetic-switcher-91.json
//
// IMPORTANT: This is a SYNTHETIC session. Do NOT use it as held-out validation.
// It should be used as an additional training target in the synthetic battery.
// Real validation uses only match91.json and human-session-1.json.

import { MOVES, judge, shift, counter } from "../../game.js";
import { mulberry32 } from "../../benchmark.js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as predictor from "../../predictor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = parseInt(process.argv[2]) || 42;

function randMove(rng) {
  return MOVES[Math.floor(rng() * MOVES.length)] || MOVES[0];
}

function generateSession(seed) {
  const aiRng = mulberry32(seed);
  const playerRng = mulberry32((seed ^ 0x12345678) >>> 0);
  const model = predictor.createModel();
  const rounds = [];
  let totals = { win: 0, loss: 0, tie: 0 };
  let bestStreak = 0;
  let currentStreak = 0;

  for (let i = 0; i < 91; i++) {
    const aiDecision = predictor.decide(model, aiRng);
    const aiMove = aiDecision.aiMove;
    const predicted = aiDecision.predictedPlayerMove;
    const confidence = aiDecision.confidence;

    // Player strategy:
    let playerMove;
    if (i < 30) {
      // Phase 1: rock bias (70%)
      playerMove = playerRng() < 0.70 ? "rock" : randMove(playerRng);
    } else if (i < 60) {
      // Phase 2: alternating scissors/paper bias
      const subPhase = Math.floor((i - 30) / 15) % 2;
      playerMove = subPhase === 0
        ? (playerRng() < 0.70 ? "scissors" : randMove(playerRng))
        : (playerRng() < 0.65 ? "paper" : randMove(playerRng));
    } else {
      // Phase 3: reactive -- beat last AI move
      if (rounds.length > 0) {
        playerMove = counter(rounds[rounds.length - 1].a);
      } else {
        playerMove = randMove(playerRng);
      }
    }

    const outcome = judge(playerMove, aiMove);
    if (outcome === "win") { totals.win++; currentStreak++; }
    else { currentStreak = 0; }
    if (outcome === "loss") totals.loss++;
    if (outcome === "tie") totals.tie++;
    bestStreak = Math.max(bestStreak, currentStreak);

    rounds.push({
      p: playerMove,
      a: aiMove,
      o: outcome,
      g: predicted || null,
      c: confidence || null,
    });

    predictor.learn(model, playerMove, aiMove);
  }

  return {
    version: 1,
    totals,
    bestStreak,
    rounds,
    // Metadata to distinguish synthetic from real
    _synthetic: true,
    _seed: seed,
    _description: "Synthetic 3-phase switcher: rock-bias(30) -> scissors/paper-bias(30) -> beat-last-AI(31)",
  };
}

const session = generateSession(SEED);
const outPath = join(__dirname, "synthetic-switcher-91.json");
writeFileSync(outPath, JSON.stringify(session, null, 2));
console.log("Written:", outPath);
console.log("Rounds:", session.rounds.length);
const counts = { rock: 0, paper: 0, scissors: 0 };
session.rounds.forEach(r => counts[r.p]++);
console.log("Player counts:", counts);
console.log("Totals:", session.totals);
