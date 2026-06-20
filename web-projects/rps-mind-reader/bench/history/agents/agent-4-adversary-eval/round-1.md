# Agent 4 — Adversary & Evaluation: Round 1 Findings

## Key Findings

### F1. The Existing Benchmark is Blind to the Real Failure Mode

The existing `switch-every-40` opponent (benchmark.js line 88-94) produces a misleadingly high post-switch net (+87.6% at W=15) because it switches TO a fixed-cycle `MOVES[i++ % 3]` pattern — exactly the most trivially exploitable class. The predictor learns the new deterministic pattern within a few rounds and the metric looks great. But the real session failure involved switching to a _bias_ (new dominant move) not a new _cycle_, and the stale within-context counts caused a multi-round stuck prediction.

Switch-every-40 is useful as a no-regress gate but is not diagnostic of adaptation lag.

### F2. The Baseline Post-Switch Performance Has a Critical Gap at Short Cadences

Against `bias-then-beatlastai-40` at 80 rounds (matching real session length), the baseline predictor scores:
- Overall net: +58.0%
- Post-switch W=10: **-21.5%** (AI is being exploited in the first 10 rounds after each switch)
- Post-switch W=15: **-3.2%**

At W=5 the result is **-50.5%**. The predictor takes 10-15 rounds to recover from a bias→reactive switch, during which time it is actively exploited. This is exactly the failure mode seen in match91 (post-switch windows -33%, -13%, -20%, -20%).

### F3. The 300-Round Battery Masks Session-Length Weakness

The delta between 300-round and 80-round overall net is substantial for the hardest switching opponents:
- `gradual-rock-to-scissors-60`: +22.9 percentage points difference (300rnd=+45.7%, 80rnd=+22.9%)
- `bias-then-beatlastai-25`: +18.1pp difference

A predictor change that improves the 300-round number but doesn't move the 80-round number or the post-switch W=10 metric has not solved the user-facing problem.

### F4. match91.json Shows 4 of 5 Post-Switch Windows Negative

Replay analysis by 15-round window:
- Rounds 1-15 (pre-first-switch): 0%
- Rounds 16-30 (after rock→paper switch): **-33%**
- Rounds 31-45 (after paper→scissors): +40% (predictor adapted)
- Rounds 46-60 (after scissors→paper): **-13%**
- Rounds 61-75 (after paper→paper persistence): **-20%**
- Rounds 76-90 (after paper→rock): **-20%**

The +40% window (rounds 31-45) is the anomaly — the "scissors" switch happened to align with contexts the predictor had already learned. The other 4 windows show the stale-count failure.

### F5. The Two Real Sessions Have Very Different Profiles

- `human-session-1.json` (80 rounds): well-mixed (R=25, P=27, S=28), oracle ceiling only +40.6%. vs model: +28.8%. 
- `match91.json` (91 rounds): strategy-switcher, oracle ceiling +26.6%, vs model: +18.0%, replay: -8.8%.

Session-1 is near-random: high oracle ceiling means there IS exploitable structure (the player reacts to AI moves), and the predictor captures about 71% of the available edge. Session-2 (match91) has lower oracle ceiling but the predictor only captures 68% of it due to the adaptation lag.

### F6. match91.json Should Be Committed as sample-plays/match91.json

The file currently lives at a volatile scratchpad path. It is the only real evidence of the failure mode. Losing it means the team cannot measure whether fixes work. It should be committed as `sample-plays/match91.json` immediately.

---

## Concrete Recommendations

### R1. Commit match91.json as sample-plays/match91.json

**What:** Copy `/tmp/claude-0/.../scratchpad/match91.json` to `web-projects/rps-mind-reader/sample-plays/match91.json` and commit it.

**Why:** It is the sole real evidence of the switch-adaptation failure. Without it, realplay-bench has only session-1 (well-mixed, not a switcher), meaning all Agents 1-3 could tune to the synthetic opponents without any human-switcher validation. The realplay-bench will auto-scan it once present.

**How:**
```bash
cp /tmp/claude-0/-home-user-guplem-github-io/322a05da-68ea-528b-80f9-efea070f4cb3/scratchpad/match91.json \
   /home/user/guplem.github.io/web-projects/rps-mind-reader/sample-plays/match91.json
git add web-projects/rps-mind-reader/sample-plays/match91.json
```

