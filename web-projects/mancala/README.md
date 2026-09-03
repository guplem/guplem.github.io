# Mancala

Two mancala games on one board: **Kalah**, the version most people have played,
and **Ba-awa**, the game played in Ghana, where one move can cross the board
many times and the winner takes pits off the loser. Play a friend on the same
device, take on one of six computer opponents, or set two opponents against
each other and watch.

## Features

- **Two rule sets, one engine interface.** Kalah has the two stores, the extra
  turn and the facing-pit capture. Ba-awa has no stores at all: any pit that
  reaches exactly four is emptied at once, and one move keeps going for as long
  as its last seed keeps landing in an occupied pit.
- **Ba-awa plays a match, not a game.** At the end of a round, four captured
  seeds buy one pit for the next round, so a player who took more than half the
  seeds owns more than six pits and the extra ones come off the opponent. Hold
  ten pits and you win the match.
- **Six computer opponents, ranked by a measured tournament.** Not by opinion:
  `benchmark.js` plays every opponent against every other one, in both rule
  sets and both seats, and the table it prints is the order they are listed in.
- **Any seat, any player.** A person or a program in each seat, so you can play
  a friend, play a program, or watch two programs.
- **Animated, and the animation can never lie.** The engine answers a move with
  the finished position plus an ordered list of everything that happened. The
  screen replays that list one seed at a time, and it paints the final position
  from the engine when it is done, so a skipped or interrupted animation still
  leaves the board correct.
- **Nothing is fetched.** No network calls at all, no fonts, no images, no
  libraries. The only thing kept is your setup, your speed choice and your
  record against each opponent, in this browser.

## How to Run

Open `index.html` in a browser, or serve the repository with any HTTP server:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/web-projects/mancala/>.

## Tests

```bash
bun test
```

## The two rule sets

Both games use the same board: twelve pits in a ring, four seeds in each, so 48
seeds in play. Sowing always goes counterclockwise, one seed per pit.

### Kalah

| Rule | What happens |
|---|---|
| Your move | Lift every seed from one of your own six pits and sow them counterclockwise. |
| The stores | A seed goes into your own store as you pass it, never into your opponent's. |
| Play again | Last seed in your own store: take another turn. |
| Capture | Last seed in an empty pit of your own row: take it and every seed in the pit facing it. |
| The end | One whole row is empty. Every seed left goes to the player who owns the row it sits in, and the fuller store wins. |

### Ba-awa

| Rule | What happens |
|---|---|
| Your move | Lift every seed from one pit you own and sow them counterclockwise. There are no stores. |
| Keep going | Last seed lands in a pit that already held seeds: lift that whole pit and sow again from there. |
| Four scores | Any pit that reaches exactly four is emptied at once and the player who **owns** that pit takes the four, even while the opponent is sowing. |
| The last seed | If the seed that made four was the last seed of the move, the player who **moved** takes them, wherever the pit is. The move then ends. |
| The end of a round | The player to move owns no seed: the other player takes every seed left. |
| The quiet endgame | Eight or fewer seeds go 18 turns with nobody capturing: the round stops and the player who started it takes them. |
| The next round | Four captured seeds buy one pit. A player with more than six pits takes the extra ones off the opponent, starting with the first pit of the opponent's row in sowing order. |
| The match | Hold ten pits and you win. Who moves first alternates every round. |

Three numbers in Ba-awa are house rules, because the traditional game leaves
them to the players and a program has to be told: the 18 quiet turns above, the
spare pit when 48 seeds do not divide into fours (it goes to the bigger
leftover, and an even 2-and-2 goes to whoever moved second), and a cut-off after
300 lifts in one relay so a browser tab cannot freeze. All three are recorded,
with the measurements behind them, in
[`adr/0003`](adr/0003-the-numbers-the-tradition-leaves-out.md).

## The opponents

Six of them, weakest first. The order is measured, not asserted: see
**Benchmark** below.

| Tier | Name | How it thinks | Win rate | Ba-awa |
|---|---|---|---|---|
| 1 | Pebble | Any legal move, with no plan at all. | 5.8% | 6.7% |
| 2 | Magpie | The most seeds it can take this turn, and no further. | 24.2% | 26.7% |
| 3 | Farmer | Judges the whole board after each of its own moves and keeps the best one. | 37.5% | 38.3% |
| 4 | Weaver | Minimax with alpha-beta pruning, a fixed few moves deep. | 64.2% | 71.7% |
| 5 | Dreamer | Monte Carlo tree search: plays hundreds of games out and keeps the move that wins most. | 81.7% | 75.0% |
| 6 | Chief | Minimax again, deepening one level at a time until its 450 milliseconds run out. | 86.7% | 81.7% |

