// Extended opponent battery for post-switch evaluation.
// Designed to expose adaptation-lag failure modes not covered by benchmark.js.
//
// Design principles:
//   1. All opponents are DETERMINISTIC given seed -- use mulberry32 for randomness.
//   2. The opponent never sees the AI's CURRENT move (simultaneous reveal),
//      matching playMatch() semantics: h[i] contains past rounds only.
//   3. Each opponent is labeled with what failure mode it specifically tests.
//
// Failure mode taxonomy:
//   STALE_BIAS   -- player switches from one move-frequency bias to another;
//                   stale counts keep predicting the old bias for many rounds.
//   REACTIVE     -- player switches FROM non-reactive to reactive (beat-last-AI);
//                   p0-p5 contexts are structurally blind, only pa/ao/ao1 help.
//   NOISY        -- gradual/blurry transitions where the switch boundary is not sharp;
//                   recency-decay helps more than clean-cut phase switches.
//   STRUCTURAL   -- player changes their entire strategy type (e.g. markov -> anti-repeat).

import { MOVES, shift, counter } from "../game.js";
import { mulberry32 } from "../benchmark.js";

export function randMove(rng) {
  return MOVES[Math.floor(rng() * MOVES.length)] || MOVES[0];
}

// ---- Bias families (STALE_BIAS) ------------------------------------------

// Alternates between 70% rock bias and 70% paper bias every N rounds.
export function makeBiasRockPaper(phaseLen) {
  return {
    name: `bias-rock-paper-${phaseLen}`,
    failureMode: "STALE_BIAS",
    switchPositions: (rounds) => {
      const positions = [];
      for (let i = phaseLen; i < rounds; i += phaseLen) positions.push(i);
      return positions;
    },
    make: () => {
      let c = 0;
      return (_h, rng) => {
        const phase = Math.floor(c++ / phaseLen) % 2;
        if (phase === 0) return rng() < 0.70 ? "rock" : rng() < 0.5 ? "paper" : "scissors";
        else return rng() < 0.70 ? "paper" : rng() < 0.5 ? "scissors" : "rock";
      };
    },
  };
}

// Three distinct bias phases: 70% rock -> 70% scissors -> 70% paper.
export function makeBiasThreePhase(phaseLen) {
  const biases = ["rock", "scissors", "paper"];
  return {
    name: `bias-three-phase-${phaseLen}`,
    failureMode: "STALE_BIAS",
    switchPositions: (rounds) => {
      const positions = [];
      for (let i = phaseLen; i < rounds; i += phaseLen) positions.push(i);
      return positions;
    },
    make: () => {
      let c = 0;
      return (_h, rng) => {
        const phase = Math.floor(c++ / phaseLen) % biases.length;
        const bias = biases[phase];
        return rng() < 0.75 ? bias : randMove(rng);
      };
    },
  };
}

// ---- Noisy phase switchers (NOISY) ----------------------------------------
// In a noisy switcher, the player's bias shifts gradually over a transition zone
// of `noiseRounds` rounds around each switch boundary.
// E.g. with phaseLen=60 and noiseWindow=12, for the 12 rounds around round 60
// the player is 50/50 between the two biases.

export function makeNoisySwitcher(phaseLen, noiseWindow, bias1, bias2) {
  const name = `noisy-${bias1}-${bias2}-p${phaseLen}-n${noiseWindow}`;
  return {
    name,
    failureMode: "NOISY",
    switchPositions: (rounds) => {
      const positions = [];
      for (let i = phaseLen; i < rounds; i += phaseLen) positions.push(i);
      return positions;
    },
    make: () => {
      let c = 0;
      return (_h, rng) => {
        const round = c++;
        // Which full-phase cycle are we in?
        const phaseNum = Math.floor(round / phaseLen);
        // Position within phase
        const posInPhase = round % phaseLen;
        // Transition zone: last noiseWindow/2 rounds of current phase,
        // first noiseWindow/2 rounds of next phase.
        const halfNoise = Math.floor(noiseWindow / 2);
        const distFromEnd = phaseLen - posInPhase;
        const distFromStart = posInPhase;

        let bias;
        if (distFromEnd <= halfNoise) {
          // Near end of phase: blend toward next
          const t = (halfNoise - distFromEnd) / halfNoise; // 0=start of transition, 1=midpoint
          const currentBias = phaseNum % 2 === 0 ? bias1 : bias2;
          const nextBias = phaseNum % 2 === 0 ? bias2 : bias1;
          bias = rng() < t * 0.5 + 0.5 * (1 - t) ? currentBias : nextBias;
          // Simplified: probability of "current" bias linearly goes from biasStrength to 0.5
        } else if (distFromStart < halfNoise) {
          // Near start of phase: blend from previous
          const t = distFromStart / halfNoise;
          const currentBias = phaseNum % 2 === 0 ? bias1 : bias2;
          const prevBias = phaseNum % 2 === 0 ? bias2 : bias1;
          bias = rng() < t * 0.5 + 0.5 * (1 - t) ? currentBias : prevBias;
        } else {
          bias = phaseNum % 2 === 0 ? bias1 : bias2;
        }

        // Play the bias move 75% of the time, random otherwise
        return rng() < 0.75 ? bias : randMove(rng);
      };
    },
  };
}

