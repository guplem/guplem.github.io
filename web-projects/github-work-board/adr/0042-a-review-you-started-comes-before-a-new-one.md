# ADR 0042: A review you started comes before a new one

## Context

The review row lists the pull requests that wait for the reader's review. In
the smart order it read oldest first, with each stack in merge order (ADR 0016),
and the cards that the reader pushed down at the bottom (ADR 0026).

That order treats two kinds of request the same way:

- **A first request.** Nobody has looked at the work yet.
- **A second request.** The reader reviewed it, the author answered, and the
  author asked the reader to look again.

A second request is half-done work. The author waits on it, and it is usually
quicker than a first review, because the reader already knows the change. When
first requests come first, second requests pile up, and authors wait longest on
the work that is closest to done.

GitHub has no "re-requested" flag. The reader is in `reviewRequests` both
times. What tells the two apart is whether the reader already submitted a
review. `latestOpinionatedReviews`, which the query already asks for, cannot
answer this: it holds approvals and change requests, and it leaves out a review
that is only a comment. A reviewer who leaves comments and no verdict is common.

## Decision

**In the smart order, the review row raises every pull request that the reader
reviewed before.** Any submitted review counts: approved, changes requested,
commented, or dismissed. A pending review does not count, because the author
never saw it.

- **The query counts the reader's own reviews**: `readerReviews: reviews(first:
  1, author: $login, states: [...]) { totalCount }` on each pull request.
  `relationships.js` reads it as `reviewedByReader`.
- **The field is asked only when the login is known**, through
  `@include(if: $knowsReader)`. An empty `author` makes GitHub count every
  reviewer, and every pull request would read as reviewed.
- **The raise is the red-check raise, on a flat row**
  (`priority.raiseReviewedBeforeItems`). A pull request in a stack takes its
  whole stack up, in merge order, because nothing in a stack merges before the
  one below it (ADR 0016).
- **The passes run in this order**: the stacks, then this raise, then the
  reader's own raise (ADR 0044), then the reader's own sink. A card that the
  reader pushed down stays down, because their hand beats the rule (ADR 0026).
- **Only the row runs it.** The board holds the reader's own work, not reviews.
  `invariants.test.js` pins both the order of the passes and the single call.

## Consequences

- **It costs nothing in the rate limit.** A full batch of 100 pull requests
  measured 18 points with the field and 18 without it, with
  `rateLimit(dryRun: true)`. `GRAPHQL_POINTS_PER_TOKEN` stays the same.
- **Inside each half, the order stays oldest first.** The reader still clears
  the longest wait first among the reviews they started, and then among the new
  ones.
- **A reader who left one small comment long ago gets that pull request
  raised.** That is acceptable: the author still waits on somebody who already
  looked at the work.
- **Rejected: read `latestOpinionatedReviews`.** It costs nothing either, but
  it misses a review that is only a comment, and a real account showed two such
  reviews among three.
- **Rejected: raise only when the reader asked for changes.** A reader who
  approved and was asked again, or who only commented, also has half-done work.
