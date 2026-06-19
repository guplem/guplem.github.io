# Agent 3: Meta-Selection — Round 1 Findings

## Key Findings

### 1. Adaptation speed is NOT the bottleneck

After a clean strategy switch (rock x30 then scissors x30), the baseline selector already flips its vote to the correct response within **2 rounds**, regardless of LL_ETA (0.5–3.0) or CTX_DECAY (0.85–0.99). The "stuck-paper x12" bug in match91 is NOT caused by a slow meta-selector.

Evidence: Direct measurement of `firstFlip` and `stableFlip` rounds for all parameter configs shows identical 2-round adaptation.

### 2. p0 dominance is the mechanism behind the stuck run

In the match91 session, at round 61 (start of the stuck period), the weight distribution was:
- **p0** (unconditional freq): **69.4%** of total weight
- p1: 11.9%, ai1: 10.1%, all others: ~0.2% each

After 60 rounds, ALL contexts except p0 and a few mid-order ones accumulate deeply negative llScores (around −32). p0 "wins" not because it's predicting well, but because it accumulates less negative scores over fewer abstentions (it never abstains — key "" is always valid). The exponential gap between −26 and −32 is `exp(1.1*(26-32)) ≈ 0.001`, i.e., p0 gets 1000x the weight.

Moreover, p0's distribution at that point is `[30%R, 33%P, 37%S]` — a slight scissors bias accumulated over 60 mixed rounds. All high-order contexts independently predict scissors too (due to recent paper-heavy history). So the vote is ~93% scissors (predicting paper), and the AI gets stuck.

### 3. The current LL_ETA and CTX_DECAY are near-optimal for the general battery

Full sweep confirms:
- LL_ETA: values 0.3–3.0 all give mean 71.6–72.0%. Current 1.1 is fine; no significant sensitivity.
- CTX_DECAY: 0.96 is the best balance. Lower values (0.85) hurt worstNet to −1.0%; higher values (0.99) slightly hurt adaptive-counter performance.
- The general battery (12 opponents, 300 rounds, 40 seeds) is insensitive to ETA because 300 rounds is long enough for all values to converge asymptotically.

### 4. Score clipping at the theoretical floor provides a genuine (small) lift

The llScore for each context is an exponentially-decaying sum of log-likelihoods. The minimum possible score over an effective window of `1/(1−CTX_DECAY)` rounds is:
```
LL_SCORE_FLOOR = UNIFORM_LL / (1 − CTX_DECAY) = log(1/3) / 0.04 = −27.47
```

Clipping scores to this floor in `aggregate()` prevents p0 from monopolizing due to accumulated score divergence. Results:

| Variant | meanNet | worstNet | match91-vsmodel | human1-vsmodel |
|---|---|---|---|---|
| baseline (1.1/0.96) | 72.0% | +0.1% | +18.0% | +28.8% |
| clipped-floor (1.1) | 72.1% | +0.6% | +20.2% | +30.6% |
| **Delta** | **+0.0%** | **+0.5%** | **+2.2pp** | **+1.8pp** |

The clipping reduces p0's weight from 69.4% to 21.5% in the stuck period, but all contexts still agree on the (stale) prediction because the within-context COUNTS are unchanged. The vote shifts from 93%/7% to 71%/29% — still scissors wins 9:2. The improvement comes from MORE BALANCED VOTING allowing outcome-based contexts (o1, o2) to have meaningful influence.

### 5. All alternative selector architectures are worse or equal

| Selector | meanNet | worstNet | Notes |
|---|---|---|---|
| baseline softmax | 72.0% | +0.1% | reference |
| hard argmax | 72.0% | −0.4% | equal mean, worse worst-case |
| Hedge (game-value weights) | 70.1% | −0.5% | −2pp mean |
| sliding-window accuracy (K=15) | 66.7% | −0.5% | −5pp mean |
| EXP3 (gamma=0.02) | 69.9% | −0.1% | −2.1pp mean |
| EXP3 (gamma=0.05) | 67.6% | −0.4% | −4.4pp mean |
| clipped-floor | 72.1% | +0.6% | best overall |

