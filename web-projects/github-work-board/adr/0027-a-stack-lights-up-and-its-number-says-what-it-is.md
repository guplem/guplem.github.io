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
card takes the stack's own amber, the same colour the badge uses, so the light
and the badge say the same thing in the same colour.

**An outline, and a wash of the same amber.** The outline alone shipped first
and was too quiet to find at a glance, which is the whole job: the reader is
looking for the other cards, not at the one under the pointer. The wash is a
layer over the card's own background and never a background of its own
(`background-image` paints on top of `background-color`), so the card keeps its
ground. A lit card still reads as a card, and one in a coloured column
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

**The light lights the stack the badge names, and nothing else.** The badge
counts only the list its card is in (the review row, or the board), never the
whole screen (ADR 0020). The light is worked out the same way, list by list
(`stackLights`), and the answers are put side by side. A card with no badge
lights nothing.

The light was first worked out over the whole screen, to answer "what else
on this screen is in this chain". That broke in real use. One pull request on
the board targeted a branch from the review row, so the screen read as one
stack. The badges still said "Stack #5843" and "Stack #6015", and pointing at
any stacked card lit every stacked card on the page. A light that disagrees
with the badge beside it tells the reader nothing.

The cost: a chain that runs from the review row into the columns lights as two
stacks, one in each list. That is what its badges already say, so the screen
stays consistent with itself.

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
