# web-projects/mancala/AGENTS.md

> **SCOPE:** These rules apply when you work on files under
> `web-projects/mancala/`. Read `web-projects/AGENTS.md` first for the rules
> every web-project follows.

## What this is

Two mancala games on one board, six computer opponents, and one animated screen.
`README.md` holds the rules of both games as tables; read it before you touch a
rule, and keep it true when you change one.

The two games are **Kalah**, the version most people know, and **Ba-awa**, the
game played in Ghana. They share the board and nothing else. See ADR 0001.

## Module map

| File | Pure? | Responsibility |
|---|---|---|
| `board.js` | Yes | The ring of twelve pits: geometry, counting, pit ownership. Knows no rules |
| `kalah.js` | Yes | The Kalah rules |
| `baawa.js` | Yes | The Ba-awa rules, one round of them |
| `match.js` | Yes | Rounds into a match: captured seeds into pits, and who won the match |
| `modes.js` | Yes | The two engines behind one interface, and the how-to-play cards |
| `evaluate.js` | Yes | How good a position is, per rule set. The file where the rule set changes which formula runs |
| `search.js` | Yes | Random, greedy, one-move, minimax with alpha-beta, Monte Carlo tree search |
| `agents.js` | Yes | The six opponents as data: a name, a tier and a plan |
| `playback.js` | Yes | The picture on the screen, which trails the engine by one event |
| `seedLayout.js` | Yes | Where the seeds sit inside a pit, and which place the next seed takes |
| `captions.js` | Yes | The words: one event's pop-up, one move's summary, one held pit's line |
| `rng.js` | Yes | A seeded generator, so a benchmark run repeats exactly |
| `urlState.js` | Yes | Reading and writing the address bar (root ADR 0006) |
| `store.js` | Yes | Setup, speed and the player's record, through an injected storage (root ADR 0007) |
| `deployStamp.js` | Yes | The "deployed at" footer. Copied verbatim; never rewrite it (root ADR 0013) |
| `deployText.js` | Yes | The words that footer uses |
| `render.js` | No | Builds the board's elements and animates the seeds |
| `app.js` | No | Listens to clicks, calls the modules above, decides the pace of an animation |
| `benchmark.js` | No | Development only. The round-robin tournament that ranks the opponents |

## The engine contract

Every rule set exports these four calls, and everything above the engines
depends on all four:

```
createGame(options)      -> state
legalMoves(state)        -> pit indices
applyMove(state, pit)    -> { state, events }
describeMove(state, pit) -> what the move would do, without playing it
```

The state shape is shared: `mode`, `pits`, `scores`, `turn`, `owner`, `over`,
`winner`, `endReason`, `plies`. Ba-awa adds `starter` and `sinceCapture`.

`describeMove` answers one shape too, because `captions.js` writes one preview
line for both games: `gain` (what the mover ends up with), `captured` (what the
mover takes out of pits), `given` (what the opponent takes), `laps`,
`extraTurn`, `lands` (the pit the last seed rests in) and `landsInStore` (the
store it falls into instead). A field a game cannot have is still answered with
the value that game always has: Kalah answers `given: 0` and `laps: 1`, Ba-awa
answers `extraTurn: false` and `landsInStore: null`.

**Add a field to one engine and you must add it to the other**, or the opponents
and the screen see a hole. Nothing enforces it but `modes.test.js`, which walks
every engine through the same four calls. Extend that test when you extend the
contract.

`applyMove` never changes the state it is given, and every engine has a test
that proves it. The screen and the search both keep older positions.

## Adding a third rule set

1. Write `<name>.js` with the four calls above, and `<name>.test.js` beside it.
2. Add an entry to `MODES` in `modes.js`: the name, the tagline, `hasStores`,
   `conquest`, the engine, and six `howToPlay` cards.
3. Give each card a `figure`: a board position the carousel draws with the real
   board code. `modes.test.js` checks that every figure adds up to 48 seeds,
   because neither game ever loses one.
4. Write an evaluation function in `evaluate.js` and dispatch to it in
   `evaluate`. Without one, every searching opponent plays the new game blind.
5. Run `bun benchmark.js --mode <name>` and check the six opponents still rank
   in the order `agents.js` claims.

No change to `agents.js`, `search.js`, `render.js` or `app.js` should be needed.
If one is, the contract has a hole in it.

## Gotchas

**A Kalah move can leave the same player to move.** The extra turn means the
players do not simply alternate. Any search must read `state.turn` at each node
rather than flipping a maximising flag on the way down. `search.js` does; a
plain negamax would be wrong here and would look almost right.

**Kalah keeps its stores in `scores`, not in `pits`.** `pits` is always the
twelve-pit ring, in both games. Kalah's store is a slot in its sowing path
(`sowingPath` in `kalah.js`) and a number in `scores`. This is what lets both
games share one board shape and one screen.

**A Ba-awa capture can pay the opponent.** A pit that reaches exactly four pays
the pit's **owner**, whoever is sowing. Only the last seed of a move pays the
**mover**. Getting this backwards makes a game that still runs and plays
nothing like Ba-awa, so `baawa.test.js` pins both halves.

**Pit ownership is not fixed.** In Ba-awa a player can own pits in the
opponent's row after a round. Read `state.owner`, never `pit < 6`.
`ownersFromPitCounts` in `board.js` decides the layout: a player with six pits
or more keeps their own row and extends forward in sowing order, and the player
left with fewer keeps the tail of theirs.

**Three Ba-awa endings, and the order matters.** Starve first, then the quiet
endgame, then the stall backstop. Reordering them is not a detail: checking the
seed count first ended every measured round and made the main ending
unreachable. ADR 0003 has the numbers.

