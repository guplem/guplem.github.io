# ADR 0029: A button that asks now, and says when it last did

## Context

The board asks GitHub again every minute on its own (ADR 0025). Two things were
still missing, and the second is the one that matters.

**No way to ask now.** Somebody who has just merged a pull request wants to see
the board move, and waiting out the rest of a minute for a thing they know has
happened reads as a board that is not listening.

**No way to tell a quiet morning from a board that stopped asking.** This is the
real cost of refreshing on a schedule. The board looks exactly the same when
nothing has changed and when it has not asked for an hour, and the reader has no
way to tell which. A tab restored from yesterday's session looks like today's
work.

## Decision

**A button beside the schedule, which asks GitHub now, whatever the schedule
says.** It works with the schedule off, which is the case it is most needed in.

**It says when the board last heard anything, and it says it at the moment the
reader asks.** The sentence is built on hover and on focus, never written once
when the button is drawn: a label reading "Refreshed just now" for an hour is
worse than no label, because it is an answer and it is wrong.

**It reports in the largest whole unit** ("Refreshed 5 minutes ago"), and
anything under ten seconds is "just now", because a number of seconds is noise
to somebody who pressed the button a moment ago. `describeLastRefresh` in
`messages.js` holds it and is tested, including the clock that moves backwards.

**It goes down when pressed and comes back up when the answer is in, or after a
second, whichever is later.** Both, not either:

- **Until the answer is in**, because the board cannot honestly say it has
  refreshed while it is still asking, and a second press would ask everything a
  second time and spend the rate limit twice.
- **At least a second**, because GitHub often answers in under a tenth of one.
  A button that goes down and up faster than the eye follows leaves the reader
  wondering whether it did anything, and inviting them to press it again is the
  opposite of what it is for.

The icon turns while it is down, so the wait is visibly the board working rather
than the button being broken. The turning stops for anybody who asked their
machine for less motion, because the reduced-motion rule already covers every
animation on the page.

**It is not a `.button-*` variant.** It carries no colour of its own and is worn
with `.button-outline`, which has the hover state. `invariants.test.js` asks
every `.button-*` for a hover, and it is right to, so the shape modifier is
named `.icon-only` rather than dodged around.

## Consequences

- **The reader can spend their own rate limit as fast as they like, but not
  faster than once a second.** Ten presses in a second would be ten full reads
  (ADR 0025 counts them), and the rest closes that off without a counter or a
  warning.
- **The sentence is the only place the board says when it last read.** It is not
  on the page, because a clock that is always on screen is a thing to watch, and
  the board is for work.
- **A press while a scheduled refresh is already running is refused.** The
  button is not down for those, because a quiet refresh is meant to go unnoticed
  (ADR 0025), so the press is turned away by the same check that would have
  stopped a second read. It is a window of well under a second, and the cost of
  the alternative is a second full read of everything.
