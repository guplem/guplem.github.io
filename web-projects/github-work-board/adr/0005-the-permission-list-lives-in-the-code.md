# ADR 0005: The permission list lives in the code, and the page asks for a wider token

## Context

The reader of this board grants access once, by hand, in GitHub's token form,
and then forgets about it. Two things follow from that, and the first version of
this project got both wrong.

**The setup guide was written by hand in `index.html`.** The permissions it
listed were a copy of what the code happened to need on the day it was written.
Nothing joined the two. The next change that adds a GitHub call adds the
permission it needs to its own request, the code works for the agent that wrote
it (whose token is already wide), and the guide keeps telling every new reader to
create a token that cannot do the job. The same copy exists a third time in
`README.md`.

**A token already made cannot widen itself.** Adding a call to this board does
not change a token somebody created three months ago. That reader's board simply
starts failing, on one feature, with GitHub's own words: "Resource not accessible
by personal access token". They have no way to know which box to tick, or that
anything changed at all.

Both are the failure this project is built to resist (ADR 0003): a later pass
that is correct in itself, passes every test, and quietly breaks something
nobody is looking at.

## Decision

**`permissions.js` is the single place this board says what it needs.**

- `REQUIRED_PERMISSIONS` holds one entry per permission: the `id`, the `name`
  and `level` exactly as GitHub's own form labels them, and the `why` the reader
  is shown.
- **The setup guide is built from that list at load.** `index.html` carries an
  empty slot, never the permissions themselves. `invariants.test.js` fails when
  the page spells a permission out again.
- **The README is checked against the same list.** A test fails when a required
  permission is missing from it, because the README is read before the page can
  say anything.
- **Every permission is proved by a call, and Settings says green or red for
  each one.** `CONNECTION_CHECKS` holds one entry per permission, naming the
  call that proves it and the permission it belongs to. A test keeps the two
  lists in step, so a permission nothing proves cannot exist.
- **Settings proves them all, on purpose, every time it is opened.** The
  ordinary read fills the same rows for free, but it can only report on what it
  happened to need: a token whose work carries no pull request never tries the
  checks, so that row would sit unanswered for ever. A permission nobody tries
  is one the reader meets the day it matters. It costs one call per permission,
  paid when a person asks, never on a refresh. A button on the same screen runs
  them again, for somebody who has just fixed a token in another tab.
- **A permission with nowhere to be tried is tried somewhere else.** The checks
  need a repository, and a token with no work assigned has none on the board. So
  the pass asks GitHub for any one repository the token reaches and tries it
  there. A token that reaches no repository at all is broken, and the row says
  exactly that.
- **A failed row names the permission and its level, spelled as GitHub's own
  form spells them, and says what stops working.** "Resource not accessible by
  personal access token" is what GitHub answers, and the reader is looking at a
  form with dozens of permissions on it. `Add "Actions → Read-only" to this
  token on GitHub, then check again. Without it, the board cannot say how the
  checks on a pull request are going.` Every entry carries that `without`
  sentence, and a test requires it.

**So: adding a call that needs new access means adding one entry to
`REQUIRED_PERMISSIONS`, and one to `CONNECTION_CHECKS`.** The guide, the README
check and what Settings says all follow. This is written into `AGENTS.md` and
into the `change-the-board` skill as a required step.

## Consequences

**Least privilege stays affordable.** The reason to over-ask up front ("grant
Pull requests now, so you need not edit the token later") disappears, because
widening later costs the reader one prompt they cannot miss. The board therefore
asks only for what it uses today.

**There is no banner across the board, on purpose.** A reader who suspects a
problem opens Settings, and Settings answers it line by line. The board itself
stays about work.

**Rejected, and removed: stamping the token with what it was approved
against.** The board used to save a fingerprint of the list beside each token on
a successful connect, and raise a notice when the list later grew. It was a
claim about the past, not a check on the token, and it was wrong in both
directions: it could not see a token narrowed afterwards on GitHub, and it kept
telling a reader who had just widened their token that the token was behind,
because nothing on GitHub writes to this browser. Only re-adding the token
cleared it. The real calls answer the same question truthfully and cost
nothing.

**Rejected: generating the HTML at build time.** There is no build step (root ADR
0002). **Rejected: leaving the guide by hand and trusting a review.** The review
is a green test suite (root ADR 0009), and no test could see this. **Rejected:
asking for every permission the board might ever want.** It is a real cost paid
by the reader, in access they did not need to give, to save the author a step.

> **Note (2026-09):** the list shrank once. `Contents` moved to the cloud storage's own permission list (`web-projects/cloud-storage/cloudPermissions.js`), because the board file is written by the cloud token, not by a work token (root ADR 0016). A shrinking list needs no notice now: every row in Settings is a call, and a call that no longer happens is a row that no longer exists.