**Risk:** None — it is read-only fixture data, not code.

**Effort:** S (< 5 minutes)

---

### R2. Add Strategy-Switching Opponent Family to benchmark.js

**What:** Add 4-7 new opponents to the `opponents` array in `benchmark.js`. These are the most diagnostically useful:

1. `bias-rock-paper-25`: 25-round phases alternating 70%-rock vs 70%-paper bias. Tests distribution-shift adaptation.
2. `bias-then-beatlastai-40`: 40-round stationary-bias phase then reactive beat-last-ai phase. The closest synthetic analog to match91. **The single most diagnostic new opponent.**
3. `4phase-cycle-15`: 4 distinct 15-round phases (rock-bias, scissors-bias, anti-repeat, paper-bias). Tests multi-switch within a session-length match.
4. `gradual-rock-to-scissors-60`: linearly interpolates bias over 60 rounds. Tests tracking of slow drift.
5. `markov-then-antirepeat-25`: habit-markov → anti-repeat switch. Tests structural strategy change.

**Why:** The existing 12 opponents include only one switcher (`switch-every-40`) that is trivially exploited post-switch. The new opponents expose the actual failure modes: stale counts dominating after bias-shifts, and the reactive switch case where p-context models are flat-footed.

**How (sketch for benchmark.js, inside the `opponents` array):**
```javascript
{ name: "bias-rock-paper-25", make: () => {
    let c = 0;
    return (_h, rng) => {
      const phase = Math.floor(c++ / 25) % 2;
      if (phase === 0) return rng() < 0.70 ? "rock" : rng() < 0.5 ? "paper" : "scissors";
      else return rng() < 0.70 ? "paper" : rng() < 0.5 ? "scissors" : "rock";
    };
  }
},

{ name: "bias-then-beatlastai-40", make: () => {
    let c = 0;
    return (h, rng) => {
      const phase = Math.floor(c++ / 40) % 2;
      if (phase === 0) return rng() < 0.70 ? "rock" : randMove(rng);
      else return h.length ? counter(h[h.length - 1].a) : randMove(rng);
    };
  }
},

{ name: "4phase-cycle-15", make: () => {
    let c = 0;
    return (h, rng) => {
      const phase = Math.floor(c++ / 15) % 4;
      if (phase === 0) return rng() < 0.75 ? "rock" : randMove(rng);
      if (phase === 1) return rng() < 0.75 ? "scissors" : randMove(rng);
      if (phase === 2) {
        if (!h.length) return randMove(rng);
        const others = MOVES.filter(m => m !== h[h.length - 1].p);
        return others[Math.floor(rng() * others.length)];
      }
      return rng() < 0.75 ? "paper" : randMove(rng);
    };
  }
},
```
The `counter` import already exists in benchmark.js (from `game.js`). Add `counter` to the import line (`import { MOVES, judge, shift, counter } from "./game.js";`).

**Risk:** Adding opponents raises the `meanNet` bar and changes `worstNet`. The new opponents should have worstNet >= ~0 to avoid breaking the no-regress gate. Verified baseline: worst among new opponents at 80 rounds is +21.8% — all positive, so no existing "must stay >= 0" constraint is broken. The 300-round meanNet will shift upward (more exploitable opponents added), so document the new baseline before Agents 1-3 tune to it.

**Effort:** S (2-3 hours)

---

### R3. Define the Official Post-Switch Metric Protocol

**What:** Standardize measurement as two additional numbers every agent reports alongside meanNet/worstNet:

1. `switchMeanNet80`: mean over all new switching opponents of the 80-round overall net (not 300-round).
2. `switchPostW10`: mean post-switch net, W=10 window, across all switching opponents at 80 rounds.

These are defined precisely as:
- Run 40 seeds, 80 rounds each, against each new switching opponent.
- For each match, at each phase-boundary index `sw = phaseLen, 2*phaseLen, ...`, collect the net AI performance over rounds `[sw, sw+10)`.
- Average across all such windows across all seeds.
- Average across all switching opponents.

