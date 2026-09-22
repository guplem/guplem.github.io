# ADR 0032: The children read by what wants a person, and the rest fold away

## Context

A parent issue's card lists its children, each with the column it is in
(ADR 0010). The first build listed them in the order GitHub answered with, cut
off at the ten the query asked for, and said "and 7 more on GitHub" with
nowhere to go.

Two things are wrong with that. The reader cannot reach the rest, and the ten
they can see are whichever ten GitHub happened to answer with. A parent with
ten children nobody has started and one whose reviewer asked for changes shows
the ten nobody can act on.

A card is also a card. It sits in a column beside five others, and twenty rows
of children is not a card any more.

## Decision

**The children read by what wants a person, the card shows five, and the rest
are one press away.**

- **The order is by how much each child wants somebody**, nearest first:
  changes were asked for, approved, somebody was asked to look, being written,
  not started, nothing known, finished. Two children in the same state keep the
  order GitHub gave, which is the order somebody arranged them in.
- **It is not the board's own order.** The columns read left to right as the
  life of a change, and that is right for a board and wrong for this list: it
  would put every unstarted child above the one with work to do. So there are
  two orders in this project, and each answers its own question. `children.js`
  holds this one and says why.
- **Five, then a fold.** Enough to read at a glance from inside a column, few
  enough that a parent with twenty children is still a card. The press says
  "Show all 12", and it says "Show fewer" once it is open.
- **The fold is per card, and it survives a refresh.** The board rebuilds every
  card each time it asks GitHub, so a list opened a minute ago would close
  itself. `state.childrenOpen` holds the parents that are open, the same way
  `state.notesOpen` holds a note box somebody opened.
- **"And 7 more on GitHub" is only what GitHub did not answer with**, and it is
  a link to the issue. The folded children are not "more on GitHub": they are
  one press away.
- **The state wears the colour of its column.** The reader paints the columns
  (ADR 0024), and a child's state is the name of a column, so it is painted with
  the same channels, at two alphas of its own sized for a small badge. A column
  nobody painted leaves the badge exactly as it was.

## Consequences

**The board asks GitHub for twenty children, not ten.** The list itself is free:
it adds no nested connection to the query, so ten and fifty both cost 13 points,
measured with `rateLimit(dryRun: true)`. What it spends is room in the second
pass, which is one batch of 100 ids, so twenty is five parents' worth of
children before anybody's child loses its state (ADR 0010, ADR 0025).

**A parent with more than twenty children still says so**, and the line goes to
the issue, where GitHub lists every one of them.

**The fold is not saved.** It is not the reader's half of the board, any more
than an open note box is; it lasts as long as the tab does. Saving it would put
a record in `board.json` for every parent anybody ever expanded.

**Two orders now live in this project.** That is the cost of the decision above,
and it is the reason `children.js` exists as its own file rather than as a sort
inside `app.js`: the order is a decision with a reason, and it is written next
to the code that holds it.

**Rejected: the board's own column order.** One order instead of two, and it
hides exactly the child the reader needs to see.

**Rejected: a `<details>` element.** It needs no state, and it closes itself
every time the board asks GitHub again, which on the default schedule is every
minute.

**Rejected: showing every child.** A parent with twenty children would own the
column, and the five that want a person would be lost among them.
