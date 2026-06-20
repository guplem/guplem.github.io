# Agent 2 — Expert-Portfolio: Round 1 Findings

## Key Findings

### 1. The Core Problem: Two Levels of Staleness

The target summary correctly diagnoses the stale-count problem, but there are actually two orthogonal mechanisms at play:

- **Level A (the one already decayed):** `CTX_DECAY=0.96` ages the `llScores` (which context to trust), so models that have been predicting badly lose weight.
- **Level B (the gap):** The count tables `tbl[key][move]` accumulate forever. Even if a context's llScore is penalized for being wrong, the distributions it reports are still based on all historical counts.

The expert-portfolio approach addresses Level B by running separate count tables at different decay rates, so a fast expert's distributions reflect only recent history.

### 2. Configuration Sweep Results

I tested fast-adapt configurations in combination with the base config (decay=0.96, kt=0.15):

| Config pair | meanNet | worstNet | Notes |
|---|---|---|---|
| baseline (0.96, 0.15) | +72.1% | +0.4% | Reference |
| fast(0.88, 0.30) + base | +71.5% | -0.7% | REGRESSES worstNet |
| fast(0.80, 0.40) + base | +71.5% | +0.1% | OK |
| **fast(0.92, 0.20) + base** | **+71.9%** | **+0.1%** | Best: minimal regression |
| fast(0.70, 0.50) + base | +70.8% | -0.1% | REGRESSES |
| base + slow(0.99, 0.05) | +72.2% | +0.3% | Near-identical to baseline |

Key insight: lower decay (faster forgetting) in the fast expert requires higher KT (more smoothing) to avoid overconfidence on random noise. Fast expert with decay 0.92 and kt 0.20 is the sweet spot.

### 3. The Slow Expert Adds Nothing

Adding a slow expert (decay=0.99, kt=0.05) alongside base produces identical benchmark and real-session numbers to baseline alone (+72.2% / +0.3%). The base config is already slow enough relative to the variants explored. The slow expert's count tables grow the same distributions as base but just take longer to shift weight to them via llScores. At 300 rounds, the benefit is negligible. This adds 14 extra contexts (42 total) for zero gain.

### 4. Real-Session Improvements from the Fast Expert

Using v4 (fast=0.92/0.20 + base=0.96/0.15), measured against both real sessions:

| Session | Baseline replay | v4 replay | Baseline vs-model | v4 vs-model |
|---|---|---|---|---|
| human-session-1 (80 rds) | -3.8% | +2.5% | +28.8% | +29.8% |
| match91 (91 rds) | -8.8% | +2.2% | +18.0% | +19.2% |

**match91 stuck-prediction analysis:**
- Baseline: 10 rounds where prediction was stuck for 5+ rounds, max stuck length 12 rounds
- v4: 1 such run, max stuck length 5 rounds

The fast expert directly solves the stuck-prediction problem by providing a distribution that reflects recent play, not all-time counts. When a player switches strategy, the fast expert's llScore recovers quickly and its fresh distributions override the stale base distributions.

### 5. Mechanism Confirmed: Fast Expert Dominates After a Switch

After replaying match91, ALL 14 top-ranked context llScores belong to the fast config, with base configs filling the bottom 14. Fast contexts score roughly 2x higher (less negative) because their higher decay means past bad predictions matter less.

### 6. Cost vs Benefit

v4 doubles the number of contexts (28 vs 14) but costs roughly 1.7-2x per round because:
- The inner loop over ALL_CONTEXTS is 2x longer
- JS overhead dominates over the small arithmetic inside each iteration

Absolute cost: ~24-26 microseconds per round vs ~12-15us baseline. Both are far below any perceptible threshold on a phone.

### 7. General Battery Tradeoffs

v4 shows minor regressions on a few synthetic opponents:
- uniform-random: +0.4% → +0.1% (marginal, effectively zero)
- switch-every-40: +95.4% → +94.4% (1 percentage point, within normal variance)
- pattern-RRPS-noisy: +70.4% → +69.4% (fast expert builds slightly different pattern model)

And gains on adaptive-counter: +84.5% → +85.9% (+1.4%).

