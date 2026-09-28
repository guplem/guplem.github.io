# ADR 0001: Replicate the reference game's rules, not its code

## Context

The game copies the Ghana Ludo that `just-lads.com/ludo` publishes: the same
board, the same three extra kicks, and the same switches for the host. The
spoken rules leave many details open. Examples: can a back kick land on an empty
field? Does a piece in the house between block a side kick? Does a raider need
a six to walk out of a house? The page's own `rules.js` answers every one of
them.

That code has no licence to copy. The texts and the branding belong to a
restaurant.

## Decision

**Read the reference game's rules code as the specification, and write our own
implementation, test-first.**

- Each rule detail read from the reference game is a test in `rules.test.js`,
  written before the code that passes it.
- The code is our own design: the track is built from the runs a finger traces
  round the cross, every function returns a new state, and the names differ.
- No text, image or style comes from the reference page.
- A random-games test plays full games with seeded dice and checks the board
  invariants after every step, because hand-picked cases miss rule interactions.

## Consequences

- The rules match the reference game, and a test documents each rule.
- A difference from the reference game is a bug in our tests or our code. Fix it
  by adding the test that the reference behaviour implies.
- If the reference game changes its rules, ours do not follow. Read the
  new code, update the tests first, and then update the code.
