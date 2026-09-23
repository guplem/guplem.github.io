# ADR 0025: The board asks again on a schedule this browser keeps

## Context

The board read GitHub once, when it connected. Anything that happened after
that was invisible until the reader reloaded the page. A board that is open all
day is exactly the board that goes stale.

Asking again is not free. GitHub counts every call against three separate
budgets, and each one was measured against the live API rather than read from a
guide:

| Budget | Limit | What one refresh spends, per token |
|---|---|---|
| REST `core` | 5000 an hour | 3 calls: who you are, open work, work closed today |
| REST `search` | 30 a **minute** | 1 call: the pull requests waiting for your review |
| GraphQL | 5000 points an hour | 1 call, or 2: the links between items, then the children of any issue that has them |

The board holds a list of tokens, not one (ADR 0007), and a refresh asks every
one of them. So the cost is five calls per token, per refresh, and six when
something on the board has children.

Two tokens on the shortest schedule spend 720 of the 5000 core calls an hour,
and 4 of the 30 search calls a minute. The tight budget is `search`, because it
is counted per minute and not per hour. It is what decides the shortest
schedule the board offers, and `refresh.test.js` holds that arithmetic as a
test.

**GraphQL is charged differently: by size, not by call.** Its points come from
how much a query could return, so its bill is set by the `first:` numbers in
the query rather than by how often the board asks. Both numbers here were
measured with `rateLimit(dryRun: true)` on the board's own query, at the
largest batch it ever sends, which is 100 items:

| The call | Points |
|---|---|
| The links, asking for 20 closing pull requests each | 42 |
| The links, asking for 5 | 12 |
| The links, as the query stands today, re-measured on 2026-09-23 | 18 |
| The second call, about the children, one batch at most | 18 |

So a refresh costs at most 36 points for a token, and the shortest schedule
spends 4320 of the 5000 points an hour. The first row is what the query used to
cost: cutting the closing pull requests from twenty to five is what paid for
the children, and nothing reads past the merged one or the first open one
(ADR 0010). `refresh.test.js` holds this arithmetic as a test too.

**Measure the cost again whenever the query grows a field.** The third row read
13 for a year, because fields were added and nobody asked GitHub again. The
cost comes from the query alone, so `rateLimit(dryRun: true)` answers it
without a real board and without a real token's data.

## Decision

**The board asks again on a schedule the reader picks: off, 30 seconds, one
minute, or five minutes.**

**It asks every minute unless the reader says otherwise.** The board shipped
with this off, so that nobody paid for a feature they had not asked for. That
was the wrong default. A board left open is exactly the board that goes stale,
and a reader cannot tell a quiet morning from a board that stopped asking. The
cost is small and it is now measured rather than guessed.

**A minute, and not 30 seconds.** The board also asks the moment a hidden tab
is looked at again, so returning to the board is always fresh whatever the
schedule says. The interval decides only how fresh the board stays **while
somebody watches it**, and work does not move in 30 seconds. What a minute buys
is the case that decides it: a board left open on a second screen all day, which
is how this board is meant to be used. A tab that is visible all day at 30
seconds spends 600 REST calls an hour for each token, so three tokens spend 36%
of the hourly budget, and the same board open on a second machine doubles that.
At a minute the same reader spends 18%, and 30 seconds is one choice away for
anybody who wants it.

A hidden tab still spends nothing at all, whatever the schedule.

**The schedule lives in this browser, not in the board file.** This is the one
place where the board splits from ADR 0024. How the board looks travels with
the reader, because a reader wants the same board on every machine. How often
this browser asks GitHub is not that: it decides what one device spends of a
budget that is shared, and a laptop on a train can want a different answer from
a desk. Two costs settle it. A choice in `board.json` is a git commit in the
reader's repository every time they flip the dial, and the dial is flipped far
more often than a theme is. And the schedule is not in the address bar either,
unlike the order (ADR 0006): a link is shared, and how often somebody else's
browser asks GitHub is not the sharer's to choose.

**A refresh is quiet.** It draws no placeholders and skips the "Reading
GitHub..." status line. The skeleton rule (ADR 0004) is about a list that has
nothing in it yet, so the reader is not left looking at a gap. That is not this
case: the board already holds a good answer, and it is replaced in place by
another good answer. Wiping five columns to placeholders every 30 seconds
would be the opposite of what the rule is for.

**Quiet is not invisible: the refresh button turns while it reads.** It is one
icon in one corner, it holds the reader's own press off a read that is already
running, and it is what tells a board that is asking apart from a board that
has stopped (ADR 0029).

**A refresh is skipped rather than queued** when it would interrupt the reader
or race a save. Four cases: the tab is out of sight, the board is already
reading, a note box or a menu is open under the reader's hands, or a save is on
its way to GitHub. The last one is the one that would corrupt something: a save
re-reads the board file, merges it and writes it back (ADR 0002), so a refresh
landing in the middle would replace the document that save is working from.

**The timer ticks every 5 seconds and acts rarely.** The tick is a cheap
question in memory. A tab that comes back into view also asks it at once, so it
catches up immediately instead of waiting out most of an interval.

**Every call tells the browser to revalidate rather than answer for itself.**
GitHub answers an authenticated REST call with `Cache-Control: private,
max-age=60`. Left alone, the browser serves its own copy for that whole minute,
so a board set to refresh every 30 seconds would show the same answer twice and
look broken. `gateway.js` sends `cache: "no-cache"` on every call.

`no-cache` is not `no-store`, and the difference is the whole point. The browser
keeps its copy and asks GitHub whether it is still good, sending the `ETag` it
already holds. GitHub answers `304 Not Modified` when nothing changed, the
browser hands over the copy it had, and **a 304 costs nothing against the rate
limit** (measured: the `used` counter did not move across two conditional
calls). So the board is both more correct and cheaper than it would be without
this line.

## Consequences

- A board left open shows work that arrives from somewhere else, without a
  reload.
- The reader pays for it in rate limit, and can see the price: the schedule sits
  next to the order at the top of the page, and one choice turns it off.
- **"Off" is not "the default", and the code says so.** Both were the string
  `"off"` at first, and `applyAutoRefresh` compared the reader's choice with
  `DEFAULT_REFRESH` to decide whether to run a timer. That read correctly only
  while the default was off. The day the default became a real schedule, the
  line inverted: no timer on the default, and a useless timer on "off". Every
  test stayed green, because no test runs `app.js`. `refresh.js` now exports
  `OFF` as its own name, and an invariant fails if `app.js` compares a schedule
  with the default again.
- **A schedule this build cannot read is treated as no choice**, so it falls
  back to the default rather than to off. Reading it as off would quietly
  switch off a feature the reader had switched on, which is the worse of the two
  mistakes. A call to `refreshDue` that says nothing about the schedule still
  asks nothing, because "nobody told me" and "nobody has chosen yet" are
  different questions.
- The schedule does not follow the reader to another machine. That is the
  trade, and it is deliberate: see the decision above.
- `cache: "no-cache"` is one word, is invisible when it is removed, and the
  damage is silent (a board up to a minute stale, with every test green). It has
  an invariant test naming this ADR.
- The search budget is the ceiling. At 30 seconds a reader can hold ten tokens
  and stay inside it. A shorter schedule, or a token list far longer than
  anybody has, would need that arithmetic done again.

> **Note (2026-09):** a refresh no longer checks the board repository or reads
> the board file. The shared cloud storage owns that check and runs it on its
> own schedule, not this one (root ADR 0016). The budget table and the
> per-token totals above count only what a work token still asks for.
