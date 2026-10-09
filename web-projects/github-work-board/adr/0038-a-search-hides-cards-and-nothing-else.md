# ADR 0038: A search hides cards and nothing else

## Context

The reader often knows one number, #312, and wants one answer: which column is
that pull request in? The board had no way to ask. The reader read the number
off every card in six columns and the review row.

The board already narrows by kind, repository, label, milestone and person (ADR 0009).
Those chips answer "show me a kind of work". A number answers "show me one
piece of work", which is a different question with different rules.

## Decision

**A find box in the masthead hides every card that does not answer it.** The
columns and their headings stay, so the one card left sits in the column that
it is in. `boardSearch.js` holds the rules, and `app.js` applies them last,
after the order, the grouping and the counts.

- **A number finds that number exactly.** "31" keeps #31 and hides #312. The
  reader types the whole number they know, and a number that merely starts
  with it is noise. A leading `#` is allowed.
- **A bare number finds it in every repository.** Two repositories can each
  have a #12, and the board shows both. A GitHub link pasted into the box
  names its repository, and then only that one stays.
- **Anything else is words.** Every word must appear in the title or the
  repository name, in any case.
- **A pull request nested in an issue's card keeps that card whole.** The card
  is where the reader finds the pull request (ADR 0010).
- **The chips step aside while a search is typed.** They fade and stop
  narrowing. The question is "where is it", and a chip must not hide the
  answer. They come back the moment the box is empty.
- **The counts, the badges and the tab do not change.** They are worked out
  over the board before the search narrows anything (ADR 0030). A tab that
  read "(1)" would say "one thing waits for you", which is false.
- **The review row hides when nothing in it matches**, and a column with no
  match says "No match". When nothing on the whole board matches, the empty
  callout says so and offers "Clear the search".
- **`/` reaches the box from anywhere on the board**, as on GitHub, unless the
  reader is typing somewhere else. Escape empties it.

## Consequences

**The search lives for this visit only.** It is not in the link and not in
`board.json`. This is the one piece of board state kept out of the address bar
on purpose: a saved link that opened on one card would look like a broken
board, with no sign of why. `invariants.test.js` pins that, and pins that the
counts never read the searched lists.

**The search costs nothing.** It runs over the answer already in memory, on
every key, and asks GitHub for nothing (ADR 0025).

**A search finds only what the board holds.** Work nobody assigned to the
reader, and work closed outside the last column's range, is not on the board,
so the search cannot find it. The empty callout names the text that found
nothing, so the reader can tell a typo from an absence.

**Rejected: matching the start of a number.** It narrows as the reader types,
but it leaves #312 beside #31 once the whole number is in, which is the one
moment that matters.

**Rejected: the search as a fifth chip filter.** A chip narrows together with
the other chips (ADR 0009). A search that a chip could defeat would miss the
card the reader is sure is there.
