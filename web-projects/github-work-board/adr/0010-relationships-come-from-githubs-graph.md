# ADR 0010: Relationships come from GitHub's graph, in one call per token

## Context

A pull request and the issue it closes are one piece of work. The board showed
them as two cards, which is the board asking you to do the same thing twice. The
same goes for an issue that is part of a bigger one, and for an issue that cannot
be started because another is not finished.

GitHub knows all of this. Its own sidebar calls the section **Relationships** and
shows three kinds: a **parent issue** (sub-issues), **blocked by** (issue
dependencies), and **Development**, the pull requests that would close the issue.

There are two ways to get at it, and only one of them is right.

**Read the text.** Every project has the habit of writing `Closes #123` in a
pull request description, and GitHub itself parses that. Reading it again in
this board would be wrong the moment somebody writes `closes GH-123`, or links
the issue through the sidebar without writing anything, or writes the number in
a sentence that means something else. It is a guess dressed as a fact.

**Ask GitHub.** The links are first-class data. The question was whether they are
reachable without a call per item, which for twenty items would be sixty calls.

## Decision

**Ask GitHub's GraphQL API, in one call per token, for the items that token
already returned.**

`Issue` exposes `parent`, `blockedBy`, `blocking`, `subIssuesSummary` and
`closedByPullRequestsReferences`; `PullRequest` exposes
`closingIssuesReferences`. All of it can be asked for at once through
`nodes(ids: [...])`, keyed by **the node ids the board already holds for every
item** (ADR 0002 made the node id the permanent key, for a different reason).
So the whole graph for a board costs one call, not sixty, and needs no
permission beyond the `Issues: read` the board already asks for.

Three rules follow from what the data means:

- **The batch goes out with the token that returned those items.** A node id
  from one owner is not readable by another owner's token (ADR 0007), so
  relationships are fetched per token and merged afterwards.
- **A closed blocker does not block.** Only a blocker still open marks an item
  "Blocked". Counting closed ones would leave half the board marked for ever and
  the word would stop meaning anything.
- **A pull request nests under the issue it closes, when both are on the
  board.** If its issue is not there, it keeps its own card, because hiding it
  would lose it.

`invariants.test.js` fails if any module starts reading `closes #` out of text.

## Consequences

**One more round trip per token**, after the issues call, because the ids are
not known until the first answer arrives. The board draws its placeholders
through both (ADR 0004), so the wait is visible but not blank.

**The relationships are never saved.** They are GitHub's data, not the reader's,
so they stay out of `board.json` and are fetched fresh. Nothing in the saved
document can go stale against them.

**A blocked card can now be told from a ready one at a glance**, which is what
makes a "what's next" queue worth building later: the first honest answer to
"what should I do now" is "not that, it is blocked".

**Nesting changes what a list of twenty items looks like.** Ten issues with ten
pull requests become ten cards, not twenty. That is the point, and it means the
counts under the heading and the number of placeholders drawn are counts of
items, not of cards.

**GraphQL answers 200 with an `errors` array** when part of a query fails, which
is not how the REST paths in `gateway.js` behave. The board keeps whatever nodes
came back and shows the rest of the item normally: a missing relationship is a
quieter failure than a missing card.

**Rejected: reading `Closes #123` out of descriptions.** It is the obvious
approach and it is a guess: it misses links made through the sidebar, misses
other spellings, and invents links from any sentence with a number in it.
**Rejected: the REST dependencies endpoints** (`/issues/{n}/dependencies/blocked_by`).
They work and they are one call per issue per direction. **Rejected: moving the
whole item fetch to GraphQL search.** It would save the extra round trip and
rewrite the part of the board that already works, for a saving of one call.
