# ADR 0014: A note box appears only when there is a note

## Context

Every card carried an empty text box saying "A note only you can see". On a
board of forty cards that is forty invitations to write something nobody wanted
to write, and the box is the tallest thing on a card: it pushed the title, the
labels and the links apart and made a column twice as long as the work in it.

Notes matter. Showing an empty box everywhere is not the same as making notes
easy; it is making the board harder to read in exchange for saving one click on
the rare occasion somebody writes one.

Three ways out were on the table: a box that appears from the card's menu, a box
shown only where a note exists, or a dialog for writing the first one.

## Decision

**The box is there when the note is there. Otherwise the menu offers it.**

- A card with a note shows the box, filled, as before.
- A card without one shows nothing, and the ⋯ menu offers **Add note**, which
  puts the box on that card and puts the cursor in it.
- The same row reads **Edit note** when a note exists, because writing the first
  note and changing an existing one are different acts and the menu should say
  which one it is offering.
- Which empty boxes are open is remembered for the visit only, in memory. A box
  somebody opened and left empty is not worth writing to the reader's
  repository, and it should not come back tomorrow.

**No dialog.** A dialog is heavier than the line it captures: it covers the
board, it needs its own dismissal, and it separates the note from the card it is
about. The box is already in the right place.

## Consequences

**A column shows more work per screen**, which is the point: the board is read
far more often than it is written to.

**The box that does appear is one line high, and grows to fit what is in it.**
It opened three lines high, which cost more of a column than every note on the
board put together, because most notes are a few words. `app.js` measures each
box once the cards are on the page and again on every keystroke, so a long note
is never cut off and a shortened one gives the space back.

The measuring runs from `renderBoard`, not from a `requestAnimationFrame` inside
the builder. A hidden tab never runs those, so a board drawn in a tab the reader
opened in the background would hold every note at one line and cut the rest off
until something else redrew it.

**Adding a note costs one more click than it did.** That is the trade, and it is
the right way round: reading happens on every visit, writing a note happens
rarely.

**Emptying a note leaves the box until the next render.** The note is cleared in
the document (with its tombstone, ADR 0002), and the box disappears the next
time the board is rebuilt rather than vanishing under the cursor mid-edit. That
is deliberate: a control that removes itself while somebody is using it is worse
than one that waits.

**A card gives no sign of a note it is not showing.** There is nothing to give a
sign of: if a note exists, the box is shown. This stops being true the day the
box is collapsed rather than absent, and that day it needs a mark.

**Rejected: a dialog for the first note.** Heavier than the thing it captures.
**Rejected: keeping the box on every card.** It is the current state, and it
costs the whole board's legibility. **Rejected: showing the box on hover.** A
finger has no hover, and a box that appears under the pointer as it crosses a
card is worse than one that never appears.
