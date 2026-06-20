# sample-plays/ — real game corpus

Real exported RPS sessions, used as **held-out validation** for predictor changes
(the overfitting guard). Unlike the synthetic opponents in `../bench/`, these are
actual human games — the ground truth a predictor change must not regress.

## How to add a game

1. Play a session in the rps-mind-reader app.
2. Click **Export** — it downloads `rps-mind-reader-<N>rounds.json` (the full state:
   totals + every round).
3. Drop that file here, renamed descriptively (e.g. `switcher-aggressive-2026-06.json`).

`realplay-bench.js` auto-discovers every `*.json` in this folder:

```bash
# from web-projects/rps-mind-reader/
bun realplay-bench.js              # replay all sessions here vs the predictor
bun realplay-bench.js path.json    # or one specific export
```

The deeper `bench/suite.js` scoreboard spotlights two anchor sessions **by name**
(`match91.json`, `human-session-1.json`). To put a new session in that scoreboard too,
add its filename there; otherwise use `realplay-bench.js`, which scales to the whole corpus.

## Record format

Each file is the app's exported state:

```jsonc
{
  "version": 1,
  "totals": { "win": 38, "loss": 27, "tie": 26 },
  "bestStreak": 5,
  "rounds": [
    { "p": "rock", "a": "rock", "o": "tie", "g": "paper", "c": 0.51 }
    // p = player move,  a = AI move,  o = outcome (player view: win|loss|tie)
    // g = AI's predicted player move,  c = AI confidence (null in older exports)
  ]
}
```

## Two metrics per session

Reported by `realplay-bench.js` and `bench/suite.js`:

- **replay** — net if the AI re-faced this exact move sequence (fixed-sequence sanity check; noisier).
- **vs-model** — net vs a reactive model fit to the session (the primary held-out signal).

## Current corpus

| File | Rounds | Type | Notes |
|---|---|---|---|
| `human-session-1.json` | 80 | real, well-mixed | no per-round confidence (older export); the "don't regress steady play" anchor |
| `match91.json` | 91 | real, **switcher** | has confidence; the motivating failure case (mid-game tactic switch) that drove the COUNT_DECAY change |

**Rule:** look at these *once per final candidate*. Tune against the synthetic battery in
`../bench/`, then validate here. A change that improves the synthetic battery but regresses
these is overfit (see ADR 0002).