**Why:** `meanNet` and `worstNet` from the 300-round battery do not capture post-switch recovery. Agents 1-3 will inevitably tune to the numbers they see. If `switchPostW10` is not in the reported table, improvements to adaptation speed are invisible. The W=10 window is chosen over W=15 because the baseline already recovers to +21.8%→+57% at W=15 for most opponents; W=10 still shows the regression (-21.5% for bias-then-beatlastai-40) that needs fixing.

**How (measurement script skeleton):**
```javascript
// In realplay-bench.js or a new switch-bench.js (keep separate from benchmark.js):
function switchMetrics(pred, { seeds = 40, rounds = 80, postWindow = 10 } = {}) {
  // Run across switchingOpponents (see R2) + compute post-switch windows
  // Returns { switchMeanNet80, switchPostW10, worstSwitchNet80 }
}
```
Full implementation lives in the scratch prototype at:
`/tmp/claude-0/-home-user-guplem-github-io/322a05da-68ea-528b-80f9-efea070f4cb3/scratchpad/research/agent-4/switch-bench.js`

**Risk:** The W=10 baseline is low enough that almost any real improvement will show up, but aggressive decay could also crater it for adversarial/random cases — exposing the tradeoff. That is the intended behavior.

**Effort:** S (half-day to write and integrate)

---

### R4. Anti-Overfitting Protocol

**What:** Designate sessions and opponents by role:

| Role | Sessions / Opponents |
|---|---|
| **Held-out validation** (never tune to) | `match91.json`, `human-session-1.json` — look at these ONCE per final candidate |
| **Training targets** | Synthetic switching opponents + existing 12-opponent battery |
| **Sanity rule** | A change that only improves `match91.json` replay/vs-model but does NOT improve `switchPostW10` on synthetic opponents is suspect overfit — do not merge |

**Anti-overfitting rule (enforceable):** A proposed change must satisfy ALL of:
1. `meanNet` (300-round) does not decrease by more than 1 percentage point.
2. `worstNet` (300-round) stays >= 0.
3. `switchMeanNet80` (80-round, switching opponents) improves OR stays flat.
4. `switchPostW10` (post-switch W=10 window) improves.
5. At most one real-session metric (replay or vs-model) is allowed to degrade, and only by <= 5pp.

If a change passes rules 1-4 but NOT 5, it is a real tradeoff that needs a discussion comment, not automatic rejection.

**Why:** With only 2 real sessions, any parameter search that includes them as tuning targets will overfit. The synthetic opponents provide ~17 independent match types (9 new + 8 stationary-ish from existing) — enough to reveal genuine generalization.

**How:** Document this table in a `BENCHMARK.md` file in `web-projects/rps-mind-reader/`. No code needed; it is a process rule. Each agent's round-2 output should include the 5-number tuple `(meanNet300, worstNet300, switchMeanNet80, switchPostW10, liveNetMatch91)`.

**Risk:** The rule is strict but all five constraints are independently meaningful. The main risk is that rule 3/4 move in opposite directions for some changes (e.g., faster decay helps post-switch but hurts overall net on slow-pattern opponents). In that case the team must examine the tradeoff explicitly — which is the intended outcome.

**Effort:** S (writing the doc)

---

## Baseline Reference Numbers

All numbers are AI-perspective net = (AI wins - AI losses) / rounds, averaged over 40 seeds.

### Standard Battery (existing, 300 rounds)
| Opponent | net |
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
| **MEAN** | **+72.0%** |
| **WORST** | **+0.1%** |

### Short-Horizon Battery (existing opponents, 80 rounds)
| Metric | Value |
|---|---|
| meanNet | +64.3% |
| worstNet | +0.8% |

### New Switching Opponents (80 rounds, 40 seeds) — BASELINE
| Opponent | net@80 | PS_net@W10 | PS_net@W15 |
|---|---|---|---|
| bias-rock-paper-15 | +27.6% | +21.8% | +23.1% |
| bias-rock-paper-25 | +30.8% | +17.9% | +18.7% |
| markov-then-antirepeat-25 | +57.3% | +56.5% | +57.2% |
| bias-then-beatlastai-25 | +45.5% | +16.8% | +26.7% |
| **bias-then-beatlastai-40** | **+58.0%** | **-21.5%** | **-3.2%** |
| 4phase-cycle-15 | +21.8% | +4.6% | +12.8% |
| gradual-rock-to-scissors-60 | +22.9% | +50.3% | +50.7% |
| **MEAN (switching)** | **+37.7%** | **+20.9%** | **+26.5%** |
| **WORST (switching)** | **+21.8%** | **-21.5%** | **-3.2%** |

