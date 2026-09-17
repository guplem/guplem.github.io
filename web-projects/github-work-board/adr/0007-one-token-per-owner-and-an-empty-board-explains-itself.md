# ADR 0007: One token per owner, and an empty board that explains itself

## Context

The board connected, every check passed, and the list was empty: "0 open issues
and 0 pull requests are assigned to you." Eighteen issues and pull requests were
assigned to that person at that moment.

The cause is a property of fine-grained tokens that the first design never
accounted for. **A fine-grained token belongs to exactly one resource owner**:
your personal account, or one organisation, chosen when the token is created. A
token owned by your account cannot see an organisation's repositories at all, no
matter which permissions it carries and no matter that you work in them every
day. Organisations must also allow fine-grained tokens, and an owner often has
to approve each one.

So for anybody whose work lives in an organisation, one token can never be
enough:

- The **organisation's** token reaches the issues and pull requests.
- The **personal** token reaches the private notes repository, which belongs to
  the person, not the organisation. Putting the notes in the organisation would
  make them readable by its owners, which is the one thing the notes must not be.

The second failure was worse than the first. The board said "Nothing is assigned
to you right now", which is a confident, plausible, wrong answer. Nothing on the
page suggested the tokens could not see where the work lived, so the reader has
no route from the symptom to the cause.

## Decision

**The board holds a list of tokens, not a token, and asks every one of them.**

- `settings.js` stores a list. Each entry carries the token, a permanent `id`,
  the permission fingerprint it was approved against (ADR 0005), the repository
  owners it turned out to reach, and whether it can write the notes file.
- **Every token is asked for the work assigned to you, and the answers are
  merged** by node id, so an item two tokens can both see appears once.
- **Exactly one token writes the notes file**: the first whose owner holds that
  repository. `boardWritingToken` picks it, so a save never goes out with a token
  that was never going to be allowed.
- The same token twice is refused. It would double every item on the board and
  read as a syncing fault rather than a slip of the clipboard.

**An empty board says how far it can see.** `sayEmptyBoard` never says "nothing
is assigned to you" on its own: it always names how many tokens are in use and
which owners they reach, and the page adds the one thing worth trying, which is
adding a token owned by the organisation.

**A token saved by the one-token version is migrated, not discarded.**
`readTokens` reads the old key as the first entry; `invariants.test.js` pins both
old key names so the migration cannot be deleted by accident.

## Consequences

**Setting up is longer for anybody working in an organisation**: two tokens, two
trips to GitHub, and possibly a wait for an organisation owner to approve the
second one. That cost is GitHub's, not this board's, and the page now names it
up front instead of letting the reader discover it as an empty list.

**Every extra token is another call on load**, and another credential in this
browser. The blast radius argument in ADR 0001 now applies once per token, which
is a real increase and the reason the page keeps the "forget every token" button
next to the list.

**The rate limit is per token**, so splitting across owners raises the ceiling
rather than lowering it.

**The notes repository is still personal.** The board does not offer to put it in
an organisation, because an organisation's owners can read its repositories, and
"notes only you can see" would stop being true.

**Rejected: one token owned by the organisation, with the notes repository
inside it.** One token, one setup, and the notes become readable by the
organisation. That trades away the feature. **Rejected: asking the reader to name
each token.** The board can say what a token actually reached, which is more
useful than a label somebody typed and never updated. **Rejected: detecting the
resource owner from the token itself.** GitHub does not expose it; what the token
reaches is the only honest answer, and the board learns that by asking.
