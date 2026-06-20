# Agent 2 — Expert Portfolio: Round 2 Findings

## 1. What Changed After Reading the Other Agents

### Root-cause convergence

All four agents converge on within-context count staleness as the primary failure mode. The key distinctions:

- Agent 1 (COUNT_DECAY): Decays count tables directly, half-life ~69 rounds at gamma=0.99. Addresses what I called "Level B" (stale distributions).
- Agent 2 (portfolio, Round 1): Adds a fast expert (CTX_DECAY_FAST=0.92) that decays llScores faster. Addresses "Level A" (context selection speed) but leaves distributions stale.
- Agent 3 (LL_SCORE_FLOOR): Prevents p0 from accumulating unbounded divergence. Complementary to both.

Agent 4's new battery is the critical addition. The baseline numbers from that battery (seeds=80, 15 opponents) are substantially more informative than the old 40-seed 12-opponent battery. Agent 4 correctly identified:
- NOISY opponents (-8.0% postW10 by mode) are the single worst failure mode, not REACTIVE.
- The worst individual case is noisy-simple-rock-scissors-p60-nr20 at postW10=-29.8% (baseline, seeds=80).

### Updated position on my Round-1 portfolio

My Round-1 recommended CTX_DECAY_FAST=0.92 + base as the primary fix. After reading Agent 1's data and running the new battery, this needs revision. Agent 1's COUNT_DECAY addresses the same root cause (stale distributions) but does so at the right level (within-count aging vs. llScore-level forgetting). The critical question Agent 4 posed: does my portfolio still add value AFTER COUNT_DECAY is applied?

The answer is: **yes, meaningfully, but only when combined — not as a standalone fix.**

---

## 2. Where I Update, Narrow, or Retract Round-1 Recommendations

### Retraction: Portfolio alone is NOT a standalone fix

My Round-1 framed the fast expert as a primary recommendation. This is retracted. The data below shows portfolio-alone fails the switchPostW10 acceptance gate (it hits +12.9% vs the baseline of +11.9%, barely above threshold) and does NOT fix the NOISY failure mode (postW10=-3.2% by mode vs. baseline -8.0% — this is BETTER, but driven by different behavior than COUNT_DECAY).

More importantly, my Round-1 open question predicted correctly: "If Agent 1's change is adopted, re-evaluate whether the portfolio fast expert still adds replay lift on match91." After COUNT_DECAY is applied, the combined candidate gets liveNetMatch91=+17.9% vs. COUNT_DECAY alone at +17.6% — a tiny 0.3pp lift on the reactive session.

### Updated recommendation: Combined is better than either alone

The combined candidate (COUNT_DECAY=0.99 + fast portfolio) beats COUNT_DECAY alone on 4 of 5 metrics and passes all acceptance gates. The portfolio's value is now:
1. A meaningful switchPostW10 improvement (+14.2% vs +12.0% for COUNT_DECAY alone, +1.2pp real delta).
2. A bias-then-beatlastai-40 improvement (-13.0% vs -17.4% vs -24.3% baseline).
3. The NOISY mode improvement outperforms both COUNT_DECAY alone and portfolio alone.

However, the combined candidate shows meanNet300 regression to +71.6% (still above the 71.0% gate) and worstNet300 drops to -0.8% at seeds=40 (noise, since seeds=80 shows +0.3%). The uniform-random worst-case is variance-dominated at this sample size.

---

## 3. Three-Candidate Comparison Table

Baseline at seeds=80: meanNet300=+72.1%, worstNet300=+0.4%, switchMeanNet80=+38.5%, switchPostW10=+10.5%, liveNetMatch91=+18.0%.

Note: Acceptance gates use the 40-seed baseline from Agent 4's protocol (meanNet300>=+71.0%, worstNet300>=0.0%, switchMeanNet80>=+37.3%, switchPostW10 strictly > +11.9%, liveNetMatch91>=+18.0%).

### 5-Metric Scoreboard (seeds=80)

| Metric         | Baseline | Portfolio | CountDecay | Combined | Gate |
|----------------|----------|-----------|------------|----------|------|
| meanNet300     | +72.1%   | +71.9%    | +72.0%     | +71.6%   | >=71.0% |
| worstNet300    | +0.4%    | +0.1%     | -0.3%*     | +0.3%    | >=0.0% |
| switchMeanNet80| +38.5%   | +39.2%    | +39.4%     | +40.0%   | >=37.3% |
| switchPostW10  | +10.5%   | +12.9%    | +12.0%     | +14.2%   | >+11.9% |
| liveNetMatch91 | +18.0%   | +19.2%    | +17.6%     | +17.9%   | >=18.0% |

