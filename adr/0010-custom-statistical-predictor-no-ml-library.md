# ADR 0010: Custom Statistical Predictor Instead of an ML Library (RPS Mind Reader)

## Context

`rps-mind-reader` needs an opponent that **learns a human's rock-paper-scissors
habits and beats them**, getting harder the more you play. The headline framing is
"a machine-learning bot," which invites reaching for a neural-network library
(TensorFlow.js, brain.js, etc.). We had to decide what actually powers the
prediction.

Constraints and considerations specific to this problem:

- **The domain is tiny and adversarial.** Three possible moves, and the signal is short-range temporal pattern in a *non-stationary* opponent (a human who changes tactics, and who may actively try to out-think the bot).
- **No build system / no bundler** (ADR 0002), and CDN deps are governed by ADR 0005. A heavy ML library would add bundle weight, a network dependency, and (for some) Node/bundler assumptions.
- **It must train instantly and run fully offline**, updating every single round on a phone.
- **It must be reconstructable from stored history** to satisfy `localStorage` persistence (ADR 0009).

Options considered:

1. **Neural network via a library (brain.js / TensorFlow.js).** "Real ML" branding, but heavy for the page, slow to train online, a CDN dependency, and — crucially — *empirically weaker at RPS* than classical methods. Continuous-weight gradient learners adapt slowly to a non-stationary three-symbol stream.
2. **A single Markov model.** Simple and decent, but a lone fixed-order model is easily exploited and brittle when the player switches strategies.
3. **A custom statistical predictor — a mixture/ensemble of cheap context models.** The proven design family for strong RPS bots (cf. the RoShamBo programming competitions / "Iocaine Powder"). Tiny, instant, dependency-free.

## Decision

The opponent is a **custom statistical predictor written from scratch** in
`predictor.js` — no ML library, no dependencies. The specific algorithm was chosen
**by an objective benchmark** (`benchmark.js` — a battery of opponent strategies
scored by net win rate) after a from-scratch exploration of several algorithm
families; the selected design beat the alternatives on both the benchmark and a
held-out set of unseen opponents. Its structure:

- **Variable-order context models.** A family of cheap models each predict the
  player's next-move *distribution* from a different slice of recent history: the
  player's own last 0–5 moves (a variable-order Markov / PPM family), the last
  one–two `(player, AI)` interaction pairs, the last one–two outcomes, the
  `(last move, last outcome)` win-stay/lose-shift signature, and the AI's last move
  (for players who chase or counter the bot), plus joint situational contexts —
  `(AI move, outcome)` and `(player move, AI move, outcome)` — that capture how a
  reacting human conditions on the whole situation. Counts use Krichevsky–Trofimov
  add-K smoothing.
- **Bayesian weighting by predictive log-likelihood.** Each model carries a
  recency-decayed sum of the log-likelihood it assigned to the moves that actually
  occurred; its weight is a softmax over that score. Log-likelihood is a denser,
  less noisy selection signal than realized game value, and it automatically
  down-weights high-order models that overfit when the true pattern is low-order.
  The exponential forgetting tracks a player who changes tactics.
- **Expected-value voting.** Each model votes (with its weight) for the AI move that
  maximizes expected game value against *its own* predicted distribution; the AI
  plays the top-voted move. Reasoning over the full distribution — not just the
  single most likely move — is what exploits 50/50 opponents (e.g. "never repeat"),
  where one reply is uniquely EV-optimal even though no move is "most likely".
- **Robustness.** Against a uniform-random player there is no signal, weights stay
  ~uniform, and since the opponent is independent of our move every play is
  expected-value 0 — so the worst case is the unavoidable noise floor (~0) and the
  bot cannot be exploited. The only randomness is the cold-start fallback before any
  context has data.
- **Fairness.** `decide()` is pure and reads only past rounds — it never sees the
  current move — so the AI predicts rather than peeks. For the UI it reports the move
  it is countering, so "I predicted X" always matches the move played.
- **Determinism for persistence.** Count/score updates are deterministic (ties
  broken by a fixed move order), so the entire model is rebuilt by *replaying* the
  stored round history (`rebuildModel`) instead of serializing model internals. This
  is what makes ADR 0009's "store rounds, not the model" approach work, verified by a
  test asserting the replayed model equals the live one.

All of this logic is pure and **TDD-covered** (`predictor.test.js`, `game.test.js`),
including tests that the bot converges on and beats constant, cyclic and
short-pattern players, exploits a 50/50 "never repeat" player, and is not exploited
by a player countering its last move. `benchmark.js` lets future changes be measured
the same way.

