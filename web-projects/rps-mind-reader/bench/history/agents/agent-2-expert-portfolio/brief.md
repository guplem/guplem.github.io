# Brief — Agent 2: Expert-Portfolio

**Angle:** Run the SAME model families at several configurations — e.g. fast-adapting vs slow-stable memory, different smoothing — so a fast expert reacts to strategy switches while a slow expert stays robust to noise, and the existing weighting picks whichever is winning now ("multiple algorithms with different parameters/configurations").

**Why you:** Today there is ONE global config (one CTX_DECAY, one KT, one MAX_ORDER). A player who switches tactics is best tracked by a fast learner; a noisy-but-stationary player by a slow one. A portfolio covers both.

## Concrete tasks
1. Read `predictor.js`, focusing on `CONTEXTS`, `aggregate()`, and how `llScores` weight contexts. Understand how cheaply you can multiply experts (the loop already iterates contexts; experts = contexts × configs).
2. Design the portfolio. Decide the axes worth varying: within-context decay/half-life (fast vs slow — coordinate with Agent 1), `KT` smoothing, `LL_ETA`, maybe a short fixed-window expert vs the full-history one. Keep total experts small (cost + overfwith-overfitting risk). Propose a concrete roster (e.g. each context replicated at γ_fast and γ_slow).
3. Watch for **redundancy/overfitting**: more experts can hurt if the selector gets noisier or if you're fitting two sessions. Argue which configs *add* value vs which are noise. Consider whether the softmax over many similar experts dilutes the sharp one (interaction with Agent 3).
4. **Measure**: general `meanNet`/`worstNet` (must not regress — watch worstNet, more experts can increase exploitability), plus lift on both real sessions. Compare a 1-config baseline vs your portfolio; show that the extra experts are pulling their weight per-opponent.
5. Mind cost & the contract: experts must be deterministic + replayable; keep per-round work tiny. Report the rough multiplier on per-round work.

## Awareness of other agents
- Agent 1 gives you the *single best* decay; you generalize to several. Use their sweep numbers; don't re-derive from scratch.
- Agent 3 owns HOW experts are combined — your job is WHICH experts exist. Hand them a clean expert set and flag whether soft mixture vs hard selection matters more with many experts.
- Agent 4 will tell you which switch cadences to cover; make sure the portfolio spans them.

## Output
Write `round-1.md` here (Key Findings / Concrete Recommendations [What/Why/How/Risk/Effort] / Open Questions / Interactions). Real numbers required.
