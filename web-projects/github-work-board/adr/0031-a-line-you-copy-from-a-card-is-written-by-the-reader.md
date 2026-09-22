# ADR 0031: A line you copy from a card is written by the reader

## Context

Work is handed to an agent as a sentence now. The reader opens a card, reads
the number, and types `/implement-issue #214` into a terminal. Later they ask
somebody to look at a pull request, and type "Please, whenever you can, take a
look and review", then paste the link.

The sentence is the same every time. The only parts that change are the number
and the link, and both are on the card already. So the reader types the fixed
part again for every card, and copies the moving part by hand from a second
place.

The board has one row of this shape already: "Copy branch name" puts a pull
request's branch on the clipboard (ADR 0021). It is fixed, and no build of this
board can guess the sentence a particular reader wants around it.

## Decision

**The reader writes the sentence once, in Settings, and the card menu copies it
filled in.**

- **A line is a name and a template.** The name is what the menu row says. The
  template is plain text with placeholders in braces: `{N}`, `{URL}`,
  `{TITLE}`, `{REPO}`, `{BRANCH}`. `copyActions.js` holds the list and fills it.
- **The board ships none.** Nobody's sentence is the right default. The empty
  boxes carry two examples instead, and the list of placeholders sits under
  them, so the reader can see what a line looks like before writing one.
- **A placeholder nobody offers is left exactly as it was typed.** `{AUTOR}`
  copies as `{AUTOR}`. Dropping it would hand back a sentence with a hole in it
  and nothing on screen would say why. The mistake travels to the clipboard,
  where the reader meets it.
- **The case does not matter.** `{url}` and `{URL}` are one placeholder,
  because the reader types the template by hand.
- **A line the card cannot fill is not offered.** An issue has no branch, so a
  line using `{BRANCH}` has no row in an issue's menu. That is the answer
  "Copy branch name" already gives (ADR 0021), and `cardMenu.cardMenuRows`
  decides it with every other row rather than `app.js` deciding it alone
  (ADR 0022).
- **The lines live in `board.json`**, one record per line, so they follow the
  reader to every machine (ADR 0024) and two devices that each add one keep
  both (ADR 0002). A removed line keeps its key with an empty template, the
  same way a cleared note keeps its key.
- **Oldest first, with the id breaking a tie.** Two devices can write a line in
  the same second, and both have to read the same order.

## Consequences

**A placeholder name is as permanent as a column id.** It is written into
`board.json` the moment the reader saves a line, so renaming `{N}` would empty
that part of every line already written, on every machine, with nothing on
screen to say so. `invariants.test.js` pins the list.

**Emptying the template box removes the line.** There is one rule for "this
record is gone", and it is the one a cleared note uses. It means a reader who
clears the box to retype the line loses the row on the next redraw, and has to
press Add again. The alternative is a second state, "saved but empty", that
reads the same on screen and merges differently.

**The reader's own text reaches two places, and both are safe.** The menu row
is written with `textContent`, and the filled line goes to the clipboard. No
part of a line is ever HTML (ADR 0001).

**Nothing new is asked of GitHub.** A line is built from what the card already
holds, so there is no extra call, no extra permission, and no cost to the rate
limit (ADR 0005, ADR 0025).

**Rejected: a fixed list of built-in actions.** "Copy the link", "copy the
title". It answers the easy half and misses the point: the value is in the
words around the number, and those are the reader's.

**Rejected: refusing to save a template with an unknown placeholder.** It reads
as strict and is worse in practice: the board would have to decide whether
`{2}` in a sentence about two issues is a typo or a number in braces. Leaving
the text alone keeps the board out of that argument.

**Rejected: `localStorage`.** A line is a preference, and a preference that
does not follow the reader is one they write twice (ADR 0024). The tokens stay
in this browser because they are credentials; a sentence is not.

**Rejected: a submenu holding the lines.** The menu is short, and a reader with
three lines would open two popovers to reach one row. Two auto popovers that
are not nested also close each other (ADR 0012), which is cost with no gain
here.
