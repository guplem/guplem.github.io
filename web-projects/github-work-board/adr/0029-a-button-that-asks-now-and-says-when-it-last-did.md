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

**It goes down for every read, whoever started it.** The reader's press, the
schedule (ADR 0025) and a tab coming back into view all turn the icon and hold
the button down until the answer is in. A scheduled read draws no placeholders
and writes no status line, so without this the board reads as idle while it is
asking, and a press in that window spends the rate limit on a second read of
the same thing. One function in `app.js`, `renderRefreshBusy`, writes that
state from one place: a press and a schedule that each set the button
themselves drift apart, and the one that loses leaves it down for good.

**A press also holds it down for a second, and comes back up when the answer is
in or after that second, whichever is later.** Both, not either:

- **Until the answer is in**, because the board cannot honestly say it has
  refreshed while it is still asking, and a second press would ask everything a
  second time and spend the rate limit twice.
- **At least a second**, because GitHub often answers in under a tenth of one.
  A button that goes down and up faster than the eye follows leaves the reader
  wondering whether it did anything, and inviting them to press it again is the
  opposite of what it is for.

The icon turns and the button greys out while it is down, so the wait is
visibly the board working rather than the button being broken. The half
opacity every disabled button wears was almost nothing on a thin outline
button, so the grey background carries the signal a plain press could not. The
turning stops for anybody who asked their machine for less motion, because the
reduced-motion rule already covers every animation on the page.

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
- **A press while a scheduled refresh is already running is refused, and the
  button says so rather than looking broken.** It is down and turning for the
  whole of that read, so the refusal is visible before the press instead of
  after it. This is the one thing a scheduled read is not silent about
  (ADR 0025): everything else about it stays quiet.
- **The button is the board's only "reading now" sign, so it must always come
  back up.** `connectAll` gives it back in a `finally`, which means a read that
  fails halfway leaves a working button rather than a board that can never ask
  again.
