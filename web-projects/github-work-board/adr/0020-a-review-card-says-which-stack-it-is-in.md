# ADR 0020: A review card says which stack it is in, and where

## Context

"Pull requests waiting for your review" is a flat row of cards from other
people. Three of them are often one stack: somebody split a change into a base,
a middle and a top, and asked for a review on all three at once.

Nothing on the card said so. The row gave the reader four cards with no sign
that three of them have a forced order, and no sign of which to read first.
Reviewing a stack out of order is wasted work twice over: the top carries the
commits of everything below it, so it reads as a much bigger change than it is,
and a comment on the bottom can invalidate the review of the top.

The board's own cards do not have this problem: the smart order already reads a
stack bottom-first (ADR 0016), and a column shows that order. The review row was
sorted by age alone, and a stack is not an age. (The row now reads its stacks in
merge order too, under the smart order. The badge stayed, because the order
alone never says how many there are or which one this is.)

## Decision

**A badge on the card: `Stack #5073 · 2 of 3`.** It names the stack by the
number of its bottom, which is the one that merges first, and says where this
one sits counting from that bottom.

- **Only what the reader was given is counted.** `stackPositions` reads the row
  it is handed and nothing else. Somebody who asked for a review on two of
  their three produces a row holding two, and "1 of 2" is the truth about the
  row in front of the reader. Counting a third they cannot see would be a badge
  about somebody else's screen.
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

**A branching stack is described loosely.** Two pull requests based on the same
branch are both "2 of 3", because `position` counts depth from the bottom and
`size` counts the whole tree. A branching stack is rare and the badge is still
true about what has to merge first; an exact answer would need to name the
branch, and the badge has no room.

**The board's own cards still have no badge.** The columns plus the smart order
already carry a stack's order there, and the badge would repeat it on every
card. It is worth adding the day somebody reads a column without the smart
order on.

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
