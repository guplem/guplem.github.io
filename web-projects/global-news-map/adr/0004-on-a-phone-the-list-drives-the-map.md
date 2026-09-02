# ADR 0004: On a phone the map holds still and the list drives it

## Context

The page has two halves that answer each other: a map of pins, and the day's
stories. On a wide screen they sit side by side, so the reader sees both at once
and the pair works.

A phone has one column. The first version stacked the halves, so the whole page
scrolled as one: the reader scrolled down to read a story and the map left the
screen. A pin they could not see could not be compared with the words they were
reading, which is the one thing the page is for. Scrolling back up to look at the
map lost their place in the list.

Three more things made the phone worse than the wide screen:

- The title, the tagline and the language picker took the top of the screen, and
  none of them are the news.
- Every row of the list carried the story's whole sentence, so about two rows fit
  on screen.
- The sources sat in the panel above the list. A reader who wanted the source of
  a story had to find the story's pin first.

## Decision

**On a phone the day and the map hold the top of the screen and never leave it.
Only the list of stories scrolls, and the story at the top of the list is the one
the map marks.**

"Hold the top of the screen" is about the map's place in the layout, which never
changes. What the map shows can change, and the paragraph on the zoom below says
when.

The link runs both ways:

- The reader scrolls the list and the map follows, with no tapping at all. The
  story at the top of the list is chosen, so scrolling the list walks the map.
- The reader taps a pin and the list scrolls that story to its top, which is the
  same state reached from the other side.

**A map the reader has zoomed into also slides to the chosen story. A map showing
the whole world holds still.** The zoom is what tells the two apart, and the zoom
itself never changes when the map follows the list. Zoomed out, every pin is
already on screen, so moving the map could only take the world away. Zoomed in,
the map is a window, and a pin outside that window is a pin the reader cannot
see. The slide is eased over about a quarter of a second, and a reader who asked
their system for less movement gets a cut instead.

**The reader's own hand always wins.** A drag, a pinch, the zoom buttons and the
"whole world" button all stop a slide in progress and none of them move the map
back to the chosen story.

**The map collapses to a bar, and the bar keeps a small map.** One button over
the map's top left corner shrinks it, which gives most of the screen to the words
for a reader who is reading more than they are looking. The bar holds three
things: the day controls, a small live map, and the pill that says the day is
loading, is empty or could not be reached.

The small map is not decoration. `zoom` means "how many canvas widths the world
is wide", so it is the same number on both sizes and the small map shows the same
ground as the big one, drawn small. Zoomed out that is the whole world with a dot
per story; zoomed in it is the neighbourhood the story happened in. It follows
the list exactly as the big map does, so a reader who collapsed the map can still
see where they are reading about.

The button is named "collapse" and not "hide", because the map never goes away.
An earlier version did hide it, and hiding the one picture on the page to read
the words is a trade nobody has to make. The button carries that name in
`aria-label` and shows the "make this smaller" icon, because a word in that
corner covers a piece of the map: "Collapse map" took about a third of the width
of a phone's map.

The fold is not remembered between visits: the page stores nothing about the
reader, and that is what lets the credit line say so with no caveat.

Five decisions follow from that one:

1. **The panel is not shown on a phone.** It sits inside the scrolling column, so
   a panel that rewrote itself as the reader scrolled would resize the column
   under them. Each row opens in place instead: the summary becomes the whole
   story with its sources. Two things open a row, and the row is the only way to
   a source on a phone, so both are needed. A chevron at the foot of the row
   opens and folds it. A tap on the story itself opens it as well, because the
   chevron is one small target and a reader who taps a story means "show me this
   story"; that tap never folds a row back, since the row a reader taps is also
   the row the map marks, so a tap on an open row is a request to go back to it.
   A wide screen leaves the row folded on a tap: there the panel already prints
   the story in full, and opening the row too would print it twice.
2. **Nothing that the selection changes takes room in the layout.** The rule
   above, one step out. The selection follows the scrolling, so a box that grows
   or appears with it moves the list under the reader. What the phone still needs
   from the panel is one thing: a marker can cover several places, and nothing
   else would hint that the others are there. So a "next place" button floats
   over the map's bottom left corner, where a thumb reaches it, and it appears
   only when the chosen marker covers more than one place. The pill shares that
   corner, and the two are never on screen together: on a phone the pill only
   speaks about a day that has no pins yet.
3. **The phone screen holds the news and nothing else.** Everything that is not
   the day, the map or the stories is off it. The counts ("17 stories on the map,
   2 without a place") are the clearest case: they stand over the map and no
   reader waits for them. The pill they share still carries the loading line, the
   empty day and the failure, which a reader does wait for. The map itself keeps
   its own 2:1 shape with no floor under it, so no band of empty ocean takes room
   above and below it either.
4. **The footer is the room the list needs.** The last story can only reach the
   top of the screen when something below it can still scroll, so the footer
   carries a `min-height` of nearly a screen. The credits sit at the top of that
   room, right after the last story.
5. **The page shows no language picker, on any screen.** It follows the `lang`
   parameter in the address bar, then the browser's own languages. A picker is
   two taps of screen space spent on a choice the browser has already made.

The title and the tagline are hidden on a phone the way `.visually-hidden` hides
anything else, so they stay in the document for a screen reader.

## Consequences

- The phone layout has no "nothing chosen" state. A tap on the open sea leaves
  the reader where they are rather than blanking the pin they are reading about.
- **The zoom is the switch between a map that holds still and a map that
  follows.** An earlier version never moved the map at all, for a good reason:
  centring on every row would have zoomed the world in and out under the reader's
  thumb, and the whole world is what makes a pin worth looking at. Holding the
  zoom fixed is what keeps that reason satisfied while the map still follows. A
  reader reported the map as useless once zoomed in, which is the case this
  answers: the pin they were reading about sat outside the window.
- **A pin near the edge of the world cannot reach the middle of the canvas.**
  `clampView` allows no gap between the edge of the map and the edge of the
  canvas, so Wellington at 175 degrees east lands near the right-hand side rather
  than in the centre. That is the projection being honest, not a fault.
- **The small map groups no pins.** It draws a plain dot per story and skips
  `clusterPoints` entirely. Two reasons, and either one is enough: a numbered
  disc is up to 36 pixels across on a map 160 wide, and at that size every pin
  falls in one group anyway. `updateMarkers` therefore does nothing while the map
  is collapsed, so `state.markers` keeps the grouping the reader last saw at full
  size, which is what the panel's "this pin also covers N more" note is counted
  from.
- **The small map is a picture, not a control.** No panning, no pinching and no
  choosing a pin on it: a tap expands it instead. A map 160 pixels wide cannot be
  aimed at, and `touch-action: none` on it would capture a finger that meant to
  scroll the list.
- The address bar is written once the scrolling stops, not once per row. A
  browser limits how often a page may rewrite its address, and a long scroll
  would spend that budget in seconds.
- A story opened in the list stays open when the countries arrive from Wikidata
  and rebuild every row. The page holds the opened ids for exactly this reason.
- The summary is cut at 120 characters, which is about three lines on a phone.
  The cut lands between words and drops the punctuation it leaves behind.
- `clearSelection` now does nothing on a phone, and `selectStory` marks the list
  without rebuilding it. Rebuilding the list on every selection was affordable
  when only a tap could change it; the reader's scrolling changes it many times a
  second.
