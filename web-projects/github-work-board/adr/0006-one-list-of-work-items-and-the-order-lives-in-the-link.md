# ADR 0006: One list of work items, and the chosen order lives in the link

## Context

The board showed issues and threw pull requests away. GitHub's issues endpoint
returns both in one answer and marks a pull request only with a `pull_request`
field, so dropping them was one line, and it was the wrong line. A review waiting
on you is work assigned to you. A board that hides it answers a question nobody
asked.

Keeping both raises two questions the first version never had to answer.

**What order?** One list holding two kinds of thing, from many repositories, has
no obvious order. "Recently updated" suits somebody opening the board in the
morning; "repository, then number" suits somebody clearing one project; "oldest
first" suits somebody hunting for what has been ignored. There is no single right
answer, so the reader picks.

**Where does the choice live?** Nowhere is wrong: a reload would throw it away.
`localStorage` is available (root ADR 0007), and the address bar is the site's
documented home for a view (root ADR 0006).

## Decision

**Issues and pull requests are one kind of thing: a work item.**
`workItems.js` reads both, tags each with `kind`, and marks a draft pull request.
The page shows the kind as a badge and says how many of each the list holds.
`permissions.js` gained `Pull requests: Read-only`, which is the first real use
of the token-update notice from ADR 0005: every reader who already connected is
told to add it.

**The order is chosen from a fixed list, and the choice lives in the address
bar.** `sorting.js` holds the orders; `urlState.js` puts the chosen one in
`?sort=`, omits it when it is the default, and uses `history.replaceState`,
because changing the order is not a place the back button should return to.

Two rules hold the sorting up, and both are tested:

- **Every order is total.** Each comparison falls back to the item's key, so two
  items updated in the same second always land the same way round. Without it a
  list appears to shuffle itself between renders and the reader loses their
  place.
- **An item with no date goes last in both directions.** A missing date is a
  broken answer from GitHub, not an old item, so putting it at the top of "oldest
  first" would be wrong every time.

**The `id` of an order is permanent.** It travels in links people save and share,
so a rename breaks them silently. `invariants.test.js` pins the set, the same way
it pins the storage keys.

## Consequences

**The list is longer and busier.** Somebody reviewing a lot will see more pull
requests than issues. A filter by kind is the obvious next step; it is not built
yet, and "ones you noted first" already covers the common case of returning to
what you were working on.

**The board asks for one more permission.** Least privilege says ask when you
use it, and ADR 0005 made asking later cheap, so this is the moment.

**`issues.js` became `workItems.js`.** The old name described what the file used
to return, and a file called `issues.js` that hands back pull requests is how the
next reader is misled. `normalizeIssues` became `normalizeWorkItems`.

**The order never reaches the saved document.** It is a view, not data: two
people are never involved, and a shared link carries it already. Adding it to
`board.json` would mean a save on every dropdown change.

**Rejected: a sort that lives in `localStorage`.** It survives a reload, and it
cannot be shared or sent to yourself. Root ADR 0006 already settled this for
view state. **Rejected: sorting server-side with the endpoint's own `sort`
parameter.** It covers three of the seven orders, cannot see your notes at all,
and would cost a network round trip per dropdown change. **Rejected: a separate
list for pull requests.** Two lists means two places to look for "what am I
meant to be doing", which is the thing this board exists to answer once.
