# ADR 0014: Three-State Work Filters, With One Button That Teaches the Third State

## Context

The works section carries one chip per project type and per skill. A click set the chip on, and a second click set it off. So a visitor could only say "keep these works".

20 of the 77 projects carry the "Vibe Coded" skill, which marks a project that an AI agent wrote (see `data/AGENTS.md`). These projects are the newest ones, and the grid sorts by date, so they fill the top of the list. A visitor who wants to read the hand-directed work first had no way to put them aside. The same need can appear for any other tag.

Two designs answer this:

- One dedicated switch that hides that one skill. It is easy to find, but it answers one tag only.
- A third state on every chip: "must exclude". It answers every tag, but a visitor never learns that a second click excludes, because almost no filter interface works that way.

## Decision

Ship both, because each one covers the other's weakness.

**Every chip holds three states.** One click cycles the chip: none -> include -> exclude -> none. `nextTagFilterState()` in `js/utils/textCore.js` holds that cycle, and `workMatchesTagFilters()` holds the rule: a work must carry at least one tag of every non-empty include list, and no excluded tag at all. An exclusion always wins over an inclusion. Both functions are pure and Bun-tested (root ADR 0012).

**One button drives the "Vibe Coded" chip.** The "Hide vibe coded" button in `index.html` sets that chip to "exclude", and the chip visibly changes with it. So the button both answers the common request in one click and shows the visitor that the third state exists. The button names its target skill in `data-tag-id`, so `index.html` decides which skill it hides, and it stays hidden while no project carries that skill.

**The chip's state is a value, not a flag.** Each chip carries `data-tag-filter="include"` or `data-tag-filter="exclude"`, and carries no such attribute while it filters nothing. A boolean `selected` attribute cannot hold three states, and CSS matches `[selected]` by presence, so a value inside it would still apply the "include" look. This follows `data-collapsed` on the works grid wrapper.

**One paint function owns every chip.** `paintTagFilterButton()` in `js/layoutBuilder/workFilters.js` writes the state attribute, the `aria-label` and the tooltip for the filter row chips and for the chips on the cards. `syncFilterControls()` repaints every control after each change, so a chip, the button and the card chips can never disagree about one tag.

**A "Clear filters" button clears everything.** A chip now needs up to three clicks to return to "none", so the works section carries one escape hatch. It also empties the search box, and it appears only while a filter is set.

**Rejected alternative:** a switch for the vibe-coded case alone. It reads well, but it hard-codes one tag into the interface and gives a visitor no way to put any other tag aside. The three states cost no extra control and answer every tag.

**Rejected alternative:** a second grid that holds the vibe-coded projects under a collapsed heading. It hides nothing and needs no control to find, but it builds a value judgment into the page layout, it doubles the masonry code (root ADR 0004), and it fights the existing "Show More Projects" collapse.

## Consequences

**Positive:**

- A visitor can put any tag aside, not only the vibe-coded one.
- The common request takes one click, and that click teaches the general mechanism.
- The filter rule is one pure function, so the include and exclude semantics are tested instead of read.
- The exclusion button and the chip can never disagree, because one function paints both from one state.

**Negative:**

- A second click no longer clears a chip. A visitor who wants to clear one chip clicks it twice more, or clears every filter at once.
- The "exclude" look needs no new palette colour, so it says "excluded" with a fill, a dashed border and a strike-through, instead of with the red that a reader may expect.
- Nothing checks that the button's `data-tag-id` still matches a skill in `data/`. A renamed skill leaves the button hidden, which is silent but visible on the page.
- Filter state lives in memory only. A reload clears it, and a visitor cannot share a filtered view by URL. Root ADR 0006 keeps URL state for `web-projects/`, and the main site holds no user state worth persisting.
