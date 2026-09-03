# ADR 0001: Two rule sets, two engines, one interface

## Context

The project plays two mancala games on the same board. Kalah and Ba-awa share
the ring of twelve pits, the four seeds per pit and the counterclockwise sowing.
They share nothing else:

| | Kalah | Ba-awa |
|---|---|---|
| Stores | Two, and you sow into your own | None at all |
| A move | Sows once and stops | Relays: it lifts the landing pit and sows again |
| Scoring | The store, plus the facing-pit capture | Any pit that reaches exactly four |
| Who scores | Always the player who moved | The pit's owner, unless it was the last seed |
| Extra turns | Yes, from your own store | Never |
| A game | One game and it is over | Rounds, and the winner takes pits |

One engine with a `variant` flag was the obvious first idea. Almost every line
of the sowing loop would then carry a branch, and the two hardest rules in the
project would sit inside each other: relay sowing is a loop around the sowing
loop, and Kalah's sowing path has a store in it that Ba-awa's does not.

Six opponents and one screen have to work on both games. Neither can hold a
list of special cases per rule set, or adding a third game means editing them.

## Decision

**Write one engine per rule set, and give both engines the same four calls.**

`kalah.js` and `baawa.js` each export:

```
createGame(options)    -> state
legalMoves(state)      -> pit indices
applyMove(state, pit)  -> { state, events }
describeMove(state, pit) -> what the move would do
```

Both take and return the same state shape: `pits`, `scores`, `turn`, `owner`,
`over`, `winner`, `endReason`. Kalah keeps its stores in `scores` rather than in
`pits`, which costs Kalah one lookup table for its sowing path and buys one
board shape for everything above.

`board.js` holds what is genuinely shared: the ring, the geometry and the
counting. It knows no rules.

`modes.js` holds the registry. `search.js`, `playback.js`, `render.js` and
`benchmark.js` are handed an engine and never ask which one it is.
`evaluate.js` is the file where that matters most: a position is worth
different things in the two games, so it dispatches on `state.mode` to choose
which formula to score with. `agents.js` reads `mode` too, but only to scale a
plan's search depth or iteration count for the shorter Ba-awa game; it never
changes which algorithm a plan calls.

## Consequences

- Each engine reads as the rules of its own game. `baawa.js` has the relay loop
  and no stores; `kalah.js` has the store in its path and no relay.
- The six opponents were written once and work on both games. The tournament in
  `benchmark.js` runs both rule sets from the same code.
- A third rule set is a new file plus an entry in `modes.js`. It needs no change
  to the opponents, the screen or the tests of the other rule sets.
- The shared state shape is a contract with no compiler behind it. A field added
  to one engine and not the other is a bug that only a test catches, so
  `modes.test.js` walks every engine through the same four calls.
- Sowing appears twice, in two loops that look similar and are not. That is the
  price. The one thing genuinely common to both, "step to the next pit, wrapping
  at twelve", is three characters of arithmetic, so sharing it would cost more
  than it saves.
