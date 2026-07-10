# rps-mind-reader/AGENTS.md

> **SCOPE:** rps-mind-reader. Read alongside `web-projects/AGENTS.md` (TDD rules) and the root `AGENTS.md`.

## What this is

Rock-paper-scissors vs an adaptive predictor. The interesting code is `predictor.js`; the rest is
a thin app (`app.js` / `game.js` / `storage.js`), a stats page (`stats.js` / `analytics.js`), and
two evaluation harnesses (`benchmark.js`, `bench/`).

## Architecture (`predictor.js`)

- A Bayesian-style mixture of variable-order **context models** (`p0–p5` player history,
  `pa1/pa2` player-AI pairs, `o1/o2` outcomes, `po1`, `ai1`, `ao1`, `pao1`). Each yields a
  KT-smoothed next-move distribution and votes (by its softmax weight) for the EV-optimal counter.
- **Two forgetting layers** so it tracks tactic switches: `CTX_DECAY` ages each model's predictive
  log-likelihood score (*which* model to trust); `COUNT_DECAY` ages the within-context counts (so
  distributions reflect recent play). `LL_SCORE_FLOOR` clamps a model's vote weight so the
  always-on `p0` can't monopolize.
- Why: ADR 0001 (algorithm + history). How we evaluate it: ADR 0002.

## Contracts — do NOT break (they are load-bearing)

- `decide(model, rng)` is **PURE** — reads the model, never mutates, never sees the live move.
- `learn(model, p, a)` is **DETERMINISTIC** (no `Math.random` / `Date`) so `rebuildModel(rounds)`
  reproduces the exact model. Persistence stores **rounds, not the model** (root ADR 0009); the float
  counts from `COUNT_DECAY` are rebuilt on load. Any new state in `learn()` must be replayable
  from history alone.
- Dependency-free, microsecond-cheap (runs per-round on a phone).
- Worst case vs a uniform-random player is **~0 net** (cannot be exploited). Preserve this.

## Two evaluation harnesses

| Tool | Use | Speed |
|---|---|---|
| `bun benchmark.js` | quick general gate — 14 opponents, mean/worst net @300 rounds | fast |
| `bun bench/suite.js` | deep eval — switching battery + post-switch recovery + real-session scoreboard | slower |

Reach for `bench/suite.js` whenever you touch predictor logic. Full workflow + acceptance gates:
`bench/README.md`.

## Iterating on a strategy

1. `cp predictor.js bench/candidate.js`; edit the **copy** only.
2. `bun bench/suite.js --predictor bench/candidate.js --seeds 80`.
3. Clear **all** acceptance gates (in `bench/README.md`) and beat production on your target metric.
4. Tune on the **synthetic** battery; look at the **real** sessions in `sample-plays/` only once
   per final candidate (overfitting guard).
5. Win → apply to `predictor.js`, extend `predictor.test.js` (esp. replay determinism), update
   ADR 0001 history, delete the candidate.
6. Big exploration → `/research-agents` (scaffolds a fresh `planning-workspace/`); archive into
   `bench/history/` when done.

## Strategies tried & rejected — don't re-tread (full data in `bench/history/`)

| Idea | Verdict | Why |
|---|---|---|
| `COUNT_DECAY=0.995` (count aging) | **ADOPTED** | fixes post-switch stuck-prediction; both real sessions improve |
| `LL_SCORE_FLOOR` clamp | **ADOPTED** | stops `p0` monopolizing the vote; +2pp real switcher, ~zero cost |
| Fast-expert **portfolio** (dual `CTX_DECAY`) | rejected | wins synthetic switching but **regresses held-out real sessions**; ~2× cost. Shelved next lever IF the noisy worst-case becomes a priority |
| Aggressive decay (`CD ≤ 0.98`) | rejected | craters real-session net (overfits abrupt synthetic switches) |
| Alt selectors (hard-argmax / Hedge / EXP3) | rejected | no gain over softmax-of-llScore |
| Per-context-order decay / reactive-context `CTX_DECAY` split | rejected | no material gain for the complexity |

## Known limitations (current predictor)

- A cold `bias → beat-last-AI` switch and long noisy phases stay briefly negative in the ~10
  rounds right after the switch (those opponents are net-positive overall). The reactive blind
  spot is structural: `pa/ao` contexts need a few rounds of post-switch data before they fire.
  Measured in `bench/history/synthesis.md` §5.

## Gotchas

- `bench/` files import `../game.js` etc. (one level up). The old bake-off scratch copies lived
  two levels deep (`../../`) — don't copy their import paths into `bench/`.
- `COUNT_DECAY` makes counts **floats**; the `predictor.test.js` replay-equality test still holds
  (fixed-order IEEE-754 is deterministic). If you add count-touching logic, keep the op order fixed.
- `sample-plays/match91.json` is the real switcher that motivated the current design — keep it; it
  anchors `liveNetMatch91`.
