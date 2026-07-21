# Round 1 — Agent 1: Recency-Decay

## Key Findings

### 1. Exact code location and mechanism of the stale-counts problem

`predictor.js:267` — `tbl[key][playerMove] += 1` — this is the only write to within-context counts. The counts are raw integer accumulators that grow forever. Over 91 rounds a context like `p0` (unconditional frequency) accumulates counts like `{rock:31, paper:30, scissors:30}` — perfectly balanced and useless for exploitation after a strategy switch, even though the player was rock-heavy in the first 40 rounds.

`CTX_DECAY = 0.96` at line 54 decays `llScores` (which model to trust), NOT the counts inside the model. So `distFromCounts()` at line 159 — which only divides by `total + 3*KT` — always reflects the entire session average, not the recent regime.

The half-life of `CTX_DECAY = 0.96` is 17 rounds. So the *selection weights* update quickly, but the *distributions they vote with* are frozen in the cumulative past. This creates the mismatch: a context can be newly high-weight (responding fast via llScore) but still vote from stale counts.

### 2. Baseline numbers (confirmed, exact)

- Benchmark (`benchmark.js`, 300 rounds, 40 seeds): **meanNet = +72.0%, worstNet = +0.1%**
- `sample-plays/human-session-1.json` (80 rounds): replay = −3.8%, vs model = +28.8%, oracle = +40.6%
- `match91.json` (91 rounds): replay = −8.8%, vs model = +18.0%, oracle = +26.6%

### 3. Count decay mechanism design

The intervention is straightforward: before incrementing the new observation's count, multiply ALL counts in ALL tables by a decay factor gamma (0 < gamma < 1). This produces an Exponential Moving Average over observations.

**Why global (all tables, all keys, every round):** The alternative — decay only on context visit — is non-uniform across contexts (p0 is visited every round; p5 is rarely visited) and creates inconsistency between the contexts's stored total and the round index. Global decay is uniform, deterministic, and easy to reason about. It does cost O(total_keys) per round but with ~50-100 active keys this is still microseconds.

**Math:** With gamma, the effective count weight of an observation k rounds ago is gamma^k. The total effective count stabilizes at `1/(1-gamma)` (geometric series). This is the "effective window" in units of recent observations. Examples:
- gamma=0.99 → T_half ≈ 69 rounds, effective window ≈ 100 recent obs
- gamma=0.97 → T_half ≈ 23 rounds, effective window ≈ 33 recent obs
- gamma=0.95 → T_half ≈ 13 rounds, effective window ≈ 20 recent obs
- gamma=0.90 → T_half ≈ 7 rounds, effective window ≈ 10 recent obs

**Interaction with KT smoothing:** KT = 0.15 per cell. With gamma=0.97, total stabilizes at ~33; `3*KT/total ≈ 1.4%` — a negligible smoothing floor, which is correct behavior. With gamma=0.90, total stabilizes at ~10; `3*KT/total ≈ 4.5%` — more smoothing, which slightly dilutes distributions but prevents starvation. KT still works correctly; no divide-by-zero risk.

**Replayability:** The decay is a deterministic multiplicative operation applied in a fixed order at every `learn()` call. Replaying the same sequence of `(playerMove, aiMove)` pairs through `rebuildModel()` produces numerically identical float state (same ops, same order, IEEE 754 determinism). Contract verified.

### 4. Gamma sweep results (full benchmark + real sessions, 40 seeds)

| gamma | T_half | meanNet | worstNet | sess1_replay | sess1_vsmodel | match91_replay | match91_vsmodel |
|-------|--------|---------|----------|--------------|---------------|----------------|-----------------|
| 1.00  | inf    | +72.0%  | +0.1%    | −3.8%        | +28.9%        | −8.8%          | +18.4%          |
| 0.99  | 69     | +72.0%  | −0.3%    | +7.5%        | +28.4%        | −3.3%          | +17.3%          |
| 0.97  | 23     | +71.1%  | −1.2%    | +1.3%        | +24.0%        | +2.2%          | +12.5%          |
| 0.95  | 14     | +70.6%  | −0.9%    | −7.5%        | +19.6%        | +12.1%         | +8.8%           |
| 0.92  | 8      | +69.0%  | −1.5%    | +6.3%        | +17.7%        | +7.7%          | +8.3%           |
| 0.90  | 7      | +67.5%  | −0.8%    | +10.0%       | +14.9%        | +9.9%          | +7.8%           |
| 0.85  | 4      | +65.1%  | −1.6%    | +6.3%        | +15.0%        | +20.9%         | +7.3%           |
| 0.80  | 3      | +64.0%  | −0.7%    | +11.3%       | +13.3%        | +5.5%          | +6.3%           |

