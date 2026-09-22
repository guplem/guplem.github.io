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
said, whether the branch still merges cleanly, how the checks ended, and whether
it landed. All of that is the column.

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
| Needs attention | The branch conflicts, a check came back red, or a reviewer asked for changes and has not been asked to look again |
| Awaiting review | A reviewer was asked by name, no verdict yet |
| Ready to merge | Approved |
| Done today | Finished inside the chosen range, since midnight by default (ADR 0017, ADR 0034) |

**One column holds everything that wants the author** (added 2026-09). A
reviewer asking for changes, a check that went red and a branch that no longer
merges are one sentence: the work cannot go forward until the person who wrote
it does something. Three columns for one sentence would split the same queue
three ways, so there is one, and the card says which of the three it is with a
pill: "Conflicts", "Checks failed", "Changes requested". `attention.js` holds
the three reasons, their words and their icons; `attentionFor` in `columns.js`
answers which of them a card carries.

The column's id stays `needs-changes`, because an id is written into
`board.json` the moment a card is moved by hand, and an id is never renamed.
Only the label changed.

**"Needs attention" sits beside "Ongoing" because it is the same activity.** In
both, the work is with the person who wrote it, so the two columns somebody
moves between all day are next to each other, and the three that mean "waiting
on somebody else" run on from there. The order is only how the columns read:
the ids are what `board.json` stores, and they never move.

**The order of the checks is the decision**, because an item answers several at
once. Finished work wins over everything: it is over (ADR 0017). Anything that
wants the author wins over an approval and over a wait on a reviewer, because
one reviewer approving does not undo a conflict, a red check, or another
reviewer asking for work, and that work is what is left to do.

**A conflict and a red check are read from GitHub, never worked out here.**
`mergeable` answers `CONFLICTING` when the branch and its target changed the
same lines. GitHub works that field out only when somebody asks for it, so the
first answer for a quiet pull request is `UNKNOWN`: that is "not worked out
yet", not "fine", so the board claims nothing about it and the next refresh
answers properly. The checks are `statusCheckRollup` on the last commit, which
is GitHub's own one-word verdict over every check: `FAILURE` and `ERROR` want
the author, `PENDING` and `EXPECTED` are still running and want nobody, and a
pull request with no checks at all has no rollup, which is not a pass. Both
fields cost one more nested connection in the relationship query (ADR 0010).

**Changes requested that have been answered is not changes requested.** GitHub
never clears `reviewDecision`. The author does the work, asks the same reviewer
to look again, and GitHub still shows the red "Changes requested" badge, right
beside "Awaiting requested review from <name>". Both are true, and only the
second one says whose turn it is. So a pull request whose verdict is
`CHANGES_REQUESTED` moves to "Awaiting review" once **every** reviewer who
asked for changes sits in `reviewRequests` again.

Every reviewer, not any one of them. Two reviewers asking for changes is two
people to satisfy, and answering one of them while the other still waits would
hide real work in the column nobody watches.

This is what `askedToLookAgain` in `relationships.js` answers, from
`latestOpinionatedReviews` (one review per reviewer, plain comments left out)
set beside `reviewRequests`. A team can be asked to review and has no login, so
it never satisfies the rule; neither does a review whose author is gone.

**Only a named reviewer counts as asked.** `reviewDecision` also answers
`REVIEW_REQUIRED`, which reads like "a review is awaited" and is not: it is the
branch rule saying the repository wants a review before a merge. Every open
pull request in such a repository carries it, including one opened a minute ago
that nobody has looked at. Reading it as a request filled "Awaiting review"
with work that was still being written. `reviewRequests.totalCount` is the only
thing that says a person was asked.

Three things this rests on:

- **`reviewDecision` is GitHub's own verdict**, not a verdict this board works
  out by reading a list of reviews. It already handles who reviewed last and
  which reviews still count. The review list is read for one thing only, and it
  is not the verdict: it is the name of the reviewer who gave it, so that name
  can be looked for among the reviewers being waited on.
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

**A card says why it is in the column, wherever it is drawn.** The pills are
drawn from the rules, not from the column, so a card the reader moved somewhere
by hand still says that its branch conflicts. Three reasons at once read as
three pills, worst first.

**A moved card can go stale.** Somebody who moves a card to "Needs attention" and
then pushes the fix has to move it back, because their choice outranks the
rules for ever. "Automatic" is one click away and the control says what the
rules would pick, which is the smallest honest fix; a rule that expired the
override on its own would be guessing at intent.

**Moving is a menu, not a drag.** Dragging is the gesture people expect from a
kanban board, and it is a lot of code to do properly on touch as well as with a
mouse. A menu works everywhere, needs no pointer, and reads to a screen reader.
Dragging can be added later, over the same data. The menu itself started as a
dropdown on every card and became a button that opens one; ADR 0012 holds why.

**Rejected: a status field the reader maintains.** It is the second job
described above. **Rejected: GitHub Projects v2 status.** It is the real answer
for somebody already living in a Project board, and it needs another permission,
a chosen project, and a mapping from that project's columns to these; it is
worth doing when somebody asks for it. **Rejected: computing the review verdict
from the review list.** `reviewDecision` already does it, and doing it again
would be a second, worse copy of GitHub's rules. That rejection stands, and the
re-request rule above does not break it: the verdict still comes from
`reviewDecision`, and the reviews are read only for the names attached to it.
**Rejected: treating any pending review request as an answer to the changes.**
A new reviewer asked while the first reviewer's changes are still outstanding
is not the work being answered, and reading it as one empties "Needs attention"
of work that really is waiting there. **Rejected: reading `REVIEW_REQUIRED` as
a review request.** It was in the first version of these rules and it was
wrong: it is a fact about the repository, not about the pull request.
**Rejected: a column of its own for conflicts and one for red checks.** They
are the same queue as changes requested, and a board of eight columns is a
board nobody reads across. The pill carries the difference.
**Rejected: reading `PENDING` checks as a reason to act.** Almost every pull
request is pending for its first minutes, so the column would fill with work
nobody has to touch. **Rejected: `mergeStateStatus`**, which also answers
"blocked" and "behind". It needs a preview media type, and it mixes the branch
rules with the merge itself; `mergeable` answers the one question asked here.