// Simpler noisy switcher: just adds noise to the bias probability (no smooth transition)
// Noise means each round independently has noise% chance of ignoring the current phase.
export function makeNoisySwitcherSimple(phaseLen, noiseRate, bias1, bias2) {
  const name = `noisy-simple-${bias1}-${bias2}-p${phaseLen}-nr${Math.round(noiseRate*100)}`;
  return {
    name,
    failureMode: "NOISY",
    switchPositions: (rounds) => {
      const positions = [];
      for (let i = phaseLen; i < rounds; i += phaseLen) positions.push(i);
      return positions;
    },
    make: () => {
      let c = 0;
      return (_h, rng) => {
        const round = c++;
        const phaseNum = Math.floor(round / phaseLen);
        const bias = phaseNum % 2 === 0 ? bias1 : bias2;
        // noiseRate chance of ignoring bias; otherwise 80% bias
        if (rng() < noiseRate) return randMove(rng);
        return rng() < 0.80 ? bias : randMove(rng);
      };
    },
  };
}

// ---- Reactive switchers (REACTIVE) ----------------------------------------
// These are THE critical failure mode: p0-p5 contexts cannot predict a
// reactive player. Only pa1, pa2, ao1, po1, pao1 can.

// Phase 1: stationary bias; Phase 2: beat-last-AI reactive.
// This is the DIAGNOSTIC opponent -- directly matches the match91 failure.
export function makeBiasThenBeatLastAI(phaseLen) {
  return {
    name: `bias-then-beatlastai-${phaseLen}`,
    failureMode: "REACTIVE",
    switchPositions: (rounds) => {
      const positions = [];
      for (let i = phaseLen; i < rounds; i += phaseLen) positions.push(i);
      return positions;
    },
    make: () => {
      let c = 0;
      return (h, rng) => {
        const phase = Math.floor(c++ / phaseLen) % 2;
        if (phase === 0) return rng() < 0.70 ? "rock" : randMove(rng);
        // Phase 1: beat last AI move
        return h.length ? counter(h[h.length - 1].a) : randMove(rng);
      };
    },
  };
}

// Phase 1: anti-repeat; Phase 2: beat-last-AI. Tests STRUCTURAL + REACTIVE.
export function makeAntiRepeatThenReactive(phaseLen) {
  return {
    name: `antirepeat-then-reactive-${phaseLen}`,
    failureMode: "REACTIVE",
    switchPositions: (rounds) => {
      const positions = [];
      for (let i = phaseLen; i < rounds; i += phaseLen) positions.push(i);
      return positions;
    },
    make: () => {
      let c = 0;
      return (h, rng) => {
        const phase = Math.floor(c++ / phaseLen) % 2;
        if (phase === 0) {
          if (!h.length) return randMove(rng);
          const others = MOVES.filter(m => m !== h[h.length - 1].p);
          return others[Math.floor(rng() * others.length)];
        }
        // Phase 1: beat-last-AI
        return h.length ? counter(h[h.length - 1].a) : randMove(rng);
      };
    },
  };
}

