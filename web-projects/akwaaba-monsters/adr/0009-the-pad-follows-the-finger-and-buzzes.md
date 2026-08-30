# 0009. The pad follows the finger, and the phone buzzes for every press

## Context

The touch pad under the screen started as six HTML buttons, each with its own
`pointerdown` and `pointerup`. That is the obvious build, and it plays badly.

A thumb on a cross does not lift between arrows. It slides: left, through the
empty corner, then down. Per-button events cannot see that slide. A touch screen
gives the first button an implicit pointer capture, so every later move goes to
that one button and no neighbour ever hears a `pointerenter`. The player pressed
left, slid to down, and kept walking left.

A glass screen also tells a thumb nothing. On a real handheld the key moves and
the finger feels it. The player had to look at the pad to trust a press, and
looking at the pad means not looking at the game.

## Decision

**The pad tracks fingers, not buttons.** One `pointerdown` on any pad button
starts a finger. `pointermove` and `pointerup` are heard on the window, and
`padActionAt` in `ui.js` says which button that finger is over now.

Four rules hold it together:

1. **A finger keeps the cluster it started in.** The four arrows are one
   cluster, the two round buttons are the other. A slide can move between
   arrows. It can never wander from an arrow onto A.
2. **The empty corners of the cross belong to the nearest arrow.** A slide from
   up to right crosses one corner, and a corner that presses nothing would drop
   the walk halfway through the turn. The same slack reaches half a key past the
   outer edge, for a thumb that overshoots.
3. **The implicit pointer capture stays.** Releasing it would send the moves to
   whatever the finger is over, which is often the canvas and its own drag
   handler. `padActionAt` hit tests by hand, so the capture costs nothing and
   guarantees the release arrives.
4. **`app.js` paints the pressed look with a `.pressed` class.** The capture
   pins CSS `:active` to the button the finger landed on, so `:active` alone
   would light the wrong arrow for the whole slide.

**Every press asks the phone for a 12 millisecond buzz.** `haptics.js` wraps
`navigator.vibrate`, remembers an on or off setting in `localStorage` next to
the mute setting, and never throws. The pad, the map hotspots, a turn of the
drag-to-walk stick and a tap that talks all buzz. A mouse never does.

The Options screen grows a **Vibration** row, and shows it only where the
browser can vibrate.

## Consequences

- A thumb can walk a whole route without lifting, which is how the pad on a real
  handheld works.
- `padActionAt` and `optionRows` are pure and tested. `app.js` keeps only the
  measuring and the events, which is the line this project already draws.
- The slack is half the smallest button in the cluster, so a layout that grows
  the pad grows the slack too and nothing needs a second number. See ADR 0006:
  the three layouts each size the pad differently.
- Most browsers ignore `navigator.vibrate`. Every iPhone does, and so does
  almost every desktop. Nothing in the game may depend on a buzz, and the
  Options row hides itself rather than offering a setting that does nothing.
- A new button on the pad must sit inside `.dpad` or `.buttons` to join a
  cluster. A button outside both becomes a cluster of one, which still works but
  cannot be reached by a slide.