### History

The first implementation was a different custom design — an ensemble of
frequency/Markov/reactive base predictors with three "counter-rotation" experts
each, fused by a recency-weighted meta-selector that hard-picked the single best
expert (mean net **+64%** on the benchmark). It was replaced by the current Bayesian
mixture + expected-value-voting design, which scored mean net **+72%** and was more
robust on held-out opponents. The selection was driven by `benchmark.js` plus a
parallel, from-scratch exploration of multiple algorithm families. The high-level
decision (custom statistical predictor, no ML library) is unchanged.

A later refinement, driven by **real exported human play** (`realplay-bench.js`
replays an exported session and also pits the predictor against a reactive model
built from it, alongside an oracle ceiling), added the two joint situational
contexts above. The analysis found the bot already captures most of the available
edge against a faithful model of a real player (e.g. ~+29% net of a ~+41% oracle
ceiling), so the joint contexts are a small, safe addition (no change to the
general benchmark) rather than a dramatic gain — a well-mixed human inherently caps
the achievable edge, and the bigger lever is more play data, not more model
complexity.

A later refinement targeted **strategy-switching players** specifically. A real
exported session from a player who changed tactics mid-game exposed a failure: the
within-context counts accumulate over the whole session, so after a switch the bot kept
voting from stale all-time frequencies for many rounds (a multi-round "stuck
prediction"). A four-track benchmark bake-off — recency-decay, an expert portfolio,
meta-selection, and an adversary/evaluation track, cross-pollinated then synthesized
(see `web-projects/rps-mind-reader/planning-workspace/`) — converged on two small,
composable changes:

- **`COUNT_DECAY = 0.995`** — within-context counts are exponentially aged each round
  (half-life ~138 rounds) *before* the new move is bumped, so recent evidence dominates
  after a switch. Counts become floats; replay stays exact because the aging is a
  fixed-order multiply (the `rebuildModel` contract is verified by a switching-sequence
  test).
- **`LL_SCORE_FLOOR`** — when computing a context's softmax vote weight, its score is
  floored at the steady-state score of a permanently-abstaining context
  (`UNIFORM_LL / (1 - CTX_DECAY) ≈ -27.47`), so the always-firing low-order `p0` cannot
  monopolize the vote via unbounded accumulated divergence. The floor is applied only to
  the weight, never stored back into `llScores`.

Both lift net against a faithful model of *both* recorded real sessions (the switcher and a
well-mixed one) and the post-switch recovery window, with no loss on the general battery and
worst-case-vs-random still ~0 (variance-dominated near zero; verified +0.13% at 4000 seeds).
A fast-expert **portfolio** and **more aggressive decay** were measured and **rejected**:
they helped the synthetic switching battery but regressed the held-out real sessions — the
overfit pattern the protocol guards against. Two switching opponents from the bake-off
(`bias-then-beatlastai-40`, `noisy-rock-scissors-p60`) were promoted into `benchmark.js` so
the committed gate exercises the post-switch transient. Accepted residuals: that transient
stays briefly negative on a cold bias→beat-last-AI switch and on long noisy phases, though
both opponents are net-positive overall.

## Consequences

**Positive:**

- Zero runtime dependencies; aligns with ADR 0002 (no build) and ADR 0005 (no unnecessary CDN deps). Works fully offline.
- Trains in microseconds per round (decayed float count bumps + a decayed score update); trivial on mobile.
- Stronger at RPS than a neural net would be, and resistant to a player trying to game it; the design was chosen — and future changes can be guarded — by a reproducible benchmark (`benchmark.js`).
- Deterministic replay makes persistence simple and testable, and keeps the stored payload minimal.
- The behaviour is documented by tests, so future agents can change it safely.

**Negative:**

- It is a bespoke algorithm to understand and maintain rather than an off-the-shelf model — mitigated by tests, the benchmark, and this ADR.
- It is specialised to RPS-shaped problems (tiny discrete action space, short-range patterns); it is not a general-purpose learner.
- The "machine learning" label is informal — this is classical online statistical learning, not a neural network. That distinction is intentional and is the whole point of the decision.

## Scope

This decision is specific to `rps-mind-reader`. The reusable principle — **for a
tiny discrete adversarial game, prefer a custom mixture of cheap context models
(weighted by predictive accuracy, each playing the expected-value-optimal counter)
over a general ML library** — should guide similar future web-projects (simple game
AIs) before any heavy dependency is introduced. When tuning such an algorithm, build
a benchmark of opponent strategies first and measure against a held-out set.
