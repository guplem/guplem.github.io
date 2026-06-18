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
3. **A custom ensemble of statistical predictors with a meta-selector.** The proven design for strong RPS bots (cf. the RoShamBo programming competitions / "Iocaine Powder"). Tiny, instant, dependency-free.

## Decision

The opponent is a **custom statistical predictor written from scratch** in
`predictor.js` — no ML library, no dependencies. Its structure:

- **Base predictors**, each guessing the player's *next* move from history:
  overall move frequency; variable-order **Markov chains** (orders 1–3) over the
  player's recent moves; and **reactive** models keyed on the AI's last move and on
  the last round's outcome (capturing "win-stay/lose-shift" and players who try to
  counter the bot).
- **Rotation experts.** Each base prediction `p` spawns three experts recommending
  `shift(p, 1|2|3)` as the AI move. Rotation 1 beats the predicted move; rotations
  2–3 cover players who are second-guessing the bot. This lets the meta-layer learn
  the correct counter-offset rather than assuming the player is naive.
- **Recency-weighted meta-selection.** Every expert carries an exponentially
  decayed score (`DECAY = 0.9`) of how it *would* have done lately. Each turn the AI
  follows the highest-scoring expert; if none has a positive track record it plays
  **uniformly at random** — an unexploitable baseline. This makes the bot start
  near chance and sharpen as it gathers evidence (the "harder the more you play"
  feel), and the random floor prevents a clever player from trapping it.
- **Fairness.** `decide()` is pure and reads only past rounds — it never sees the
  current move — so the AI predicts rather than peeks.
- **Determinism for persistence.** Table/score updates are deterministic (ties
  broken by a fixed move order), so the entire model is rebuilt by *replaying* the
  stored round history (`rebuildModel`) instead of serializing model internals.
  This is what makes ADR 0009's "store rounds, not the model" approach work, and it
  is verified by a test asserting the replayed model equals the live one.

All of this logic is pure and **TDD-covered** (`predictor.test.js`,
`game.test.js`), including tests that the bot converges on and beats constant,
cyclic, and anti-bot players, and that it is not exploited by a player countering
its last move.

## Consequences

**Positive:**

- Zero runtime dependencies; aligns with ADR 0002 (no build) and ADR 0005 (no unnecessary CDN deps). Works fully offline.
- Trains in microseconds per round (integer counter bumps + a decayed score update); trivial on mobile.
- Stronger at RPS than a neural net would be, and resistant to a player trying to game it, thanks to the rotation experts + random floor.
- Deterministic replay makes persistence simple and testable, and keeps the stored payload minimal.
- The behaviour is documented by tests, so future agents can change it safely.

**Negative:**

- It is a bespoke algorithm to understand and maintain rather than an off-the-shelf model — mitigated by tests and this ADR.
- It is specialised to RPS-shaped problems (tiny discrete action space, short-range patterns); it is not a general-purpose learner.
- The "machine learning" label is informal — this is classical online statistical learning, not a neural network. That distinction is intentional and is the whole point of the decision.

## Scope

This decision is specific to `rps-mind-reader`. The reusable principle — **for a
tiny discrete adversarial game, prefer a custom ensemble-of-predictors with a
recency-weighted meta-selector over a general ML library** — should guide similar
future web-projects (simple game AIs) before any heavy dependency is introduced.
