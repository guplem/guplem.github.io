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
| `workItems.js` | Yes | GitHub's answer into the items the board shows, issues and pull requests alike |
| `sorting.js` | Yes | The orders the list can be put in, all of them total (ADR 0006) |
| `titles.js` | Yes | A title split from the change it announces, and the icon for each kind (ADR 0021) |
| `stacks.js` | Yes | Which pull request sits on which, the order a stack merges in (ADR 0016), and where each one sits in it (ADR 0020) |
| `filters.js` | Yes | Narrowing by kind, repository and label, and what to offer (ADR 0009) |
| `skeletons.js` | Yes | How many placeholders to draw while the board waits (ADR 0004) |
| `tokenIdentity.js` | Yes | Masking a token, naming it, and saying what it reached (ADR 0007) |
| `tokenBackup.js` | Yes | Every token as one text, and reading that text back (ADR 0015) |
| `relationships.js` | Yes | GitHub's own links between items, and nesting a pull request under its issue (ADR 0010) |
| `columns.js` | Yes | Which column a piece of work is in, by rule or by the reader's hand (ADR 0011) |
| `urlState.js` | Yes | The open view, the order and the filters in the address bar, and nothing else (root ADR 0006) |
| `permissions.js` | Yes | The one list of what the board asks GitHub for, and whether a saved token is behind it (ADR 0005) |
| `githubErrors.js` | Yes | A failed call into a sentence that names the missing permission |
| `settings.js` | Yes | The list of tokens and the data repository, through an injected storage (ADR 0007) |
| `messages.js` | Yes | Every sentence the page says, the one HTML escaper, the folded-row summary, and whether the notes are syncing (ADR 0019) |
| `deployStamp.js` | Yes | The "deployed at" line (root ADR 0013) |
| `style.css` | - | The design system: colour roles, one radius, and the four parts every screen is built from (ADR 0004) |
| `gateway.js` | No | The **only** file that calls the network |
| `app.js` | No | The page: listens, calls the modules above, builds elements |
| `invariants.test.js` | - | The decisions that must not be undone by accident (ADR 0003) |

Data flow, reading: `app.js` → `gateway.fetchAssignedIssues` (open work) and `gateway.fetchFinishedWork` (closed since midnight, ADR 0017) → `workItems.normalizeWorkItems` and `workItems.finishedSince` → `gateway.fetchRelationships` → `filters.filterWorkItems` → `sorting.sortWorkItems` → `relationships.groupByLinkedIssue` → `stacks.orderStacksForMerging` (smart order only) → `columns.groupIntoColumns` (also reorders "Done today" newest first) → elements.
Data flow, saving: a keystroke → `boardDocument.writeNote` → (1.2 s later) `gateway.fetchBoardFile` → `sync.planSave` → `gateway.saveBoardFile`.

## Non-obvious conventions and gotchas

- **A fine-grained token belongs to one owner**, your account or one
  organisation, and cannot see the other's repositories whatever permissions it
  carries. The board therefore holds a **list** of tokens, asks every one, and
  merges the answers. Anyone working in an organisation needs at least two
  (ADR 0007).
- **Exactly one token writes the notes file.** `boardWritingToken` picks it. A
  save with any other token fails, because the notes repository belongs to one
  owner.
- **The token guide lives once, as the `<template id="token-guide">` in
  `index.html`**, and `app.js` clones it into every `.token-guide-slot` (the
  welcome screen and the add-token screen). Never copy that markup into a
  second place: a test fails, and the two copies would drift the way the
  permission list once did (ADR 0008).
- **A `<template>` is inert**, so nothing inside it is reachable by
  `getElementById`. Find things inside a clone by class instead, which is why
  the permission list inside the guide carries a class and no id.
- **Never tell the reader "nothing is assigned to you" on its own.** It is a
  confident wrong answer when the truth is that no token reaches the
  organisation their work lives in. `sayEmptyBoard` always says how far the
  board can see.
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
  field. The board keeps both and tags each item with `kind` (ADR 0006).
- **Every sort comparison ends with a fallback to the item's key.** Two items
  updated in the same second must land the same way round every render, or the
  list appears to shuffle itself while somebody is reading it.
