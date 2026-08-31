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

**On a phone the day and the map hold the top of the screen and never move. Only
the list of stories scrolls, and the story at the top of the list is the one the
map marks.**

The link runs both ways:

- The reader scrolls the list and the map follows, with no tapping at all. The
  story at the top of the list is chosen, so scrolling the list walks the map.
- The reader taps a pin and the list scrolls that story to its top, which is the
  same state reached from the other side.

Five decisions follow from that one:

1. **The panel is not shown on a phone.** It sits inside the scrolling column, so
   a panel that rewrote itself as the reader scrolled would resize the column
   under them. Each row opens in place instead: a "show more" button turns the
   summary into the whole story with its sources. That button is also the only
   way to a source on a phone, which is why every row has one.
2. **Nothing that the selection changes takes room in the layout.** The rule
   above, one step out. The selection follows the scrolling, so a box that grows
   or appears with it moves the list under the reader. What the phone still needs
   from the panel is one thing: a marker can cover several places, and nothing
   else would hint that the others are there. So a "next place" button floats
   over the map, and it appears only when the chosen marker covers more than one
   place.
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
- The map does not move when the selection follows the scrolling. Centring the
  map on every row would zoom the world in and out under the reader's thumb, and
  the whole world is what makes a pin worth looking at.
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
