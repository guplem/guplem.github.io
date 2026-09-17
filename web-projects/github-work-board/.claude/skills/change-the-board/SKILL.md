---
name: change-the-board
description: The procedure for any change inside web-projects/github-work-board. Use before adding a feature, fixing a bug, or refactoring in that folder. It keeps a fast pass from undoing an earlier decision.
---

# Change the work board

This folder handles a real credential and writes to somebody's repository. The
expensive failure here is not a bug. It is a later pass that quietly undoes an
earlier decision, keeps every test green, and is found months later. This
procedure exists to stop that. ADR 0003 holds the reasoning.

Work through the steps in order. Do not skip a step because the change looks
small: a small change is exactly the one that gets made without reading.

## 1. Read before you write

- Read `AGENTS.md` in this folder: the module map, and "Non-obvious conventions
  and gotchas".
- Read the ADRs in `adr/` that cover the area you are about to touch. The
  `AGENTS.md` index says what each one covers.
- Find the closest existing module and read it in full. It is the spec for how
  new code here looks.

**Stop and ask** when the change would contradict an ADR. Contradicting one is
allowed. Doing it by accident is not.

## 2. Write the failing test first

- New behaviour: write the test that pins it, run `bun test`, and **watch it
  fail** before you write any implementation. A test that has never failed has
  never proved anything.
- A bug: write the test that reproduces the bug first. That test is what stops
  the bug from coming back.
- Pure logic only. `app.js` and `gateway.js` get no tests: push anything worth a
  test into a pure module instead.

Name the test after the behaviour, not the function. Add a comment saying why the
case exists when the reason is not obvious from the name.

## 3. Make it pass, and keep the shape

- Smallest change that turns the test green.
- **One file calls the network** (`gateway.js`). **One file touches storage**
  (`settings.js`). **Nothing reaches the screen through `innerHTML`** except the
  deploy line.
- No import from outside this folder, and no CDN import (ADR 0001).

## 3b. If the change calls GitHub for something new

A new call almost always needs access the reader has not granted. Add one entry
to `REQUIRED_PERMISSIONS` in `permissions.js`, and nothing else. The setup guide,
the README check and the notice that asks existing readers to widen their token
all follow from that entry (ADR 0005).

Never write a permission into `index.html` or `README.md` by hand. Ask only for
what the board uses today: widening later costs the reader one prompt they
cannot miss, so there is no reason to over-ask.

## 4. Run the whole suite

```bash
cd web-projects/github-work-board && bun test
```

Then the repository suite, the way CI runs it: delegate to the **validate**
agent.

**When a test in `invariants.test.js` fails, stop.** It names an ADR. Read that
ADR and decide, in words, whether you are changing the decision on purpose. If
yes, update the ADR in the same pull request. If no, fix your change, not the
test.

## 5. Record what you decided

- A decision with a trade-off worth keeping becomes a new ADR in `adr/`, numbered
  from the next free number. Index it in this folder's `AGENTS.md` **and** in the
  root `AGENTS.md` per-project table.
- A new trap a future agent would fall into becomes a bullet in "Non-obvious
  conventions and gotchas" in this folder's `AGENTS.md`.
- A decision that is cheap to undo and expensive to notice gets a test in
  `invariants.test.js`, naming the ADR it comes from.
- After the code settles, delegate to the **docs-checker** agent.

## 6. Ship it

Follow the repository rules in the root `AGENTS.md`: branch with the
`create-branch` skill, commit with the `write-commit` skill, open the pull
request, then stamp it with `bun scripts/generateDeployStamp.js --pr <N> --date
<created_at>` in a second commit.
