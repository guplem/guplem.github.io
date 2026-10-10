# ADR 0020: A card says which stack it is in, and where

## Context

"Pull requests waiting for your review" is a flat row of cards from other
people. Three of them are often one stack: somebody split a change into a base,
a middle and a top, and asked for a review on all three at once.

Nothing on the card said so. The row gave the reader four cards with no sign
that three of them have a forced order, and no sign of which to read first.
Reviewing a stack out of order is wasted work twice over: the top carries the
commits of everything below it, so it reads as a much bigger change than it is,
and a comment on the bottom can invalidate the review of the top.

The board's own cards were thought not to have this problem: the smart order
already reads a stack bottom-first (ADR 0016), and a column shows that order.
The review row was sorted by age alone, and a stack is not an age. (The row now
reads its stacks in merge order too, under the smart order. The badge stayed,
because the order alone never says how many there are or which one this is.)

**That was wrong, and the board wore it for months** (2026-09). An order is not
a statement: a column holds cards in several states, the reader scrolls one
column and not the board, and a stack's cards can sit in two different columns
because the column comes from each pull request's own state. So the same pull
request said "Stack #5073 - 2 of 3" in the review row and said nothing in a
column.

## Decision

**A badge on the card: `Stack #5073 · 2 of 3`, in the review row and in
the columns alike** (`2a of 2` when the stack branches, see Consequences).
It names the stack by the number of its bottom, which is the one that merges
first, and says where this one sits counting from that bottom.

- **Only what the reader was given is counted.** `stackPositions` reads the list
  it is handed and nothing else. Somebody who asked for a review on two of
  their three produces a row holding two, and "1 of 2" is the truth about the
  row in front of the reader. Counting a third they cannot see would be a badge
  about somebody else's screen.
- **Each list counts itself**, so the board works its badges out over the
  board and the review row over the row. Two lists, two truths, and each badge
  is the truth about the list it sits in. The light is worked out the same way,
  list by list, so it always lights the stack the badge names (ADR 0027).
- **The badge goes on the pull request's own card, wherever that card is.** A
  pull request nested under the issue it closes carries it there, because that
  is the card the stack is about. The issue above it lights up with the stack
  even so: in a column the card the reader points at is the outer one, and
  lighting a small box inside a card instead of the card answers nothing
  (ADR 0027).
- **A pull request standing on its own gets no badge.** "1 of 1" on every card
  is noise on every card.
- **The stack is read from the branches**, like everywhere else: a pull request
  is stacked under the one whose head branch it targets (ADR 0016). A "depends
  on #4979" in a description is a guess (ADR 0010).
- **The badge has its own colour**, not the label colour, because it describes
  the shape of the work rather than the work.

## Consequences

**Review items go through `applyPullRequestState` now.** They did not: only the
board's own items did, so a review card carried no branch names and could not
know it was stacked. They come from a different endpoint in a different shape
(ADR 0013) and were the only list skipping that step.

**A stack that branches gives each pull request on a shared level a letter**
(2026-10). The badge first counted depth from the bottom over the size of the
whole tree, so two pull requests based on the same branch were both "2 of 3".
That was meant to be rare. It was not: one base with eight pull requests on it
put eight identical "2 of 9" badges on the board. Now:

- `position` still counts levels from the bottom. A level that holds more than
  one pull request adds a letter: `2a`, `2b`, `2c`. Past `z` the letters go on
  as `aa`, `ab`.
- The letters count across the whole level, not per parent. Per parent, two
  branches would both hold a `3a`, and the badges would match again.
- The letters run in merge order (`orderStacksForMerging`), so the pull requests
  on one parent sit side by side.
- The number after "of" is the levels, not the pull requests: "2a of 9" would
  say there are nine levels. In a straight stack the two are equal, so a
  straight stack reads as it always did.
- The tooltip carries the rest: the count of pull requests in the stack, how
  many share the level, and which pull request this one targets.

`describeStackPosition` in `stacks.js` writes the words, so a test pins them.
Naming the branch on the badge would answer exactly, but the badge has no room
for it.

**Rejected at first, and then done: sorting the review row so a stack reads
bottom-first.** The reasoning here was that the row answers one question, how
long something has waited, and that the badge could say the merge order without
taking that sort away. It does not work. The badge and the order then give the
reader two different answers at the same time, and the order is the louder one.

The smart order also says what it does in its own name, "Smart (oldest, stacks
in merge order)", and the row was not doing the second half. ADR 0016 now runs
the stack pass on the row as well. Every other order still gives the row a pure
date order, so nobody who asked for a date order lost one. **Rejected: naming the
stack by its branch.** A branch name is long, and the bottom's number is
already a link the reader can follow.
