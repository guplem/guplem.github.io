# ADR 0037: A dot says how the checks are going, read from the Actions API

## Context

The board already knew that the checks on a pull request had gone red: that is
one of the three ways into "Needs attention" (ADR 0011). It said nothing about
the other two cases, which are most of the time a reader looks:

- **Still running.** The reader has just pushed and wants to know whether to
  wait. The card looked exactly like a card whose checks all passed.
- **All green.** "Ready to merge" is about the review, not about the checks.

**And the reason that did exist had never once fired.** It read
`statusCheckRollup`, GitHub's own one-field verdict for a commit. That field
needs the Checks permission, and **GitHub offers no Checks permission on a
fine-grained token**, which is the only kind this board asks for (ADR 0001).
GitHub answers the field with null. No error reaches the page, nothing turns
red, and the feature simply never happens. It was shipped, reviewed and lived
in the code for months without working.

The same gap breaks `gh pr view` and `gh pr checks` for anybody holding a
fine-grained token, and GitHub has said the permission may come back one day.

## Decision

**One dot on every pull request card, beside the "PR" badge.** Green every run
passed, red one came back red, grey they are still running. A commit nothing has
run on draws no dot, because nothing ran is not a pass. Resting on it gives the
breakdown in words, worst first: "Checks: 2 failed, 1 still running, 5 passed."
The same sentence is on the dot for a screen reader, because a colour is not an
answer for everybody (ADR 0004).

**The checks are read from the Actions API**, `GET /repos/{owner}/{repo}/actions/
runs?head_sha=<commit>`, which a fine-grained token reads with "Actions:
read". That permission is now in `REQUIRED_PERMISSIONS`, so the setup guide, the
fingerprint and the "your token needs more access" notice all carry it without
anything else being written by hand (ADR 0005).

**The verdict is the board's own, worked out from every run on the commit.** The
board sees all of them here, which is what makes a sum an honest answer: one red
run is a red dot however many passed. The same verdict is what puts a card in
"Needs attention", so the dot and the column can never disagree.

**The board asks about a commit once and keeps the answer.** A run that has
finished stays finished, and the commit id changes the moment anybody pushes, so
a finished answer is good for as long as it exists. Only two answers are asked
again: runs still going, and a commit nothing has run on yet, because a workflow
can still start on one opened a second ago. `needsAsking` in `checks.js` is that
rule.

**"Nothing ran" is asked about five times and then left alone.** A repository
with no workflows answers it every time, and asking again on every refresh, for
every pull request in it, is the exact cost this rule exists to avoid. Five is
about five minutes on the default schedule.

**The calls for one token go together, not one after another.** They are
independent, and a board of twenty pull requests would otherwise take twenty
round trips before it drew anything.

## Consequences

- **The board sees GitHub Actions runs, and not a check posted by another
  service.** A repository whose CI is CircleCI or Jenkins gets no dot. That is
  the price of the only door GitHub opens to a fine-grained token, and it is
  better than a field that answers null for everybody.
- **A workflow run is coarser than a check run.** One run holds many jobs, so a
  repository with one workflow and ten jobs shows one dot and "1 passed" rather
  than ten. For "can I merge this yet" that reads better, not worse.
- **This is the one part of a refresh that grows with the board**: one call per
  pull request on the first read, and after that only the ones still building.
  `refresh.test.js` holds the worst case, twenty pull requests all building on
  the 30 second schedule, at 3000 of the 5000 REST calls an hour.
- **Every reader has to widen their token once.** The page tells them exactly
  what to add, which is what ADR 0005 built that flow for.
- **`invariants.test.js` fails if the query ever asks for `statusCheckRollup`
  again.** It is the obvious field, it looks like a simplification, and it
  cannot work here.
