# ADR 0005: The screen keeps its own copy of the battle and trails the engine by one event

## Context

`takeTurn` in `battle.js` works a whole turn out at once. It returns the battle
as it stands when the turn is over, plus a list of events that say what happened
along the way. `app.js` plays those events back one at a time, so a message sits
on screen for about a second before the next one replaces it.

The picture did not follow. `drawBattle` read `game.battle`, which already held
the finished turn, so the screen showed the answer while the message box was
still reading out the question. A player saw:

- Both health bars fall at the same moment, while the box still said
  "Nacho used Tackle!". Nothing said which creature had done what.
- A creature swap arrive before the line that called the creature out.
- A poisoned badge appear before the line that named the poison.
- A beaten creature stay on the field, at zero health, until something else
  replaced it.

The report was that combat "feels off, not like Pokemon where the actions are
applied one after the other". Every one of those four is the same cause: one
copy of the battle, read by two things that need it at different speeds.

## Decision

**The battle screen keeps a second, slower copy of the battle, and moves it
forward one event at a time.**

`battlePlayback.js` holds two pure functions and no clock:

- `snapshotBattle(battle)` copies what the screen reads from a battle: both
  parties, which creature each side has out, and whether that creature is down.
  It leaves the random generator behind, so the copy is a plain value.
- `applyBattleEvent(shown, event)` returns the snapshot moved forward by one
  event. An event it does not recognise changes nothing, so `battle.js` can add
  an event without breaking the picture.

`app.js` draws the field, the creatures and the two panels from the snapshot.
The engine still holds the truth, and the menus still read it, because a menu
only opens once the queue is empty and the two agree.

Two rules keep the snapshot honest:

- **A message comes before the event that changes the picture.** `battle.js`
  pushes them in that order. The one exception is `faint`: the creature drops
  and the log then names it, the same as in the real games.
- **An event carries the value it lands on, not only the step.** `damage`
  carries the health that is left, `exp` carries the new total, `levelUp`
  carries the health a level gained. The snapshot never redoes the engine's
  arithmetic, so the two can never disagree about a rounding.

The screen also holds the next event back while a health bar is still sliding,
so a bar always lands before the line that talks about it.

## Consequences

**Good.**

- One thing happens at a time, and the message that describes it comes first.
- `battlePlayback.test.js` plays whole battles back and checks that the picture
  ends each turn showing exactly what the engine worked out. That property is
  what makes the delay safe: the screen is behind, never wrong.
- The engine stays pure and knows nothing about frames. The delay lives entirely
  in the screen, which is where the clock already was.
- A beaten creature now slides off the field, so the space it leaves says as
  much as the message does.

**Bad.**

- A turn takes longer to watch. That is the point, but it means a long battle
  is a long battle. A player can still press a button to cut any wait short.
- The event order in `battle.js` is now load-bearing. Push a `damage` before its
  message and the bug comes straight back. The tests in `battle.test.js` under
  "the order of the events" pin the rule, and the comment at the top of
  `battle.js` says why.
- A new event that changes the picture must be taught to `applyBattleEvent`.
  Forget, and the screen holds still until the turn ends and the snapshot is
  checked against the engine. That check is the safety net, not the design.
