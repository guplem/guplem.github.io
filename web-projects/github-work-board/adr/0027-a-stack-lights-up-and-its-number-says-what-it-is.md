# ADR 0027: A stack lights up, and its number says which pull request it is

## Context

The board knows which pull requests are stacked and puts them in merge order
(ADR 0016), and a review card carries a badge naming its stack (ADR 0020). Two
questions were still unanswered on screen.

**Which cards on this screen are the same stack?** The order alone does not say
it. A stack's cards can sit in two different columns, because the column comes
from the state of each pull request and not from the stack. The reader had to
read every branch name to work out what belonged together.

**What is `#5073`?** The badge names a stack by the number of its bottom, which
is the pull request that merges first. A number is not a name. The reader knew
which card to read first only by going to GitHub to look the number up. Hovering
the badge answered a question nobody asked: "Number 2 of 3 stacked pull
requests", which the badge already says in writing.

## Decision

**Point at a card in a stack, and every card of that stack lights up.** The
outline turns the stack's own amber, the same colour the badge uses, so the
light and the badge say the same thing in the same colour. Only the outline
changes: the card keeps its background, so a lit card in a coloured column
(ADR 0024) still reads as being in that column.

**The keyboard does it too.** A card is reachable by tab, and a reader who never
touches a mouse asks the same question. One `focusin` listener answers it beside
the `mouseover` one.

**One listener for the page, not two for every card.** The board is rebuilt on
every render, so listeners attached to a card have to be attached again each
time. `mouseover` and `focusin` both bubble, and moving onto anything that is
not a stacked card clears the light by itself.

**A stack is identified by the key of its bottom, never by its number.** Two
repositories can both hold a pull request numbered 7. The number is for reading;
the node id is for matching.

**The light is computed over everything on screen. The badge still counts the
review row alone.** These answer two different questions and are allowed to
differ:

- The badge answers "where does this card sit among the pull requests **you were
  asked to review**". ADR 0020 decided that on purpose: somebody who asked for a
  review on two of their three gets a row of two, and "1 of 2" is the truth about
  the row in front of the reader.
- The light answers "what else **on this screen** is in this chain", which is a
  question about the screen, so it is computed over the screen.

In practice a stack belongs to one person, so it sits either in the review row
or in the reader's own columns, and the two answers agree. They can differ only
when a reader stacks their own pull request on a colleague's.

**The badge is two parts, and each answers for itself.** Hovering the number
says which pull request that number is, with its title. Hovering "2 of 3" keeps
the sentence about merge order, which is what that half is about.

## Consequences

- `stackPositions` now returns the bottom's `key` and `title` beside its number.
  The key is what tells two stacks apart; the title is what the number means.
- **The badge became a flex box with two children**, so the space between them
  is a `gap` and not a space in the text. A flex container eats whitespace
  between its children, and the badge read `Stack #31· 1 of 2` until the gap
  went in.
- **Every dark rule in `style.css` now answers an explicit choice of dark, not
  only a dark machine.** Adding the lit card's dark outline showed that the
  component rules written before the theme switch (ADR 0024) sat in a bare
  `@media (prefers-color-scheme: dark)` block. A reader on a light machine who
  chose dark got a dark page with light-coloured badges on it. All four blocks
  were fixed, and an invariant now fails if a new one forgets.
- A card in no stack carries no mark and lights nothing, so a board with no
  stacks behaves exactly as it did.
