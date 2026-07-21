# Target Summary — rps-mind-reader predictor

Shared context for all research agents. **Read this fully, then deep-dive the real files.** All paths below are under `/home/user/guplem.github.io/web-projects/rps-mind-reader/` unless absolute.

## The system

Vanilla JS ES-module web-project, **no dependencies, no build step**. Pure logic is **TDD'd with `bun test`**. The opponent AI lives in `predictor.js` and is a **Bayesian mixture of variable-order context models**: several cheap models each predict the player's next-move *distribution* from a different slice of history; each is weighted by how well it has predicted lately; each votes (with its weight) for the expected-value-best counter; the AI plays the top-voted move.

### `predictor.js` — the algorithm (the thing we're improving)

Exports: `createModel()`, `decide(model, rng)`, `learn(model, p, a)`, `rebuildModel(rounds)`, `randomMove(rng)`, `aggregate(model)`.

Tunables (chosen via benchmark): `CTX_DECAY=0.96` (forgetting on the **selection** scores), `LL_ETA=1.1` (softmax sharpness), `MAX_ORDER=5` (deepest player-move context), `KT=0.15` (Krichevsky–Trofimov add-K smoothing), `UNIFORM_LL=log(1/3)`.

Model state: `{ n, llScores:{ctxId->decayed log-lik}, tables:{tableName->{ctxKey->{rock,paper,scissors counts}}}, pHist, aHist, oHist (capped at MAX_ORDER+1), lastAI, lastOutcome }`.

`CONTEXTS` (each: id, tableName, key(model)->lookupKey|null):
- `p0..p5` — player's own last 0..5 moves (variable-order Markov / PPM; p0 = unconditional freq).
- `pa1,pa2` — last 1–2 `(player,AI)` pairs.
- `o1,o2` — last 1–2 outcomes (win-stay/lose-shift).
- `po1` — `(last player move, last outcome)`.
- `ai1` — AI's last move.
- `ao1` — `(AI last move, last outcome)`.
- `pao1` — `(last player move, AI last move, last outcome)`.

`decide()`: calls `aggregate()`; if no context has data → cold-start random `{aiMove, predictedPlayerMove:null, confident:false, confidence:null}`. Else picks the move with the most weighted votes; reports `predictedPlayerMove = shift(best,2)` (the move the AI counters, so "I predicted X" always matches) and `confidence = mix[predictedPlayerMove]`. **PURE — never sees the live move.**

`learn(model,p,a)`: (1) for every context, add `CTX_DECAY*prev + log(dist[p])` to its `llScore` using the distribution **as it stood before this round** (abstaining contexts get `UNIFORM_LL`); (2) bump that context's counts `tbl[key][p] += 1`; (3) push to pHist/aHist/oHist, update lastAI/lastOutcome, n++. **DETERMINISTIC** (no Math.random/Date).

`aggregate(model)`: for each context with data, `w = exp(LL_ETA * llScore)`, vote `bestResponse(dist)` += w, accumulate `mix += w*dist`. Returns `{votes, mix}` or null.

### ⭐ THE DIAGNOSED GAP (do not re-derive — build on it)

`tbl[key][move] += 1` — **counts inside each context never age.** `CTX_DECAY` decays only *which model to trust* (llScores), NOT the *distributions* themselves. So after a player switches tactics, stale accumulated counts dominate the within-context distribution and the bot keeps predicting the **old** habit. On a real 91-round strategy-switching session this produced stuck runs (predicted Paper 9 then 12 times in a row while the player had shifted to rock) and **30% replay prediction accuracy (< 33% random)**.

### `game.js` — rules (don't change semantics)

