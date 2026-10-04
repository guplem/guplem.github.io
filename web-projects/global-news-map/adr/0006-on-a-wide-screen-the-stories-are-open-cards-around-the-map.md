# ADR 0006: On a wide screen the stories are open cards around the map

## Context

A day has about 10 to 20 stories. The first wide layout put the map and a
reading column side by side, with a "Selected location" panel above the list.
Each story in the list was folded to a summary, and the panel printed the chosen
story in full.

That layout had three faults:

- The reader had to look at two places to read one story: the folded row and the
  panel.
- The panel held one story, so a pin that covers several places needed a note
  ("this pin also covers N more") to say the others existed.
- A wide screen has room for the full text of every story. Folding them saved
  nothing.

## Decision

**On a wide screen (60rem and up) the stories are open cards in a masonry, and
the map is part of that masonry, at the top left. There is no panel.**

- The map (the day bar and the canvas) spans two columns. The page uses two or
  three columns, never a card narrower than 300px (`columnCountFor`).
- Every card shows the full text and the sources, with no chevron to fold it.
- `placeCards` puts each card in the shortest column at that moment. The map's
  columns start with the map's height, so the cards fill the space under and
  beside it. JS sets each card's absolute position and the list's height. A
  `ResizeObserver` places the cards again when the width or a card's size changes.
- Cards stay in the document in the portal's order. A screen reader, and a
  browser with no script, read that order. Only the position on screen changes.
- A click on a pin chooses the story, marks its card (or cards, when the pin
  groups several) and scrolls the card into view with `block: "nearest"`. A click
  on a card still centres and zooms the map.
- A hover on a card draws its pin like a chosen one. The state is transient and
  is not in the link.
- The "next place" button, which a phone already had, replaces the panel's note.
  It sits in the map's bottom right corner, and the counts pill holds the bottom
  left.

**The map scrolls away with the page.** A sticky map was rejected, and so was a
small second map: a day is about two screens tall, so the reader is never far
from the map, and a pinned map would cost the room the cards use.

Rejected: CSS columns. They fill one column top to bottom before the next, so the
second story of the day could land at the foot of the first column and the
reading order would break.

## Consequences

- The wide layout and the phone layout (ADR 0004) share the card markup and the
  selection state. They differ in how the page places the cards and in how a
  reader reaches a source: open on a wide screen, behind a tap on a phone.
- The page places cards with script, so a resize that changes a card's height
  must trigger a new placement. That is why a `ResizeObserver` watches the list.
- `masonry.js` has no DOM code, so `masonry.test.js` tests the placement with no
  browser. Measuring the cards stays in `app.js`.
- A pin that covers several places is reached with the "next place" button. No
  text says "this pin also covers N more" any more.
