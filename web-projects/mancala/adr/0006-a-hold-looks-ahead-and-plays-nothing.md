# ADR 0006: A hold looks ahead, the engine answers the look, and the release plays nothing

## Context

Both games ask the player to count. A Kalah move sows up to thirteen seeds and
the whole point is where the last one falls: in your own store you play again,
in an empty pit of your own row you take the pit facing it. A Ba-awa move
relays, so its last seed can land four or five lifts later, on the far side of
the board.

A player counting pits with a finger gets it wrong, and the only way to find out
used to be to play the move. Nothing can be taken back: `applyMove` is the move.

The engine already knew the answer. `describeMove` plays the move on a copy and
reports what it would do, and the weaker opponents were the only callers.

## Decision

**Hold a pit and the board marks the pit its last seed would land in. The
engine answers the question, and letting go plays no move.**

Three parts.

**1. The engine answers it.** `describeMove` now also reports `lands` (the pit
the last seed comes to rest in) and `landsInStore` (the store it falls into
instead), and both engines answer the same fields. The screen marks what the
engine says. It never walks the board itself, so a mark cannot disagree with
the move that follows: the same call decides both.

**2. A hold is a look, not a slow tap.** A press longer than `HOLD_MS` (240ms)
opens the look, and the click that ends that press is swallowed. A quick tap
still plays the move.

**3. Every input gets the same look.** A mouse resting on a pit for `DWELL_MS`
(380ms) opens it, because a mouse has no natural hold. A pit reached with the
keyboard opens it at once, because a keyboard cannot hold anything down;
`:focus-visible` is what tells a keyboard focus from a mouse press, so a click
does not flash a look on its way to playing the move.

The marks are three: a ring inside the pit being looked at, a white glow around
the pit its last seed would land in, and the same glow on a store. The status
line says it in words as well (`previewText` in `captions.js`), because a
Ba-awa relay also wants to say how many times it lifts and how much each player
would take.

## Alternatives considered

- **Release plays the move.** One gesture, and the player who looks does not
  have to tap again. Rejected: a player who holds a pit to see what it does has
  not decided to play it, and the answer is often "not that one". A look that
  commits is not a look.
- **Mark the landing pit on hover only.** It works on a desktop and does not
  exist on a phone, which is where this game is played.
- **Walk the board in the screen code.** It would avoid running a whole Ba-awa
  relay twice, once for the look and once for the move. Rejected: the screen
  would then hold a second copy of the rules, and the two would drift. A relay
  is a few hundred steps at worst, which is nothing next to what the searching
  opponents run for every move.
- **Show it always, for every legal pit at once.** Twelve marks is not a hint,
  it is a diagram, and it takes the counting out of a counting game.

## Consequences

- A slow tap does nothing. That is the one cost, and it is the same on a mouse
  and on a finger, so it is at least predictable.
- The look shows only what a legal move would do. `openPeek` checks
  `legalMoves` first, so a pit that cannot be played says nothing.
- The screen runs a whole move to draw a hint. `describeMove` copies the state,
  so nothing it does can touch the position on the board; the engines' own
  tests prove `applyMove` never changes what it is given.
- The board must not answer a long press with a text selection or a callout, so
  `.board` sets `user-select: none`, `-webkit-touch-callout: none` and
  `touch-action: manipulation`.
- A screen reader gets the same information: the landing pit's label ends with
  "the last seed lands here", and the status line is a live region.
- The marks avoid `transform`, because `.pit--playable:hover` already sets it
  and would win over a plain class. The landing marks still use `box-shadow`
  for the glow; each rule sits after `.pit--playable` in `style.css`, so its
  shadow wins there instead.
