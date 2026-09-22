# ADR 0016: The smart order is oldest first, with each stack in merge order

## Context

The board opened on "recently updated". That is the wrong way round for
clearing work: the thing touched five minutes ago is the thing already in hand,
and the thing waiting three weeks is the one nobody is looking at. The review
row worked this out first and already defaults to oldest first (ADR 0013).

Oldest first has one failure, and it is not small. A **stacked** pull request
targets another pull request's branch instead of the main one, so the lower one
has to merge first. That order is not a preference; it is the only order the
work can land in. And a stack usually looks exactly wrong under oldest first,
because the top of a stack is written first and then sits untouched while the
ones below it are reviewed and rebased.

A real three-deep stack, taken from the repository this board was built for:

| Pull request | Targets | Last touched |
|---|---|---|
| #5073 | `main` | 21 Sep 09:29 |
| #5082 | #5073's branch | 21 Sep 09:35 |
| #5083 | #5082's branch | **17 Sep 16:52** |

Oldest first reads **#5083, #5073, #5082**: the one that must merge last is at
the top of the list, and the list gives the reader no sign of it.

## Decision

**A "Smart" order, which is oldest first with one rule laid over it: a stack
reads in the order it can merge.** It is what the board opens on.

- **A stack is read from the two branch names**, and from nothing else. A pull
  request is stacked under another when its `baseRefName` is that one's
  `headRefName`, in the same repository. "Depends on #4979" in a description is
  a guess: it misses every stack nobody wrote a sentence about, and invents one
  from any sentence with a number in it (ADR 0010 already forbids this).
- **A stack sits where its bottom sat.** The top of a stack cannot merge until
  the bottom does, so a top that has waited a long time is not work anybody can
  pick up: the stack is only as old as the pull request that can merge next.
  Anything in no stack does not move at all.

  The case that settled this, with the year standing for the last update:

  | Card | Last touched | |
  |---|---|---|
  | A | 2015 | |
  | B | 2016 | the top of a stack |
  | C | 2017 | |
  | D | 2018 | its bottom |

  Oldest first alone reads **A, B, C, D**, and B cannot be merged. The answer
  is **A, C, D, B**: the stack waits for D's turn, then reads in merge order.
  Take D off the board and B stops being the top of anything, so it goes back
  to its own place: **A, B, C**.
- **The pass runs on the grouped board, not on the list of items.** A pull
  request travels inside the card of the issue it closes, so the card is what
  moves. A group publishes every branch its pull requests add, and wants every
  branch they target.
- **Only "Smart" does this.** Every other order says what it does in its own
  name and has to keep doing exactly that. Somebody who picks "Least recently
  updated" asked for a date order, not a clever one.

`stacks.js` holds it, and it is pure. `sorting.js` gains `smart` as an id,
which compares exactly like `updated-asc`; the stack pass is the rest of it.

## Consequences

**The board opens on a different order than before.** `DEFAULT_SORT_ID` moved
from `updated-desc` to `smart`. Every saved link still works: a link carrying
`?sort=updated-desc` says so, and a link with no `sort` at all was always
"whatever the default is".

**The top of a stack can sink a long way down the board.** That is the point.
It looks like the oldest thing there and it is the one piece of work nobody can
touch, so every card that can actually be picked up now comes first.

**Rejected on the way: placing a stack at its best-placed member.** It was
built that way first. It reads well in a list of its own and it is wrong on the
board, because it promotes the whole stack on the strength of a card that
cannot move. The table above is the case that showed it.

**The smart order cannot be a comparator.** Every other order in `sorting.js`
is a pairwise comparison. "Keep this group together, in this internal order" is
not expressible that way, so the smart order is a comparator plus a pass. That
is why `app.js` names `smart` once, and why a new order that needs the same
treatment has to be added in both places.

**The review row reads its stacks bottom first too.** It is one flat row of
pull requests waiting on the reader, and a flat item is a group with nothing
nested in it, so the same pass runs on it (`orderItemsForMerging`).
`reviewSortId` still maps smart to `updated-asc`, because that is the
comparator half of smart; the pass is the rest of it.

The row shipped without the pass, and the fault was reported from a real board:
five cards badged "2 of 2", "1 of 2", "2 of 3", "3 of 3", "1 of 3", in that
order. The badge told the reader which to read first and the order told them
the opposite. Nothing was broken enough to notice unless somebody read the
badges.

**A ring of branches is survivable.** Retargeting can in principle make a cycle.
The pass breaks it and emits every group exactly once, because a reorder that
drops a card loses work with nothing on screen to say so. A test pins that
every group comes back exactly once.

**Rejected: sorting the items rather than the groups.** The board draws groups,
so a pull request nested under its issue would have been ordered and then
ignored. **Rejected: reading the stack from the description.** ADR 0010 settled
this for relationships and the same reasoning holds: a sentence is a guess, a
branch is a fact. **Rejected: making every order stack-aware.** An order named
after a date must give a date order. **Rejected: a separate "stacks" column or
badge.** It may be worth showing which pull request a stack is waiting on, but
that is a second feature, and the order alone already answers "what do I do
next".
