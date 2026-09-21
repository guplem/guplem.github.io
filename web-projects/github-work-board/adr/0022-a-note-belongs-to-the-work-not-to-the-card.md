# ADR 0022: A note belongs to the work, not to the place the card sits

## Context

"Pull requests waiting for your review" took no notes. Two things stopped it,
and both were written on purpose:

- A CSS rule, `.reviews-list .note { display: none }`, with the comment *"a
  review card carries no note box: it is somebody else's work, and the note
  belongs on the thing you are doing."*
- ADR 0013 said the same in words: *"The cards carry no note box and no move
  menu. A note belongs on your own work."*

That reasoning was wrong, and the reader said so. "Ask about the migration
before approving" is exactly the kind of thing worth writing down, and the
place to write it is against the pull request it is about. A review is work,
and a note about it is a note about work.

A second thing had gone wrong quietly. The card menu decided its rows with
three conditions written into `app.js` one at a time, and the newest of them
gated the note row on the same flag as the move row. So a note stopped being
addable from anywhere but the columns, including from a pull request nested in
its issue, and no test said a word.

## Decision

**A note is filed under the item's node id, so it belongs to the work rather
than to the place the card is drawn.** Every card takes one: a column, the
review row, and a pull request nested inside its issue.

**Which rows the menu offers is one pure function**, `cardMenuRows`, with a
test that states all three answers:

| Row | When |
|---|---|
| Add note | Every card |
| Copy branch name | A pull request |
| Move to | A card that sits in a column |

**"Move to" stays out of the review row.** That has nothing to do with whose
work it is: the row is ordered by how long a review has waited, and nothing in
it sits in a column to be moved between (ADR 0012).

## Consequences

**ADR 0013 is corrected rather than left standing.** It said the cards carry no
note box; they do now, and the half of that sentence about the move menu is
still true for its own reason.

**A note on somebody else's pull request is still only yours.** It goes to the
same private file as every other note (ADR 0001), and nothing on GitHub shows
it. Nothing about the storage changed, which is why nothing about the storage
needed changing: the key was always the node id.

**The three menu answers now have one home and one test.** They were the kind
of thing that drifts: each was right when it was written, and together they
said something nobody had decided.

**Rejected: a note box on a review card by default.** ADR 0014 stands. The box
appears where a note exists, or where the reader asked for one from the menu,
on every card alike.
