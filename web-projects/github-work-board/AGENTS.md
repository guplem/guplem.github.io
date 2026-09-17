# web-projects/github-work-board/AGENTS.md

> **SCOPE:** files under `web-projects/github-work-board/`. Read `web-projects/AGENTS.md` first for the rules that cover every web-project.

## What this is

A personal work board on top of GitHub issues. The page runs with no server: the
reader pastes a fine-grained personal access token, and the browser calls
`api.github.com` directly. Their private half (notes now; tags, columns and a
"what's next" queue later) lives in one JSON file in a private repository they
own, so the board follows them across devices.

**This project is held to a higher bar than the rest of the playground, on
purpose.** It handles a real credential and it writes to somebody's repository.
Read "The bar" below before the first change.

## The bar

Work here is fast and mostly done by agents. The failure that costs most is not a
bug: it is a later pass that quietly undoes an earlier decision, keeps every test
green, and is found months later. Four rules answer that, and ADR 0003 explains
the reasoning.

1. **Red first, always.** Write the failing test, watch it fail, then make it
   pass. This is not best effort here (root ADR 0012).
2. **A bug fix starts with the test that reproduces it.** That test is what stops
   the same break from coming back.
3. **`invariants.test.js` guards decisions, not behaviour.** When one of its
   tests fails, read the ADR it names before you touch the test. A decision may
   be changed on purpose and must not be changed by accident.
4. **A decision with a trade-off becomes an ADR** in `adr/`, in the same pull
   request that makes it.

Before any change, run `.claude/skills/change-the-board/SKILL.md` in this folder.
It is the short procedure for all of the above.

## Module map

| File | Pure? | Responsibility |
|---|---|---|
| `boardDocument.js` | Yes | The stored document: schema version, `migrate`, reading and writing one note |
| `sync.js` | Yes | Merging two copies of the document, and deciding create / update / skip (ADR 0002) |
| `documentCodec.js` | Yes | UTF-8 safe base64, both ways, for the Contents API |
| `issues.js` | Yes | GitHub's answer about issues into the items the board shows |
| `githubErrors.js` | Yes | A failed call into a sentence that names the missing permission |
| `settings.js` | Yes | The token and the data repository, through an injected storage |
| `messages.js` | Yes | Every sentence the page says, and the one HTML escaper |
| `deployStamp.js` | Yes | The "deployed at" line (root ADR 0013) |
| `gateway.js` | No | The **only** file that calls the network |
| `app.js` | No | The page: listens, calls the modules above, builds elements |
| `invariants.test.js` | - | The decisions that must not be undone by accident (ADR 0003) |

Data flow, reading: `app.js` → `gateway.fetchAssignedIssues` → `issues.normalizeIssues` → elements.
Data flow, saving: a keystroke → `boardDocument.writeNote` → (1.2 s later) `gateway.fetchBoardFile` → `sync.planSave` → `gateway.saveBoardFile`.

## Non-obvious conventions and gotchas

- **`btoa` is not enough.** The Contents API carries file content as base64, and
  the browser's `btoa` throws on any character above 255. A note with an accent
  or an emoji arrives on day one, so text goes through `TextEncoder` first.
  Reading back, GitHub wraps the base64 in newlines every 60 characters and
  `atob` refuses them, so `decodeBase64` strips whitespace first. Both halves are
  pinned in `documentCodec.test.js`.
- **A note is keyed by the issue's `node_id`, never by `repo#number`.** An issue
  transferred to another repository keeps its node id and changes its number, so
  a note filed under the number would later attach itself to a different issue.
- **`GET /issues` returns pull requests too**, marked only by a `pull_request`
  field. `normalizeIssues` drops them.
- **A save re-reads the file first and writes with the sha from that read.** The
  sha is GitHub's optimistic-concurrency check. Passing a remembered one is how a
  save silently overwrites another device's work. A 409 means somebody saved in
  between; the cycle runs once more.
- **A cleared note keeps its key.** Deleting the key would read as "this device
  never had it" and the other device's older text would come back (ADR 0002).
- **`migrate` never throws and never drops a map it does not recognise.** An old
  tab that saves must not wipe what a newer build wrote.
- **Nothing reaches the screen through `innerHTML`** except the deploy line,
  which carries its own escaper. Issue titles come from other people, and the
  token is one origin away.
- **This project takes no CDN import**, although root ADR 0005 would allow one. A
  third-party script on a page holding a credential can read that credential
  (ADR 0001).
- **The setup guide cannot prefill a fine-grained token form.** GitHub supports
  prefilled links for classic tokens only. The guide lists the permissions
  instead, and `githubErrors.js` names the missing one when a call fails.

## Tests

Every module marked "Pure" has a sibling `*.test.js`. `app.js` and `gateway.js`
have none by design: anything in them worth a test belongs in a pure module.

```bash
cd web-projects/github-work-board && bun test
```

## Architecture Decision Records

| ADR | Topic |
|---|---|
| [0001](adr/0001-the-token-lives-in-this-browser.md) | The token lives in this browser, and the page says so |
| [0002](adr/0002-merge-record-by-record-not-file-by-file.md) | Merge record by record, and let the remote side win a tie |
| [0003](adr/0003-tests-that-guard-decisions-not-only-behaviour.md) | Tests that guard decisions, not only behaviour |

## What is not built yet

Phase 1 proves the hard parts: connect, read issues, write a private note, merge
two devices. Still to come, roughly in this order: custom tags, kanban columns
with automatic moves, a "what's next" queue, and filters in the URL (root ADR
0006, and never the token).
