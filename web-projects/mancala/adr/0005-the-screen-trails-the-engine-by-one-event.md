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

## Decision

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
waiting: it walks the events, flies one seed element per drop at that pace,
and paints each pit from the snapshot rather than from the animation, so a
number on screen is never guessed.

This copies `akwaaba-monsters` ADR 0007, which reached the same design for the
same reason in a turn-based battle.

## Consequences

- The player sees the move happen. A relay reads as a relay, and a capture
  reads as a capture, because each seed leaves one pit and arrives in another.
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
- The pace has to come from the number of events, not from a fixed delay per
  seed. `paceFor` in `playback.js` shortens the wait as a move gets longer, so a
  thirty-seed relay does not take thirty times as long as a one-seed move.
- After every move the board is repainted from the engine's own position. A
  player who taps to skip the animation, or a tab that slept through it, still
  ends up looking at the right board.
