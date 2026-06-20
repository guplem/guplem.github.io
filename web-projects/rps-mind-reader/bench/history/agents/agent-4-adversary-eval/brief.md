# Brief — Agent 4: Adversary & Evaluation

**Angle:** Make the measurement trustworthy. The general benchmark plays 300-round matches against mostly-stationary opponents, so it under-weights *post-switch adaptation speed* — the exact thing that failed. Add strategy-switching opponents and a short-horizon / post-switch protocol so the other agents' wins are proven to generalize, not overfit to two real sessions.

**Why you:** With only two real sessions, there's real overfitting risk. A principled adversary battery + the right metrics are what let us trust "this is better" rather than "this fits these 91 rounds."

## Concrete tasks
1. Read `benchmark.js` (opponents, `playMatch`, `benchmark`, the `switch-every-40` opponent) and `realplay-bench.js` (replay vs reactive-model vs oracle). Note the methodology gaps: 300-round asymptotics hide adaptation lag; `meanNet` averages away short-term losses; only one crude switcher exists.
2. Design a **strategy-switcher opponent family** (prototype in your scratch dir; propose for later inclusion in `benchmark.js`): players that change regime mid-match — e.g. bias-A→bias-B every N rounds, Markov-habit→anti-repeat, stationary→reactive(beat-last-ai), with varying cadence (N ∈ {15,25,40}) and abrupt vs gradual switches. Make them deterministic given the seed (use the existing `mulberry32`).
3. Define the **post-switch metric**: e.g. net over the W rounds immediately following each regime change, and a short-horizon benchmark (rounds=60–90, matching real sessions) alongside the existing 300-round run. Specify exactly what numbers the other agents should report so results are comparable.
4. Establish an **anti-overfitting protocol**: which sessions/opponents are "training" vs "held-out"; a sanity rule (a change that only helps `match91` but not the synthetic switchers or `human-session-1` is suspect). Recommend whether `match91.json` should become a committed `sample-plays/` fixture (it should) and how to keep the two real sessions as held-out validation rather than tuning targets.
5. Run the CURRENT baseline through your proposed new opponents + short-horizon settings to get **baseline reference numbers** the others can compare against. Report them.

## Awareness of other agents
- You are the scorekeeper. Agents 1–3 will tune to whatever you measure — so make the metrics capture adaptation speed and robustness, not just asymptotic mean.
- Flag if any of their likely changes (faster decay / sharper selector) would predictably crater `worstNet` against uniform-random or adaptive-counter — that's the cost side they must report.

## Output
Write `round-1.md` here (Key Findings / Concrete Recommendations [What/Why/How/Risk/Effort — here "recommendations" = the eval harness + metrics + baseline numbers] / Open Questions / Interactions). Real baseline numbers required.
