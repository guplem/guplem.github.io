# ADR 0032: The children are a row of pills, and the list is one press away

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

The first fix showed the five children that wanted a person most and folded the
rest. That is still five rows of a card, and the line above them, "3 of 8
done", said how much was left and nothing about what it was (2026-09).

## Decision

**A parent draws one pill per child, and the list is one press below.**

- **One pill per child, painted with the colour of the column that child is
  in.** A pill is a small rounded bar with no words in it: the row of them is
  the whole answer to "how is this going", in one line, and it wears the same
  colours as the board the reader already reads (ADR 0024). Each pill is a link
  to that child, and hovering it says which issue it is and where it sits.
- **The count sits beside the pills: closed out of total.** Both numbers come
  from GitHub's own summary, so they count every child, including the ones past
  the twenty the board asks about. "Closed" is closed for any reason: work that
  was finished and work that was dropped are both off the list of things left
  to do.
- **The list is folded away until somebody presses for it, and then all of it
  shows.** The pills answer the question a glance asks, so the rows are the
  detail, and a reader who asks for the detail wants the whole of it rather
  than five of it.
- **The order is by how much each child wants somebody**, nearest first:
  changes were asked for, approved, somebody was asked to look, being written,
  not started, nothing known, finished. Two children in the same state keep the
  order GitHub gave, which is the order somebody arranged them in.
- **It is not the board's own order.** The columns read left to right as the
  life of a change, and that is right for a board and wrong for this list: it
  would put every unstarted child above the one with work to do. So there are
  two orders in this project, and each answers its own question. `children.js`
  holds this one and says why.
  The pills read in that same order, so the third pill and the third row are
  the same child.
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
- **A child the board could not ask GitHub about is hollow**, a dashed outline
  with nothing in it, so it cannot be mistaken for a child sitting in a column
  the reader left unpainted (ADR 0010).

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

**A pill stands only for a child the board knows.** GitHub answers with at most
twenty children and the board asks about one batch of them, so a parent with
more has pills for the ones it was told about and the count beside them for all
of them. The line under the list still says how many more are on GitHub.

**Rejected: showing every child by default.** A parent with twenty children
would own the column. That is what the pills exist to avoid.

**Rejected: one long bar cut into segments.** It reads as one quantity, and
these are separate issues the reader can open. Separate pills say that, and
each one can be a link.

**Rejected: counting "done" from the columns instead of GitHub's summary.** The
board knows the column of at most twenty children, and the count has to cover
every one of them.