- **A stack is read from `headRefName` and `baseRefName`, never from a
  description.** A pull request sits on another when its base branch is that
  one's head branch, in the same repository (ADR 0016). `blockedBy` does not
  exist on a `PullRequest` in GraphQL, so it cannot answer this.
- **The smart order is a comparator plus a pass**, and it is the only order
  that is not a plain comparison. "Keep this group together, in this internal
  order" cannot be written as a pairwise comparison, so `app.js` names
  `smart` once, beside the grouping, and `sorting.js` names it again. A new
  order needing the same treatment has to be added in both places (ADR 0016).
- **The stack pass runs on groups, not on items.** A pull request travels
  inside the card of the issue it closes, so the card is what moves. Reorder
  the items and `groupByLinkedIssue` throws the work away.
- **A sort id travels in the address bar, so it is permanent.** Renaming one
  silently breaks every link anybody saved; `invariants.test.js` pins the set.
  The same holds for the view names and the filter kind ids.
- **Filters widen within one kind and narrow across kinds** (ADR 0009). Two
  labels means either; a kind plus a repository means both. Getting that
  backwards empties the board on the second click.
- **The `issue` and `pull-request` ids name two things at once**: a work item's
  own `kind`, and a filter in the address bar. Renaming one breaks the filter
  and every card's badge together.
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
- **Colour tokens are bare HSL channels (`240 10% 3.9%`), never finished
  colours.** Every hover state is built by taking an alpha at the point of use,
  `hsl(var(--primary) / 0.88)`, which a hex value cannot do. Tidying the tokens
  into hex breaks every hover state at once and the page still loads (ADR 0004).
- **Never let anything appear out of nothing after a pause.** Every list the
  board is about to fill draws placeholders first, in the shape of what is
  coming and in as close to the right number as the page can know. The counts
  come from `readLastCounts`, so the placeholder matches the last visit. This
  holds for any new list or panel added later, not only the ones built so far
  (ADR 0004).
- **`app.js` and `gateway.js` have no unit tests, so nothing loads them.** A
  syntax error in either passes the whole suite and leaves the browser with a
  dead page: the module is refused and every button stops working.
  `invariants.test.js` parses every source file for exactly this reason. It has
  happened once (a duplicate `let`), and it cost a release (ADR 0003).
- **"Waiting on me" is a different question from "assigned to me", and only
  search answers it.** `GET /issues` has no filter for it. Search also answers
  in a different shape: `repository_url` instead of a `repository` object, which
  is why `normalizeWorkItem` reads both (ADR 0013).
- **Every list of work items goes through `applyPullRequestState`.** The
  review row did not, so its cards carried no branch names and could not
  know they were stacked. It comes from a different endpoint in a different
  shape (ADR 0013) and was the only list skipping that step (ADR 0020).
- **`stackPositions` counts only the items it is handed.** On the review row
  that is the point: "1 of 2" is the truth about the row in front of the
  reader, and counting a third they were not asked to review would be a
  badge about somebody else's screen (ADR 0020).
- **The review row defaults to the oldest first**, while the board defaults to
  the newest. A review waiting three weeks is the one to clear, and newest-first
  buries it. `reviewSortId` holds that one rule.
- **A note box exists only where a note does**, or where the reader asked for
  one from the menu this visit. An empty box on every card is forty invitations
  to write something nobody wanted to write, and it is the tallest thing on a
  card (ADR 0014). Which empty boxes are open is held in memory, never saved.
- **The card menu is a `popover`, and it has to be.** `.columns` scrolls
  sideways, so `overflow-x: auto` clips anything positioned inside a card. Only
  the top layer escapes it (ADR 0012).
- **Let `popovertarget` open a popover; never `showPopover()` from a click
  handler.** The same click then reaches the page and the browser
  light-dismisses the menu it just opened. It flashes and closes, and nothing
  errors.
- **A submenu must be nested inside its menu in the DOM.** Two auto popovers
  that are not nested are unrelated, so opening the second closes the first.
- **A word `titles.js` does not know is left in the title, word for word.** The
  prefix is stripped only when the board recognises the type, so "Note: the rate
  limit is 5000 an hour" keeps every word. Never guess a type from a title with
  no colon: "Fix the thing" is a fix and "Fixture loading is slow" is not, and
  nothing in the string tells them apart (ADR 0021).