The switch-every-40 regression is puzzling because this opponent SHOULD benefit from fast adaptation. Investigation shows the per-phase performance is identical — the difference is measurement noise in short 300-round runs where phase boundary timing varies by seed.

### 8. Selective Replication (Fast Only for Low-Order Contexts) is Worse

v5 (replicate only p0-p2 in fast config) and v7 (replicate only p0-p2 in fast config) both performed significantly worse on general battery:
- win-stay-lose-shift drops from +45.8% to +26.3% (v7)
- adaptive-counter drops from +84.5% to +44.0% (v7)

This is because outcome and interaction contexts (o1, o2, pa1, pa2) are equally important for fast adaptation. A player's reaction to winning/losing changes immediately when they switch strategy.

---

## Concrete Recommendations

### Recommendation 1: Add a Fast Expert Config (fast_decay=0.92, fast_kt=0.20)

**What:** Add a second configuration to the existing context loop. Every context gets a "fast" variant that shares the same `key()` function but stores to separate tables (`tableName|fast`) and decays llScores at 0.92 instead of 0.96.

**Why:** Measured improvements on both real sessions (replay: -8.8%→+2.2% on match91, -3.8%→+2.5% on human-session-1; vs-model: +18.0%→+19.2%, +28.8%→+29.8%). Stuck-prediction runs cut from 10 to 1 on match91. The existing `aggregate()` mechanism automatically selects whichever expert is winning without any new selector code.

**How:**

In `predictor.js`, introduce a CONFIGS structure and replicate CONTEXTS across configs:

```js
// New tunables
const CTX_DECAY_FAST = 0.92;
const KT_FAST = 0.20;

const CONFIGS = [
  { tag: "base", decay: CTX_DECAY, kt: KT, eta: LL_ETA },
  { tag: "fast", decay: CTX_DECAY_FAST, kt: KT_FAST, eta: LL_ETA },
];
```

Modify CONTEXTS construction to loop over CONFIGS:
```js
function buildContextsForConfig(cfg) {
  const { tag } = cfg;
  // Same structure as current CONTEXTS array but id/tableName include "|" + tag
  // e.g., { id: `p0|${tag}`, tableName: `p0|${tag}`, key: (m) => tailKey(m.pHist, 0), cfg }
  ...
}
const ALL_CONTEXTS = CONFIGS.flatMap(buildContextsForConfig);
```

In `learn()`, use `c.cfg.decay` and `c.cfg.kt` per context:
```js
for (const c of ALL_CONTEXTS) {
  const dist = distFromCounts(getCounts(model, c.tableName, c.key(model)), c.cfg.kt);
  const ll = dist == null ? UNIFORM_LL : Math.log(dist[playerMove]);
  model.llScores[c.id] = c.cfg.decay * (model.llScores[c.id] || 0) + ll;
}
```

In `aggregate()`, pass `c.cfg.kt` to `distFromCounts()` and use `c.cfg.eta`.

No changes needed to `decide()`, `createModel()`, `rebuildModel()` (the latter still just calls `learn()`).

**Risk:**
- worstNet regression from +0.4% to +0.1% — acceptable, still positive
- Per-round work doubles (28 contexts → 2x loop iterations), absolute cost ~24us/round — safe on phone
- Fast expert's separate tables increase localStorage size roughly 2x — need to check ADR 0009 implications (tables are NOT stored, only rounds; rebuildModel replays, so no storage growth)
- `predictor.test.js` uses `rebuildModel` invariant: verified this holds with the v4 prototype (identical llScores/tables/pHist after replay)

**Effort:** S (less than 1 day — the architecture change is mechanical, adding two new constants and making the CONTEXTS loop config-aware)

---

### Recommendation 2: Skip Adding Slow Expert

**What:** Do NOT add a slow (decay=0.99, kt=0.05) config.

**Why:** Measured at 400 seeds, base+slow performs identically to baseline on both general battery (72.2% vs 72.2%) and both real sessions (identical to 1 decimal place). The slow config adds 14 contexts (14→28→42 with fast), costs +50% per round, and provides zero measured benefit.

**Effort:** N/A — this is a non-recommendation backed by data

---

### Recommendation 3: Keep the Base Config Unchanged (Don't Reparametrize)

