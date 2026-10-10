# ADR 0048: Settings is split into sections, the section is in the link, and a search finds any setting

## Context

Settings grew one card at a time: the tokens, the cloud storage, how the board
looks, what the tab counts, the lines a card copies, and a link to report a
problem. It reached about forty controls and about four windows of height.
ADR 0023 measured it at 1067 pixels when it was much smaller, and said to
measure again if it grew.

A reader rarely comes to Settings to browse. They come to fix one thing: a
red token, a hidden column, a copy line, the cleanup. On a page four windows
tall they scroll to find it.

Opening Settings also cost GitHub calls. Every visit proved every permission
of every token (one call each, ADR 0005) and asked the cloud storage
repository again, even when the reader only came to change a colour.

A study of other settings screens (Chrome, GitHub, VS Code, Android, macOS,
Linear) gave three common patterns: an index of sections beside the content,
sections as separate pages, and a search box. Android's guideline puts the
limit at 10 to 15 items on one screen.

## Decision

**Settings is five sections, one per subject, and only one is drawn at a
time.** The sections are today's cards: GitHub tokens, Cloud storage, Look,
Tab count, and Copy lines. `settingsSections.js` lists them.

**The open section is in the link**, as `?view=settings&section=appearance`.
A section id is permanent, like a view name; a test pins the set. The default
section, `tokens`, is left out of the link, so every saved `?view=settings`
link still works. The link carries a section only while Settings is open.
The section is a parameter, not a new view name, because a new view name would
grow the permanent list of views and the toggle's map for what is one screen.

**An index stands beside the section on a wide screen, and above it on a
phone.** The index is real links, so a section can be copied or opened in a
new tab. The open one carries `aria-current="page"`. On a phone the five names
wrap onto two lines rather than scroll sideways, so the open one is always in
sight. Drilling down from a list to a page (GitHub's phone layout) was
rejected: every page would need its own way back, which is a second exit, and
ADR 0008 and ADR 0023 keep one control.

**The calls run only for the section that shows their answer.** The
permission checks run when the tokens section opens. The cloud storage panel
asks its repository again when the storage section opens. A reader who comes
to change a colour spends no call.

**The two screens opened from Settings go back to their own section.** Adding
a token goes back to the tokens, and the cleanup goes back to the storage
section, through `parentSection`. The empty board's button opens the section
that answers it: the tokens to add one, Look to show a hidden column.

**A search box sits above the index, and it reads a written list, not the
page.** `SETTINGS_ENTRIES` lists each setting with its section and the words
a reader may type instead of the words on the screen ("dark" for the theme,
"color" for the colours). Searching the page itself, as Chrome first did,
cannot find a setting in a section that is not drawn, nor the rows that the
shared cloud storage panel draws. Every word typed has to start a word of the
setting, a word it is known by, or its section; accents and capitals do not
count. While the box holds text, the answers stand where the section was, each
with the name of its section under it. A press opens the section, scrolls to
the row and lights it once. Enter takes the first answer, and Escape clears
the box.

**The search says only how many settings match**, in a status line that is on
the page from the start. A screen reader hears the count, not every answer.

**Every setting the search finds carries `data-setting` on its row**, and
`invariants.test.js` fails when the page and the list disagree, so a result
can never point at nothing.

**"Report a problem" moved from a card to the foot of the index.** It is one
link, and a whole card for it was the largest thing it did.

## Consequences

**Each section is now about one window.** Measured on 2026-10-10 in a window
898 pixels tall, with one token: GitHub tokens 899, Cloud storage 2009, Look
1388, Tab count 924, Copy lines 984. Cloud storage stays the longest, because
the shared panel draws it (root ADR 0016).

**Settings takes a wider page on a wide screen**: the reading width plus the
index, 58rem in all. The board's own width rule is untouched.

**The back button does not walk through sections.** The page replaces the link
rather than pushing a new entry, as every other view change here does
(root ADR 0006). GitHub's settings pages are real page loads and do push; this
board keeps one rule for every change of view.

**A new setting needs an entry in `SETTINGS_ENTRIES` and a `data-setting` on
its row.** The invariant catches a missing half.

**Rejected: one long page with a contents list.** It is the smallest change,
but the page stays four windows tall, it needs scroll tracking to say where
the reader is, and the calls still run on every visit.

**Rejected: a filter that hides rows on the drawn page.** It cannot reach a
section that is not drawn, nor the shared panel's rows.

**Rejected for now: a "changed from the default" marker (VS Code's
`@modified`), a keyboard shortcut for the search, and a sticky index.** There
are too few settings for the first two, and each section fits about one
window, so the index does not need to stay in sight.
