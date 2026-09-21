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
| REST `core` | 5000 an hour | 5 calls: who you are, open work, work closed today, the board repository, the board file |
| REST `search` | 30 a **minute** | 1 call: the pull requests waiting for your review |
| GraphQL | 5000 points an hour | 1 call: the links between items |

The board holds a list of tokens, not one (ADR 0007), and a refresh asks every
one of them. So the cost is seven calls per token, per refresh.

Two tokens on the shortest schedule spend 1200 of the 5000 core calls an hour,
4 of the 30 search calls a minute, and 240 of the 5000 GraphQL points an hour.
The tight budget is `search`, because it is counted per minute and not per
hour. It is what decides the shortest schedule the board offers, and
`refresh.test.js` holds that arithmetic as a test.

## Decision

**The board asks again on a schedule the reader picks: off, 30 seconds, one
minute, or five minutes.** Off is the default, because a refresh spends the
reader's rate limit and nobody should pay for a feature they did not ask for.

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
  next to the order at the top of the page, and off is where it starts.
- The schedule does not follow the reader to another machine. That is the
  trade, and it is deliberate: see the decision above.
- `cache: "no-cache"` is one word, is invisible when it is removed, and the
  damage is silent (a board up to a minute stale, with every test green). It has
  an invariant test naming this ADR.
- The search budget is the ceiling. At 30 seconds a reader can hold ten tokens
  and stay inside it. A shorter schedule, or a token list far longer than
  anybody has, would need that arithmetic done again.
