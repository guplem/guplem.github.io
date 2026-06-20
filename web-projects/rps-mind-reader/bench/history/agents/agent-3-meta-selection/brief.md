# Brief — Agent 3: Meta-Selection

**Angle:** Today experts are blended by a soft softmax over recency-decayed log-likelihood. A/B alternative ways to pick/blend experts and "go with the best one": hard argmax (single best expert), Hedge / multiplicative-weights, sliding-window accuracy, EXP3-style bandit, and tuning the softmax temperature `LL_ETA` and selection forgetting `CTX_DECAY`.

**Why you:** The selector is what decides how fast the bot abandons a losing read after a switch. A sharper/faster selector may adapt quicker; too sharp and it overreacts to noise. This is a core lever and currently only one point in that space is used.

## Concrete tasks
1. Read `aggregate()`, `decide()`, and the `llScores` update in `learn()`. Pin down the current rule precisely: `w = exp(LL_ETA * llScore)`, `llScore = Σ CTX_DECAY^age · log p(realized)`. Note it scores by *log-likelihood of the move*, then votes by *EV-best response* — keep that EV-voting idea unless you can show better.
2. Implement and compare selectors (in your scratch copy): (a) current softmax; (b) hard argmax over llScore; (c) Hedge / multiplicative weights on realized **game value** rather than log-lik; (d) sliding-window predictive accuracy (last K rounds) instead of exponential; (e) sweep `LL_ETA` and `CTX_DECAY`. Consider scoring by realized win/loss vs by log-likelihood — which adapts faster after a switch?
3. Analyze the **adaptation-speed vs stability** tradeoff explicitly: how many rounds after a switch does each selector take to flip its bet? Tie this to the 91-round stuck-runs (Paper×12).
4. **Measure**: general `meanNet`/`worstNet` (a faster selector must not crater worstNet vs random/adaptive opponents) + both real sessions. Report per-selector numbers.
5. Keep it deterministic/replayable and cheap. Flag any selector that needs randomness (e.g. EXP3 sampling) — that would break the pure/deterministic contract unless the exploration is derandomized or moved to `decide`'s rng (decide may use rng; learn may not).

## Awareness of other agents
- Agents 1 & 2 change WHAT the experts are (aged counts, multiple configs). Your selector sits on top — ideally test your selectors on top of a portfolio-ish expert set, not just the current one. Coordinate: a good selector + aged experts may be complementary or redundant.
- If aging (Agent 1) already fixes most of the stuck-run problem, your marginal gain may be small — say so honestly and quantify.
- Agent 4 gives switch cadences for the adaptation-speed analysis.

## Output
Write `round-1.md` here (Key Findings / Concrete Recommendations [What/Why/How/Risk/Effort] / Open Questions / Interactions). Real numbers required.
