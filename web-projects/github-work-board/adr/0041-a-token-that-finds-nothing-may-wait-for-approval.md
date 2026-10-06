# ADR 0041: A token that finds nothing may wait for approval, and the board says where to approve it

## Context

An organisation can ask its owners to approve each fine-grained token made for
it. Until an owner does, the token signs in and reads public data only. Every
call the board makes answers 200: `/user` names the reader, `/issues` answers an
empty list, and search answers no items. So the board found nothing and said
"Nothing open is assigned to you", and its advice was "add a token owned by that
organisation", which the reader had just done.

The reader had no route from the empty board to the cause. The fix is one press
by an organisation owner, on a page that the reader may not know exists:
`github.com/organizations/<org>/settings/personal-access-token-requests`.

GitHub makes this hard to see from a token:

- **No call says "pending".** The list of token requests needs an owner's
  credential. A refused call carries `X-Accepted-GitHub-Permissions`, which
  says what the endpoint accepts and never what the token holds.
- **No call names the token's resource owner** (ADR 0007).
- **`GET /user/orgs` answers an empty list to every fine-grained token.** The
  public list, `GET /users/<login>/orgs`, holds only public memberships, and a
  membership is private by default.

## Decision

**A token that found no work of any kind gets one more question: does it reach
a private repository?** `GET /user/repos?visibility=private&per_page=1`.

- A pending token reads public data only, so it answers an empty list.
- A personal token reaches the reader's own private repositories.
- An approved organisation token reaches the organisation's private
  repositories.

When the answer is empty, the board says the token **may** wait for approval.
It never says "does": a token limited to public repositories answers the same
way. A failed call proves nothing, and the board never reads it as "pending".
`approval.js` holds these rules.

**The board names the organisation when it can, and asks the reader when it
cannot.** It reads the person's public organisations once a visit. When that
list is empty, the reader types the organisation once, and `settings.js` keeps
the name beside the token. A typed name wins over the public list.

**A callout above the board, one for each such token**, not only on an empty
board. A reader whose personal token finds work would otherwise never see that
the organisation's token finds nothing. The callout holds the approval page,
a button to copy its link for the owner, the reader's own token list on GitHub,
and the box for the organisation's name. Settings says the same on the token's
"issues" row. The empty board drops its "add a token" advice while a callout
shows.

**The question is a step of the read** (`approval` in `READ_STEPS`), so the read
bar does not stall on it (ADR 0039).

## Consequences

- **A token that finds nothing costs one more `core` call on every read**, and
  one more once a visit for the public organisations. A token that finds work
  costs nothing more. `core` allows 5000 calls an hour, so at one read a minute
  this spends about 1% of it, and only until the token is approved.
- **A false "may" is possible**: a token limited to public repositories reads
  exactly like a pending one. The sentence says "may" and says what the board
  saw, so the reader can judge.
- **A typed organisation name can go stale**, exactly like a typed token name
  (ADR 0007). The reader can change it in the same box.
- **Rejected: list the token requests.** That call needs an organisation
  owner's credential, which the reader usually does not hold.
- **Rejected: read the 403 message of an organisation call.** The board would
  have to know the organisation's name first, and a pending token reads an
  organisation's public data without any error.
