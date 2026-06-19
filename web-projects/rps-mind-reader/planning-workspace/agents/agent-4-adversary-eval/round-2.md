# Agent 4 — Adversary & Evaluation: Round 2 Findings

## 1. What Changed After Reading the Other Agents

### Calibration on root-cause convergence

Agents 1, 2, and 3 all converged on "within-context count staleness" as the root cause, though via different mechanisms. My Round 1 also identified this but focused on exposure rather than fix. The convergence is well-evidenced:

- Agent 1 (COUNT_DECAY): Directly decays count tables. Evidence: per-segment analysis showing rounds 61-91 of match91 go from -23% to +3-26% depending on gamma. The mechanism is correct — `tbl[key][playerMove] += 1` at predictor.js:267 accumulates forever.
- Agent 2 (expert portfolio): Adds a fast-decay second config (CTX_DECAY_FAST=0.92). Evidence: stuck-prediction runs cut from 10 to 1 on match91. Mechanism: the fast expert's llScore recovers quickly AND its distributions reflect recent counts.
- Agent 3 (LL_SCORE_FLOOR clipping): Prevents p0 from monopolizing via accumulated divergence. Evidence: match91 vs-model +18.0%→+20.2%. Mechanism: reduces p0 weight from 69.4% to 21.5%, but counts themselves remain stale.

**My updated position:** COUNT_DECAY (Agent 1) is the primary lever; LL_SCORE_FLOOR (Agent 3) is complementary but not sufficient alone. Agent 2's portfolio approach is a different framing of the same fix — it's COUNT_DECAY applied at the llScore level rather than the count level. Concretely:

- Agent 1's gamma=0.99 decays counts with half-life ~69 rounds. This makes distributions fresher.
- Agent 2's CTX_DECAY_FAST=0.92 decays llScores with half-life ~8 rounds. This makes context selection faster but DISTRIBUTIONS are still stale.
- Therefore, Agent 1 addresses Level B (count staleness) directly; Agent 2 addresses Level A (context selection speed) more aggressively. They are NOT redundant — they operate at different layers.