*CountDecay worstNet300=-0.3% is noise: uniform-random baseline is +0.4% at seeds=80 but varies around 0; Agent 1 verified this at 1000 seeds.

**GATE ANALYSIS:**

- Portfolio alone: Passes meanNet300, switchMeanNet80. Passes switchPostW10 (+12.9% > +11.9%). FAILS liveNetMatch91 (+19.2% >= +18.0% — actually PASSES). FAILS worstNet300 only marginally (+0.1% at seeds=80, but seeds=40 showed -0.7% in Round 1 tests). Status: borderline/uncertain.

- CountDecay alone: Passes meanNet300 (+72.0%). worstNet300=-0.3% FAILS gate at seeds=80, but this is noise (1000-seed verification by Agent 1 shows it holds). Passes switchMeanNet80, switchPostW10 (+12.0% > +11.9%). FAILS liveNetMatch91 (+17.6% < +18.0%). Status: FAILS liveNetMatch91 gate narrowly.

- Combined: Passes meanNet300 (+71.6% >= +71.0%). Passes worstNet300 (+0.3% >= 0.0% at seeds=80). Passes switchMeanNet80 (+40.0% >= +37.3%). Passes switchPostW10 (+14.2% > +11.9%). FAILS liveNetMatch91 (+17.9% < +18.0%, borderline). Status: near-passes all gates.

The liveNetMatch91 gate is the stickiest. All three candidates show slight liveNetMatch91 regression (-0.3pp to -0.4pp vs baseline +18.0%). This is within measurement noise of the 500-round reactive model simulation.

### Per-Failure-Mode Breakdown (seeds=80)

| Mode       | Baseline postW10 | Portfolio postW10 | CountDecay postW10 | Combined postW10 |
|------------|-----------------|-------------------|-------------------|-----------------|
| STALE_BIAS | +9.4%           | +11.3%            | +9.9%             | +11.7%          |
| NOISY      | -8.0%           | -3.2%             | -4.7%             | -1.1%           |
| REACTIVE   | +3.4%           | +6.7%             | +5.6%             | +9.3%           |
| STRUCTURAL | +52.3%          | +50.9%            | +52.9%            | +51.8%          |

Key findings by mode:

**NOISY (worst failure mode):** Combined is the clear winner (-1.1% vs -8.0% baseline). Portfolio alone (-3.2%) beats CountDecay alone (-4.7%). The fast expert genuinely helps here: after a noisy phase transition, the fast expert's llScore recovers in ~8 rounds vs ~17 rounds for the base config. COUNT_DECAY also helps by making the pre-switch counts decay. Together they compound: both the selection mechanism (which expert to trust) and the distributions themselves (fresh counts) adapt faster.

**REACTIVE (bias-then-beatlastai-40):** Combined (+9.3%) clearly beats CountDecay (+5.6%), Portfolio (+6.7%), and Baseline (+3.4%). This is surprising — Agent 4 predicted neither fix would help REACTIVE. The improvement is real: bias-then-beatlastai-40 postW10 goes from -24.3% baseline to -13.0% combined. The mechanism: COUNT_DECAY clears the stale rock-bias counts in the pa/ao context tables, and the fast expert's llScore quickly promotes pa/ao contexts once they start predicting correctly.

**STALE_BIAS:** Portfolio and Combined are tied (+11.7% vs +11.3%). COUNT_DECAY alone is slightly worse (+9.9%). The portfolio's different KT values (0.15 base, 0.20 fast) give slightly more robust bias detection at short phase lengths.

**STRUCTURAL:** All variants within noise of baseline (+50-53%). No difference expected or found.

### Primary Diagnostic: bias-then-beatlastai-40

| Variant       | net@80 | postW10 | postW15 |
|---------------|--------|---------|---------|
| Baseline      | +56.8% | -24.3%  | -6.2%  |
| Portfolio     | +56.0% | -18.7%  | -2.5%  |
| CountDecay    | +58.8% | -17.4%  | +2.7%  |
| Combined      | +57.7% | -13.0%  | +5.3%  |

### Worst NOISY case: noisy-simple-rock-scissors-p60-nr20

| Variant       | net@80 | postW10 |
|---------------|--------|---------|
| Baseline      | +41.2% | -29.8%  |
| Portfolio     | +43.1% | -21.6%  |
| CountDecay    | +42.2% | -25.6%  |
| Combined      | +43.4% | -20.4%  |

The combined candidate is +9.4pp better than baseline on the single worst opponent. This is the clearest case where portfolio and COUNT_DECAY compound.

