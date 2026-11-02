# ADR 0051: The projects are a pill and a filter, and their permission is optional

## Context

GitHub Projects is a board that holds issues and pull requests from many
repositories. A team plans its work there: "Iteration board", "Roadmap". The
reader wanted to see on each card which projects the work is in, and to narrow
the board to one project.

ADR 0047 rejected the project **fields** (a project's Status, its iteration),
for three reasons. The reader confirmed that they need no field: only the name
of each project the work is in. Two of the three reasons still apply to the
name:

- **The permission.** GitHub answers the projects of an item only through
  GraphQL, and only to a token that carries the organisation permission
  "Projects: read". Every token made before this change lacks it.
- **A personal account.** A fine-grained token cannot read a project that a
  personal account owns, whatever it is granted. GitHub lists this among the
  limits of fine-grained tokens. Only a classic token with the `project` scope
  can read one, and this board takes fine-grained tokens only.

The third reason, the cost, does not apply to the name. A project field needs
a connection nested under each project item. The name does not.

Four questions decide the design:

- **Is the permission required?**
- **Where does the query go?**
- **What does it cost?**
- **What does the card show, and what does a press do?**

## Decision

**The permission is optional.** `REQUIRED_PERMISSIONS` marks the Projects entry
`optional: true` and `owner: "organisation"`. It is the only entry with either
mark. A token without it reads everything else as before and shows no
projects. So no reader has to make a token again, and a token for a personal
account, which has no organisation permissions at all, is not broken. The
setup guide lists it in its own step, "Organization permissions (optional)",
because GitHub's form keeps it in that list, apart from the repository
permissions.

**A token without it is told so, and is not reported as broken.** Its row in
Settings wears "Optional", not "Fix". `summariseChecks` leaves a `skipped` row
out of its count, and the token does not fold open as trouble. The row says
which permission adds the projects.

**The projects are a query of their own** (`fetchProjects` in `gateway.js`), never
a field in the relationship query. GitHub refuses a project item the token may
not read with an `errors` entry and a null in its place. A null inside a list
that GitHub promises is never empty climbs up to the whole node. In the
relationship query that would take the item's parent, blockers and pull
requests with it, on every token without the permission. A query of its own
loses the projects and nothing else. `invariants.test.js` fails when the
relationship query asks for `projectItems`.

**The query runs at the same time as the relationships**, with the same item
ids and the same token (ADR 0010, ADR 0040). It is one more step of the read
bar, `projects` (ADR 0039).

**A missing permission is told apart from a project out of reach.**
`projects.readProjectsAnswer` reads the whole GraphQL body. A refusal with no
project read anywhere means the token lacks the permission. A refusal beside a
project that was read means the permission is there, and one project belongs
to an owner the token does not reach.

**It costs about one point a refresh.** GitHub counts one request for each
object a connection hangs from, and charges one point per 100 requests. The
query has one connection, `projectItems(first: 10)`, under at most 100 items,
and nothing nested under it. `GRAPHQL_POINTS_PER_TOKEN` grew from 36 to 37.
This number comes from GitHub's published rule, not from
`rateLimit(dryRun: true)`. The same rule gives about 23 for the relationship
query, against the 18 measured, so it errs high.

**A closed project is left out**, like a closed blocker. It is history.

**A project is a pill with two halves, after the milestone**, in the same
shape as the milestone pill (ADR 0045). The icon links to the project on
GitHub. The name is a filter chip, pressed while the board is narrowed to that
project. On a review card the name is text, because the board's filters never
narrow the review row (ADR 0009).

**A project filter is chosen by name**, like a milestone. The name travels in
the link as `project=`, one parameter for each project, and it is permanent.
Two projects widen the board; a project with a repository narrows it
(ADR 0009). The filter bar offers a "Project" menu from one project up.

**The reader can hide the pills.** `projects` is a new part of a card in
`CARD_PARTS` (ADR 0047).

## Consequences

**A project owned by a personal account never shows.** The board cannot tell
the reader that such a project exists, because GitHub does not tell the token.
The setup guide and the README say so.

**Work with no project read reads as work in no project.** A token without the
permission, an item in no project, and an item in a personal project all look
the same on the card. The Settings row is the one place that tells them apart.

**Two projects with one name share one chip**, like two milestones with one
name (ADR 0045). Each pill still links to its own project.

**A project renamed on GitHub leaves an old link filtered on a name no item
carries.** "Clear the filters" is the way out, as for a renamed milestone.

**Rejected: a required permission.** It would tell every reader with a token
made before this change that their token is behind, for a feature that some
of them will never use, and a token for a personal account could never pass.

**Rejected: the Status field.** The reader did not need it, and it would add a
nested connection to each project item on every refresh (ADR 0047).
