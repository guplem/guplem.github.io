# ADR 0003: Tests that guard decisions, not only behaviour

## Context

This project is built the way most work here is built: in fast passes, mostly by
an agent, merged as soon as the `test` check goes green (root ADR 0009 and the
auto-merge rule in the root `AGENTS.md`). That flow has one failure mode, and it
is not "the agent writes a bug". Unit tests catch bugs.

It is that **a later pass quietly undoes an earlier decision**. Real examples of
the shape, all of which produce green tests:

- A storage key is renamed for tidiness. Every reader's saved token and saved
  repository silently disappear on their next visit.
- A note is keyed by `repo#number` because it reads better in a debugger. Months
  later an issue is transferred, and its note attaches itself to a different
  issue.
- A second module starts calling the network directly, because it was one line
  shorter than passing the data. The token now has two exits instead of one, and
  every module that touches it stops being testable.
- A library is imported from a CDN for a small convenience, on a page that holds
  a live credential.
- `migrate` is "simplified" to drop fields it does not know. An old open tab
  saves, and everything a newer build wrote is gone.

Nothing in an ordinary unit test notices any of these. Each one keeps every
existing behaviour test green, because the behaviour did not change: the
**decision** did. An ADR records the decision, but an ADR is a document, and the
agent that breaks the rule is the agent that did not read it.

## Decision

**Decisions that are cheap to undo and expensive to discover get their own test
file: `invariants.test.js`.**

It is not a second copy of the unit tests. Each test pins one promise and names
the ADR it comes from, so a failure reads as "you are undoing decision X", not
"expected true to be false". It holds two kinds of check:

1. **Value promises**, asserted through the normal exports: the exact storage
   keys, the exact document file name, that a note is keyed by the permanent
   GitHub node id, that `migrate` keeps maps it does not know.
2. **Shape promises**, asserted by reading this folder's own source text: only
   `gateway.js` calls the network, only `settings.js` names `localStorage`, the
   token key appears in one file, nothing is imported from outside the folder or
   from a CDN, and `gateway.js` sends requests to `api.github.com` and nowhere
   else.

The second kind is unusual and is the point. A rule that only lives in prose is a
rule that holds until the next fast pass.

Alongside it, the ordinary rule stands: pure logic is written test-first, red
then green (root ADR 0012), and a bug fix starts with a test that reproduces the
bug, so the same break cannot return unnoticed.

## Consequences

**A failing invariant test is a conversation, not a chore.** The comment at the
top of the file says it: read the ADR the test names before changing the test. A
decision can be changed on purpose. It must not be changed by accident.

**Some tests read source files as text.** That is fragile in the usual way: a
comment that happens to contain `fetch(` fails the network check. The trade is
accepted, because the alternative is a rule nothing enforces. Keep the patterns
narrow and the comments plain.

**The invariant file grows with the project, and only with real traps.** A test
here has to name a decision that is easy to undo and hard to notice. Padding it
with obvious assertions turns it back into an ordinary test file and costs it the
authority that makes a failure worth reading.

**Rejected: rely on the ADRs alone.** They are the reasoning, and reasoning is
not a gate. **Rejected: a lint rule or a custom checker.** Root ADR 0002 keeps
this site free of build tooling, and the test runner already runs on every pull
request, so the check costs nothing new.