- **The card menu shows only the rows that mean something for the card that
  opened it.** An issue has no branch to copy, and a nested pull request cannot
  be moved. `state.menuCanMove` carries that from the card to the menu, because
  one menu serves the whole board (ADR 0012).
- **A nested pull request card carries a menu, with no move in it.** It travels
  in its issue's column, so the move would write to the document and change
  nothing on screen. Copying its branch does mean something, which is why it has
  a menu at all (ADR 0021).
- **GitHub never clears `reviewDecision`.** A pull request that had changes
  requested keeps that verdict after the author does the work and asks the same
  reviewer to look again, and GitHub shows both at once: the red "Changes
  requested" badge and "Awaiting requested review from <name>". So the verdict
  alone cannot say whose turn it is. `askedToLookAgain` answers that, from
  `latestOpinionatedReviews` set beside `reviewRequests`, and **every** reviewer
  who asked for changes must be in the request list, not just one (ADR 0011).
- **`REVIEW_REQUIRED` is not a review request.** It is the branch rule saying
  the repository wants a review before a merge, so every open pull request in
  such a repository answers it, including one nobody has looked at. Only
  `reviewRequests.totalCount` says a person was asked. The first version of the
  column rules read it the other way and "Awaiting review" collected every
  fresh pull request (ADR 0011).
- **The board asks GitHub twice: once for open work, once for what closed
  today.** `state=open` is why "Done" was empty for so long: a merged pull
  request is closed, so it never arrived (ADR 0017). Keep the second call
  narrow. Measured on the real account: 13 items close in a day, 43 in three
  days, over 100 in a week, against about 16 open cards.
- **`since` on `/issues` filters on when a thing was last touched, not on
  when it closed.** The answer holds work closed months ago that somebody
  commented on this morning, so `finishedSince` has to narrow it. Drop that
  filter and "Done today" fills with last year's work.
- **`finishedAt` is the one answer to "did this land?"** A pull request is
  finished when it merged, an issue when it closed, and a pull request closed
  without merging is never finished. REST carries `merged_at` inside
  `pull_request`, so no GraphQL call is needed to tell them apart.
- **"Done today" is the one column the reader's order does not decide.** It
  is a log, not a queue, so it reads newest first; `groupIntoColumns` does
  that one reorder and nothing else (ADR 0017).
- **A column is computed, never maintained.** The rules read what GitHub
  already knows, and the order of the checks in `automaticColumn` is the whole
  decision: merged beats everything, changes requested beats an approval. A
  pull request closed without merging counts for nothing (ADR 0011).
- **`includeClosedPrs` must stay true in the relationship query.** A merged pull
  request is a closed one, so leaving it out hides exactly the work that belongs
  in "Done".
- **`latestOpinionatedReviews` and `requestedReviewer` must stay in the
  relationship query.** Trim either and `askedAgain` is false on every card:
  nothing errors, every test that builds its own answer stays green, and
  answered work sits in "Needs changes" for ever. A test pins both names.
- **A column id is written into `board.json`** the moment a card is moved by
  hand, so it is as permanent as a storage key. The reader's move always beats
  the rule, and "Automatic" hands it back.
- **`[hidden]` needs the `!important` rule at the top of `style.css`.** The
  browser hides `[hidden]` with a rule of its own, and any author rule setting
  `display` beats it. This page sets `display` on buttons, filter groups and
  callouts, so without that line they ignore `hidden` and sit on screen with
  nothing in them, and nothing errors. A test pins the rule.
- **Never read a relationship out of a description.** `Closes #123` in a
  pull request body is a guess: it misses links made through GitHub's sidebar,
  misses other spellings, and invents links from any sentence with a number in
  it. Ask GraphQL for `parent`, `blockedBy` and `closedByPullRequestsReferences`
  instead. A test fails on `closes #` appearing in any module (ADR 0010).
- **Relationships are fetched with the token that returned those items**, in one
  batched GraphQL call, and are never saved to `board.json`: they are GitHub's
  data, not the reader's.
- **Only an open blocker blocks.** A closed one is history, and counting it
  would leave half the board marked "Blocked" for ever.
