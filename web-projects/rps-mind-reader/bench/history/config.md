# Config — RPS predictor improvement bake-off

**Goal:** Make `predictor.js` beat strategy-switching players (it currently loses ~12% net to one) without regressing well-mixed play or the general benchmark.

**Roster (4 agents):**
1. `agent-1-recency-decay` — within-context exponential aging of counts.
2. `agent-2-expert-portfolio` — same model families at multiple memory/decay/smoothing configs.
3. `agent-3-meta-selection` — selector/blending strategies over experts.
4. `agent-4-adversary-eval` — strategy-switching opponents for `benchmark.js` + post-switch/short-horizon measurement protocol + overfitting guard.

**Rounds:** 2 (Round 1 independent, Round 2 cross-pollinate), then synthesis.

**Consensus criteria — a recommendation is "accepted" only if it:**
- Keeps the general benchmark `meanNet` ≥ ~+72% (no regression) and `worstNet` ≥ ~0.
- Improves `realplay-bench` "vs model" net on BOTH real sessions (the 80-round well-mixed one and the 91-round switcher).
- Preserves the fairness + determinism contract (pure `decide`, deterministic replayable `learn`).
- Stays dependency-free and microsecond-cheap.

**Relevant files:** `predictor.js`, `benchmark.js`, `realplay-bench.js`, `predictor.test.js`, `game.js`, `adr/0001-custom-statistical-predictor-no-ml-library.md`, `sample-plays/human-session-1.json`, scratch `match91.json`.
