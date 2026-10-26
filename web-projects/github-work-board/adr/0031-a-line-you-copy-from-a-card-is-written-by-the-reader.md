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

The board had one row of this shape already: "Copy branch name" put a pull
request's branch on the clipboard (ADR 0021). It was fixed, and no build of
this board can guess the sentence a particular reader wants around it.

## Decision

**The reader writes the sentence once, in Settings, and the card menu copies it
filled in.**

- **A line is a name and a template.** The name is what the menu row says. The
  template is plain text with placeholders in braces: `{N}`, `{URL}`,
  `{TITLE}`, `{REPO}`, `{BRANCH}`. `copyActions.js` holds the list and fills it.
- **The board ships one line, "Copy branch name" (`{BRANCH}`), and no more.**
  It was a fixed menu row before lines existed (ADR 0021). As a line, the
  reader can rename it, limit it or remove it, and a second fixed row beside
  it would put the branch in the menu twice. Nobody's sentence is the right
  default, so the board ships no sentence. Settings lists a few examples
  instead, until the reader writes their own, and the list of placeholders
  sits under them. The starting line does not count as the reader's own, so
  a new reader still sees the examples.
- **The starting line is read in, never written.** `copyActions.withStartingActions`
  adds it to what `boardDocument.readCopyActions` reads when the file holds no
  record under its id, `branch-name`. The file holds a record only once the
  reader edits or removes the line, and a removed one keeps its key with an
  empty template, so it does not come back. Writing it on every device that
  opens the board would change the file with nothing changed by the reader. One example is a placeholder and nothing
  else, `{URL}`, because the other two wrap words around a placeholder and on
  their own they read as if a line has to be a sentence.
- **A placeholder nobody offers is left exactly as it was typed.** `{AUTOR}`
  copies as `{AUTOR}`. Dropping it would hand back a sentence with a hole in it
  and nothing on screen would say why. The mistake travels to the clipboard,
  where the reader meets it.
- **A placeholder is filled as it is, and never encoded.** A line can be a
  link, such as one that opens a Claude Code cloud session on the card
  (`https://claude.ai/code/new?q=...&repo={REPO}`), and the examples show one.
  The reader encodes the fixed text by hand, `#` as `%23` above all. `{N}`
  and `{REPO}` are safe in a link as they are; `{TITLE}` is not, and the
  board offers no encoded form of it yet.
- **The case does not matter.** `{url}` and `{URL}` are one placeholder,
  because the reader types the template by hand.
- **A line the card cannot fill is not offered.** An issue has no branch, so a
  line using `{BRANCH}` has no row in an issue's menu. That is how "Copy
  branch name" stays off an issue (ADR 0021), and `cardMenu.cardMenuRows`
  decides it with every other row rather than `app.js` deciding it alone
  (ADR 0022).
- **The lines live in `board.json`**, one record per line, so they follow the
  reader to every machine (ADR 0024) and two devices that each add one keep
  both (ADR 0002). A removed line keeps its key with an empty template, the
  same way a cleared note keeps its key.
- **A line is offered everywhere, or only in the parts of the board the reader
  picks.** A part is the review row or a column, by the id
  `appearance.colourableAreas` gives it. A prompt that asks an agent to
  implement an issue belongs on work in "To do" and is noise on a card in
  review. No part picked means everywhere, so every line saved before this
  choice existed keeps its rows, and a new line starts there. The part is
  where the card is drawn, a column moved by hand included; a pull request
  nested in its issue is in that issue's column. `copyActions.offeredIn`
  decides it, and `cardMenu.cardMenuRows` applies it with every other row.
- **A line can carry an icon**, picked from a list or typed as one emoji, and
  the menu row leads with it. ADR 0046 holds the rules.
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

**A starting line's id is as permanent as a placeholder.** A reader who
removed the line wrote a record under `branch-name`. Rename the id and the line
comes back for every one of them. `invariants.test.js` pins it.

**A starting line sorts first, with a `createdAt` from 1970.** That is where
the fixed row sat, above every line the reader wrote, and an edit keeps it
there because an edit keeps `createdAt`.

**Rejected: writing the starting line into the file on first load.** Two
devices would each write it at once. One fixed id keeps that from making two
lines, but each device would still change the file with nothing done by the
reader, and an older build would read the line with no way to know it was the
board's own.

**Rejected: keeping the fixed row and only adding `{BRANCH}` to the
examples.** The reader could not rename, limit or remove the row, and a
reader who wrote the same line had it twice.

**A part id is as permanent as a column id**, because it is one. It is written
into the line the moment the reader picks it, and the column ids are pinned
already (ADR 0011).

**Rejected: a submenu holding the lines.** The menu is short, and a reader with
three lines would open two popovers to reach one row. Two auto popovers that
are not nested also close each other (ADR 0012), which is cost with no gain
here.
