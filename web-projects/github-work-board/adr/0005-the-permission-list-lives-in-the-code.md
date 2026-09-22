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
- **A token is stamped with what it was approved against.** On a successful
  connect, `permissionsFingerprint()` is saved next to the token. On load, a
  saved fingerprint that no longer matches raises a notice that names the exact
  permissions to add and links to the reader's tokens.

The fingerprint follows `id` and `level` only. Rewriting the reason a permission
exists must not tell every reader their token is out of date.

**So: adding a call that needs new access means adding one entry to
`REQUIRED_PERMISSIONS`.** The guide, the README check, the fingerprint and every
existing reader's prompt all follow from that one edit. This is written into
`AGENTS.md` and into the `change-the-board` skill as a required step.

## Consequences

**Least privilege stays affordable.** The reason to over-ask up front ("grant
Pull requests now, so you need not edit the token later") disappears, because
widening later costs the reader one prompt they cannot miss. The board therefore
asks only for what it uses today.

**A reader who never returns to the page is never told.** The notice appears on
load, so somebody who stops using the board and comes back in a year meets it
then, which is the right moment anyway.

**The fingerprint is a claim about the past, not a check on the token.** It
records what the board asked for when the reader last connected successfully. It
cannot detect a token the reader narrowed afterwards on GitHub. That case still
surfaces the old way, as a failed call naming the missing permission
(`githubErrors.js`), which is the safety net underneath this.

**One more storage key.** `invariants.test.js` pins the exact set, so adding it
failed that test first. That is the guard working as designed: the key was added
on purpose, and the test was updated in the same change.

**Rejected: generating the HTML at build time.** There is no build step (root ADR
0002). **Rejected: leaving the guide by hand and trusting a review.** The review
is a green test suite (root ADR 0009), and no test could see this. **Rejected:
asking for every permission the board might ever want.** It is a real cost paid
by the reader, in access they did not need to give, to save the author a step.

> **Note (2026-09):** the list shrank once. `Contents` moved to the cloud storage's own permission list (`web-projects/cloud-storage/cloudPermissions.js`), because the board file is written by the cloud token, not by a work token (root ADR 0016). `tokenNeedsUpdate` therefore says "no" for a token that carries more than the list asks for: a token approved under the old list has nothing to add.
