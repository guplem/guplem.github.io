# ADR 0040: The tokens, and their first calls, are asked together

## Context

A full read was slow, and it grew slower with each token. For each token,
`inspectToken` waited on its calls one after another: who the token belongs
to, the open work, the finished work, the reviews, the relationships (one or
two GraphQL calls) and the checks. Then the next token started. A reader with
three tokens waited for about 21 round trips in a row, which is 6 to 12
seconds on an ordinary connection.

Most of that waiting bought nothing. A fine-grained token belongs to one owner
(ADR 0007), so no token needs another token's answer. Inside one token, the
first four calls need nothing from each other either. Only the relationships
need the item ids, and only the checks need the commit ids that the
relationships return.

## Decision

**Every token reads at the same time, and so do a token's first four calls.**

- **`connectAll` asks every token with one `Promise.all`.** It merges the
  answers afterwards, in the order of the token list, never in the order that
  the answers arrived. So two tokens that both see one item always resolve it
  the same way, as before.
- **`inspectToken` asks four calls together**: `fetchViewer`,
  `fetchAssignedIssues`, `fetchFinishedWork` and `fetchReviewRequests`. The
  relationships wait for all four, and the checks wait for the relationships.
  The chain for one token goes from about seven round trips to four.
- **The first token in the list that answers names the reader** (`state.login`),
  as it did when the tokens read one after another. `inspectToken` returns
  the login, and `connectAll` sets it during the merge.
- **The page opens the connection to `api.github.com` before the scripts run**,
  with `<link rel="preconnect" ... crossorigin>` in `index.html`. The
  `crossorigin` attribute matters: `fetch` calls GitHub without cookies, and
  the browser keeps those calls on a separate connection. A preconnect without
  the attribute opens a connection that no call uses.
- **The read bar counts the steps of every token together** (ADR 0039).
  `readProgress.stepsDone` counts them, whatever order they ended in. The
  refresh button's tooltip names the earliest step that some token has not
  finished. It names the token when one is left on that step, and counts the
  tokens when several are left ("with 2 of 3 tokens").

Measured in the page, with every GitHub answer held for 300 milliseconds:
three tokens drew the board in about 0.63 seconds. One after another, the same
read takes about 4.5 seconds.

## Consequences

- **The read makes exactly the same calls**, so the rate limit costs the same.
  (ADR 0041 later added one call, only for a token that found no work.)
  The tight budget, `search` at 30 a minute (ADR 0025), is untouched.
- **The board still draws once**, with every answer in place. No card moves to
  another column a moment after it appears. That is why the board does not
  draw the open work before the relationships arrive, which would be faster to
  see and worse to read.
- **A token that fails its first call has already spent three more calls.**
  Before, it stopped after the first one. A broken token is rare, and three
  calls are cheap next to a slower read for every reader.
- **Two tokens that reach the same commit can both ask about its checks** in
  one read, because neither has an answer yet when both ask. The cache keyed by
  the commit id (ADR 0037) stops it on the next read. This costs a call only
  when two tokens reach the same repository, which ADR 0007 makes rare.
- **About 4 calls for each token start at the same moment.** GitHub refuses
  more than 100 calls at once from one account, so this holds for any board
  with fewer than about 20 tokens.
- `invariants.test.js` pins the two `Promise.all` calls and the preconnect.
  A loop with an `await` in it looks tidy and makes the board slow again, and
  nothing else would fail.