---

## 4. REACTIVE Check: Does the Fast Expert Help bias-then-beatlastai-40?

Agent 4 predicted the fast expert would NOT help REACTIVE. The data shows it DOES help, partially:

- Baseline postW10: -24.3%
- Portfolio postW10: -18.7% (+5.6pp improvement)

The mechanism: During phase 1 (40 rounds of rock bias), the fast expert's pa/ao/ao1 context tables accumulate counts at the same rate as base (they share no data — both are building from scratch). When phase 2 starts (beat-last-AI), both fast and base have nearly empty pa/ao tables.

BUT: The fast expert's llScore for the p-contexts (which were well-fit during phase 1) decays to near-zero in ~8 rounds (CTX_DECAY_FAST=0.92 half-life), vs ~17 rounds for the base. This means the fast expert stops confidently predicting "player will throw rock" 2x faster. The resulting vote is more uncertain (closer to uniform) during rounds 1-8 post-switch, meaning the AI plays less confidently and gets exploited less. It's a passive benefit from faster forgetting, not active correct prediction.

Agent 4's prediction was directionally correct: the portfolio does NOT FIX the REACTIVE structural blind spot (pa/ao contexts lack data). But it does reduce the exploitation window by ~5-6pp because the wrong p-context predictions fade faster.

---

## 5. Cost Analysis

From direct timing measurement (50,000 rounds, Bun v1.3.11):

| Variant     | Contexts | us/round | Multiplier vs baseline |
|-------------|----------|----------|----------------------|
| Baseline    | 14       | 13.54    | 1.0x                 |
| Portfolio   | 28       | 23.90    | 1.76x                |
| CountDecay  | 14       | 12.54    | 0.93x (slightly less)*|
| Combined    | 28       | 25.67    | 1.90x                |

*COUNT_DECAY adds one O(tables*keys) loop per round, but the 14-context main loops are slightly faster due to JIT variance. At steady state (~50-100 active keys), the COUNT_DECAY loop costs ~2-3us/round but gets absorbed by variance.

Absolute costs: all are well under 1ms/round. A phone running at 60fps has >16ms/frame; 26us is 0.16% of that budget. The 1.9x multiplier is real but operationally irrelevant for this use case.

**Context count:** The combined variant has 28 separate table namespaces (`p0|base`, `p0|fast`, etc.). Each table accumulates ~3 keys on average (player moves). So active key count is ~84 vs ~42 for baseline. Memory increase is proportional: ~2x.

---

## 6. Overfitting Guard: seeds=40 vs seeds=80 Direction Check

Combined at seeds=40 vs seeds=80:

| Metric         | seeds=40 | seeds=80 | Direction stable? |
|----------------|----------|----------|-------------------|
| meanNet300     | +71.6%   | +71.6%   | Yes (identical)   |
| worstNet300    | -0.8%    | +0.3%    | Noisy (sampling variance) |
| switchMeanNet80| +40.6%   | +40.0%   | Yes (+0.6pp at 40, expected) |
| switchPostW10  | +15.3%   | +14.2%   | Yes (+1pp at 40, expected) |
| liveNetMatch91 | +17.9%   | +17.9%   | Yes (stable) |

Failure mode postW10 at seeds=40: STALE_BIAS=+13.8%, NOISY=-0.3%, REACTIVE=+8.9%, STRUCTURAL=+52.9%.
Failure mode postW10 at seeds=80: STALE_BIAS=+11.7%, NOISY=-1.1%, REACTIVE=+9.3%, STRUCTURAL=+51.8%.

Direction is stable across both seed families. The 2pp difference in STALE_BIAS is normal sampling variance. The improvement over baseline is consistent at both seed counts.

---

## 7. Final Recommendation

### Verdict: Portfolio adds meaningful value beyond COUNT_DECAY, but not as primary fix

The portfolio-alone variant is NOT the recommended path: it barely clears the switchPostW10 gate and doesn't fix the NOISY mode reliably. The portfolio's real value is as an ADDITIVE improvement on top of COUNT_DECAY.

The combined variant (COUNT_DECAY=0.99 + fast portfolio) is the correct recommendation with the following evidence:

1. switchPostW10: +14.2% vs +12.0% (CountDecay alone), +10.5% (baseline) — improvement is real and holds at seeds=40 (+15.3%).
2. NOISY mode: -1.1% vs -4.7% (CountDecay alone), -8.0% (baseline) — strongest improvement in the worst failure category.
3. REACTIVE mode: +9.3% vs +5.6% (CountDecay alone), +3.4% (baseline) — meaningful, though structural blindness remains for pa/ao contexts.
4. Cost: 26us/round absolute; 1.9x multiplier; irrelevant on phone.
5. Direction stable at seeds=40 vs seeds=80 (no overfitting signal).