**Hedge** on realized game value is conceptually appealing but adapts too aggressively to single-round noise, degrading pattern-opponent performance.

**Sliding window** is brittle: it gives equal weight to all contexts within the window but different contexts fire at different frequencies (p0 fires every round, pa2 fires occasionally), making hit-rate comparisons unfair. Performance on switch-every-40 drops from 95.3% to 82.3%.

**EXP3 random exploration** is strictly harmful. Even gamma=0.02 (2% random play) costs −2.1pp on mean. This is expected: EXP3 randomizes even when the correct move is certain (vs always-rock), directly reducing exploitation. The determinism contract also makes proper EXP3 weight updates impossible in `learn()`.

### 6. The meta-selection gap is mostly driven by Agent 1's domain (count aging)

The core issue is that p0's accumulated counts (30 rock, 0 paper, 20 scissors after a 30-rock then 20-scissors sequence) persist forever. Even perfect meta-selection can't compensate when ALL contexts derive their predictions from stale cumulative counts. The clipping improvement (+2pp vs-model) is real but modest precisely because the underlying expert distributions are wrong.

If Agent 1 (count aging) successfully ages away stale counts, the meta-selection problem largely resolves itself: aged counts would make p0's distribution more uniform, reducing the unanimity of the stuck prediction.

---

## Concrete Recommendations

### Recommendation 1: Add LL_SCORE_FLOOR clipping in aggregate()

**What:** Add a single constant and one `Math.max()` call in `aggregate()` to prevent llScores from below the theoretical minimum accumulating unboundedly.

**Why:** Measured lift: +2.2pp on match91 vs-model (+18.0% → +20.2%), +1.8pp on human1 vs-model (+28.8% → +30.6%), +0.5pp on worstNet, 0 regression on meanNet. No cost: zero new state, one extra comparison per context per round.

**How:**
```js
// In predictor.js, add one constant after existing tunables:
const LL_SCORE_FLOOR = UNIFORM_LL / (1 - CTX_DECAY); // ≈ −27.47

// In aggregate(), replace:
const w = Math.exp(LL_ETA * (model.llScores[c.id] || 0));
// With:
const s = Math.max(LL_SCORE_FLOOR, model.llScores[c.id] || 0);
const w = Math.exp(LL_ETA * s);
```

That is the complete change. No new model state. `learn()` is unchanged (scores can still go below floor in storage — the floor is only applied during the softmax computation). `rebuildModel()` continues to work identically.

**Risk:** The LL_SCORE_FLOOR constant is derived from `UNIFORM_LL` and `CTX_DECAY`, so it will automatically stay correct if those tunables are ever adjusted. Low regression risk (confirmed by full battery sweep with 40 seeds). The one-line change does NOT affect learn() or the determinism contract.

**Effort:** S (< 1 hour including test verification)

### Recommendation 2: Do not pursue hard argmax, Hedge, window accuracy, or EXP3

**What:** Reject these alternatives from consideration.

**Why:**
- Hard argmax: marginally worse worstNet (−0.5pp), same meanNet. Winner-take-all discards valid signal from multiple agreeing experts.
- Hedge (game value): −2pp meanNet. Game value is +1/0/−1 only — much noisier than log-likelihood for gradient estimation.
- Sliding-window accuracy: −5pp meanNet. Context firing-frequency mismatch makes accuracy scores incomparable across contexts.
- EXP3 exploration: −2 to −4pp meanNet. Randomizing confident decisions against exploitable opponents is catastrophically costly. Also breaks the persistence contract (EXP3 weight updates require knowing which arm was explored, but learn() must be deterministic).

**How:** No implementation needed.

**Risk:** None.

**Effort:** S (no-op)

### Recommendation 3: LL_ETA and CTX_DECAY are at good values — no retuning