- **GraphQL answers 200 with an `errors` array** when part of a query fails,
  unlike every REST path in `gateway.js`. Keep the nodes that came back.
- **Nothing tells you which owner a token is scoped to.** `GET /user/repos`
  looks like it does and does not: it lists what the **person** is affiliated
  with, as far as the token can see, one page at a time, so two different tokens
  come back with overlapping owners and the same capped count. The reader names
  a token; the board only suggests a name from where it found work, and shows
  the token masked so a row can be matched against GitHub's own list (ADR 0007).
- **Settings copies a token and never prints one on request.** GitHub shows a
  token once, so this browser holds the only copy (ADR 0015). `Copy` is the one
  control, and the warning dialog comes first. The token reaches the screen
  only through `revealToken`, which just one caller uses: the way out when the
  browser refused the clipboard, as a `file://` page always does. Do not add a
  button for it; one was built and taken out. Printing a token is no less safe
  than storing it (the same script reads either), but a token on screen is a
  token in a screen share.
- **A backup carries the token and the reader's name for it, nothing else.**
  Owners, counts and `canWriteBoard` are facts the board discovered, and they
  are stale the moment they are written down. **Never write a backup into
  `board.json`**: that puts a live credential in a GitHub repository and in
  its history. A test in `invariants.test.js` fails on it.
- **One box takes a token or a backup**, on the welcome screen and on the
  add-token screen. Text starting with `{` is always read as a backup, never
  tried as a token: a blob that was cut short must report itself, not come
  back as GitHub's complaint about a bad credential.
- **There are three views, and one control moves between them.** Board,
  Settings, and `add-token`; the toggle goes board -> settings -> board, and
  add-token -> settings, because that is where it was opened from (ADR 0018).
  A view name travels in the address bar, so it is as permanent as a sort id.
- **Five columns fill the window on purpose.** `grid-auto-columns` is the
  window less the four gaps, split five ways, so "Done today" is the one that
  scrolls. The `max(17rem, ...)` half of it is what keeps a phone usable; drop
  it and a column becomes 80 pixels wide (ADR 0018).
- **A nested pull request card hides its repository behind a hover.** It sits
  inside the card of the issue that already names it. Only the nested card
  does: `buildWorkItemCard(item, { compact: true })` (ADR 0018).
- **Every check row carries the `id` of the `CONNECTION_CHECKS` entry it
  answers.** The notes badge finds the board-file row by that id, never by
  matching its label, which is wording and changes (ADR 0019).
- **A token that cannot reach the notes repository pushes no board-file
  check at all**, on purpose: an organisation's token is not broken for
  failing to hold somebody's private notes (ADR 0007). So no row from any
  token means no token reached it, which is why `describeNotesSync` takes an
  `asked` flag: without it, "nobody reached your notes" and "still asking"
  are the same empty list.
- **The connection checks live folded inside the token they are about**, not
  in one list. `summariseChecks` writes the shut line and names a single
  failure rather than counting it. A one-off message goes to a notice line in
  the screen that raised it (`settings-notice`, `add-token-notice`).
- **`renderLoading` must be changed whenever a list in Settings is.** It
  wrote placeholders into the check list after that list was removed, threw,
  and left the board stuck on "Reading GitHub..." with every test green. That
  is three times now that an `app.js` change was caught by opening the page
  and not by the suite.
- **The masthead toggle is the only way between the views, and the
  masthead is sticky.** Settings is more than twice the height of a window, so a
  control that scrolls away leaves a reader with no way out. Do not add a second
  exit inside a screen; keep the one in the header (ADR 0008).
- **A placeholder mirrors the row it replaces, line for line.** A token row is
  two stacked lines and two buttons, so its placeholder is too. Two bars appended
  to a plain `div` render as one line with no gap, which is what the first
  version did: give the container `.token-lines` (ADR 0004).
- **Build a screen from the four parts** (`.button` and its variants, `.input`,
  `.card`, `.badge`), and give any new interactive part a hover, a press and a
  focus-visible state. `invariants.test.js` fails when a `.button-*` variant has
  no `:hover`.