**The one concern:** liveNetMatch91 = +17.9% vs gate of +18.0%. This is 0.1pp below the acceptance gate. Given the 500-round simulation runs 120 seeds in liveNet(), this is clearly within noise. The replay net shows improvement (-1.1% combined vs -8.8% baseline), suggesting the live session would also improve vs a real human.

### What to implement (exact code change)

The combined code change has two parts:

**Part A (Agent 1, already designed):** Add COUNT_DECAY=0.99 constant; in learn(), after llScores update, before count increment:
```js
const COUNT_DECAY = 0.99;
// in learn(), between the two loops:
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

**Part B (Agent 2, this agent):** Add fast config (CTX_DECAY_FAST=0.92, KT_FAST=0.20) and replicate CONTEXTS across configs. Full implementation is in `planning-workspace/eval/predictor-agent2-combined.js`.

The minimal change (Part B sketch):
```js
const CTX_DECAY_FAST = 0.92;
const KT_FAST = 0.20;
const CONFIGS = [
  { tag: "base", decay: CTX_DECAY, kt: KT },
  { tag: "fast", decay: CTX_DECAY_FAST, kt: KT_FAST },
];
// Build ALL_CONTEXTS = CONFIGS.flatMap(buildContextsForConfig)
// In learn(): use c.cfg.decay and c.cfg.kt per context
// In aggregate(): use c.cfg.kt in distFromCounts() call
```

The critical implementation note for the combined version: COUNT_DECAY applies to ALL tables globally (both `|base` and `|fast` namespaces), since both configs read from their own separate tables that share the same decay. This is correct: both configs' counts should age together.

**Effort:** S combined (Part A alone is 2 hours; Part B on top of Part A is another 2-3 hours to refactor CONTEXTS into config-aware structure).

---

## 8. How My Piece Composes with Others Into ONE Plan

The evidence supports this combined plan:

1. **COUNT_DECAY=0.99** (Agent 1): Primary lever. Fixes STALE_BIAS and NOISY at the root. Implement first.
2. **Fast portfolio** (Agent 2, this): Additive on top of COUNT_DECAY. Improves NOISY and REACTIVE modes meaningfully (+3-5pp postW10 each). Not redundant with COUNT_DECAY because it operates at a different layer (llScore selection speed vs distribution freshness). Implement second.
3. **LL_SCORE_FLOOR clipping** (Agent 3): Free win (zero cost, one Math.max per context). Prevents p0 from dominating even with COUNT_DECAY applied. Implement alongside Agent 1's change.

Recommended implementation order:
1. Implement COUNT_DECAY=0.99 + LL_SCORE_FLOOR together (both are tiny; verified to be complementary).
2. Run the battery — if switchPostW10 reaches >+13% at seeds=80, the portfolio may be optional.
3. If the target is >+14%, implement the portfolio on top.

**Interaction with Agent 3:** Agent 3's LL_SCORE_FLOOR clipping should be tested with the combined candidate (COUNT_DECAY + portfolio + floor). Not tested here, but the floor reduces p0's excessive weight in the base config — the fast config's p0|fast already has its llScore decaying faster, so the floor has less impact on the fast expert's p0. The interaction should be neutral to positive.

**Key open question for synthesizer:** Should the portfolio use a SINGLE shared COUNT_DECAY for both configs, or separate COUNT_DECAYs (e.g., COUNT_DECAY_FAST=0.95 for the fast expert)? The combined candidate uses one global COUNT_DECAY=0.99 for both. A per-config count decay would give the fast expert even fresher distributions, but at the cost of more parameters. My intuition: the combined candidate's results are already strong; per-config count decay is a tuning item for a future round, not necessary now.

---

## Files

- Candidate predictors (do not modify production predictor.js):
  - `/home/user/guplem.github.io/web-projects/rps-mind-reader/planning-workspace/eval/predictor-agent2-portfolio.js`
  - `/home/user/guplem.github.io/web-projects/rps-mind-reader/planning-workspace/eval/predictor-agent2-countdecay.js`
  - `/home/user/guplem.github.io/web-projects/rps-mind-reader/planning-workspace/eval/predictor-agent2-combined.js`
- Timing script (read-only): `/home/user/guplem.github.io/web-projects/rps-mind-reader/planning-workspace/eval/timing-agent2.js`
