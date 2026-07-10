# ADR 0002: Predictor Evaluation Methodology — Switching Battery + Held-Out Real Sessions

**Status:** Accepted (2026-06)

## Context

`benchmark.js` (ADR 0001) guards the predictor with an opponent battery scored by mean/worst
net over 300-round matches. That rewards *steady-state* accuracy but is blind to **adaptation
speed** — a player who plays one way, then switches tactics mid-game. A real switcher session
(`sample-plays/match91.json`) exposed a multi-round "stuck prediction" failure that
`benchmark.js` still scored as a comfortable win overall.

We needed to (a) measure post-switch recovery, and (b) iterate on fixes without overfitting to
a handful of synthetic opponents or to the single real switcher we had.

## Decision

Add a second-tier evaluation suite under `bench/`, kept separate from the lean `benchmark.js` gate:

- **Opponent taxonomy — 4 failure modes** (`bench/opponents.js`, 15 deterministic seedable
  opponents): `STALE_BIAS` (bias→bias shift), `NOISY` (blurry transitions), `REACTIVE`
  (switch into beat-last-AI — a structural blind spot for player-history contexts), `STRUCTURAL`
  (whole strategy-type change). Each opponent is labeled with the mode it isolates.
- **Post-switch window metrics:** beyond overall net, measure net over the `W` rounds right
  after each strategy switch (`switchPostW10`/`W15`). This is the adaptation-speed signal
  `benchmark.js` lacks.
- **A 5-metric scoreboard with acceptance gates:** `meanNet300`, `worstNet300`,
  `switchMeanNet80`, `switchPostW10`, `liveNetMatch91`. A change must clear all — no general
  regression, no real-session regression, a strict post-switch improvement.
- **Overfitting guard = held-out real sessions.** Real exported games in `sample-plays/` are
  validation only, looked at *once per final candidate*; tuning uses the synthetic battery. A
  near-zero metric (e.g. worst-vs-random) is judged across multiple seed families, not one.
- **Parameterizable runner** (`bun bench/suite.js --predictor <path>`) so any candidate is
  measured identically and reproducibly (deterministic mulberry32 seeds).
- **Two tiers stay separate:** `benchmark.js` = fast sanity gate everyone runs; `bench/suite.js`
  = deep eval for predictor R&D. A small subset of the hardest switching opponents
  (`bias-then-beatlastai-40`, `noisy-rock-scissors-p60`) was promoted into `benchmark.js` so the
  committed gate at least *sees* the failure mode.

## Consequences

- Predictor changes are judged on adaptation speed + robustness + real-session fidelity, not
  just steady-state net. The `COUNT_DECAY` + `LL_SCORE_FLOOR` change (ADR 0001 history) was
  selected on this scoreboard, and a fast-expert portfolio / aggressive decay were **rejected**
  on it — they won synthetic metrics but regressed held-out real sessions.
- The real-games corpus (`sample-plays/`) is meant to **grow**; each added session strengthens
  the overfitting guard. See `sample-plays/README.md`.
- Iterating on a new strategy follows a fixed workflow (copy predictor → edit → run suite →
  clear gates → apply + tests). See `bench/README.md` and `web-projects/rps-mind-reader/AGENTS.md`.
- The 2026-06 bake-off that established this methodology and the current tuning is archived in
  `bench/history/` (4 research agents × 2 rounds + synthesis).
- Cost: a second harness to maintain. Mitigated by keeping it dependency-free, deterministic,
  and runnable with one `bun` command — the same constraints as `benchmark.js`.

Complements ADR 0001 (the algorithm) and root ADR 0009 (rounds-not-model persistence, which lets the
suite replay any session deterministically).