// ---- Structural switchers (STRUCTURAL) ------------------------------------
// The player changes strategy type entirely: markov habit -> anti-repeat.
export function makeMarkovThenAntiRepeat(phaseLen) {
  return {
    name: `markov-then-antirepeat-${phaseLen}`,
    failureMode: "STRUCTURAL",
    switchPositions: (rounds) => {
      const positions = [];
      for (let i = phaseLen; i < rounds; i += phaseLen) positions.push(i);
      return positions;
    },
    make: () => {
      let c = 0;
      const habit = { rock: "paper", paper: "scissors", scissors: "rock" };
      return (h, rng) => {
        const phase = Math.floor(c++ / phaseLen) % 2;
        if (phase === 0) {
          if (!h.length) return "rock";
          const last = h[h.length - 1].p;
          return rng() < 0.80 ? habit[last] : randMove(rng);
        }
        // Phase 1: anti-repeat
        if (!h.length) return randMove(rng);
        const others = MOVES.filter(m => m !== h[h.length - 1].p);
        return others[Math.floor(rng() * others.length)];
      };
    },
  };
}

// ---- Gradual drift (NOISY but no clean switch) ----------------------------
// Player's bias slowly shifts from one move to another over the full match.
export function makeGradualDrift(fromMove, toMove, totalRounds) {
  return {
    name: `gradual-drift-${fromMove}-to-${toMove}`,
    failureMode: "NOISY",
    switchPositions: () => [],  // no discrete switch points
    make: () => {
      let c = 0;
      return (_h, rng) => {
        const t = Math.min(c++ / (totalRounds - 1), 1.0);
        // Linear interpolation: at t=0 strong fromMove bias, at t=1 strong toMove bias
        const pFrom = 0.75 * (1 - t);
        const pTo = 0.75 * t;
        const r = rng();
        if (r < pFrom) return fromMove;
        if (r < pFrom + pTo) return toMove;
        return randMove(rng);
      };
    },
  };
}

// ---- Multi-phase cycle (stress test) --------------------------------------
// 4 phases: rock-bias -> scissors-bias -> anti-repeat -> paper-bias
// Tests whether the predictor can handle multiple switches within a short session.
export function makeMultiPhaseCycle(phaseLen) {
  return {
    name: `4phase-cycle-${phaseLen}`,
    failureMode: "STALE_BIAS",
    switchPositions: (rounds) => {
      const positions = [];
      for (let i = phaseLen; i < rounds; i += phaseLen) positions.push(i);
      return positions;
    },
    make: () => {
      let c = 0;
      return (h, rng) => {
        const phase = Math.floor(c++ / phaseLen) % 4;
        if (phase === 0) return rng() < 0.75 ? "rock" : randMove(rng);
        if (phase === 1) return rng() < 0.75 ? "scissors" : randMove(rng);
        if (phase === 2) {
          if (!h.length) return randMove(rng);
          const others = MOVES.filter(m => m !== h[h.length - 1].p);
          return others[Math.floor(rng() * others.length)];
        }
        return rng() < 0.75 ? "paper" : randMove(rng);
      };
    },
  };
}

// ---- Canonical battery --------------------------------------------------
// This is the full canonical battery used by bench-ext.js.
// Organized by failure mode for clear attribution of improvements.

export const switchingOpponents = [
  // STALE_BIAS family -- tests count staleness for bias shifts
  makeBiasRockPaper(15),
  makeBiasRockPaper(25),
  makeBiasRockPaper(40),
  makeBiasThreePhase(20),

  // NOISY family -- blurry transitions where recency-decay matters most
  // 60-round phases at 20% noise (Agent 1's explicit request)
  makeNoisySwitcherSimple(60, 0.20, "rock", "scissors"),
  // 20-round phases at 15% noise (Agent 1's explicit request)
  makeNoisySwitcherSimple(20, 0.15, "rock", "paper"),
  // 40-round phases at 15% noise
  makeNoisySwitcherSimple(40, 0.15, "scissors", "paper"),
  // Gradual drift (no discrete switch -- slow drift detection)
  makeGradualDrift("rock", "scissors", 80),

  // REACTIVE family -- THE CRITICAL TEST for pa/ao contexts
  // This directly matches the match91 failure mode.
  makeBiasThenBeatLastAI(25),
  makeBiasThenBeatLastAI(40),   // primary diagnostic opponent
  makeAntiRepeatThenReactive(30),

  // STRUCTURAL family -- strategy type changes
  makeMarkovThenAntiRepeat(25),
  makeMarkovThenAntiRepeat(40),

  // Multi-phase stress test
  makeMultiPhaseCycle(15),
  makeMultiPhaseCycle(20),
];
