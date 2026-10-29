# ADR 0049: The filters are one bar, a kind switch and one menu per filter

## Context

The board offers a value for every repository, label, milestone, reviewer and
issue-field value its work carries (ADR 0009, ADR 0045, ADR 0047). A reader
in several repositories, with labelled work and issue fields, gets many
values. As rows of chips, they pushed the columns below the first screen.

An earlier design folded the chips behind a button. It showed only the chosen
chips and kept the open or folded state in this browser. It still cost a
panel, a button with a changing label, and a kind called "Everything" that
narrowed nothing. The reader needs less than that: a way to pick a kind, and
a way to pick values.

## Decision

**The filters are one bar beside the "Your issues and pull requests"
heading.** `filters.js` holds the rules, and `app.js` draws them.

- **A segmented switch picks the kind.** It reads All, Issues, Pull
  requests. "All" is the absence of a kind filter, so it is not a chip and
  narrows nothing.
- **Each kind of filter is one dropdown button.** The kinds are Repository,
  Reviewer, Label, Milestone, and one per issue field. A press opens one
  shared popover, `#filter-menu`, in the top layer (ADR 0012). It holds one
  checkbox per value, and a "Clear filters" action.
- **Each option shows how many cards carry it** (`matches` on each option from
  `filterMenus`). A menu with six or more options has a find box at the top.
  The foot of the menu shows the `hint` ("Two labels match either") and a
  "Clear" press for that one filter when a value is chosen.
- **A count badge on the button says how many values are chosen.** A reader
  sees from the closed bar which filters are in force.
- **`filterMenus(items, chosen)` builds the menus.** It offers a repository or
  a reviewer only when there are two or more to choose between. It offers a
  label, a milestone or an issue field from one value. A menu with a chosen
  value always stays, so the reader can see it and undo it.
- **The count is the board's own.** The assignee choice above the review row
  narrows that row, not the board. It is a separate control, and
  `boardFilterCount` leaves it out (ADR 0009).
- **Nothing about the bar is stored.** The bar is always the same size, so it
  has no open or folded state. The old `filtersOpen` key is only in
  `LEGACY_KEYS` in `settings.js`, and sign-out clears it. The chosen values
  stay in the link (ADR 0009).

## Consequences

**A press on a card's pill still works.** A label, the repository name, a
milestone, a field value or a reviewer's face presses the same choice, and
the menu then shows it as chosen. Every value a menu offers is also a press
on the card that carries it. Labels and the repository name were plain text
for a while, so `invariants.test.js` now checks that `app.js` toggles each
of these lists from a card. On a review card they stay text, because the
board's filters never narrow the review row (ADR 0009).

**A chosen value the list no longer offers stays chosen but may not be
listed.** ADR 0009 accepts this, and "Clear filters" is the way out of an
empty board.

**The bar takes one row, whatever the number of values.** Twenty repositories
are twenty checkboxes in a menu, not twenty chips on the page.

**Rejected: chips that fold behind one button.** It kept the chips and added a
state to remember. **Rejected: one popover per button.** One shared popover
means one place in the top layer to open, close and place.
