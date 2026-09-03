# ADR 0004: Rank the opponents by a measured tournament, not by opinion

## Context

The game offers six computer opponents and labels them Beginner to Expert. A
player picks by that label, so the label has to be true.

It is easy to assume the order. A deeper search should beat a shallower one, and
tree search should beat a one-move heuristic. Assuming it is how a game ends up
with an "Expert" that a careful player beats every time.

The order also depends on the rule set. The two games here reward different
thinking: Kalah rewards looking ahead, because the extra turn lets one player
chain several moves; Ba-awa is shorter and sharper, and a relay can take three
pits in one move.

## Decision

**`benchmark.js` plays every opponent against every other one, in both rule sets
and both seats, and the table it prints is the order shipped in `agents.js`.**

Both seats, because moving first is an advantage in both games. A seeded
generator (`rng.js`) makes a run repeatable.

The opponents are **data, not closures**, so this is possible at all. Each one
has a `plan(mode)` that returns which algorithm to run and with what settings.
`planFor(id, mode, scale)` can then shrink a thinking clock without touching the
algorithm, which is what makes a whole tournament finish in minutes.

The ranking shipped came from `bun benchmark.js --games 3 --scale 1`: 15
pairings, 6 games each, both seats, both rule sets, 180 games.

| Tier | Opponent | Algorithm | Both rule sets | Ba-awa alone | ms per move |
|---|---|---|---|---|---|
| 1 | Pebble | any legal move | 5.8% | 6.7% | 0.0 |
| 2 | Magpie | most seeds this turn | 24.2% | 26.7% | 0.0 |
| 3 | Farmer | one move deep, on the evaluation | 37.5% | 38.3% | 0.0 |
| 4 | Weaver | alpha-beta, fixed depth 4 (3 in Ba-awa) | 64.2% | 71.7% | 0.5 |
| 5 | Dreamer | Monte Carlo tree search, 1200 tries (400 in Ba-awa) | 81.7% | 75.0% | 49.9 |
| 6 | Chief | alpha-beta, deepening on a 450ms clock | 86.7% | 81.7% | 169.7 |

## Consequences

- The labels are earned. Every step up the list wins its head-to-head against
  the step below, in both rule sets.
- **Never rank from a scaled run.** An earlier run at `--scale 0.2` put Weaver
  above Dreamer, 73.5% to 59.5%. That is not a finding about the algorithms: it
  is Dreamer being given a fifth of its search while Weaver, which searches to a
  fixed depth, loses nothing. Confirm any change to the top of the table at
  `--scale 1`.
- The tournament is the only place the strong opponents are compared.
  `agents.test.js` compares the cheap ones, because a 450ms search times a test
  suite out and a fair comparison needs more games than a test should play.
- Re-run it after any change to `search.js`, `evaluate.js` or either engine. The
  Ba-awa ending rules changed once after the first ranking (ADR 0003), and the
  tournament was re-run to check the order held. It did, and the win rates moved
  by a few points, so the table above is from after the change.
- Three tables now carry the same numbers: `agents.js` (the `tier` field),
  `README.md` and this ADR. Change them together.
- The benchmark measures thinking time as well as strength. That is what keeps
  Chief's clock at 450ms: it averages 170ms a move, and a budget large enough to
  win by more would make a phone feel broken.
