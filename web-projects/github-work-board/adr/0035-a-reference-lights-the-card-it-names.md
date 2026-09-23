# ADR 0035: A reference lights the card it names

## Context

A card names other work all the time. A parent draws one pill per child and
lists them by number (ADR 0032). A card says what blocks it, and what it is a
sub-issue of (ADR 0010).

Every one of those is a card somewhere else on the same board, and finding it
meant reading the number off every card in every column. The reader knew the
number, and the board made them hunt for the card.

The board already answers the same shape of question for stacks: point at a
stacked pull request and every card of that stack lights up (ADR 0027). A
reference to another item is the same question, asked about one card.

## Decision

**Point at anything that names another item, and the card it names lights up.**

- **Every reference points at a key**, in one attribute, `data-points-at`: a
  child's pill, a child's row in the unfolded list, and every link on a
  "Blocked by" or "Sub-issue of" line. **Every card says which item it is**, in
  `data-key`. One listener for the page reads the first and lights the second,
  the same shape ADR 0027 chose, because the board is rebuilt on every render
  and a listener on a card would have to be given again each time.
- **Violet, where the stack light is amber.** They are different statements:
  the stack says "these belong together", and this says "the one you are
  pointing at is here". Two colours, so they never read as the same thing.
  Drawn the same way, as a wash over the card's own background, so a lit card
  keeps its ground and its column's colour (ADR 0024).
- **The keyboard does it too.** A pill and a row are both links, so both are
  reachable by tab, and `focusin` answers beside `mouseover`.
- **A reference wins over the stack the card it sits in belongs to.** The
  reader is pointing at the reference, not at the card around it.
- **Nothing happens when the card is not there.** A child of yours can be
  somebody else's work, or filtered out, or past the twenty the board asks
  about. The tooltip on the pill already names it and says where it sits
  (ADR 0032), so there is an answer either way, and a light that fired for
  something off screen would be a lie.

## Consequences

**A card carries its key in the page now.** It is a GitHub node id, which is
already in the link on the card and is not a secret. Nothing is stored and
nothing is sent.

**The rule is one rule, applied to every reference.** A new line that names
another item gets the light by setting one attribute, and `invariants.test.js`
pins both attribute names, because they are set in one place and read in
another and a rename would put the light out in silence.

**Rejected: scrolling to the card.** The reader is reading the parent's card,
and a board that jumps takes that away. A light is enough when the card is in
view, which it usually is, and the reader can find the column when it is not.

**Rejected: lighting the parent when you point at a child's card.** The
"Sub-issue of" line already does exactly that, because it is a reference like
any other.

**Rejected: the stack's amber.** Two relations in one colour is worse than no
colour: the reader would learn to read amber as "something to do with this
card" and nothing more.
