# Brief — Agent 1: Recency-Decay

**Angle:** Give each context's *counts* a recency weighting so recent throws matter more than old ones — directly fixing the diagnosed "stale counts → stuck prediction after a switch" failure ("how much more important is the latest play than the Nth").

**Why you:** The bot recency-weights *which model to trust* (CTX_DECAY on llScores) but the within-context distributions are built from un-aged integer counts. This is the #1 suspected cause of the 91-round loss.

## Concrete tasks
1. Read `predictor.js` end-to-end, especially `learn()` (the `tbl[key][p] += 1` count bump) and `distFromCounts()`. Confirm exactly where aging must be introduced and what must stay deterministic/replayable.
2. Design within-context aging. Compare at least: (a) **exponential decay** of all counts on each round (`tbl[key][m] *= γ` globally per round, or per-context on visit), (b) **half-life expressed as a window**, (c) decaying only on the context's own updates vs every round. Work out the math so it stays a deterministic function of history (replayable by `rebuildModel`) — counts become floats; check `distFromCounts` + KT smoothing still behave (no divide-by-zero; abstain logic intact).
3. Find the sweet spot for the decay strength and how it interacts with `KT`. Does decay need to differ by context order (deep contexts are sparse — aggressive decay may starve them)?
4. **Measure** (see target-summary recipe): general `meanNet`/`worstNet` must not regress; quantify lift on the 91-round switcher and the 80-round session. Show a decay-strength sweep (e.g. γ ∈ {0.99, 0.97, 0.95, 0.9, 0.8}).
5. Check the contract: does aging break any `predictor.test.js` expectation? Does replay still reproduce the live model with float counts (floating-point determinism is fine since it's the same ops in the same order)?

## Awareness of other agents
- Agent 2 (portfolio) will likely want MULTIPLE decay settings as separate experts — your single-best decay is one of its building blocks. Note whether one global decay suffices or whether fast+slow both earn their keep.
- Agent 3 (meta-selection) consumes per-expert distributions; flag if aging changes how confident/peaky the distributions get (affects selection).
- Agent 4 (eval) will test against synthetic switchers; tell them what switch cadence your decay is tuned for.

## Output
Write `round-1.md` to this folder using the structure in the launch prompt (Key Findings / Concrete Recommendations [What/Why/How/Risk/Effort] / Open Questions / Interactions). Include real numbers.
