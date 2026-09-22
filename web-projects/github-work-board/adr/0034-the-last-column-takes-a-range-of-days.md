# ADR 0034: The last column takes a range of days, and the range is in the link

## Context

The last column was "Done today" and could be nothing else: one constant,
midnight in the reader's clock, decided it (ADR 0017).

The board is read out loud at a standup, and a standup does not ask about
today. It asks **"what did you finish yesterday"**, and on a Monday it asks
about last week. Somebody preparing that recap had to open GitHub and search,
which is the thing this board exists to save them.

Two more days matter in practice: a day somebody was away, and the last working
day before a holiday. Neither is a preset anybody would name.

## Decision

**The last column takes a range of days, chosen on the column itself, and the
range travels in the link.**

- **A calendar press in the column heading opens a picker**, and the picker
  holds two things: three presets, **Today**, **Yesterday** and **The last 7
  days**, which are the ranges people ask for out loud; and two date boxes for
  any other pair of days. The boxes are `<input type="date">`, so the browser
  draws the calendar in the reader's own language, with their own first day of
  the week, and this page draws no calendar at all.
- **The heading says which days it is about**: "Done today", "Done yesterday",
  "Done in the last 7 days", "Done on Fri 18 Sep", "Done 15 Sep to 19 Sep". A
  single chosen day carries its weekday, because "last Friday" is how the
  question is asked. A heading that still said "Done today" while showing last
  week would be a lie, and it is the one column whose name is a claim about
  time.
- **Every boundary is midnight in the reader's own clock**, exactly as ADR 0017
  decided for today. `doneRange.js` owns every one of them now, and
  `workItems.startOfToday` is gone: one file decides where a day starts.
- **The range is in the link** (root ADR 0006), as `?done=yesterday` or
  `?done=2026-09-15..2026-09-19`, and today is left out because it is the
  default. So "what we finished yesterday" is one link somebody pastes into the
  standup chat. The written forms are permanent, like a sort id, and
  `invariants.test.js` pins them.
- **The range is not saved.** It is a question somebody is asking right now,
  not a setting: a board that opened on last Tuesday for ever, because
  somebody looked at last Tuesday once, would be wrong every day after.
- **Changing the range asks GitHub again**, because the window in the call is
  the range itself. The read is quiet: the board already holds a good answer
  for every other column, and drawing placeholders over all of them would make
  a change of days look like a reload (ADR 0029).
- **The call follows the pages.** ADR 0017 measured more than a hundred closed
  items in seven days on a real account, and left the under-report standing
  because the column only ever asked about one day. A range makes that reachable
  in one press, so `fetchFinishedWork` now asks for up to five pages and stops
  at the first page that is not full.

## Consequences

**An ordinary day still costs one call per token.** One page holds a hundred
items, and the loop stops as soon as a page comes back short, which for today
is the first one.

**A long range costs up to five calls per token, and stops there.** Five
hundred finished items is past what any column can show, and an unbounded loop
on somebody's rate limit is not a thing to ship. The column under-reports past
that, and never shows anything untrue.

**The picker is on the column, not in Settings.** It belongs to the one column
it changes, and a standup is not a moment for a trip through Settings.

**The other columns do not move.** They are about open work, which has no date
to pick. Only the last column is a log.

**An issue whose pull request merged today still reads as done in an older
range.** That column is filled from the second question, but ADR 0011 also
sends an issue to "Done" when GitHub says a pull request that closes it has
merged, and that answer carries no date the range could filter. It is rare, and
the alternative is to stop trusting a merge.

**Rejected: a date picker this page draws.** A range picker with two months and
keyboard support is a large piece of code, and every browser ships one behind
`<input type="date">`, translated already.

**Rejected: saving the range in `board.json`.** It would follow the reader to
every device and open there on a day they asked about once. The link is the
honest carrier for a question.

**Rejected: presets for "last week" as calendar weeks.** "The last 7 days"
answers the Monday standup, and a preset that means Monday-to-Sunday is a
different thing from what people say out loud on a Wednesday. The date boxes
cover anybody who wants exact weeks.

**Rejected: one "since" box without an end.** Somebody who types one date wants
that day, not everything since it. One end alone reads as that one day.
