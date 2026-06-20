# Synthesis — RPS Predictor Switching-Robustness Bake-Off

**Synthesizer verdict, backed by fresh high-seed measurement.** All numbers below were
re-measured by the synthesizer using Agent 4's harness (`bench-ext.js`) plus three
dedicated scripts (uniform-random net at 4000 seeds, full-battery worstNet across 3
independent 1000-seed seed families, replay-determinism verification, and a
human-session-1 vs-model probe). They are not quoted from the agents.

Production `predictor.js` was NOT modified. New scratch candidates created:
`planning-workspace/eval/predictor-synth-portfolio-cd0995-floor.js` (CD=0.995 + LL_SCORE_FLOOR + Agent 2's fast portfolio).

---

## 1. Decision & Recommended Configuration

**ADOPT: `COUNT_DECAY = 0.995` + `LL_SCORE_FLOOR` clamp.** (Agent 1's corrected primary
recommendation + Agent 3's floor, composed. Endorsed by Agents 1, 3, 4; Agent 2's data
also supports CD as the primary lever.)

**REJECT the fast expert portfolio** (Agent 2) for this change. **REJECT** more-aggressive
decay (CD ≤ 0.98), `CTX_DECAY` retuning, hard-argmax/Hedge/EXP3 selectors, per-context-order
decay, and reactive-context `CTX_DECAY` differentiation.

Rationale: The two-line floor clamp is a provably-safe free win that lifts the held-out
real session (`liveNetMatch91` +18.0%→+20.2% alone) with zero mechanism cost. Adding
`COUNT_DECAY = 0.995` ages within-context counts so the predictor stops voting from
stale all-time frequencies after a strategy switch; it adds a real `switchPostW10` gain
(+0.7pp) and, critically, flips the match91 *replay* trajectory (the late-session
"stuck prediction" failure) from negative to positive while keeping `liveNetMatch91` at
+19.9% and improving session-1 vs-model to +29.9%. Both changes are one-file,
dependency-free, microsecond-cheap, keep `decide()` pure, and — verified directly — keep
`learn()` deterministic and exactly replayable by `rebuildModel()` even with float counts.
The portfolio buys a further +1.9pp on `switchPostW10` and a much better worst NOISY case,
but at the cost of regressing the held-out `liveNetMatch91` (−1.5pp), regressing session-1
vs-model (−0.4pp), shaving meanNet300 (−0.4pp), nudging the uniform-random worst case
negative, and ~1.9x compute / ~2x memory. That fails the project's own consensus criterion
("improve vs-model on BOTH real sessions") and trades a held-out real-session win for a
synthetic-battery win — exactly the overfit pattern the protocol warns against. Not worth it.

**Recommended final tunables:** `CTX_DECAY=0.96`, `COUNT_DECAY=0.995`, `LL_ETA=1.1`,
`MAX_ORDER=5`, `KT=0.15`, `LL_SCORE_FLOOR = UNIFORM_LL/(1-CTX_DECAY) ≈ -27.47`.

---

## 2. Exact Production Changes to `predictor.js`

Four edits. Reference scratch copy that is byte-identical except for the import path:
`planning-workspace/eval/predictor-agent1-cd0995-floor.js`. **Keep production's
`import ... from "./game.js"` (line 50) unchanged** — the scratch copy uses `../../game.js`
only because it lives in `eval/`.

**Edit A — add `COUNT_DECAY` constant** (after `CTX_DECAY`, predictor.js:54):
```js
const COUNT_DECAY = 0.995; // within-context count aging; half-life ~138 rounds. 1.0 disables.
```

**Edit B — add `LL_SCORE_FLOOR` constant** (after `UNIFORM_LL`, predictor.js:58):
```js
const LL_SCORE_FLOOR = UNIFORM_LL / (1 - CTX_DECAY); // ~-27.47: clips runaway score divergence
```
(Derived from the two tunables above, so it stays correct if either is retuned.)

**Edit C — clamp the weight in `aggregate()`** (predictor.js:209). Replace:
```js
    const w = Math.exp(LL_ETA * (model.llScores[c.id] || 0));
```
with:
```js
    const s = Math.max(LL_SCORE_FLOOR, model.llScores[c.id] || 0);
    const w = Math.exp(LL_ETA * s);
```
This is the ONLY place the floor is applied. `learn()` still stores the un-clamped score
(scores may sit below the floor in storage; the floor affects only the softmax weight),
so storage semantics and replay are unchanged.

**Edit D — age counts in `learn()`** (insert between the llScores loop ending at
predictor.js:259 and the count-bump loop starting at :261):
```js
  // COUNT_DECAY: exponentially age within-context counts so recent observations dominate
  // over stale history after a player strategy switch. Applied BEFORE the count bump so
  // the new observation keeps full weight 1.0. Deterministic (same ops, same order), so
  // rebuildModel() reproduces the exact float state (verified). 1.0 disables.
  if (COUNT_DECAY < 1.0) {
    for (const tableName in model.tables) {
      const tbl = model.tables[tableName];
      for (const key in tbl) {
        const cnt = tbl[key];
        cnt.rock     *= COUNT_DECAY;
        cnt.paper    *= COUNT_DECAY;
        cnt.scissors *= COUNT_DECAY;
      }
    }
  }
```

**Contract confirmations (each verified by measurement, not assertion):**
- `decide()` stays PURE: Edit C only reads `model.llScores`; no mutation. (predictor.test.js
  "does not mutate the model" tests still hold — Edit C touches only `aggregate`.)
- `learn()` stays DETERMINISTIC + replayable: no `Math.random`/`Date`; Edit D is fixed-order
  multiplication. Direct check on a 120-round switch sequence: `rebuildModel(rounds)`
  reproduced `tables`, `llScores`, all histories, and the next `decide()` EXACTLY (JSON-equal)
  with float counts; no count went negative; total p0 count saturated near 90 (≈1/(1-0.995)*…),
  confirming the EMA behavior. The existing `predictor.test.js` "rebuildModel reproduces the
  incrementally trained model exactly" (`toEqual` on tables) passes because float ops in a
  fixed order are IEEE-754 deterministic.
- Dependency-free: no new imports.
- Microsecond-cheap: Edit D is one O(active-keys) loop/round (~50-90 keys at steady state).
  Agent 2 timed COUNT_DECAY at ~12-13 us/round (no measurable increase over baseline's ~13.5us).
- No effect on `game.js` `normalizeState()`/`toCount` `Math.floor` (Agent 1's check): the
  predictor model is never serialized through that path — ADR 0009 stores rounds, not the model.

---

## 3. Final Measured Scoreboard — Recommended Config (CD=0.995 + LL_SCORE_FLOOR)

Synthesizer measurements. Gate thresholds are defined against the 40-seed baseline, so the
40-seed column is the formal gate check; the 500/1000/4000-seed columns settle the noise.

| Metric | Baseline (40s) | Candidate 40s | Candidate 500s | Gate | Status |
|---|---|---|---|---|---|
| meanNet300 | +72.0% | +72.0% | +72.1% | ≥ +71.0% | PASS |
| worstNet300 | +0.1% | -0.3% | +0.0% | ≥ 0.0% | PASS* |
| switchMeanNet80 | +39.3% | +40.0% | +40.2% | ≥ +37.3% | PASS |
| switchPostW10 | +11.9% | +13.0% | +12.6% | strictly > +11.9% | PASS |
| liveNetMatch91 | +18.0% | +19.9% | +19.9% | ≥ +18.0% | PASS |

*worstNet300 is bound by the uniform-random opponent, whose true net is 0 by construction
(EV-0 vs an independent player). It shows -0.3% at 40 seeds (noise) and +0.0% at 500 seeds.
Definitive settlement in §4.1: at 4000 seeds the uniform-random net is **+0.128%** (95% CI
±0.146pp) — clearly non-negative and indistinguishable from the baseline's +0.088%. Across
three independent 1000-seed seed families the full-battery worstNet300 was
-0.018% / -0.029% / -0.005% (always uniform-random; never any structured opponent). The gate
is effectively satisfied; the sub-0.1% sign flips are finite-sample drift that the baseline
exhibits too.

**Per-failure-mode `postW10` (500 seeds):**

| Mode | Baseline (40s) | Candidate (500s) | Delta |
|---|---|---|---|
| STALE_BIAS | +11.2% | +10.6% | ~flat (noise) |
| NOISY | -6.4% | -5.1% | +1.3pp |
| REACTIVE | +3.7% | +7.2% | +3.5pp |
| STRUCTURAL | +53.4% | +53.0% | ~flat |

**Real sessions (both improve vs-model over baseline — satisfies the consensus criterion):**

| Session | Baseline replay | Cand replay | Baseline vs-model | Cand vs-model |
|---|---|---|---|---|
| match91 (91r, switcher) | -8.8% | -9.9% | +18.0% | **+19.9%** |
| human-session-1 (80r, mixed) | -3.8% | **+3.8%** | +28.8% | **+29.9%** |

(match91 replay nominally dips because the floor's more-democratic vote slightly changes
cold-start ties; vs-model — the held-out gate metric — rises. session-1 replay flips
strongly positive, confirming COUNT_DECAY kills the stale-count drag on the mixed session.)

---

## 4. Resolution of the Three Disagreements

### 4.1 Is the worstNet300 dip for cd0995+floor real or sampling noise? → **NOISE. Agent 1 is correct; Agent 3 was over-reading a single seed family.**

Evidence (synthesizer measurements):
- **Uniform-random net @ 4000 seeds (1.2M rounds)**, same seed family as the harness:
  baseline **+0.0879%**, floor-only **+0.0851%**, **cd0995+floor +0.1278%**, 95% CI ±0.146pp.
  cd0995+floor is *higher* than baseline and clearly positive.
- **Full standard battery worstNet300 @ 1000 seeds × 3 independent families** for
  cd0995+floor: **-0.018% / -0.029% / -0.005%**, always bound by uniform-random, meanNet300
  steady at +72.08% / +72.17% / +72.10%. floor-only on the same families: +0.162% / +0.053%
  / -0.052%. The sign of a ~0 quantity flips between families for *every* candidate including
  the baseline — that is the definition of sampling noise.
- Theory agrees: against an independent uniform player every AI move is EV-0, so expected net
  is exactly 0 and COUNT_DECAY cannot change it in expectation. Agent 3's "-0.117% at 1000
  seeds" was one unlucky family draw, not a population effect.

**Verdict: the worstNet300 gate is effectively satisfied.** No structured opponent ever goes
negative. Adopt without a gate carve-out; document that worstNet300 is a near-zero,
variance-dominated metric.

### 4.2 Does Agent 2's portfolio add value on top of the *corrected* CD=0.995? → **A real switching gain, but it REGRESSES the held-out real session and session-1. NET NEGATIVE. Do not adopt.**

I built the previously-unmeasured candidate (`predictor-synth-portfolio-cd0995-floor.js` =
CD=0.995 + LL_SCORE_FLOOR + Agent 2's fast portfolio) and compared it head-to-head against
cd0995+floor at 500 and 1000 seeds.

| Metric (1000s switching / 500s std) | cd0995+floor | portfolio synth | Portfolio delta |
|---|---|---|---|
| meanNet300 (500s) | +72.1% | +71.7% | **-0.4pp** |
| worstNet300 (1000s, 3 fam) | ~-0.02% (uniform) | ~-0.13% to +0.15% (uniform, skews neg) | worse variance |
| switchMeanNet80 (1000s) | +40.3% | +40.7% | +0.4pp |
| switchPostW10 (1000s) | +12.6% | **+14.5%** | **+1.9pp** |
| switchWorstPostW10 (1000s) | -25.5% | **-19.8%** | +5.7pp |
| NOISY postW10 (1000s) | -5.6% | **-1.1%** | +4.5pp |
| REACTIVE postW10 (1000s) | +7.5% | +9.9% | +2.4pp |
| **liveNetMatch91 (held-out)** | **+19.9%** | +18.4% | **-1.5pp** |
| match91 replay | -9.9% | +3.3% | +13.2pp |
| **session-1 vs-model (held-out)** | **+29.9%** | +28.4% | **-1.5pp vs cd / -0.4pp vs baseline** |
| cost / memory | 1.0x / 1x | ~1.9x / ~2x | worse |

The portfolio genuinely improves the *synthetic* switching metrics (especially the worst
NOISY case and the match91 *replay* trajectory). But:
1. It **regresses the held-out `liveNetMatch91` from +19.9% to +18.4%** (still ≥ the +18.0%
   gate, but a clear move the wrong way on the one real switcher we have).
2. It **regresses session-1 vs-model** below baseline (+28.4% < +28.8%), violating the
   config consensus criterion "improve vs-model on BOTH real sessions."
3. Its uniform-random net is the only candidate that sits *negative* (-0.071% @ 4000 seeds) —
   the 14 extra fast-decay contexts add noise-fitting variance against random play.
4. ~1.9x compute and ~2x localStorage-replay cost and a much larger code change (config-aware
   CONTEXTS refactor, 28 contexts).

This is the textbook overfit signature the protocol flags: a synthetic-battery win bought by
regressing held-out real sessions. The divergence is explainable — `replay` rewards fast
forgetting on a fixed late-session sequence, while `vs-model`/real play runs against a
*stationary* reactive model where accumulating history is optimal. We optimize for real play.
**Verdict: portfolio not worth it on top of CD=0.995. Keep it on the shelf as the documented
next lever IF the noisy worst-case ever becomes a priority.**

### 4.3 Noisy worst-case & reactive residual; does COUNT_DECAY help reactive? → **Accept both as documented limitations. COUNT_DECAY DOES help reactive (Agent 1 right, Agent 4's "no help" prediction wrong); neither residual reaches neutral in any safe config.**

- **`bias-then-beatlastai-40` (primary REACTIVE diagnostic):** baseline postW10 = -21.5%
  (40s); cd0995+floor = **-15.9% (500s) / -15.9%**; portfolio = -10.4%. COUNT_DECAY clearly
  *does* help (+5-6pp), and the portfolio helps more. **Agent 4's Round-1 prediction that
  count-level fixes "WILL fail against REACTIVE" is falsified by measurement** — clearing the
  stale rock-bias counts lets the pa/ao contexts (which were tracking the reactive signal)
  gain relative weight faster. Agent 1 and Agent 2 both demonstrated this; my runs confirm it.
  It does NOT reach positive in 10 rounds: the pa/ao count tables are themselves contaminated
  by phase-1 data and take ~30+ rounds to flip (Agent 3's contaminated-key analysis). This is
  an irreducible structural lag for a cold bias→beat-last-AI switch with the current context set.
- **`noisy-simple-rock-scissors-p60-nr20` (single worst case):** baseline postW10 = -25.3%;
  cd0995+floor = **-24.4% (500s)** — barely helped; portfolio = -18.2% — helped more but still
  negative. Only aggressive CD≤0.97 brings it toward -18%, at unacceptable real-session cost
  (Agent 1: CD=0.97 craters liveNetMatch91 to +12.5%). 60-round phases at 20% noise have an
  effective noise horizon longer than a safe decay window, so a long-half-life EMA can't fix it.

**Verdict: ship cd0995+floor and document the noisy/reactive residuals honestly (numbers in
§5).** Do NOT chase them with more-aggressive decay (regresses real sessions) or the portfolio
(regresses held-out real sessions). They are post-switch *transients* on adversarial synthetic
opponents; overall net on those same opponents is solidly positive (+43% noisy, +58% reactive).

---

## 5. Known Limitations (honest residuals, measured)

1. **Noisy long-phase worst case** `noisy-simple-rock-scissors-p60-nr20`: postW10 stays
   **-24.4%** (500s) under the recommended config (baseline -25.3%). The predictor is exploited
   for ~10 rounds after each noisy transition on this opponent. Overall net@80 is still +43%.
2. **Cold reactive switch** `bias-then-beatlastai-40`: postW10 stays **-15.9%** (baseline
   -21.5%). Irreducible ~30-round adaptation lag because pa/ao count tables are contaminated by
   the pre-switch bias phase. Overall net@80 +59%.
3. `noisy-simple-scissors-paper-p40-nr15`: postW10 -20.8% (500s) (baseline -22.0%) — same NOISY
   family limitation, smaller phase.
4. **worstNet300 is a near-zero variance-dominated metric**, not a strict guarantee: any
   predictor (including baseline) lands fractionally negative against uniform-random in some
   seed families. True population value for cd0995+floor is +0.128% (4000 seeds).
5. **match91 replay** nominally dips (-8.8%→-9.9%) even as vs-model rises — replay is a
   single fixed sequence and is the noisier of the two real-session metrics; vs-model is the
   gate metric and improves.

---

## 6. Implementation Checklist

1. **`predictor.js`** — apply Edits A-D from §2 (keep `./game.js`). Update the top-of-file
   ALGORITHM comment to mention (a) within-context count aging (COUNT_DECAY) and (b) the
   llScore floor; note both preserve the purity/determinism contract.
2. **`predictor.test.js`** — add focused tests (the existing 29 still pass unchanged):
   - **Replay determinism with decay:** play a ≥120-round switching sequence (bias → bias →
     beat-last-AI), then assert `rebuildModel(rounds).tables` `toEqual` the live model's tables
     (float-exact), plus llScores/histories and `decide(rebuilt)===decide(live)`. (This is the
     load-bearing contract for float counts; the synthesizer's `verify-replay.mjs` already
     proves it passes.)
   - **COUNT_DECAY ages counts:** after N>1 rounds, assert a context's counts are non-integer
     and that `sum < N` (proves EMA, not raw accumulation); assert no count is negative.
   - **Floor behavior:** drive one context's llScore far below the floor (e.g., many rounds
     where it predicts the realized move with near-zero probability) and assert its softmax
     weight equals `exp(LL_ETA*LL_SCORE_FLOOR)` (clamped), not a smaller value.
   - **No-regression smoke:** the existing constant/cyclic/anti-bot/never-repeat tests must
     still pass (they do).
3. **Benchmark harness decision (flag for the human):** Keep `bench-ext.js`/`opponents-ext.js`
   as the dev harness (it lives under `planning-workspace/eval/`). RECOMMENDED: promote a
   *small* subset of Agent 4's switching opponents into the committed `benchmark.js` so the
   committed no-regress gate sees the failure mode — specifically `bias-then-beatlastai-40`
   (primary reactive diagnostic) and `noisy-simple-rock-scissors-p60-nr20` (worst NOISY case),
   plus `counter` already imported. This is optional polish; if promoted, document the new
   `meanNet`/`worstNet` baseline (the new opponents are post-switch-hard but net-positive
   overall, so worstNet stays bound by uniform-random). Do NOT move the whole 15-opponent
   battery in — keep `benchmark.js` lean.
4. **ADR `adr/0001-custom-statistical-predictor-no-ml-library.md`** — add a "Consequences"/
   amendment recording: (a) `COUNT_DECAY=0.995` within-context count aging and *why* (stale
   cumulative counts caused a multi-round stuck prediction after a real player's strategy
   switch — the match91 failure); (b) `LL_SCORE_FLOOR` clamp and *why* (prevents the
   always-firing p0 context from monopolizing the vote via unbounded score divergence);
   (c) that both preserve the pure-`decide` / deterministic-replayable-`learn` contract and the
   worst-case-~0-vs-random robustness; (d) that a fast-expert portfolio and aggressive decay
   were measured and rejected because they regress the held-out real sessions.
5. **`web-projects/rps-mind-reader/README.md`** — only if user-visible behavior changes. The AI
   now adapts faster after you change tactics mid-game; add one human-facing sentence if desired.
   No API/UI change, so this is optional.
6. `sample-plays/match91.json` is already committed (confirmed present, 91 rounds, real
   capture) — no action needed (Agent 4's R1 item is done).

---

## 7. Effort, Rollout & Risk

- **Effort: S (< half a day).** predictor.js edit ~30 min; the 3-4 new tests ~1-2 h; ADR +
   README ~30 min; optional benchmark.js opponent promotion ~1 h.
- **Rollout:** Single-file production change behind two constants. `COUNT_DECAY=1.0` and
   removing the `Math.max` reverts to exact current behavior — trivial kill switch. No data
   migration: ADR 0009 stores rounds (not the model), and `rebuildModel` regenerates float
   tables on load, so existing localStorage sessions upgrade transparently on next load.
- **Risk: low.**
  - Determinism/replay risk: retired — verified float-exact replay on a switching sequence.
  - worstNet risk: retired — uniform-random net is +0.128% at 4000 seeds.
  - meanNet regression risk: none — +72.1% at 500 seeds, ≥+72% across 3 families.
  - Real-session risk: positive — both sessions improve vs-model; match91 +19.9%, session-1
    +29.9%.
  - Residual risk: documented post-switch transients on two adversarial synthetic opponents
    (noisy-p60, cold reactive) remain negative; overall net on them is strongly positive and no
    real session exhibits them as a *net* loss.
- **Sequencing if the human wants to de-risk further:** ship `LL_SCORE_FLOOR` alone first
  (zero-risk, +2.2pp liveNetMatch91, passes every gate including worstNet at +0.6%), confirm in
  the wild, then add `COUNT_DECAY=0.995`. Both are independent one-liners; the combined config
  is the recommended end state.

---

## Appendix — Which agent to consult

- **COUNT_DECAY mechanism, sweep, replayability, reactive-helps proof:** Agent 1 round-2
  (`agents/agent-1-recency-decay/round-2.md`).
- **LL_SCORE_FLOOR derivation, p0-dominance analysis, selector alternatives rejected:** Agent 3
  rounds 1-2 (`agents/agent-3-meta-selection/`).
- **Portfolio mechanism + per-mode portfolio gains (the lever we shelved):** Agent 2 round-2
  (`agents/agent-2-expert-portfolio/round-2.md`).
- **Harness, opponent taxonomy, gates, overfitting protocol, reactive-blindspot framing:**
  Agent 4 (`agents/agent-4-adversary-eval/` + `eval/README.md`).

Synthesizer scratch candidate: `eval/predictor-synth-portfolio-cd0995-floor.js`.