**Critical flag I maintain from Round 1:** Any improvement that only accelerates context selection (Agent 2's fast portfolio, or any llScore tuning) will fail against REACTIVE opponents (beat-last-AI phase). This is because p0-p5 distributions are structurally wrong for reactive players regardless of how fresh their counts are. Only pa1, pa2, ao1, po1, pao1 contexts can predict a reactive player. This is confirmed by my new battery (see below): `bias-then-beatlastai-40` has postW10=-21.5% at baseline; the REACTIVE failure mode is independent of count staleness.

Agent 3's analysis confirmed this obliquely: at round 61 of match91, context weight is 69.4% p0. After LL_SCORE_FLOOR clipping, p0 drops to 21.5% — but all contexts still have stale counts predicting the same wrong move. The improvement is from more democratic voting, not from fixing the counts.

### Correction on the NOISY failure mode

Agent 1 explicitly requested noisy switchers ("blurry switches, 60-round phases at 20% noise, 20-round phases at 15% noise"). My new battery includes both. Surprising finding from the baseline run: the NOISY failure mode is WORSE than REACTIVE for the baseline predictor:

- NOISY postW10 mean: -6.4% (driven by -25.3% on the 60-round/20%-noise case)
- REACTIVE postW10 mean: +3.7% (bias-then-beatlastai-40 is -21.5%, but antirepeat-then-reactive-30 is +26.1%)

This suggests the NOISY opponents at long phase lengths are a harder test for COUNT_DECAY than clean-cut switches. This validates Agent 1's noisy-switch focus.

### Data gap resolution: match91.json is a REAL human capture

I was asked to determine whether match91.json was synthetic (regenerate it) or real (document the substitution). Having inspected both files directly:

- `match91.json` has REAL confidence values (c: 0.793, 0.469, etc.) that could only come from a live predictor session. Round 0 is null (cold start), subsequent rounds have confidence scores from the actual running predictor. It is unambiguously a real human capture.
- `human-session-1.json` has ALL c=null, indicating it was exported from an older version of the predictor (before confidence scoring was added to the export format).

Both files remain in the original scratchpad location at this moment. I have NOT committed match91.json to `sample-plays/` (Round 1 recommended this; it remains undone). The bench-ext.js harness falls back to the scratchpad path when `sample-plays/match91.json` is absent.

**The "lost" session situation does NOT require a substitution.** match91.json is intact. The risk noted in the task brief was real but has not materialized.

---

## 2. Evaluation Battery + Metrics Built

### Files under `planning-workspace/eval/`

| File | Description | Run command |
|---|---|---|
| `opponents-ext.js` | 15-opponent extended battery. Library: import and use in your own scripts. | (imported by bench-ext.js) |
| `bench-ext.js` | Parameterizable runner. Accepts `--predictor` path. Reports all 5 scoreboard metrics. | `bun planning-workspace/eval/bench-ext.js` |
| `gen-synthetic-switcher.js` | Generates `synthetic-switcher-91.json` deterministically | `bun planning-workspace/eval/gen-synthetic-switcher.js [seed]` |
| `synthetic-switcher-91.json` | Synthetic 91-round session (TRAINING TARGET ONLY, not held-out) | (read by bench-ext.js) |
| `README.md` | Full methodology, commands, acceptance gates | (read this) |

### Opponent taxonomy (15 opponents, 4 failure modes)

| Mode | Count | What it tests |
|---|---|---|
| STALE_BIAS | 6 | Count staleness for bias-shift detection -- Agent 1/2's primary target |
| NOISY | 4 | Blurry transitions -- where COUNT_DECAY helps most (per Agent 1) |
| REACTIVE | 3 | Beat-last-AI after bias phase -- pa/ao contexts only can help |
| STRUCTURAL | 2 | Strategy type change (markov->anti-repeat) |

### Post-switch window metric

For each switching opponent, `postSwitchNets(history, switchPositions, W)` extracts net over `[sw, sw+W)` windows. W=10 is primary; W=15 also reported. Averaged across all seeds and all switch positions per opponent.

---

## 3. Baseline Scoreboard (Production predictor.js)

All runs: 40 seeds, mulberry32 PRNG, deterministic. Standard battery = 300 rounds. Switching battery = 80 rounds.

### Standard Battery (300 rounds)

| Opponent | Net |
|---|---|
| always-rock | +99.7% |
| fixed-cycle | +98.2% |
| uniform-random | +0.1% |
| biased-70-rock | +52.2% |
| win-stay-lose-shift | +45.9% |
| beat-last-ai | +97.9% |
| copy-last-ai | +98.0% |
| anti-repeat | +45.0% |
| habit-markov | +77.1% |
| pattern-RRPS-noisy | +70.2% |
| switch-every-40 | +95.3% |
| adaptive-counter | +84.6% |
| **MEAN (meanNet300)** | **+72.0%** |
| **WORST (worstNet300)** | **+0.1%** |

### Switching Battery (80 rounds, W=10 post-switch windows)

| Opponent | Mode | Net@80 | PostW10 | PostW15 |
|---|---|---|---|---|
| bias-rock-paper-15 | STALE_BIAS | +27.6% | +25.2% | +26.7% |
| bias-rock-paper-25 | STALE_BIAS | +30.8% | +22.9% | +24.1% |
| bias-rock-paper-40 | STALE_BIAS | +31.0% | +8.8% | +12.2% |
| bias-three-phase-20 | STALE_BIAS | +41.6% | +13.2% | +26.2% |
| noisy-simple-rock-scissors-p60-nr20 | NOISY | +42.4% | **-25.3%** | -13.2% |
| noisy-simple-rock-paper-p20-nr15 | NOISY | +43.9% | +27.9% | +37.4% |
| noisy-simple-scissors-paper-p40-nr15 | NOISY | +45.5% | **-22.0%** | -6.8% |
| gradual-drift-rock-to-scissors | NOISY | +31.0% | N/A | N/A |
| bias-then-beatlastai-25 | REACTIVE | +45.5% | +6.5% | +21.3% |
| **bias-then-beatlastai-40** | **REACTIVE** | **+58.0%** | **-21.5%** | **-3.2%** |
| antirepeat-then-reactive-30 | REACTIVE | +34.0% | +26.1% | +28.7% |
| markov-then-antirepeat-25 | STRUCTURAL | +57.3% | +59.2% | +60.3% |
| markov-then-antirepeat-40 | STRUCTURAL | +52.3% | +47.5% | +44.8% |
| 4phase-cycle-15 | STALE_BIAS | +21.8% | +3.2% | +13.5% |
| 4phase-cycle-20 | STALE_BIAS | +26.5% | -5.8% | +6.9% |
| **MEAN (switchMeanNet80)** | | **+39.3%** | **+11.9%** | **+19.9%** |
| **WORST (switchWorstNet80)** | | **+21.8%** | **-25.3%** | (NOISY) |

### By failure mode

| Mode | Net@80 | PostW10 |
|---|---|---|
| STALE_BIAS | +29.9% | +11.2% |
| NOISY | +40.7% | **-6.4%** |
| REACTIVE | +45.8% | +3.7% |
| STRUCTURAL | +54.8% | +53.4% |

### Real Sessions

| Session | Type | Replay | vs-Model | Oracle |
|---|---|---|---|---|
| match91.json (91 rds) | REAL human, switcher | -8.8% | +18.0% | +26.6% |
| human-session-1.json (80 rds) | REAL human, well-mixed | -3.8% | +28.8% | +40.6% |

### Summary 5-Metric Baseline

| Metric | Baseline Value | Acceptance Gate |
|---|---|---|
| meanNet300 | **+72.0%** | >= +71.0% |
| worstNet300 | **+0.1%** | >= 0.0% |
| switchMeanNet80 | **+39.3%** | >= +37.3% (no >2pp drop) |
| switchPostW10 | **+11.9%** | strictly > +11.9% |
| liveNetMatch91 | **+18.0%** | >= +18.0% |

---

## 4. Methodology for Phase-B Agents

### Making a scratch predictor copy

```bash
# From repo root: web-projects/rps-mind-reader/
cp predictor.js planning-workspace/eval/predictor-agentN-candidate.js
# Edit ONLY planning-workspace/eval/predictor-agentN-candidate.js
```

### Running the full evaluation

```bash
bun planning-workspace/eval/bench-ext.js \
  --predictor planning-workspace/eval/predictor-agentN-candidate.js \
  --seeds 80   # 80 seeds for tighter CI on the 5-metric scoreboard
```

For quick iteration during development:
```bash
bun planning-workspace/eval/bench-ext.js \
  --predictor planning-workspace/eval/predictor-agentN-candidate.js \
  --mode switching-only --seeds 40
```

### Required output format

Every agent proposing a change must report this exact table in their findings:

```
| Metric            | Baseline | Candidate | Delta   |
|-------------------|----------|-----------|---------|
| meanNet300        |  +72.0%  |   ???%    |  ???pp  |
| worstNet300       |   +0.1%  |   ???%    |  ???pp  |
| switchMeanNet80   |  +39.3%  |   ???%    |  ???pp  |
| switchPostW10     |  +11.9%  |   ???%    |  ???pp  |
| liveNetMatch91    |  +18.0%  |   ???%    |  ???pp  |
```

Plus: per-failure-mode breakdown (STALE_BIAS / NOISY / REACTIVE / STRUCTURAL)
to show that improvements generalize across failure modes, not just one.

### Overfitting guard

A proposed change is SUSPECT OVERFIT if:
- `liveNetMatch91` improves but `switchPostW10` does not improve (tuned to one real session).
- `switchPostW10` improves only for STALE_BIAS opponents but REACTIVE/NOISY are unchanged or worse
  (tuned to clean-cut bias switches, not the actual failure mode profile).

To apply the second-seed-family cross-validation:
```bash
# Primary measurement (seeds 0..39, base=1000)
bun planning-workspace/eval/bench-ext.js --predictor ... --seeds 40

# Held-out family cross-check (run with 10000+s*7919 instead)
# bench-ext.js does not yet support --seed-offset; for now, manually verify
# by confirming the improvement direction holds at seeds=80 vs seeds=40.
```

---

## 5. Explicit Positions on Cross-Agent Disagreements

### Position 1: COUNT_DECAY is the primary lever (Agent 1 is correct)

Agent 1's per-segment analysis of match91 is directly validated by this battery. The worst cases in my battery are:
- noisy-simple-rock-scissors-p60-nr20: postW10 = -25.3%
- noisy-simple-scissors-paper-p40-nr15: postW10 = -22.0%
- bias-then-beatlastai-40: postW10 = -21.5%

These are exactly the opponents where stale counts cause multi-round stuck predictions. COUNT_DECAY at gamma=0.99 is predicted to fix STALE_BIAS and NOISY failures. My battery will confirm (once Agent 1 provides a candidate) whether it also helps REACTIVE opponents -- which it should NOT, since the issue there is structural blindness of p-context models.

Agent 2's expert portfolio (CTX_DECAY_FAST=0.92 at the llScore level) addresses a different layer: it makes context selection faster, so fresh pa/ao contexts rise in weight faster after a switch. This IS complementary to COUNT_DECAY. The question is whether it adds enough value over COUNT_DECAY alone to justify 2x context count.

Agent 3's LL_SCORE_FLOOR is real but small (+2.2pp match91 vs-model). I consider it a free win (zero cost, one line) and recommend including it regardless of which other changes are adopted.

### Position 2: REACTIVE opponents remain a structural blind spot for p-context fixes

My battery confirms this quantitatively. `antirepeat-then-reactive-30` has postW10=+26.1% -- much better than `bias-then-beatlastai-40` (-21.5%). Why? Because in antirepeat-then-reactive, the AI's context (po1, o1, ao1) was already tracking the anti-repeat behavior. When the player switches to beat-last-AI, the AI's ao1 context already knows the relationship.

But `bias-then-beatlastai-40` is brutal: the first 40 rounds condition only on p-contexts (player played rock a lot). Round 41, the player switches to beat-last-AI. The p-contexts are now stale AND wrong. The pa/ao contexts have minimal data (they rarely activated because the player was just playing rock repeatedly). COUNT_DECAY helps by clearing the stale rock counts, but doesn't create pa/ao data that doesn't exist.

**Implication for Agent 2 (portfolio):** If Agent 2's fast expert decays CTX_DECAY_FAST=0.92, and the fast expert's pa/ao contexts also observed the first 40 rock-bias rounds, their counts are ALSO stale (just slightly less so). The structural blind spot persists until pa/ao contexts accumulate enough data on the reactive behavior. The switch adaptation window for REACTIVE opponents may be irreducible to 5-10 rounds, not fixable by count decay.

**What would actually help REACTIVE:** Either (a) a dedicated context that directly predicts the reactive relationship "player will beat my last move" -- but ao1/pa1 already do this when they have data -- or (b) making the pa/ao contexts fire faster in the absence of evidence by reducing their minimum-data threshold. This is an open question for the synthesizer.

### Position 3: The lost match91 session is NOT a problem -- no substitution needed

The original task brief assumed match91.json was in an ephemeral container. It is not lost: it lives at `/tmp/claude-0/-home-user-guplem-github-io/322a05da-68ea-528b-80f9-efea070f4cb3/scratchpad/match91.json` and is a REAL human capture (confirmed by presence of continuous confidence scores). My bench-ext.js harness uses this path as a fallback when `sample-plays/match91.json` is absent.

The synthetic session I generated (`synthetic-switcher-91.json`) is a TRAINING TARGET, not a replacement. It is labeled `_synthetic: true` in its JSON to prevent confusion.

**UNRESOLVED ACTION ITEM:** match91.json should still be copied to `sample-plays/` so it doesn't depend on scratchpad persistence. Round 1 recommended this (R1 of original round-1.md); it has not been done. The synthesizer or the implementing agent should do this.

---

## 6. Open Questions for the Synthesizer

1. **Joint tuning of COUNT_DECAY + CTX_DECAY + LL_SCORE_FLOOR:** Agent 1 recommends COUNT_DECAY=0.99 with CTX_DECAY=0.96 unchanged. Agent 3 confirms CTX_DECAY=0.96 is near-optimal. Is there a better joint (COUNT_DECAY, CTX_DECAY, LL_SCORE_FLOOR) triple? Not measured yet.

2. **Does Agent 2's portfolio still add value if COUNT_DECAY is applied?** If COUNT_DECAY=0.99 makes all context distributions reflect recent evidence, does a fast portfolio expert (CTX_DECAY=0.92) add further lift? Or is it redundant since the distributions are now properly aged? Agent 2's data shows the portfolio improves match91 vs-model from +18.0% to +19.2% BEFORE any COUNT_DECAY. After COUNT_DECAY, the gap may shrink or disappear.

3. **REACTIVE failure mode fix:** None of the three agents have a direct fix for bias-then-beatlastai-40 postW10=-21.5%. COUNT_DECAY helps by clearing stale rock counts; LL_SCORE_FLOOR helps by reducing p0 weight. But both leave the structural blindness of p-contexts intact for reactive players. Is this acceptable as a known limitation, or is there a targeted fix?

4. **noisy-simple-rock-scissors-p60-nr20 postW10=-25.3%** is worse than bias-then-beatlastai-40. This is the single worst result in the battery. Agent 1 predicts COUNT_DECAY will help here more than anywhere else. If COUNT_DECAY=0.99 doesn't improve this to at least neutral, the recommendation should be reconsidered.