- **A new GitHub call that needs new access means one edit: add an entry to
  `REQUIRED_PERMISSIONS` in `permissions.js`.** The setup guide, the README
  check and the prompt that tells existing readers to widen their token all
  follow from it. Never write a permission into `index.html` or `README.md` by
  hand; `invariants.test.js` fails when you do (ADR 0005).
- **Never write a count of generated items in prose.** The page said "set these
  three" and the generated permission list grew to four on the next change. Say
  "each of these" instead; the list is the count.
- **The setup guide cannot prefill a fine-grained token form.** GitHub supports
  prefilled links for classic tokens only. The guide lists the permissions
  instead, and `githubErrors.js` names the missing one when a call fails.

## Tests

Every module marked "Pure" has a sibling `*.test.js`. `app.js` and `gateway.js`
have none by design: anything in them worth a test belongs in a pure module.

```bash
cd web-projects/github-work-board && bun test
```

A green suite does not prove the page loads: nothing here executes `app.js`.
After a change to `app.js` or `gateway.js`, open the page and read the console
before calling it done.

## Architecture Decision Records

| ADR | Topic |
|---|---|
| [0001](adr/0001-the-token-lives-in-this-browser.md) | The token lives in this browser, and the page says so |
| [0002](adr/0002-merge-record-by-record-not-file-by-file.md) | Merge record by record, and let the remote side win a tie |
| [0003](adr/0003-tests-that-guard-decisions-not-only-behaviour.md) | Tests that guard decisions, not only behaviour |
| [0004](adr/0004-one-set-of-parts-in-the-shape-shadcn-uses.md) | One set of parts, in the shape shadcn/ui uses |
| [0005](adr/0005-the-permission-list-lives-in-the-code.md) | The permission list lives in the code, and the page asks for a wider token |
| [0006](adr/0006-one-list-of-work-items-and-the-order-lives-in-the-link.md) | One list of work items, and the chosen order lives in the link |
| [0007](adr/0007-one-token-per-owner-and-an-empty-board-explains-itself.md) | One token per owner, and an empty board that explains itself |
| [0008](adr/0008-settings-is-a-view-and-the-token-guide-is-written-once.md) | Settings is a view in the link, and the token guide is written once |
| [0009](adr/0009-filters-widen-within-a-kind-and-narrow-across-kinds.md) | Filters widen within one kind and narrow across kinds |
| [0010](adr/0010-relationships-come-from-githubs-graph.md) | Relationships come from GitHub's graph, in one call per token |
| [0011](adr/0011-columns-are-read-from-github-and-overridden-by-hand.md) | Columns are read from GitHub, and overridden by hand |
| [0012](adr/0012-the-card-menu-lives-in-the-top-layer.md) | The card menu lives in the top layer, and one menu serves the board |
| [0013](adr/0013-work-waiting-on-you-is-a-row-above-the-board.md) | Work waiting on you is a row above the board, not a column in it |
| [0014](adr/0014-a-note-box-appears-only-when-there-is-a-note.md) | A note box appears only when there is a note |
| [0015](adr/0015-settings-hands-the-token-back.md) | Settings hands the token back, behind one warning |
| [0016](adr/0016-the-smart-order-puts-a-stack-in-merge-order.md) | The smart order is oldest first, with each stack in merge order |
| [0017](adr/0017-done-is-today-and-the-board-asks-a-second-question.md) | "Done" is today, and it takes a second question |
| [0018](adr/0018-five-columns-two-headings-and-a-screen-for-adding-a-token.md) | Five columns, two headings, and a screen for adding a token |
| [0019](adr/0019-the-notes-say-whether-they-are-getting-through.md) | The notes say whether they are getting through |
| [0020](adr/0020-a-review-card-says-which-stack-it-is-in.md) | A review card says which stack it is in, and where |
| [0021](adr/0021-a-title-is-split-and-a-branch-is-one-tap-away.md) | A title is split from the change it announces, and a branch is one tap away |

## What is not built yet

Connecting with several tokens, the one list of issues and pull requests,
private notes, sorting, the filters and the settings screen are built.
Still to come, roughly in this order: dragging a card instead of choosing its
column from a dropdown, custom tags, and a "what's next" queue, which the
blocked marking and the columns now make answerable. Every new view state goes in the address bar
beside `view`, `sort`, `kind`, `repo` and `label`, and the tokens never do.
