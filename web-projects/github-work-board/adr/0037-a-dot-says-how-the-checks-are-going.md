# ADR 0037: A dot says how the checks are going, and the rollup gives it its colour

## Context

The board already knew that the checks on a pull request had gone red: that is
one of the three ways into "Needs attention" (ADR 0011). It said nothing about
the other two cases, which are most of the time a reader looks:

- **Still running.** The reader has just pushed and wants to know whether to
  wait. The card looks exactly like a card whose checks all passed.
- **All green.** "Ready to merge" is about the review, not about the checks, so a
  card could sit there with the checks still running.

And a red card said only "Checks failed", never how many, or whether the rest
had even finished.

## Decision

**One dot on every pull request card, beside the "PR" badge.** Green every check
passed, red one came back red, grey they are still running. A pull request
nothing ran on draws no dot at all, because no checks is not a pass.

**The colour is GitHub's rollup. The numbers are the board's count.** GitHub
rolls every check on the last commit into one verdict, and that verdict is what
paints the dot. The breakdown in the tooltip is counted here, from the first 50
checks. They are two different questions, and the split is deliberate: a sum
done here could read green on a pull request GitHub calls red, because the board
reads 50 checks and GitHub rolls up all of them. The colour never lies, and the
numbers say when they describe only part of a longer list.

**Resting on the dot gives the breakdown in words**, worst first: "Checks: 2
failed, 1 still running, 5 passed." The same sentence is on the dot for a screen
reader, because a colour is not an answer for everybody (ADR 0004). A card whose
checks the board could not count still says what the verdict is.

**A skipped or neutral check counts as a pass**, which is how GitHub's own
rollup counts it. Numbers that argue with the colour beside them are worse than
no numbers.

**The checks are asked for on the pull request, and not on the pull requests an
issue closes.** Every card that draws a dot is a `PullRequest` node, so the
other branch needs nothing. This is the whole of the cost decision, and it was
measured, not guessed.

## Consequences

- **The feature costs nothing.** Measured with `rateLimit(dryRun: true)` on a
  full batch of 100 items: 18 points before, 18 with the checks asked for on the
  pull request, 23 with them on both branches, where they multiply by the five
  linked pull requests each issue carries. `invariants.test.js` fails if a second
  branch ever asks for them.
- **The `first:` number costs nothing either**, so 50 is chosen for the size of
  the answer that comes back rather than for the bill. No check's name and no
  address is asked for, only what each one says.
- **The measurement also found a stale number.** `GRAPHQL_POINTS_PER_TOKEN` read
  26 and measures 36: the query had grown and nobody had asked GitHub again. It
  is corrected, and ADR 0025 now says to measure it again whenever the query
  grows a field.
- **An issue card draws no dot**, even when the board reads its column from a
  pull request. The dot is about one commit, and an issue has none.