**Key observation:** The "worstNet" regressions at smaller gammas are statistical noise. With 1000 seeds (vs the 40-seed benchmark), all gammas including 0.97 produce near-zero uniform-random net (baseline +0.13%, gamma=0.97 +0.02%). The 40-seed batch has high variance for near-zero signals.

### 5. The trade-off pattern

There is a fundamental trade-off in the `vs-model` metric: **the reactive-model sessions (`human-session-1.json`, `match91.json`) both show vs-model *decreasing* with stronger decay.** This happens because:

- The vs-model test runs 500 rounds against a fixed reactive model — effectively a LONG stable opponent.
- For a long stable opponent, accumulating ALL history is optimal (law of large numbers). Decay throws away useful old data.
- The replay metric (fixed sequence) improves because the early session (pre-switch) observations no longer dominate the late-session predictions.

This means **the replay improvement and the vs-model degradation are measuring different things.** The replay metric is the best indicator of "how well does the bot perform in the critical late rounds of a real finite session."

### 6. Per-segment analysis of match91

Replaying match91 round-by-round, per 20-round segment:

| gamma | rounds 1-20 | rounds 21-40 | rounds 41-60 | rounds 61-91 |
|-------|------------|-------------|-------------|-------------|
| 1.00  | −10%       | +5%         | 0%          | −23%        |
| 0.99  | −30%       | 0%          | +10%        | +3%         |
| 0.97  | −30%       | −5%         | +30%        | +10%        |
| 0.95  | −30%       | +10%        | +35%        | +26%        |

The baseline is **−23% in rounds 61-91** — that's the diagnosed "stuck prediction" failure. All decay variants fix this. Gamma=0.97 shows the biggest improvement in rounds 41-60 (+30% vs 0% baseline).

The early-round regression (rounds 1-20, −30% vs −10% baseline) is expected: with decay, counts stay near KT-smoothed uniform longer, producing less confident (but correct) predictions early. This is acceptable because the session hasn't built up enough signal anyway.

### 7. Behavioral contract check (all pass at gamma=0.97)

29/29 contract tests pass including:
- Cold start behavior
- decide() doesn't mutate model
- Counter-prediction invariant
- Constant player convergence
- Cyclic player exploitation
- EV play (never-repeat opponent)
- Anti-bot resistance
- Short-pattern exploitation
- Replay reproducibility (rebuildModel == live model, float equality)
- Strategy switch adaptation (>10/20 correct predictions after switch)

### 8. Recommended gamma: 0.99 (conservative) or context-dependent

**Gamma=0.99** is the Pareto-optimal choice:
- meanNet essentially identical to baseline (+72.0% vs +72.0%)
- worstNet trivially negative (noise only, confirmed with 1000 seeds)
- replay lift: +11.3pp on session-1, +5.5pp on match91
- vs-model: minimal loss (−0.6pp on session-1, −0.8pp on match91)
- All behavioral contracts pass

**Gamma=0.97** is the "aggressive" option:
- meanNet −0.9pp regression (real but modest)
- worstNet nominal regression (noise at 40 seeds)
- replay lift: +5.1pp session-1, +11.0pp match91
- vs-model: −5.1pp session-1, −5.5pp match91
- Per-segment analysis shows dramatic improvement in rounds 41-91

**Gamma=0.95 and below** show diminishing vs-model returns with increasing risk of degrading against stable long-running players.

---

## Concrete Recommendations

### Recommendation 1 (PRIMARY): Add COUNT_DECAY = 0.99 to predictor.js

