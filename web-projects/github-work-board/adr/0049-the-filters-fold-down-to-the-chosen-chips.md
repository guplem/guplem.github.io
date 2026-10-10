# ADR 0049: The filters fold down to the chosen chips

## Context

The board offers a chip for every repository, label, milestone, reviewer and
issue-field value its work carries (ADR 0009, ADR 0045, ADR 0047). A reader
in several repositories, with labelled work and issue fields, gets eight or
more rows of chips. They push the columns below the first screen.

ADR 0009 named this cost and the probable answer: fold the groups away. Most
of the time the reader chose nothing, or one or two chips. Those few chips are
the part worth seeing, because they are the reason the board is short.

## Decision

**A button folds the board's filters down to the chips the reader chose.**
`filters.js` holds the rules, and `app.js` draws them.

- **Folded, each group shows only its chosen chips.** A group with nothing
  chosen hides. `shownChoices` keeps the order the group offered.
- **"Everything" is not a filter.** It narrows nothing, so a folded kind group
  never holds it. `shownKinds` returns no kind while "Everything" is chosen.
- **The button says what a press does, and counts the chosen chips.** Folded,
  it reads "Show all the filters (3 chosen)", or "Show the filters" when none
  is chosen. Open, it reads "Show only the chosen filters", or "Hide the
  filters".
- **The count is the board's own.** The assignee chips above the review row
  narrow that row, not the board, and they do not fold. `boardFilterCount`
  leaves them out.
- **Folded is the default.** The choice stays in this browser
  (`settings.js`, key `filtersOpen`), like the refresh schedule (ADR 0025). It
  is about the room this screen has, not about the reader's work, so it does
  not travel in the board file. It does not go in the link either: a shared
  link carries the chosen filters, and folded shows exactly those.

## Consequences

**A press on a card's pill still works when the filters are folded.** A
milestone, a field value or a reviewer's face presses its chip, and the chip
then appears in the folded group.

**A chosen value the list no longer offers stays out of sight, folded or
open.** ADR 0009 already accepts this, and "Clear the filters" is still the
way out of an empty board.

**Rejected: one fold per group.** Eight buttons cost more attention than the
chips they hide. **Rejected: the fold state in the board file.** Two devices
with two screen sizes want different answers.