Win rate is the share of points each one took in the round-robin below, over
both rule sets; the last column is Ba-awa alone. Every opponent plays both rule
sets, and nothing in them knows which game is on the board, because the engine
is handed to them.

The two rule sets do not reward the same thinking equally. Ba-awa is shorter
and sharper, so the gap between the top three narrows there. Dreamer beats
Weaver 6-0 at Kalah, but only 3-2 with 1 drawn at Ba-awa. Chief beats Dreamer
3-2 with 1 drawn at Kalah, and 2-0 with 4 drawn at Ba-awa, where six of its ten
games were drawn.

## Benchmark

```bash
bun benchmark.js                    # every opponent, both rule sets
bun benchmark.js --games 6          # more games per pairing
bun benchmark.js --mode baawa       # one rule set
bun benchmark.js --scale 1          # full thinking time, slower
bun benchmark.js --agents deep,mcts # only these two
```

`benchmark.js` is a development tool. The game never imports it, and `bun test`
never runs it, because it is not named `*.test.js`.

The table above came from `bun benchmark.js --games 3 --scale 1`: 15 pairings,
6 games each, both seats, both rule sets, 180 games in all. Re-run it after any
change to `search.js`, `evaluate.js` or either engine, and if the order moves,
change the `tier` numbers in `agents.js` and this table together.

`--scale` shrinks the thinking clock of the two opponents that use one, which
makes a whole tournament finish in minutes. Do not rank from a scaled run: at
`--scale 0.2` Dreamer drops below Weaver purely because it is given a fifth of
its search.

## URL Parameters

The address bar holds the setup, so a link opens a table already laid out. The
position is not in the link: see `adr/0002`.

| Parameter | Values | Default |
|---|---|---|
| `mode` | `kalah`, `baawa` | `kalah` |
| `blue` | `human`, or an opponent id | `human` |
| `red` | `human`, or an opponent id | `heuristic` |
| `rounds` | `single` to play one Ba-awa round instead of a match | a full match |

Opponent ids: `random`, `greedy`, `heuristic`, `minimax`, `mcts`, `deep`.
Anything the game does not recognise falls back to the default, and a value
equal to the default is left out of the link.

Example: <https://triunitystudios.com/web-projects/mancala/?mode=baawa&red=deep>

## Files

| File | Pure? | Responsibility |
|---|---|---|
| `board.js` | Yes | The ring of twelve pits: geometry, counting, who owns which pit |
| `kalah.js` | Yes | The Kalah rules |
| `baawa.js` | Yes | The Ba-awa rules, one round of them |
| `match.js` | Yes | Rounds into a match: captured seeds into pits, and who won |
| `modes.js` | Yes | The two rule sets behind one interface, and the how-to-play cards |
| `evaluate.js` | Yes | How good a position is, per rule set |
| `search.js` | Yes | Random, greedy, one-move, minimax and Monte Carlo tree search |
| `agents.js` | Yes | The six opponents as data: a name, a tier and a plan |
| `playback.js` | Yes | The picture on the screen, which trails the engine by one event |
| `rng.js` | Yes | A seeded random-number generator, so a benchmark run repeats |
| `urlState.js` | Yes | Reading and writing the address bar (root ADR 0006) |
| `store.js` | Yes | Setup, speed and your record, through an injected storage (root ADR 0007) |
| `deployStamp.js` | Yes | The "deployed at" footer, read from this page's own head (root ADR 0013) |
| `deployText.js` | Yes | The words that footer uses |
| `render.js` | No | Builds the board's elements and animates the seeds |
| `app.js` | No | Listens to clicks, calls the modules above, owns the only clock |
| `benchmark.js` | No | Development only: the round-robin tournament |

## Privacy

The page makes no network requests at all. It keeps three things in this
browser's `localStorage`, and nothing leaves the device:

- `mancala:setup:v1` the last setup you played
- `mancala:speed:v1` the animation speed
- `mancala:record:v1` your wins, draws and losses against each opponent

## Tech Stack

Vanilla HTML, CSS and JavaScript ES modules. No build step, no framework, no
dependencies. Tests run on [Bun](https://bun.sh)'s built-in test runner.

## Live Version

<https://triunitystudios.com/web-projects/mancala/>
