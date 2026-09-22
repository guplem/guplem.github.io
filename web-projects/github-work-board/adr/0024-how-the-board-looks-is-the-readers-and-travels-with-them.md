# ADR 0024: How the board looks is the reader's, and travels with them

## Context

The board had one appearance: the machine's light or dark setting, and six
columns the same colour as each other. A person who works with this open all
day wanted to tell the columns apart at a glance, and wanted to choose dark on
a machine set to light.

Where those choices live is the real question. Three answers were on the table:

- **`localStorage`.** Free, and wrong: a preference set on the laptop is not
  there on the desktop, and this board's whole promise is that the reader's
  half follows them (ADR 0001).
- **A new file in the repository.** A second file to read, a second sha to
  track, a second thing to merge.
- **The document that is already there.** `board.json` already holds the
  reader's notes and the cards they moved by hand, already merges record by
  record across two devices (ADR 0002), and is already read and written on
  every visit.

## Decision

**How the board looks is stored in `board.json`, beside the notes**, in two new
record maps: `colours` (one record per paintable area) and `appearance` (one
record, the theme). Adding a map is the whole change, which is what ADR 0002
built the document for.

**A colour is bare HSL channels, and the page paints with two alphas.** `app.js`
sets `--tint` on the column and the CSS washes the background at one alpha and
the outline at another. That is only possible because every colour token here is
channels rather than a finished colour (ADR 0004), and it is why a preset is
one string.

**The board opens painted, and the reader's hand always wins.** It shipped with
nothing painted, on the grounds that the absence of a rule is honest. It is also
six grey columns, and every reader painted the same six by hand before the board
said anything at a glance. So each part now opens with a colour: violet on the
review row, slate on "To do", blue on "Ongoing", rose on "Needs changes", green
on "Ready to merge". `appearance.DEFAULT_COLOURS` holds them.

**"Awaiting review" and "Done today" open unpainted, on purpose.** They are the
two nobody has to act on: one is with somebody else, the other is over. Leaving
them plain is what makes the painted ones mean something.

**A record means the reader chose, and "None" is a choice like any other.** A
part with a record wears what the record says, so a column somebody cleared
stays cleared and never goes back to the shipped colour. A part with no record
wears the shipped colour. Nothing carries `data-colour` when the answer is
"None", so a column read as unpainted still has no rule on it at all.

**The review row is painted like a column and is not one**, so it has an id of
its own, `reviews`, stored in the same map beside the column ids. A test pins
that it can never collide with one.

**The theme is written three times in CSS, on purpose.** The dark tokens appear
under `@media (prefers-color-scheme: dark)` guarded by
`:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`.
CSS has no way to say "these rules, under either of two selectors" without
repeating them. Keep the two copies identical: an explicit choice has to win in
**both** directions, or choosing light on a dark machine does nothing.

**Automatic is the theme's default**, and it stores nothing until the reader chooses.

## Consequences

**The repository is no longer "your notes".** It holds the notes, the cards
moved by hand, and now the colours and the theme, so the page calls it the
**board repository** and says what is in it. The permission the guide asks for
says the same. Nothing about the file's shape or its merge changed; only what
the page calls it.

**A colour a newer build knows reads as "None" on an older one**, and is left in
the file untouched. That is the additive rule doing its job (ADR 0002): an old
tab that saves must not wipe what a new one wrote.

**Choosing "None" again keeps the record**, like a cleared note and a card moved
back to automatic. The other device has to tell "cleared just now" from "never
set".

**A save costs a round trip, and a colour is a thing people click through.**
Every press schedules the same debounced save as a keystroke in a note, so
trying six colours writes once at the end rather than six times.

**The dark tokens are duplicated.** A change to one has to be made to the other.
The alternative is a build step, which this site does not have (root ADR 0002).
Four component rules once kept only the media-query copy, so a reader who chose
dark on a light machine saw light-coloured badges on a dark page. ADR 0027
fixed the four and added an invariant that fails when a new rule repeats the
mistake, though it checks the guard, not that the two copies still match.

**Rejected: `localStorage`.** It is the one storage that cannot follow the
reader, which is the whole point of the feature.
**Rejected: a colour picker.** A free colour is a colour that can be unreadable
against the text on it, in one theme and not the other. A preset is checked
against both.
**Rejected: colouring the cards rather than the column.** The column is the
thing being told apart; the cards inside it are the work.

> **Note (2026-09):** the repository holding `board.json` is no longer called
> the board repository. The shared cloud storage panel calls it the data
> repository, because it now holds every project's saved data, one folder
> each (root ADR 0016). The colours and the theme still live in `board.json`,
> unchanged.