**The relay needs a cut-off.** Nothing in the rules stops relay sowing from
looping. `MAX_LAPS` is that cut-off, and a test builds a position that leans on
it. Never remove it.

**A Ba-awa test fixture usually needs ballast.** A sparse board ends the round
before the rule under test can fire, by starving or by the endgame rule. Most
fixtures park twelve seeds in a pit out of the way. Twelve never reaches four,
so the ballast changes nothing else.

**The animation must never be the source of a number.** `render.js` paints each
pit from the snapshot, and `app.js` repaints the whole board from the engine
after every move. A player can tap anywhere on the board to skip an animation
at any point, and the skip is checked before the tap is matched to a pit.

**A flying seed starts and ends on a place a pit draws, never on a pit's
centre.** `seedLayout.js` fixes twelve places per pit and `restingPoint` in
`render.js` turns one into pixels. Seed k of a lift leaves place k of the pit
it comes out of and lands on the place its new pit is about to draw it in, so
the swap from a flying seed to a drawn dot moves nothing. Aim a flight at
`centreOf(pit)` again and every seed jumps into place as it arrives, which is
the exact bug a player reported as a teleport. Two smaller parts of the same
fix: the flying seed is `calc(var(--pit) * 0.14)` across, the size of a drawn
one, and `--pit` therefore lives on `:root` and not on `.board`, because the
layer the seeds fly on is a sibling of the board.

**A hold is a look, and it plays nothing.** Press a pit for `HOLD_MS` and the
board marks the pit its last seed would land in; the release then plays no
move, because `eatClickUntil` swallows the click that ends a press that became
a look. That is a moment and not a flag on purpose: a press that ends off the
board sends no click, and a flag left standing would eat the next real one. A mouse resting on a pit for `DWELL_MS` opens the same look, and a pit
reached with the keyboard opens it at once (`:focus-visible` tells a keyboard
focus from a mouse press). The marks come from the engine's `describeMove`, so
the screen never simulates a move of its own. ADR 0006 has the reasoning.

**A line about a move must not be overwritten by the prompt.** `playMove` says
whose turn it is ONLY when `summarise` had nothing to report, and passes that
answer to `queueAgent` so the "thinking" line does not wipe it either. Both
calls looked harmless and both hid every summary the game ever wrote.

**The seeds of one lift fly together, not one at a time.** `sowingLaps` in
`playback.js` groups a move's events into laps, one per `lift`, and `render.js`
launches every seed of a lap at once: seed 1 lands in the next pit, seed 2 in
the pit after it, and the last seed crosses the whole distance. This is
measured from the game the project copies, and the first version got it wrong
by flying one seed and waiting for it. Do not "simplify" it back. ADR 0005 has
the frame-by-frame numbers.

**The pace is per pit crossed, not per event.** `BASE_GAP` in `playback.js` is
560ms, which is what the measured game averages. A lap of five seeds therefore
runs for five gaps. `MOVE_BUDGET` shrinks the gap on a long Ba-awa relay,
because the last seed of a forty-seed move would otherwise fly for twenty
seconds, and `MIN_GAP` is the floor. The speed button divides the gap by 1, 2
or 3, and the normal pace is the slowest of the three on purpose.

**The board's size comes from one custom property.** `--pit` in `style.css` is
capped against the viewport width AND height, so the tall phone board never runs
off the bottom of the screen. Change the layout by changing that, not by adding
a fixed width.

**Both halves of the reduced-motion rule must agree.** `style.css` cuts the
transitions under `prefers-reduced-motion`, and `app.js` sets the pace to zero
under the same query, which skips the seed flights rather than making them
instant. Change one and you must change the other.

## Working on an opponent

The six opponents live in `agents.js` as **data**, not as closures: each has a
`plan(mode)` that returns which algorithm to run and with what settings. That
buys two things. The plans are testable without playing a game, and
`benchmark.js` can scale the thinking clock down so a whole tournament finishes
in minutes.

The workflow, from `rps-mind-reader`:

1. Change `search.js`, `evaluate.js` or a plan in `agents.js`.
2. Run `bun benchmark.js --games 3 --scale 1`. It plays every pairing in both
   rule sets from both seats.
3. If the order moved, update the `tier` numbers in `agents.js` **and** the
   difficulty table in `README.md`, and the win rates in ADR 0004.

**Never rank from a scaled run.** At `--scale 0.2` the Monte Carlo opponent
drops below the fixed-depth one purely because it is given a fifth of its
search. ADR 0004 records that measurement and why it is not the ranking.

**Keep the strength tests fast.** `agents.test.js` compares the cheap opponents
only. The two that think on a clock spend 450ms a move, which times a test suite
out; comparing them properly needs more games than a test should play. That is
what the benchmark is for.

## Architecture Decision Records

| ADR | Topic |
|---|---|
| [0001](adr/0001-two-engines-behind-one-interface.md) | Two rule sets, two engines, one interface |
| [0002](adr/0002-the-setup-is-in-the-link-the-position-is-not.md) | The link carries the setup, never the position |
| [0003](adr/0003-the-numbers-the-tradition-leaves-out.md) | Decide the numbers the tradition leaves to the players, and measure them |
| [0004](adr/0004-rank-the-opponents-by-a-measured-tournament.md) | Rank the opponents by a measured tournament, not by opinion |
| [0005](adr/0005-the-screen-trails-the-engine-by-one-event.md) | The engine answers with events, and the screen trails it by one |
| [0006](adr/0006-a-hold-looks-ahead-and-plays-nothing.md) | A hold looks ahead, the engine answers the look, and the release plays nothing |