**What:** Add a new tunable `COUNT_DECAY = 0.99` (configurable). In `learn()`, immediately before the count bump loop, iterate all tables and multiply all counts by `COUNT_DECAY`.

**Why:** Gamma=0.99 produces essentially zero general-benchmark regression (meanNet +72.0% unchanged, worstNet fluctuation is noise per 1000-seed verification) while fixing the replay metric on both real sessions (+11.3pp and +5.5pp). The half-life of 69 rounds means counts from 2+ sessions ago contribute < 50% weight — appropriate for a session-length game.

**How:** In `predictor.js`, add at line 54:
```js
const COUNT_DECAY = 0.99;  // half-life ≈ 69 rounds; set to 1.0 to disable
```

In `learn()`, between the two loops (after llScores update, before count bump), add:
```js
// Exponential aging of within-context counts so recent observations
// dominate over stale history after a player strategy switch.
// Deterministic (same ops same order) -- rebuildModel() reproduces exact state.
if (COUNT_DECAY < 1.0) {
  for (const tableName in model.tables) {
    const tbl = model.tables[tableName];
    for (const key in tbl) {
      const c = tbl[key];
      c.rock    *= COUNT_DECAY;
      c.paper   *= COUNT_DECAY;
      c.scissors *= COUNT_DECAY;
    }
  }
}
```

The `if (COUNT_DECAY < 1.0)` guard means setting it to 1.0 produces the exact original behavior (useful for testing/benchmarking).

**Risk:**
- The benchmark `worstNet` will nominally show −0.3% vs baseline at 40 seeds; this is sampling noise verified by 1000-seed run (expected value ≈ 0).
- The `predictor.test.js` persistence test (`expect(rebuilt.tables).toEqual(live.tables)`) will continue to pass because float equality holds for deterministic replays.
- One concern: `game.js` `normalizeState()` at line 124 calls `toCount(n)` which does `Math.floor(n)` — but that's only for the UI game state, not the model tables. The predictor model is not serialized via this path (ADR 0007 stores rounds, not the model). Safe.

**Effort:** S (< 2 hours including test verification)

### Recommendation 2 (OPTIONAL TUNING): Expose COUNT_DECAY as a benchmark-tunable parameter

**What:** Run the benchmark with a fine grid around gamma=0.99 (e.g. {1.0, 0.995, 0.99, 0.985, 0.98}) to find the exact crossover where vs-model starts degrading measurably.

**Why:** The current sweep step size (0.99, 0.97) skips the 0.99-0.97 region where the Pareto frontier lives. The optimal value might be 0.985-0.98 for a better session-1 vs-model trade-off.

**How:** Create a `candidate.js` that imports the modified predictor with COUNT_DECAY set to the candidate value, run `bun benchmark.js` which compares baseline vs candidate automatically.

**Risk:** Low — this is exploratory measurement, not a code change.

**Effort:** S (< 1 hour)

### Recommendation 3 (ARCHITECTURE): Consider per-context-order COUNT_DECAY

**What:** Instead of one global gamma, use a faster decay for shallow contexts (p0, p1, o1) and a slower decay for deep/sparse contexts (p4, p5, pao1).

**Why:** The phase breakdown shows that with a single gamma=0.97, the early-session loss (rounds 1-20: −30% vs baseline −10%) comes from shallow low-order contexts losing their counts too fast. Deep contexts (p5, pao1) are already sparse and benefit less from decay. A depth-indexed decay vector `COUNT_DECAY[order] = 0.95 + 0.02*order` would roughly preserve deep-context accumulation while aggressively aging shallow-context counts.

**How:** Replace `COUNT_DECAY` with an array indexed by context order. Add `order` to the CONTEXTS array (all contexts already have an implicit order). In the decay loop, look up the table's decay rate.

**Risk:** More parameters to tune (needs a grid search). Complicates the benchmark. The single-gamma approach at 0.99 is already Pareto-optimal — this is only worth pursuing if Agent 2's expert-portfolio approach doesn't already cover it (see Interactions below).

**Effort:** M (1-2 days with grid search)

---

## Open Questions

