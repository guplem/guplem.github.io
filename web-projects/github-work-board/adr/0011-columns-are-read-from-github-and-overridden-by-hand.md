# ADR 0011: Columns are read from GitHub, and overridden by hand

## Context

A board of one long list answers "what is assigned to me". It does not answer
"where is each of these", which is the question a kanban board exists for.

Every board of this kind has to decide one thing first: **who keeps the columns
up to date**. On a normal kanban board, a person does. That is a second job, it
is always slightly wrong, and it is the reason most personal boards are
abandoned: the board stops matching reality and then nobody trusts it.

GitHub already knows the answer for most of the lifetime of a change. It knows
whether a pull request exists, whether anybody was asked to review it, what they
said, and whether it landed. All of that is the column.

It does not know everything. A reviewer can approve and then ask for one more
thing in a comment. GitHub says approved; the person doing the work knows
better.

## Decision

**The columns are computed from what GitHub knows, and any single card can be
moved by hand.**

Six columns, in the order work travels:

| Column | The rule |
|---|---|
| To do | Assigned, with no pull request |
| Ongoing | A pull request exists, nobody asked to review it |
| Awaiting review | A reviewer was asked, no verdict yet |
| Ready to merge | Approved |
| Needs changes | A reviewer asked for changes |
| Done | The pull request is merged |

**The order of the checks is the decision**, because an item answers several at
once. Merged wins over everything: it is over. Changes requested wins over an
approval, because one reviewer approving does not undo another asking for work,
and the work is what is left to do.

Three things this rests on:

- **`reviewDecision` is GitHub's own verdict**, not a verdict this board works
  out by reading a list of reviews. It already handles who reviewed last and
  which reviews still count.
- **A pull request closed without merging counts for nothing.** It is abandoned
  work, and reading it as progress would park an issue in a column it is not in.
- **An issue's column comes from its linked pull request** (ADR 0010), so the
  pair is in one column, on one card.

**A card moved by hand stays moved**, in `board.json` under a new `columns`
record map, which merges across devices like every other record (ADR 0002). The
move control also offers "Automatic", which hands the card back to the rules,
and it says which column the rules would choose, so the reader can see what they
are overriding.

**Column ids are permanent**, like sort ids and storage keys, because they are
written into the saved document the moment a card is moved. `invariants.test.js`
pins them.

## Consequences

**The board maintains itself for the common case.** Open a pull request and the
card moves. Ask for a review and it moves. This is the whole reason to build it
on GitHub's data rather than on a status field.

**Six columns need more width than prose.** The page is wider on the board
screen only; setup and settings stay at reading width, because prose does not
read well wide. Below about 60rem the columns stack, since sideways scrolling
inside a page that already scrolls down is a trap.

**The rules will be wrong for somebody.** They are written to be changed: one
list in `columns.js`, one function, and a test per rule. The reader's override
is the escape hatch while a rule is still wrong.

**A moved card can go stale.** Somebody who moves a card to "Needs changes" and
then pushes the fix has to move it back, because their choice outranks the
rules for ever. "Automatic" is one click away and the control says what the
rules would pick, which is the smallest honest fix; a rule that expired the
override on its own would be guessing at intent.

**Moving is a dropdown, not a drag.** Dragging is the gesture people expect from
a kanban board, and it is a lot of code to do properly on touch as well as with
a mouse. A dropdown works everywhere, needs no pointer, and reads to a screen
reader. Dragging can be added later, over the same data.

**Rejected: a status field the reader maintains.** It is the second job
described above. **Rejected: GitHub Projects v2 status.** It is the real answer
for somebody already living in a Project board, and it needs another permission,
a chosen project, and a mapping from that project's columns to these; it is
worth doing when somebody asks for it. **Rejected: computing the review verdict
from the review list.** `reviewDecision` already does it, and doing it again
would be a second, worse copy of GitHub's rules.
