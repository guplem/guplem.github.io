# ADR 0013: Work waiting on you is a row above the board, not a column in it

## Context

The board answers "what is assigned to me". There is a second question that
costs other people time rather than yours: **what is waiting on me**. A pull
request where somebody asked for your review blocks them until you answer, and
it does not appear on this board at all, because a review request is not an
assignment.

It cannot be a column either. The columns are the life of one change, from To do
to Done (ADR 0011), and somebody else's pull request is not at a stage of your
work. Putting it in a column would say you are doing it.

Two facts shaped the answer.

**Only search can find it.** `GET /issues` answers "assigned to me" and has no
filter for "waiting on me". `GET /search/issues?q=is:open is:pr
review-requested:@me` is the only endpoint that answers the question.

**Search answers in a different shape.** A search result carries
`repository_url`, an API address, where the issues endpoint carries a whole
`repository` object. Reading only the object leaves every review card with no
repository on it.

## Decision

**A row above the columns, scrolling sideways, outside the board.**

- It is fetched per token with `fetchReviewRequests`, like everything else, and
  merged, because a review can be waiting from any owner (ADR 0007).
- `normalizeWorkItem` reads the repository from either shape, so one function
  serves both endpoints and a review card looks like every other card.
- **Anything already on the board is left out of the row.** A pull request can
  be assigned to you *and* waiting for your review; showing it twice would put
  the same work on screen twice, and the board is the half that can move it.
- **The cards carry no move menu.** There is no column to move somebody else's
  pull request into: this row is ordered by how long a review has waited, and
  nothing in it sits in a column.
- **The cards take a note, like every other card.** They did not at first, on
  the reasoning that a note belongs on your own work. That reasoning was wrong:
  "ask about the migration before approving" is exactly the kind of thing worth
  writing down, and it is worth writing down against the pull request it is
  about. A note is filed under the item's node id, so it belongs to the work
  rather than to the place the card is drawn (ADR 0022).

**The order follows the reader's choice, and its default is the oldest first.**
The rest of the board defaults to newest first, which is right for your own work
and wrong here: the review that has been waiting three weeks is the one to
clear, and newest-first buries it under everything touched today. So
`reviewSortId` returns "least recently updated" while the sort is at its
default, and returns whatever the reader picked as soon as they pick something.

## Consequences

**One more call per token**, and it is a search call, which has its own smaller
rate limit (about 30 a minute rather than 5000 an hour). One per load is well
inside it, and the limit is a reason not to poll this in the background later
without thinking.

**A token that cannot search is not broken.** The row simply shows nothing from
it, and the rest of the board is unaffected.

**The default order is a rule, not a preference, and it is invisible.** Somebody
who has never touched the dropdown sees a different order in the row than in the
columns and is not told why. The alternative, one order everywhere, buries the
thing the row exists to surface. If this confuses anybody, the honest fix is a
word in the row's heading rather than dropping the rule.

**Team review requests are not included.** `review-requested:@me` finds what was
asked of you directly; `team-review-requested:` finds what was asked of a team
you are in. The second is a different question with a different answer ("does
anybody on the team need to do this, or specifically me"), and it can be added
when somebody wants it.

**Rejected: a seventh column.** The columns are stages of your own work, and a
column saying "somebody else's pull request" is not a stage. **Rejected: mixing
them into the board with a badge.** The list is already long, and the whole
point is that this is a different question with a different urgency. **Rejected:
one search for both questions.** The issues endpoint is cheaper, has the larger
rate limit, and already works.