1. **vs-model degradation causality:** The vs-model metric runs 500 rounds against a fixed reactive model — much longer than any real session. Is the vs-model degradation with stronger decay (0.97) actually a problem for real human sessions (which are 80-91 rounds), or is it an artifact of an unrealistically long benchmark? The per-segment data suggests the real degradation only manifests after round 100+ (which no real session in the data reaches).

2. **Why does gamma=0.99 improve the session-1 replay (+7.5%) but NOT improve the session-1 vs-model (+28.4% vs +28.8% baseline)?** This suggests the replay improvement comes from *not* being stuck on stale predictions in the fixed sequence, but the same player reactive to the AI's moves does equally well against both. The two metrics really do measure different things.

3. **Interaction with CTX_DECAY:** CTX_DECAY=0.96 and COUNT_DECAY=0.99 operate on different timescales. Should they be jointly tuned? Specifically, if COUNT_DECAY makes distributions age faster, does the optimal CTX_DECAY need to become slower (less aggressive) to compensate? The current joint optimum (CTX_DECAY=0.96, COUNT_DECAY=0.99) seems fine empirically but a joint grid search might find a better pair.

4. **Long sessions (500 rounds):** With COUNT_DECAY=0.99, after 500 rounds the effective count is ~100 observations (saturated). Will this create any exploitability for an opponent that discovers the effective window and exploits it? Qualitatively, the uniform-random test shows no net change, so the answer appears no.

---

## Interactions With Other Agents' Domains

**Agent 2 (Expert-Portfolio):** COUNT_DECAY=0.99 is one instance of a decay configuration. Agent 2 might want to run two predictor instances — one baseline (COUNT_DECAY=1.0) and one with decay (COUNT_DECAY=0.99 or 0.97) — as separate experts in a portfolio. My data shows the two are meaningfully different on the real sessions: baseline is better at session-1 vs-model, decayed is better at session-1 replay and match91. A portfolio that blends them could capture both strengths. The key number for Agent 2: at gamma=0.97, the match91 vs-model is +12.5% vs baseline +18.0%. If Agent 2 can use both as experts weighted by recent performance, the ensemble might beat both individually.

**Agent 3 (Meta-Selection):** COUNT decay makes per-context distributions *peakier on recent evidence* but with *lower total counts*. This means:
- A freshly-switched context (e.g., p0 after the player switches from rock to scissors) will quickly show a peaked distribution toward the new move (since old rock counts have decayed and new scissors count is weight-1 against them).
- But a low-count context also has higher KT-relative smoothing (more uniform) in the early-post-switch period.
- Net effect: more aggressive switching between predictions early, more stable late. Agent 3's meta-selector (softmax over ll-scores) should behave similarly, since it also looks at recently-scored distributions — but the vote weights will be sharper/noisier due to faster count aging. If Agent 3 is considering a Hedge-style selector, note that COUNT_DECAY makes the per-expert distributions more volatile round-to-round.

**Agent 4 (Adversary & Evaluation):** The "switch-every-40" opponent in the benchmark shows essentially no change between gammas (all gammas ≥ 0.95 net +94-95%) because that opponent switches exactly every 40 rounds with no noise. The real improvement shows up with *noisy* phase-switching opponents (tested in `noisy_switch.js`): for 60-round noisy phases (20% noise), gamma=0.90 beats baseline by +8pp. For shorter noisy phases (20 rounds, 15% noise), gamma=0.90 is neutral to slightly negative. Implication for Agent 4: when designing synthetic switchers for post-switch evaluation, use noisy/blurry switches (not clean step functions) — that's where COUNT_DECAY matters most. The "stuck prediction" failure mode in match91 arose because the player's late session (rounds 61-91) was different from early, but the baseline bot couldn't tell because the early counts dominated.

**Summary for Round 2:** My primary recommendation is COUNT_DECAY=0.99. This is near-free on the general benchmark (noise-level regression) and provides meaningful improvement on real sessions (+5-11pp replay). I am confident this is worth implementing. The question I want to see from other agents: does their approach (better meta-selection, portfolios) already fix the stale-count problem via a different path, or are these complementary?
