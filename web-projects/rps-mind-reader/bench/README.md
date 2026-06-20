# bench/ — predictor R&D suite

Deep evaluation for `predictor.js`: adaptation speed + post-switch recovery + real-session
fidelity — the things the lean `benchmark.js` gate doesn't measure. Built during the 2026-06
switching bake-off (archived in `history/`); kept as the standing tool for iterating on
prediction strategies. Methodology rationale: ADR 0012.

## Files

| File | What |
|---|---|
| `suite.js` | the runner — parameterized (`--predictor`); prints the 5-metric scoreboard, per-mode breakdown, and real sessions |
| `opponents.js` | the challenge battery — 15 deterministic switching/noisy/reactive/structural opponents |
| `gen-switcher.js` | regenerates the synthetic switcher fixture deterministically |
| `fixtures/` | generated synthetic sessions (exploration targets, **not** held-out) |
| `history/` | the bake-off that established the current config (4 agents × 2 rounds + synthesis) |

## Run it

```bash
# from web-projects/rps-mind-reader/
bun bench/suite.js                                   # current production predictor.js
bun bench/suite.js --predictor bench/candidate.js    # a candidate
bun bench/suite.js --predictor bench/candidate.js --seeds 80   # tighter CI — use for decisions
bun bench/suite.js --mode switching-only --seeds 40  # fast iteration loop
```

## Iterate on a strategy

1. `cp predictor.js bench/candidate.js` and edit the **copy** (never tune production in place).
2. Run the suite at `--seeds 80`.
3. Clear **all** acceptance gates (below) **and** beat current production on the metric you targeted.
4. Tune on the **synthetic** battery; check the `sample-plays/` real sessions **once** at the end (overfitting guard).
5. Win → apply to `predictor.js`, extend `predictor.test.js`, update ADR 0010 history, delete the candidate.

For a larger exploration, run `/research-agents` (it scaffolds a fresh `planning-workspace/`);
archive the result into `history/` when done.

## 5-metric scoreboard + acceptance gates

| Metric | What | Gate |
|---|---|---|
| `meanNet300` | mean net, standard 300-round battery | ≥ ~+71% (no >1pp regression) |
| `worstNet300` | worst opponent (≈ uniform-random, a ~0 metric) | ≥ ~0 — variance-dominated; confirm across seed families, don't over-read one |
| `switchMeanNet80` | mean net over the switching battery | no >2pp drop vs production |
| `switchPostW10` | net in the 10 rounds after each switch | **strictly improves** — the headline switching signal |
| `liveNetMatch91` | vs-model net on the real switcher | ≥ +18% (don't regress the real session) |

Current production reference (~80 seeds): `meanNet300` ~+72%, `switchPostW10` ~+13%,
`liveNetMatch91` +19.9%, `human-session-1` vs-model +29.9%.

**Overfit flag:** a change that lifts the synthetic battery but drops a held-out real session is
overfit — reject it (this is exactly how the fast-expert portfolio was rejected; see `history/`).

## Opponent taxonomy (`opponents.js`)

| Mode | What it isolates |
|---|---|
| `STALE_BIAS` | bias→bias shift; stale counts keep predicting the old bias |
| `NOISY` | blurry transitions (noisy long phases) — the current worst case |
| `REACTIVE` | switch into beat-last-AI; `p0–p5` are blind, only `pa/ao` contexts help — structural blind spot |
| `STRUCTURAL` | whole strategy-type change (markov → anti-repeat) |

**Add a challenger:** push an object onto `switchingOpponents` in `opponents.js`:

```js
{
  name: "my-switcher",
  failureMode: "STALE_BIAS",            // one of the four modes
  make: () => (history, rng) => "rock", // returns the player's move; history = past rounds only
  switchPositions: (rounds) => [40],    // 0-indexed rounds where a new phase begins
}
```

Keep it **deterministic** — use the passed `rng` (mulberry32), never `Math.random`.

## Reproducibility

All opponents seed mulberry32 from the match seed, so the same `--seeds` value always yields the
same numbers. The runner imports `predictor.js`/`benchmark.js`/`game.js` from one level up
(`../`) and is read-only — it never mutates a predictor.
