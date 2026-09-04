# ADR 0005: The engine answers with events, and the screen trails it by one

## Context

One move can move a lot of seeds. A Kalah move sows up to thirteen. A Ba-awa
move relays: it can lift a pit, sow it, lift the landing pit, sow that, and
carry on round the board several times, taking four seeds out of play each time
a pit reaches exactly four.

`applyMove` works all of that out at once and answers with the finished
position. If the screen drew that position, a player would see the board jump
from before to after. Nothing would say which pit the seeds came from, where
they went, which pit reached four, or who took it. In Ba-awa, where the whole
skill is in reading where a relay will end, that is the game hidden rather than
shown.

Animating from the difference between two positions does not work either. Pit 3
holding two seeds more than before does not say whether one move dropped two
seeds in it or a relay passed it twice. A capture and a sweep both empty a pit.
The information the animation needs is the order things happened in, and a
before-and-after pair has thrown that away.

## Decision: the engine answers with events

**Every engine answers a move with the position AND an ordered list of events.
The screen replays the list.**

`applyMove` returns `{ state, events }`. An event is a plain object with a
`type`: `lift`, `drop`, `store`, `capture`, `sweep`, `turn`, `extraTurn`,
`relayCutOff`, `gameOver`.

`playback.js` is pure and holds no clock:

```
snapshot(state)        -> the picture of a position
applyEvent(shown, e)   -> the picture after one event
applyEvents(shown, es) -> the picture after a whole move
```

`app.js` decides the pace (`paceFor`, scaled by the speed setting and set to
zero under reduced motion) and hands it to `render.js`, which owns the actual
waiting. `render.js` paints each pit from the snapshot rather than from the
animation, so a number on screen is never guessed.

This copies `akwaaba-monsters` ADR 0007, which reached the same design for the
same reason in a turn-based battle.

## Decision: the seeds of one lift fly together, not one at a time

The first version replayed the events strictly one by one: fly a seed, wait for
it to land, fly the next. It was wrong, and a player said so: "can you make the
balls move animated?".

The game this copies was measured frame by frame to find out why. One move
there runs for **2.85 seconds** and sows five seeds. Counting the seed pixels
in the wood between the pits, on every frame, gives the shape of it:

| Time into the move | Seeds in the air |
|---|---|
| 0.00s | 5 |
| 0.40s | 4 |
| 0.72s | 3 |
| 1.00s | 2 |
| 1.45s | 1 |
| 2.85s | 0 |

Every seed of the lift is in the air from the same moment. They fly as one
stream, and each one drops off at its own pit: the first into the next pit
along, the second into the pit after that, and the last one crosses the whole
distance. That is a hand sowing seeds, and it is why five seeds take five times
as long as one.

So `sowingLaps` in `playback.js` groups a move's events into laps, one per
`lift`, using the seed count the lift carries. `render.js` then launches every
seed of a lap at once and animates each along its own run of pit centres with
one call to `Element.animate`, so the browser keeps the stream in step. The
seed count in each pit still comes from the snapshot, applied as each seed
lands.

The pace is now **per pit crossed**, not per event: `BASE_GAP` is 560ms, near
the 570ms the measured game averages. The old value was 150ms for a whole
flight, so a seed crossed a pit in a tenth of a second, which reads as a jump.

## Decision: a seed starts and ends on a place a pit draws

The stream above still ended badly. A player said the seeds "teleport to snap
into their resting place", and they did: a flight ran from the middle of one
pit to the middle of the next, and the pit then drew the seed as a dot 14 to 25
per cent of a pit away from that middle. The flying seed vanished and the dot
appeared somewhere else, in the same frame.

So the places a pit draws seeds in are now the animation's own targets.
`seedLayout.js` holds them: twelve fixed places per pit, spread by the golden
angle, in the order the pit fills them. It is pure and tested, because the
animation now depends on it being exactly what the pit draws.

`restingPoint` in `render.js` turns place number *n* of a pit into pixels.
Seed *k* of a lift leaves place *k* of the pit it comes out of and lands on the
place its new pit is about to draw it in. Nothing moves when the flying seed is
replaced by the dot.

Three smaller parts of the same fix:

- The flying seed is `calc(var(--pit) * 0.14)` across, the size of a drawn one.
  It used to be a fixed `0.55rem`, so on a wide screen it also changed size as
  it landed. `--pit` moved from `.board` to `:root` for this, because the layer
  the seeds fly on is a sibling of the board and could not read it.
- The last leg of a flight slows down (`LANDING`), so a seed settles instead of
  stopping dead. Every earlier leg stays linear, so the stream keeps its pace.
- A dot that has just been drawn scales up from small (`seed-settle`), so the
  arrival has nothing sharp in it.

## Decision: the words come from the events too

The board now says what a move did, as it does it. `captions.js` is pure and
turns one event into the few words that pop up over the board (`+4`,
`Play again`) and the sentence for the status line. `render.js` puts the words
on the flying layer, over the pit or the store the event belongs to.

The words therefore have the same source as the numbers: the engine's event
list. The screen cannot congratulate a player on a capture the engine did not
report.

This also fixed a bug that had hidden every summary the game ever wrote. After
a move, `playMove` said whose turn it was, and that call overwrote the line
`summarise` had just written. `playMove` now announces the turn only when the
summary had nothing to say, and tells `queueAgent` to leave the line alone for
the same reason.

## Consequences

- The player sees the seeds move. A relay reads as a relay and a capture reads
  as a capture, because each seed leaves one pit and arrives in another.
- Nothing jumps when a seed lands. The cost is that `seedLayout.js` and the
  `.seed` rule in `style.css` are now one thing in two places: change where a
  dot sits in CSS and the flights aim at the old place.
- A skipped or reduced-motion move pops no words at all, because there is no
  moment to hang them on. The one summary line still reports the whole move.
- A move takes longer, on purpose: about 2.3 seconds for four seeds instead of
  0.8. The speed button therefore offers three paces, and the normal one is the
  slowest of them, as the same player asked.
- A seed passes pits it is not landing in. Its own first and last points sit on
  a pit, and the ones between are pulled halfway towards the board's middle
  (`CHANNEL_PULL`), so the stream flows down the wood instead of across pits it
  has nothing to do with. That is also what the measured game does: its seeds
  travel in the gap between the two columns.
- A long Ba-awa relay cannot have this pace. The last seed of a lap flies for
  one gap per seed sown, so forty seeds at 560ms would run for twenty seconds.
  `paceFor` shrinks the gap to hold a whole move inside `MOVE_BUDGET`, and
  never goes below `MIN_GAP`.
- A tap anywhere on the board still skips the rest. The seeds in the air are
  finished at once (`Animation.finish`) and every remaining event is applied,
  so the board is correct the moment the tap lands. The skip is checked before
  the tap is matched to a pit, because a player who wants to hurry the
  animation taps the board, not a pit.
- The engines stay pure and testable. They have no idea an animation exists.
- The picture and the engine can be checked against each other, and are:
  `playback.test.js` plays whole games in both rule sets and asserts that
  replaying a move's events onto the picture of the position before gives
  exactly the position the engine returned. That test caught a real gap. The
  `gameOver` event carried no `turn`, so the picture could not match the engine
  on the move that ended a game. The event carries it now.
- The event list is a second contract. An engine that adds an event type the
  playback does not know must not break the board, so `applyEvent` ignores what
  it does not recognise and the test above proves the picture still lands right.
- After every move the board is repainted from the engine's own position. A
  player who taps to skip the animation, or a tab that slept through it, still
  ends up looking at the right board.
