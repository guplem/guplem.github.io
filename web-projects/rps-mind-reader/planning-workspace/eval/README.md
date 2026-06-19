# eval/ — Extended Evaluation Harness

This directory contains the reproducible evaluation infrastructure for the RPS predictor
improvement bake-off (Round 2+). It was built by Agent 4 (Adversary & Evaluation).

## Files

| File | Purpose |
|---|---|
| `bench-ext.js` | Main runner -- parameterizable, imports any predictor variant |
| `opponents-ext.js` | Extended opponent battery (switching, noisy, reactive) |
| `gen-synthetic-switcher.js` | Generates `synthetic-switcher-91.json` deterministically |
| `synthetic-switcher-91.json` | A synthetic 91-round 3-phase session (NOT held-out) |
| `README.md` | This file |

## Quick Start

```bash
# Baseline (production predictor.js)
bun planning-workspace/eval/bench-ext.js

# With a candidate variant (Agents 1/2/3 use this)
bun planning-workspace/eval/bench-ext.js --predictor planning-workspace/eval/my-variant.js

# Switching opponents only (faster, skip 300-round standard battery)
bun planning-workspace/eval/bench-ext.js --mode switching-only

# More seeds for tighter confidence intervals
bun planning-workspace/eval/bench-ext.js --seeds 80

# Full run for a candidate
bun planning-workspace/eval/bench-ext.js \
  --predictor planning-workspace/eval/predictor-agent1-candidate.js \
  --seeds 80 --rounds 80 --postWindow 10
```

## How Agents 1/2/3 Create a Scratch Predictor Copy

1. Copy the production predictor to the workspace:
   ```bash
   cp web-projects/rps-mind-reader/predictor.js \
      web-projects/rps-mind-reader/planning-workspace/eval/predictor-agent1-candidate.js
   ```

2. Edit your copy ONLY (never touch predictor.js itself).

3. Run bench-ext.js pointing at your copy:
   ```bash
   bun web-projects/rps-mind-reader/planning-workspace/eval/bench-ext.js \
     --predictor web-projects/rps-mind-reader/planning-workspace/eval/predictor-agent1-candidate.js
   ```

4. Report the full 5-metric scoreboard (see below).

## Metrics to Report (5-Metric Scoreboard)

Every agent proposing a change MUST report all five:

| # | Metric | How measured | Baseline |
|---|--------|-------------|---------|
| 1 | `meanNet300` | Standard battery, 300 rounds, 40 seeds | +72.0% |
| 2 | `worstNet300` | Worst opponent in standard battery | +0.1% |
| 3 | `switchMeanNet80` | Mean over switching battery, 80 rounds | +39.3% |
| 4 | `switchPostW10` | Mean post-switch net, W=10 window | +11.9% |
| 5 | `liveNetMatch91` | vs-model net on match91.json | +18.0% |

**Acceptance gate (must pass ALL of these):**
- meanNet300 >= 71.0% (1pp regression margin)
- worstNet300 >= 0.0%
- switchMeanNet80 does not decrease by more than 2pp vs baseline
- switchPostW10 strictly increases (any positive change counts)
- liveNetMatch91 >= 18.0% (does not regress the real session)

**Important:** A change that only improves `liveNetMatch91` without improving
`switchPostW10` on the synthetic battery is SUSPECT OVERFIT and should be flagged.

## Real Session Status

| Session | Type | Used as | Notes |
|---|---|---|---|
| `sample-plays/match91.json` | REAL human capture | Held-out validation | 91 rounds, has live confidence values, ~real player switching rock->scissors/paper->reactive |
| `sample-plays/human-session-1.json` | REAL human capture | Held-out validation | 80 rounds, well-mixed (no strong switching), no confidence field (older predictor version) |
| `eval/synthetic-switcher-91.json` | SYNTHETIC | Training/exploration target ONLY | 3-phase: rock-bias -> scissors/paper -> beat-last-AI, seed=42, deterministic |

**Rule:** Look at real sessions ONCE per final candidate, not during tuning.
Use synthetic opponents + `switchPostW10` as the tuning signal.

## Opponent Battery Taxonomy

| Name | Failure mode tested | Key diagnostic question |
|---|---|---|
| bias-rock-paper-{15,25,40} | STALE_BIAS | Do stale counts prevent bias-shift detection? |
| bias-three-phase-20 | STALE_BIAS | Do multiple bias phases compound the lag? |
| noisy-simple-rock-scissors-p60-nr20 | NOISY | Does recency-decay help with 20% noisy long phases? |
| noisy-simple-rock-paper-p20-nr15 | NOISY | Does recency-decay help with 15% noisy short phases? |
| noisy-simple-scissors-paper-p40-nr15 | NOISY | Mid-length noisy phase detection |
| gradual-drift-rock-to-scissors | NOISY | Slow drift (no discrete switch) |
| **bias-then-beatlastai-25** | **REACTIVE** | **Can pa/ao contexts catch beat-last-AI after bias phase?** |
| **bias-then-beatlastai-40** | **REACTIVE** | **PRIMARY DIAGNOSTIC -- matches match91 failure mode** |
| antirepeat-then-reactive-30 | REACTIVE | Structural switch + reactive phase |
| markov-then-antirepeat-{25,40} | STRUCTURAL | Habit-chain changes entirely |
| 4phase-cycle-{15,20} | STALE_BIAS | Multi-switch stress test |

**CRITICAL NOTE for all agents:** Improvements that work only through faster p0-p5
context adaptation WILL fail against REACTIVE phase opponents. Only pa1, pa2, ao1,
po1, pao1 contexts can predict a beat-last-AI player. Any proposal that targets the
STALE_BIAS and NOISY columns but leaves the REACTIVE column unimproved has addressed
only part of the problem. The post-switch W=10 on bias-then-beatlastai-40 (-21.5%
baseline) is the single hardest target.

## Anti-Overfitting Protocol

- Training targets: All synthetic opponents in `opponents-ext.js` + existing `benchmark.js` battery.
- Held-out validation: `match91.json` and `human-session-1.json` -- check ONCE per final candidate.
- Seed families for overfitting detection: bench-ext.js uses seeds 1000..1000+N*7919.
  For a cross-validation check, re-run with `--seeds 40` but pass `--seed-offset 500000` (TODO: add this flag).
  If results diverge significantly, the improvement is sensitive to seed family (suspicious).

## Reproducibility

All opponents use `mulberry32` (from benchmark.js) with seeds derived from the match seed.
The opponent RNG seed is `(matchSeed ^ 0x9e3779b9) >>> 0` (same as benchmark.js playMatch).
Replaying with the same `--seeds` value always produces the same numbers.