**What:** Keep LL_ETA=1.1 and CTX_DECAY=0.96 as-is.

**Why:** Full sweep (LL_ETA 0.3–3.0, CTX_DECAY 0.85–0.99) shows the current values are at or near the Pareto frontier of meanNet vs worstNet. Lower CTX_DECAY (0.85) hurts worstNet by 1.1pp. Higher LL_ETA doesn't help the stuck problem (adaptation speed is already 2 rounds). The meta-selector ETA controls how sharply weights concentrate; the current value already saturates the benefit.

**How:** No change.

**Risk:** None.

**Effort:** S (already measured)

---

## Open Questions

1. **Does LL_SCORE_FLOOR interact well with Agent 1's count aging?** If Agent 1 introduces per-key decay on counts, the within-context distributions will become more uniform (closer to KT-smoothed baseline). In that scenario, all contexts will converge toward near-equal distributions, and the meta-selector will matter more for tie-breaking. The floor clipping should still help by keeping lower-order contexts competitive. But the interaction should be tested once Agent 1's implementation is available.

2. **Is there a "delta-score" formulation that's better?** Instead of clipping at the floor, one could score by `llScore - expectedScore(uniform)` = `llScore - UNIFORM_LL * n * (1−CTX_DECAY^n)/(1−CTX_DECAY)`. This normalizes out the accumulation drift and gives a pure "above-baseline" signal. The downside is it requires tracking `n` per context (how many rounds it fired), adding state. Not measured — potentially worth exploring in Round 2 if other agents' changes make the meta-selector more impactful.

3. **Does any two-level meta selector help?** E.g., first cluster contexts by "context type" (player-history vs outcome-history vs AI-history), then soft-mix within clusters, then soft-mix clusters. Would add O(1) complexity but let outcome-based contexts always have minimum representation. Not tested; unclear if the improvement would exceed the LL_SCORE_FLOOR floor result.

4. **What's the match91 oracle ceiling?** The target summary gives oracle ceiling +26.6%. Current +18.0% baseline, candidate +20.2%. So meta-selection alone recovers about 2.2/8.6 = 25% of the available gap. The rest is count aging (Agent 1) territory.

---

## Interactions With Other Agents' Domains

**Agent 1 (Recency-Decay — within-context count aging):**
- This agent's fix is more important than mine for the stuck-run problem. Aging stale counts would make all experts more uncertain after a strategy switch, reducing the unanimity of the "wrong" prediction.
- My LL_SCORE_FLOOR fix is **complementary** but NOT redundant: clipping helps even when within-context counts are correctly aged, because it prevents p0 (which observes every round) from dominating high-order contexts that fire less frequently.
- If Agent 1's changes significantly reduce p0's predictive advantage over high-order contexts, the floor clipping will have LARGER marginal impact (more expert diversity means the softmax distribution matters more).
- **Risk of interaction:** Agent 1 may change how llScores accumulate (e.g., if counts are aged, the distribution fed to `distFromCounts` becomes more uniform, so log-prob is closer to log(1/3), so scores don't diverge as much). In that regime, my floor might never activate — but it still doesn't hurt.

**Agent 2 (Expert-Portfolio — multiple configs):**
- More experts = more diversity = the meta-selector matters more. A portfolio of experts with different decay/memory configs will produce more varied predictions; the floor clipping ensures no single "always-fires" expert monopolizes the vote.
- If Agent 2 adds many experts with similar firing patterns but different parameters, the floor will equalize their weights more (since they all have similar expected scores). This could be good (more democratic voting) or neutral.

**Agent 4 (Adversary & Evaluation):**
- My adaptation-speed analysis (2 rounds to flip) is relevant to Agent 4's switching opponent measurements. The bottleneck is NOT the meta-selector flip speed — it's the within-context count staleness. Agent 4's post-switch metrics should be attributed primarily to Agent 1's domain.
- The clipped-floor variant should be tested with Agent 4's synthetic switchers to confirm the +2pp vs-model gain holds across different switch cadences.