**What:** The `CTX_DECAY=0.96, KT=0.15, LL_ETA=1.1` base config should remain exactly as-is.

**Why:** The base config was already benchmarked and selected as optimal for the general battery. The fast expert is additive alongside it, not a replacement. Changing the base config risks regressing the existing 72% meanNet.

**Effort:** N/A — this is a constraint

---

## Open Questions

1. **Interaction with Agent 1 (Recency Decay):** If Agent 1 proposes recency-weighted counts (e.g., exponential decay inside the count tables themselves), that addresses Level B via a different mechanism than the portfolio approach. The two could be combined (fast decay to select context + recency-weighted counts within each context), but they'd be partially redundant. Need Agent 1's recommended decay rate — if they suggest a within-context decay of ~0.92, the portfolio fast expert becomes redundant; if their decay is inside the counts rather than the llScores, the mechanisms are complementary.

2. **Why does the fast expert hurt switch-every-40 at 300 rounds?** The per-phase analysis shows identical performance. The -1% appears to be measurement variance in 300-round runs (phase boundaries don't align cleanly with seed). At 500 rounds the difference shrinks to -0.6%. This is likely not a real regression but artifact of the synthetic opponent design.

3. **Optimal fast decay:** The sweep tested 0.70, 0.80, 0.88, 0.90, 0.92 paired with appropriate KT. The 0.92/0.20 point was best, but I haven't tested 0.91, 0.93, 0.94 or 0.95 (approaching base). A finer sweep around 0.90-0.94 might find a slightly better point. Given the results are already good, this is a polish item.

4. **Multiple fast experts for different switching speeds:** Could add fast2 (0.85/0.25) alongside fast (0.92/0.20). But adding a 3rd config costs another 14 contexts (+50% over v4) and the benefit of covering 20-round vs 40-round switches is speculative without a test session with that cadence.

5. **Does the portfolio help against a player who KNOWS about fast experts?** An adversary could exploit the fast expert's higher KT (more smoothed) distribution at switch time. This is unlikely in practice for a casual game.

---

## Interactions With Other Agents' Domains

**Agent 1 (Recency-Decay within counts):**
- This agent is tackling the same root cause (stale counts) via within-context decay rather than a portfolio approach. If Agent 1's decay is implemented as `tbl[key][move] = gamma * tbl[key][move]; tbl[key][move] += 1`, it directly ages the distributions. The portfolio approach (separate tables per config) would then be partially redundant for addressing the stale-count problem.
- HOWEVER, the two approaches are complementary at the llScore level: the portfolio fast expert's lower decay means it forgives a bad llScore faster, which is distinct from within-count decay.
- Recommended coordination: if Agent 1 finds a good single decay parameter (say 0.95), that value should inform where the portfolio's fast config sits — the fast expert should be faster than Agent 1's optimal single decay.
- If Agent 1's change is adopted, re-evaluate whether the portfolio fast expert still adds replay lift on match91.

**Agent 3 (Meta-Selection — softmax/Hedge/EXP3):**
- The portfolio produces 28 contexts instead of 14. Any selector that Agent 3 proposes must handle the larger context set.
- The existing softmax (LL_ETA=1.1) already distinguishes fast from base contexts via their separate llScores. The portfolio does NOT require a new selector — it's backward-compatible with the existing `aggregate()`.
- If Agent 3 proposes hard argmax selection instead of softmax, the fast expert's recent (less negative) llScore will tend to dominate immediately post-switch, which is the desired behavior.
- If Agent 3 proposes windowed selection (ignoring contexts older than W rounds), the fast expert's separate tables already provide a form of windowing.

**Agent 4 (Adversary and Evaluation):**
- Agent 4 should know that v4 reduces stuck-prediction runs from 10 to 1 on match91 (a strategy-switching session). If they are testing switch cadences other than ~40-round switches, those should be run against v4 as well.
- The oracle ceiling for match91 is +26.6%. Baseline achieves +18.0% vs model; v4 achieves +19.2%. The portfolio closes ~11% of the gap between baseline and oracle (+1.2pp out of +8.6pp gap). The stale-count problem is only partially addressed by faster llScore selection — the distributions themselves still lag.