`MOVES=["rock","paper","scissors"]`, `shift(move,k)`, `counter(move)`, `beats`, `judge(player,ai)->"win"|"loss"|"tie"` (player's view), `gameValue(ai,player)->{+1,0,-1}` (AI view). `applyRound(state,p,a,predicted,confidence)` stores a round `{p,a,o,g,c}`. `MAX_ROUNDS=500`.

### `benchmark.js` — general battery (the no-regress gate)

`benchmark(predictor,{rounds=300,seeds=40}) -> {results, meanNet, worstNet}` over `opponents` (12 strategies: always-rock, fixed-cycle, uniform-random, biased-70-rock, win-stay-lose-shift, beat-last-ai, copy-last-ai, anti-repeat, habit-markov, pattern-RRPS-noisy, **switch-every-40**, adaptive-counter). `playMatch(predictor, oppMake, rounds, seed)`. `mulberry32(seed)` PRNG. Metric = AI-perspective net = (wins−losses)/rounds. **Current baseline meanNet ≈ +72%; worstNet should stay ≥ ~0.**
**CLI convenience:** `bun benchmark.js` also benchmarks `./candidate.js` if that file exists — head-to-head vs baseline.
**Methodology note:** matches are **300 rounds** — long enough that slow learners catch up asymptotically, so the general battery *under-weights post-switch adaptation speed*. Short-horizon / immediately-post-switch behavior is exactly what failed in the real match.

### `realplay-bench.js` — real-session harness (the must-improve gate)

`bun realplay-bench.js [path ...]` (defaults to scanning `sample-plays/*.json`). For each session reports: **recorded** (the bot actually faced), **replay** (current bot vs your fixed sequence — a pessimistic lower bound, flatters a reacting player), **vs model** (current bot live vs a reactive model built from `(lastPlayer,lastAI,lastOutcome)` — the realistic estimate), **oracle ceiling** (best net any predictor knowing that model could get). Exposes `playMatch` import too.

The two real sessions to improve on:
- `sample-plays/human-session-1.json` — well-mixed 80-round. Current ≈ **+29% vs model of a +41% oracle**.
- `/tmp/claude-0/-home-user-guplem-github-io/322a05da-68ea-528b-80f9-efea070f4cb3/scratchpad/match91.json` — the strategy-switcher. Current: replay **−8.8%**, vs model **+18.0%**, oracle **+26.6%**.

## INVIOLABLE CONTRACT (ADR 0001 / root ADR 0007)

- `decide()` stays **PURE** (reads only model/history; never the live move).
- `learn()` stays **DETERMINISTIC** — no `Math.random`, no `Date`. Replaying stored rounds via `rebuildModel` must reproduce the exact live model (this is how localStorage persistence works). **Any recency/decay must be a deterministic function of round index/history**, not wall-clock.
- No new runtime dependencies; must run in microseconds per round on a phone.
- `predictor.test.js` encodes the behavior contract (replayed==live; beats constant/cyclic/short-pattern; exploits 50/50 "never repeat"; not exploited by counter-last-AI). Changes must keep these green.

## How to MEASURE (every claim must be measured)

Do NOT edit the shared `predictor.js` / `benchmark.js` / `candidate.js` (parallel agents will collide). Instead prototype in **your own scratch dir**: `/tmp/claude-0/-home-user-guplem-github-io/322a05da-68ea-528b-80f9-efea070f4cb3/scratchpad/research/agent-<N>/`. You only have Bash — create files with heredocs and run with `bun`.

Recipe: copy `predictor.js` into your scratch dir, modify your copy, then measure both gates:

```bash
A=/tmp/claude-0/-home-user-guplem-github-io/322a05da-68ea-528b-80f9-efea070f4cb3/scratchpad/research/agent-<N>
P=/home/user/guplem.github.io/web-projects/rps-mind-reader
cp "$P/predictor.js" "$A/mine.js"   # then edit $A/mine.js (it imports ./game.js — copy game.js too or fix the import path to $P/game.js)
# General battery:
bun -e 'import {benchmark} from "'$P'/benchmark.js"; import * as m from "'$A'/mine.js"; const r=benchmark(m,{rounds:300,seeds:40}); console.log("mean",r.meanNet,"worst",r.worstNet); for(const x of r.results) console.log(x.opponent,x.net.toFixed(3));'
# Real sessions: easiest is to set candidate via realplay by importing its internals, OR replicate its liveNet against the reactive model. See realplay-bench.js for playMatch + reactiveModel.
```
(If wiring real-session measurement is fiddly, at minimum run the general battery on your variant and reason carefully about the real sessions using the phase analysis in the diagnosis.)

Report **numbers**, not vibes. A change that lifts real-play but regresses `meanNet`/`worstNet` is a tradeoff to flag, not a free win.
