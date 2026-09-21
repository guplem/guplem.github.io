# ADR 0023: The order goes to the top, and the header scrolls away

## Context

Two things, one line apart on the screen.

**The order was in the middle of the page.** "Sort by" sat beside "Your issues
and pull requests", under the review row, which is where it ended up when the
headings were added (ADR 0018) rather than where anybody looks for it. A
control that changes the whole board belongs at the top of the board.

**The header was sticky, and the reason had gone.** ADR 0008 pinned it there
because Settings was taller than a window, about 1900 pixels against 840, and
the only way out sat at the top: scrolling once put the exit out of reach with
nothing below it to press.

That is no longer the shape of the screen. The token guide moved to its own
view (ADR 0018) and Settings shrank with it. Measured now, in a window 898
pixels tall:

| Screen | Height |
|---|---|
| Board | 983 |
| Settings | 1067 |
| Add a token | 2110 |

Settings is a screen and a bit. The one screen still meaningfully longer is
the add-token guide, and it carries its own **Cancel** at pixel 1761, at the
end of the last step, which is exactly where a reader who read it ends up.

So the sticky header was buying a control that is always reachable on screens
that no longer need one, and charging every screen a strip of vertical room for
it. The reader said it added nothing. It does not.

## Decision

**"Sort by" moves into the masthead**, beside the way to Settings, at the top
of the page. It belongs to the board, so it is hidden on Settings and on the
add-token screen, the same way the Settings button is hidden before the first
connection.

**The masthead scrolls with the page.** `position: sticky`, the `is-stuck`
border and the scroll listener that set it are all gone.

**What has to stay true is the exit, not the stickiness.** The invariant that
pinned `position: sticky` now pins that every screen carries a way back, and
that the long one carries a second one at its end.

## Consequences

**Every screen gains back the strip the header was holding**, including the
board, where ADR 0008 already noted nothing needed it.

**Changing the order means scrolling to the top.** On a board of 983 pixels
against a 898 pixel window that is barely a scroll, and the order is a thing
somebody sets and leaves.

**ADR 0008 is corrected in place.** Its reasoning was right about the screen it
described, and that screen no longer exists. The half of it that still stands
is that one control moves between the views and no screen carries a second one.

**This is undone by re-adding two CSS lines**, if Settings ever grows back past
a screen. The measurement above is the thing to check first, not the feeling.

**Rejected: keeping the header sticky and moving only the order.** The reader
asked for it gone, and the measurement agrees.
**Rejected: leaving the order where it was.** It changes everything below it
and sat below half of it.
