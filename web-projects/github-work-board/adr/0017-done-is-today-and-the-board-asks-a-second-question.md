# ADR 0017: "Done" is today, and it takes a second question

## Context

The "Done" column was always empty, and it could not be anything else.

The board asks GitHub one question: `GET /issues?filter=assigned&state=open`.
**Open.** A merged pull request is closed, so it never arrived. A closed issue
never arrived either. The only way a card could reach "Done" was an open issue
whose linked pull request had merged, which lasts the few seconds between the
merge and `Closes #N` closing the issue.

So the column was a promise the data could not keep. Two ways out: take it off
the board, or ask a second question and make it true.

**How much finished work is there?** Measured against the real account this
board was built for, on an ordinary day:

| Window | Items closed |
|---|---|
| 1 day | 13 |
| 3 days | 43 |
| 7 days | over 100 (the page limit) |

The open board holds about 16 cards. A week of finished work would be six times
the whole board, and the column would stop being readable at all. That number
decided the window, not taste.

## Decision

**Keep the column, name it "Done today", and ask a second question to fill it.**

> **Note (2026-09):** the column now takes a range of days, chosen on the
> column itself and carried in the link, because a standup asks about
> yesterday and not about today. Today is still the default and every rule
> below still holds; where this page says "midnight" or "today", read "the
> start of the chosen range", which `doneRange.js` works out in the same
> clock. ADR 0034 holds that decision.

- `fetchFinishedWork(token, since)` asks
  `GET /issues?filter=assigned&state=closed&since=<midnight>`, once per token,
  beside the question the board already asks.
- **Midnight in the reader's own clock**, not UTC. A board opened at half past
  midnight in Barcelona must not still be showing yesterday's work as today's.
- **`since` is not enough on its own.** It filters on when a thing was last
  touched, not on when it closed, so the answer holds work closed months ago
  that somebody commented on this morning. `finishedBetween` narrows it to the
  truth, at both ends.
- **Only finished work counts.** A pull request closed without merging is
  abandoned, not done, and reporting it as done would claim work that never
  shipped. ADR 0011 already said a closed unmerged pull request counts for
  nothing; `finishedAt` answers `""` for it, so it never reaches the board.
- **"Done today" reads newest first, whatever order the reader chose.** Every
  other column is a queue of work to pick up, so the chosen order decides it.
  This one is a log of what landed, and the useful end of a log is the thing
  that just landed. A card moved there by hand carries no moment, so it goes
  last rather than disappearing.

## Consequences

**The board makes one more call per token, every refresh.** It is the same
endpoint and the same permission, so nothing to grant and nothing to regenerate.

**The count line grows.** It says what is on the board, and today's finished
work is now on the board. That is the honest reading; a count that quietly
skipped a whole column would be worse.

**"Done today" is empty first thing in the morning**, and that is a different
kind of empty from the one this fixes. It fills as the day goes, and it says
what it means. The old column was empty at four in the afternoon after a day of
merging, which is the one that could only be read as broken.

**The window was one constant, and is now the reader's** (2026-09, ADR 0034).
The measurement above is why a week is not the *default*, and it is why the
call had to learn to follow pages before a week could be asked for at all.

**A day with a lot of merging can outgrow one page**, and a week of it can
outgrow five. The call takes `per_page=100` and now follows up to five pages,
stopping at the first short one (2026-09, ADR 0034). Past five hundred finished
items the column under-reports; it never shows anything untrue.

**Rejected: removing the column.** It is the cheapest fix and it throws away the
end of the board. A work board with no "finished" is a board that never closes
a loop, and moving a card to "Done" by hand stops having anywhere to go.
**Rejected: a week.** Measured: over a hundred cards, six times the rest of the
board. **Rejected: the last 24 hours instead of today.** "Today" is the thing a
person actually asks about, and a rolling window makes a card leave the board at
an hour nobody can predict. **Rejected: reading `merged` from GraphQL.** REST
already carries `merged_at` inside `pull_request`, so the extra call would buy
nothing.
