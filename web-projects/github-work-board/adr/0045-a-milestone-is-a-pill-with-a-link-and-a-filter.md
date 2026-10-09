# ADR 0045: A milestone is a pill with a link half and a filter half

## Context

GitHub groups issues and pull requests into milestones: a sprint, a release, a
launch. The reader wanted to see on each card which milestone the work is in,
how far that milestone has gone, and to narrow the board to one milestone.

Three questions decide the design:

- **What does it cost?** One refresh already costs five GitHub calls for each
  token, and the search budget is tight (ADR 0025). A call for each milestone
  would multiply that cost.
- **What does a press do?** The reader wants two things from one pill: go to
  the milestone on GitHub, and filter the board by it.
- **What identifies a milestone in a filter?** A milestone belongs to one
  repository. Two repositories can each have a milestone called "Sprint 12".

## Decision

**The board reads the milestone from the answer that it already has.** The
issues endpoint and the search endpoint both send a `milestone` object inside
each item, with its name, its page and its open and closed counts.
`milestones.readMilestone` keeps those four things, and `normalizeWorkItem` puts
them on the item. The feature adds no call and no permission.

**The share is the closed part of the milestone, rounded down.** GitHub's counts
hold issues and pull requests together, and so does its milestone page, so the
two numbers agree. Rounded down, the pill says 100% only when nothing is open.
An empty milestone shows the icon and no number, because 0% would invent one.

**The pill has two halves, and each half does one thing.**

- The icon and the share are a link to the milestone on GitHub. A green fill
  behind them shows the share.
- The name is a filter chip. A press narrows the board to that milestone, and
  the name stays pressed while it does. It presses the same chip as the new
  "Milestone" group above the board.

A long press or a menu could hold the second action, but the reader would never
find it. Two halves keep both actions in plain sight.

**The pill closes the row of labels**, so the labels keep their place. It is
filled and the labels are only outlined, so the two never read as the same kind
of thing.

**A milestone filter is chosen by name, across repositories, like a label.**
Two repositories that name a milestone "Sprint 12" almost always mean the same
sprint. The name travels in the link as `milestone=`, one parameter for each
milestone, and the rules of ADR 0009 hold: two milestones widen the board, and a
milestone with a repository narrows it.

**On a review card the name is text, not a filter.** The board's filters never
narrow the review row (ADR 0009). A filter half there would change the columns
below, which is not the list that the reader pressed in. The link half still
works.

## Consequences

**The counts are as fresh as the last read.** They refresh with the rest of the
card, on the schedule of ADR 0025.

**Two milestones with one name share one chip.** Their pills still link to two
different pages, because each pill links to its own repository's milestone. If
the shared name ever misleads, the repository filter separates them.

**A milestone name is permanent in a saved link, like a label.** A milestone
renamed on GitHub leaves an old link filtered on a name that no item carries.
The board is then empty, and "Clear the filters" is the way out (ADR 0009).

**The start-up now restores every filter that the link carries.** The two person
filters (ADR 0028) were written into the link and never read back at start-up,
so a link lost them on load. `invariants.test.js` now checks that `app.js`
copies every list that `readStateFromSearch` answers.

**Rejected: the due date on the pill.** The same answer carries it, so it costs
no call, but a date on every card is noise. It can go in the tooltip later.

**Rejected: a filter by repository and number.** It is exact, but a sprint
across five repositories would take five chips.
