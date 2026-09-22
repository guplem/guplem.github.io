# ADR 0030: The tab carries the number, and the reader decides what it counts

## Context

A board open in a tab behind three others is a board nobody looks at. The page
answered "what is waiting on me" only to somebody already looking at it, so the
reader had to go and check, find nothing, and go back. The cost of that is paid
every time, and the answer is usually "nothing new".

The browser tab is the one part of the page that is visible from everywhere
else. It said "Work Board · Your GitHub Issues, Your Notes · Guillem Poy", which
is what a search engine needs and not what the reader needs.

## Decision

**The tab is named "Work Board", and "Work Board (N)" when N is more than
zero.** N is the number of cards in the parts of the board the reader chose. No
number when there is nothing: "Work Board (0)" is a number nobody needs, because
there is nothing to come back for.

**The reader decides what the number means, part of the board by part of the
board.** Each part answers two questions of its own, in Settings:

- **Does it add to the number in the tab?** The parts that do by default are the
  review row, "Ongoing", "Needs attention" and "Ready to merge": the work that is
  moving and waiting on somebody. "To do" is not started, "Awaiting review" is
  waiting on a person who is not the reader, and "Done today" is a log
  (ADR 0017), so none of them start counted.
- **Does its count hold the work pushed down?** Yes by default, because the
  badges counted everything before any of this existed, and changing a number
  the reader already reads, without asking, is worse than not offering the
  choice.

**The second answer is not only about the tab. It is the same number the badge
on that part already shows.** One number per part of the board, wherever it is
drawn. A badge saying 7 while the tab counts 4 would make the reader work out
which one to believe.

**A count that leaves work out says so.** Resting on the badge reads `2 cards
marked "not a priority" are not counted`. This is the line ADR 0026 draws:
a marked card is never hidden, because the board must not lie about how much
work there is. Leaving it out of a count is close enough to that to need the
same protection, so the card stays on screen, faint and last, and the number
that skipped it admits it on the spot.

**The same number sits beside the board's name**, and resting on it lists where
it came from, one line per part the reader chose. The tab shows the total; the
page shows the total and, for anybody who asks, the parts.

**Every number on the page comes from one pass.** `counting.js` is handed the
areas, the keys pushed down and the reader's choices, and it answers all of
them: each badge, the number beside the title, and the name of the tab. They
cannot disagree, because there is nothing for them to disagree about.

**The parts of the board are `colourableAreas()`**, the same list Settings
paints. One list, so the two screens can never drift apart on what the parts
are.

**The choices live in `board.json`.** They are the reader's opinion about their
own board, like a colour or the theme, and they are worth carrying to another
machine (ADR 0024). They are not what ADR 0025 kept local: they cost no rate
limit, and nobody wants their laptop and their desk to count differently.

## Consequences

- **The number follows the polling.** Nothing was needed to make that work: the
  board re-renders after every read, and the counting runs there (ADR 0025).
- **`document.title` is now written by the page.** It is the first place on this
  site that happens. The `<title>` in the file is untouched, so a crawler still
  reads the full name; only the open tab changes, and only after the board has
  something to say.
- **A count can now differ from how many cards are in the column.** That is the
  point, and it is why the badge explains itself. Nothing else on the board
  hides a number behind a setting.
- **Two devices flipping different answers for the same part, close together,
  keep only the newer one.** A record is merged whole, not field by field
  (ADR 0002). It is the same trade the colours and the notes already make.