### Real Session Baselines (from realplay-bench.js)
| Session | replay net | vs-model net | oracle ceiling |
|---|---|---|---|
| human-session-1.json (80 rnd) | -3.8% | +28.8% | +40.6% |
| match91.json (91 rnd) | -8.8% | +18.0% | +26.6% |

### Key Diagnostic: bias-then-beatlastai-40, post-switch by window width (80 rounds)
| Window W | baseline post-switch net |
|---|---|
| W=5 | -50.5% |
| W=10 | -21.5% |
| W=15 | -3.2% |
| W=20 | +13.5% |

**This is the primary target metric.** A fix that moves W=10 from -21.5% toward 0 or positive without cratering meanNet or worstNet is a genuine improvement.

---

## Open Questions

1. **Should bias-then-beatlastai-40 also be tested at 300 rounds as a gate?** At 300 rounds it scores +64.7% overall (fine), but the session-length W=10 number exposes the real problem. Reporting only the 300-round number would hide the failure. My recommendation: always report both.

2. **How many seeds are enough for the switching opponents?** At 40 seeds, individual opponent results have ~2-3pp standard error. The post-switch W=10 windows are noisier (~5-8pp). Increasing to 80-100 seeds would tighten confidence intervals for round 2 comparison. Run time is ~2-3 seconds per opponent with 40 seeds; 100 seeds is still acceptable.

3. **Is a gradual-drift opponent necessary in the official battery?** The `gradual-rock-to-scissors-60` opponent (22.9% overall net at 80 rounds) exposes a different failure mode (slow drift) that is distinct from abrupt switches. Agents 1-3 might solve the abrupt-switch problem with a recency trick that still fails on gradual drift. I recommend including it.

4. **Should post-switch W be 10 or 15?** W=10 reveals more of the failure (-21.5% vs -3.2% at W=15). But W=10 has higher variance at the individual-match level. Both should be reported; use W=10 as the primary gate.

---

## Interactions With Other Agents' Domains

**Agent 1 (Recency-Decay):** Their fix (aging within-context counts) directly targets the failure exposed by `bias-then-beatlastai-40`. Expected improvement: post-switch W=10 should go from -21.5% toward positive. Risk: aggressive decay could hurt the `always-rock` and `fixed-cycle` opponents (those need accumulated counts to stay confident). Check that worstNet stays >= 0 in the 300-round battery. The `bias-rock-paper-*` family is a second validation: if recency helps with bias shifts, all three variants should improve.

**Agent 2 (Expert-Portfolio):** Adding more expert configurations won't help post-switch recovery if every expert still has stale within-context counts. The post-switch window metric is the acid test. A multi-config ensemble might also inflate variance on the uniform-random opponent — watch worstNet.

**Agent 3 (Meta-Selection):** A faster meta-selector (quicker weight shift toward accurate models post-switch) could help the llScore-based recovery without touching within-context counts. The `switchPostW10` metric directly measures this. Risk: a selector that resets too aggressively will hurt the stationary opponents. The `bias-rock-paper-*` family (where each phase is 15-40 rounds of stable bias) is the balance test.

**Critical flag for all agents:** `bias-then-beatlastai-40` phase 2 is reactive (beat-last-AI). The p-context models (p0-p5) are structurally blind to this: no player-history context predicts well against a player who reacts to AI moves. Only `pa1`, `pa2`, and `ao1` contexts can catch this. Any improvement that works by making p0-p5 faster will fail against beat-last-AI post-switch. The vs-model metric from realplay-bench covers this because the reactive model uses (lastPlayer, lastAI, lastOutcome) conditioning — but only the synthetic `bias-then-beatlastai-40` exposes it starkly in the benchmark.
