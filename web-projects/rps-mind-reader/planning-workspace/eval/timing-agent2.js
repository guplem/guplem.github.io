import { createModel, learn, decide } from "../../predictor.js";
import { createModel as createModelP, learn as learnP, decide as decideP } from "./predictor-agent2-portfolio.js";
import { createModel as createModelC, learn as learnC, decide as decideC } from "./predictor-agent2-countdecay.js";
import { createModel as createModelComb, learn as learnComb, decide as decideComb } from "./predictor-agent2-combined.js";

const MOVES = ["rock", "paper", "scissors"];
const ROUNDS = 50000;

function timeRounds(createFn, learnFn, decideFn, label) {
  const model = createFn();
  const moves = Array.from({length: ROUNDS}, (_, i) => MOVES[i % 3]);
  const start = performance.now();
  for (let i = 0; i < ROUNDS; i++) {
    decideFn(model, () => 0.5);
    learnFn(model, moves[i], moves[(i + 1) % 3]);
  }
  const elapsed = performance.now() - start;
  const usPerRound = (elapsed * 1000) / ROUNDS;
  console.log(`${label}: ${usPerRound.toFixed(2)} us/round  (total ${elapsed.toFixed(0)}ms for ${ROUNDS} rounds)`);
}

timeRounds(createModel, learn, decide, "baseline    (14 contexts)");
timeRounds(createModelP, learnP, decideP, "portfolio   (28 contexts, no COUNT_DECAY)");
timeRounds(createModelC, learnC, decideC, "countdecay  (14 contexts, COUNT_DECAY=0.99)");
timeRounds(createModelComb, learnComb, decideComb, "combined    (28 contexts, COUNT_DECAY=0.99)");
