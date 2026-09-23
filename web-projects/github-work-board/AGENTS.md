# web-projects/github-work-board/AGENTS.md

> **SCOPE:** files under `web-projects/github-work-board/`. Read `web-projects/AGENTS.md` first for the rules that cover every web-project.

## What this is

A personal work board on top of GitHub issues. The page runs with no server: the
reader pastes a fine-grained personal access token, and the browser calls
`api.github.com` directly. Their private half (their notes, columns, colours, theme, marked priority,
counting choices and the lines they copy from a card, now; tags and a "what's
next" queue later) lives in one JSON file, `board.json`, kept by the shared
cloud storage (`web-projects/cloud-storage/`, root ADR 0016): mirrored in this
browser, and saved to the private repository they own, so the board follows
them across devices.

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
| `boardDocument.js` | Yes | What each record means to the board: one note, column, colour, theme, priority, counting choice or copy action at a time, over the shared envelope (`../cloud-storage/envelope.js`) |
| `legacyStorage.js` | Yes | The one-time hand-over of the board's old data repository and its writing token to cloud storage (root ADR 0016) |
| `workItems.js` | Yes | GitHub's answer into the items the board shows, issues and pull requests alike |
| `sorting.js` | Yes | The orders the list can be put in, all of them total (ADR 0006) |
| `appearance.js` | Yes | The colours a column can be painted, and light or dark (ADR 0024) |
| `refresh.js` | Yes | How often the board asks GitHub again, and when a tick is due (ADR 0025) |
| `doneRange.js` | Yes | Which days the last column is about: the presets, every midnight boundary in the reader's clock, the words in its heading, and the written form a link carries (ADR 0034) |
| `children.js` | Yes | The order the children of an issue read in, the count of closed ones beside their pills, and the words on the press that opens the list (ADR 0032) |
| `counting.js` | Yes | What each part of the board counts, the number in the tab, and what a count leaves out (ADR 0030) |
| `copyActions.js` | Yes | The lines the reader copies from a card, the placeholders they can carry, and filling one in (ADR 0031) |
| `people.js` | Yes | Who a card is about, and what the board waits on each of them for (ADR 0028) |
| `priority.js` | Yes | The work the reader pushed down, and what sinks with it, on the board and in the review row (ADR 0026) |
| `cardMenu.js` | Yes | Which rows the card menu offers for the card that opened it (ADR 0022, ADR 0031) |
| `tooltip.js` | Yes | Where a tooltip goes, and how long a pointer rests first (ADR 0033) |
| `titles.js` | Yes | A title split from the change it announces, and the icon for each kind (ADR 0021) |
| `stacks.js` | Yes | Which pull request sits on which, the order a stack merges in for the board and for the review row (ADR 0016), and where each one sits in it, with the bottom's name (ADR 0020, ADR 0027) |
| `filters.js` | Yes | Narrowing by kind, repository, label and person, and what to offer (ADR 0009, ADR 0028) |
| `skeletons.js` | Yes | How many placeholders to draw while the board waits (ADR 0004) |
| `tokenIdentity.js` | Yes | Masking a token, naming it, and saying what it reached (ADR 0007) |
| `tokenBackup.js` | Yes | Every token as one text, and reading that text back (ADR 0015) |
| `relationships.js` | Yes | GitHub's own links between items, the children of an issue, which linked pull request an item is read from, and nesting a pull request under its issue (ADR 0010, ADR 0028) |
| `columns.js` | Yes | Which column a piece of work is in, by rule or by the reader's hand, and what to call that column away from the board (ADR 0011) |
| `attention.js` | Yes | The three reasons a pull request wants its author (conflicts, red checks, changes requested), with the words and the icon each pill draws (ADR 0011) |
| `urlState.js` | Yes | The open view, the order and the filters in the address bar, and nothing else (root ADR 0006) |
| `permissions.js` | Yes | The one list of what the board asks GitHub for, and whether a saved token is behind it (ADR 0005) |
| `githubErrors.js` | Yes | A failed call into a sentence that names the missing permission |
| `settings.js` | Yes | The list of tokens, through an injected storage (ADR 0007) |
| `messages.js` | Yes | Every sentence the page says, the one HTML escaper, the folded-row summary, how long ago the board read (ADR 0029), and whether the notes are syncing (ADR 0019) |
| `deployStamp.js` | Yes | The "deployed at" line (root ADR 0013) |
| `style.css` | - | The design system: colour roles, one radius, and the five parts every screen is built from (ADR 0004) |
| `gateway.js` | No | The **only** file that calls the network |
| `app.js` | No | The page: listens, calls the modules above, builds elements |
| `invariants.test.js` | - | The decisions that must not be undone by accident (ADR 0003) |

Data flow, reading: `app.js` → `gateway.fetchAssignedIssues` (open work) and `gateway.fetchFinishedWork` (closed inside the chosen range, following its pages, ADR 0017 and ADR 0034) → `workItems.normalizeWorkItems` and `workItems.finishedBetween` → `gateway.fetchRelationships` (which asks a second time about the children it just heard of) → `filters.filterWorkItems` → `filters.filterByPerson` (reviewers) → `sorting.sortWorkItems` → `relationships.groupByLinkedIssue` → `stacks.orderStacksForMerging` and `priority.sinkLowPriority` (smart order only) → `columns.groupIntoColumns` (also reorders "Done today" newest first) → elements.
Data flow, the review row: `gateway.fetchReviewRequests` → `workItems.uniqueByKey` → `relationships.applyPullRequestState` → `filters.filterByPerson` (assignees) → `sorting.sortWorkItems` with `reviewSortId` → `stacks.orderItemsForMerging` → `priority.sinkLowPriorityItems` (the last two only in the smart order) → `stacks.stackPositions` for the badge → cards.
Data flow, asking again: a 5 second tick, or a tab coming back into view → `refresh.refreshDue` → `connectAll({ quiet: true })`, which is the same read with no placeholders and no "Reading GitHub..." status line (ADR 0025).
Data flow, saving: a keystroke, a card moved, a colour, the theme, a priority mark, a counting choice or a line the reader copies → the matching `boardDocument.write*` → `store.write(state.board)`, which mirrors the document at once and, after a rest, merges and saves it through the shared cloud storage (`../cloud-storage/cloudStore.js`, root ADR 0016).

## Non-obvious conventions and gotchas

- **`gateway.js` sends `cache: "no-cache"`, and removing it breaks the board
  silently.** GitHub answers an authenticated call with `Cache-Control: private,
  max-age=60`. Without that one option the browser answers from its own copy for
  a minute, so the 30 second refresh shows the same answer twice and nothing
  errors. `no-cache` is not `no-store`: the browser still revalidates with the
  `ETag` that it holds, and a `304` costs nothing against the rate limit. So
  this is the cheaper option as well as the correct one (ADR 0025).
- **A harness tab is a hidden tab, so do not measure the refresh timer in one.**
  Chrome throttles a long-lived `setInterval` in a background tab to about once
  a minute, so the 30 second schedule looks like a 60 second one. Worse, an
  override of `document.visibilityState` from the browser tools does **not**
  reach the page: those tools run in an isolated world, and the page keeps
  seeing `hidden`. To force the page's own view, inject a `<script>` element
  with the override as its text, which runs in the page's world. Measure what
  fires, not when.
- **One refresh costs five GitHub calls for each token, and six when
  something on the board has children**, and the tight budget is `search` at 30
  a minute, not `core` at 5000 an hour. A new call in the connect path
  multiplies by the number of tokens and by the refresh rate. Do that
  arithmetic in `refresh.test.js` before you add one.
- **GraphQL is charged by the size of the query, not by the call.** The points
  come from the `first:` numbers, so raising one raises what every refresh
  costs and nothing on the page changes. `closedByPullRequestsReferences(first:
  5)` is measured, not chosen: at twenty it cost 42 points a call and at five it
  costs 12, which is what pays for the second call about the children. Measure
  a change with `rateLimit(dryRun: true)` before you make it, and keep
  `GRAPHQL_POINTS_PER_TOKEN` in `refresh.js` true (ADR 0010, ADR 0025).
- **"Nobody asked" and "nothing to say" read the same, and one of them must not
  become a state.** An item the board never asked GitHub about has no
  relationship record, which is exactly what an item with no pull request looks
  like, so it would read as "To do". The children listed on a card are the case
  that hits this, because the board asks about one batch of them and no more:
  `relationships.knowsAbout` is what tells the two apart (ADR 0010).
- **A refresh must stay skipped, never queued, while a save is in flight.** A
  save re-reads the board file, merges it and writes it back (ADR 0002). A
  refresh that lands in between replaces the document that the save works from,
  and the reader loses the note that they just typed.
- **A card marked "not a priority" sinks with everything stacked on top of
  it**, and that is on purpose (ADR 0026). A pull request that waits on a sunk
  one cannot merge first, so leaving it up would show work that reads as ready
  and is not. Do not "fix" this into a single-card move: it recreates the exact
  failure ADR 0016 exists to prevent.
- **Nothing on this page sets `title`, and a new one would give the reader two
  tooltips at once.** The board draws its own (ADR 0033): write one with
  `explain(element, words)` in `app.js`, which sets `data-tip`. The system's
  tooltip cannot be themed, placed or laid out, and it reads the breakdown
  beside the title as a cramped block. `invariants.test.js` fails on any
  `title` written by a module or left in `index.html`.
- **`.badge` is `inline-flex`, so whitespace between two child elements
  disappears.** A badge built from two spans needs a `gap`, not a space in the
  text (ADR 0027).
- **The review row and the columns sort by one rule, and that rule lives in two
  places in `app.js`.** `sorting.js` only compares. Both passes of the smart
  order run twice: on the grouped board (`orderStacksForMerging`, then
  `sinkLowPriority`) and on the flat review row (`orderItemsForMerging`, then
  `sinkLowPriorityItems`), in that order. The row drifted away from the columns
  once already, one pass at a time, and nothing failed either time: the badge
  said "1 of 3" on a card sitting last, and a marked card stayed where it was.
  Add anything to one side and add it to the other (ADR 0016, ADR 0026).
- **"Who is reviewing this" is never `reviewRequests` alone.** GitHub drops a
  reviewer from that list the moment they submit a review, so a pull request
  held up by one `CHANGES_REQUESTED` review has an empty request list. Read
  `reviewRequests` and `latestOpinionatedReviews` together, which is what
  `people.reviewPeople` does (ADR 0028). The same trap already caught
  `askedToLookAgain` once (ADR 0011).
- **There are two person filters, and they narrow two different lists.**
  `assignee=` narrows the review row by whose work each pull request is.
  `reviewer=` narrows the board by who is in the review. A link can carry both.
  Do not merge them: they answer different questions (ADR 0028).
- **`requestAnimationFrame` never runs in a hidden tab, so nothing that has to
  measure the page may depend on it.** A board drawn in a background tab would
  keep its measurements from before. The note boxes are sized from `renderBoard`
  for exactly this reason (ADR 0014).
- **A `.button-*` class is a variant and must have a `:hover`**, which
  `invariants.test.js` checks by name. A class that only changes a button's
  shape is not a variant and must not be named like one: the refresh button's
  square shape is `.icon-only`, worn with `.button-outline`, which carries the
  hover (ADR 0029).
- **Every screen in `index.html` starts `hidden`, except the start-up screen.**
  The browser paints that file before it runs a line of the board's code, so
  whatever is visible in it is what a reader sees first. The welcome screen was
  visible, and it flashed at every reader who already had a token. `app.js`
  moves the start-up steps along, and `finishBoot` in `showView` is the one
  place that takes the screen away (ADR 0036). `invariants.test.js` fails on a
  screen that starts visible.
- **One function says whether the board is reading: `renderRefreshBusy` in
  `app.js`.** The refresh button turns and goes down for every read, the
  scheduled one included, because a scheduled read draws no placeholders and no
  status line (ADR 0025, ADR 0029). Never set `disabled` or `aria-busy` on that
  button anywhere else: the press and the schedule would each write it, and the
  one that loses leaves the button down for good. `invariants.test.js` fails on
  a second writer.
- **Every number on the page comes from one `countBoard` pass.** The badge on a
  column, the number beside the title and the name of the browser tab are the
  same numbers, so they cannot disagree. Do not count a list again anywhere else
  (ADR 0030).
- **A count that leaves out the work pushed down must say so on the badge.**
  That sentence is what keeps the mark from hiding work, which ADR 0026 forbids.
  Remove it and the rule is broken, not bent.
- **A fine-grained token belongs to one owner**, your account or one
  organisation, and cannot see the other's repositories whatever permissions it
  carries. The board therefore holds a **list** of tokens, asks every one, and
  merges the answers. Anyone working in an organisation needs at least two
  (ADR 0007).
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
- **The board file goes through the shared store, never through `gateway.js`.**
  `app.js` opens `openStore` from `../cloud-storage/cloudStore.js` with
  `legacyPath: "board.json"`, and every mutation ends in `scheduleSave()`, which
  is `store.write(state.board)`. The store owns the local mirror, the question
  when two copies meet, the save schedule and the sha dance (root ADR 0016).
  `invariants.test.js` fails on any `/contents/` path in this folder.
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
- **The repository holds the whole of the reader's half, not just notes.**
  `board.json` carries the notes, the cards moved by hand, the colour on each
  column and the theme (ADR 0024). The cloud storage panel calls it the **data
  repository**, because it now holds every adopting project's data, not only
  the board's; say "your half of the board", never "your notes", in anything
  new.
- **A new kind of stored thing is one entry in `RECORD_MAPS` and a read/write
  pair.** That is what ADR 0002 built the document for, and it is why adding
  colours and the theme touched no merge code at all.
- **The dark tokens are written twice**, under
  `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and
  under `:root[data-theme="dark"]`. CSS cannot share one block between two
  selectors without repeating it. Keep the copies identical: an explicit
  choice has to win in **both** directions, or picking light on a dark
  machine does nothing (ADR 0024). Four blocks once missed the guard and left
  light-coloured badges on a dark page; `invariants.test.js` now fails when a
  new block forgets it (ADR 0027).
- **`data-colour` is absent only when the answer is "None"**, never merely
  because nobody has touched that part. Most parts open painted with
  `appearance.DEFAULT_COLOURS`; a record always wins, and "None" is a choice
  like any other (ADR 0024).
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
- **`stackPositions` counts only the items it is handed, and each list counts
  itself.** The board works its badges out over the board (`state.stackBadges`)
  and the review row over the row: "1 of 2" is the truth about the row in front
  of the reader, and counting a third they were not asked to review would be a
  badge about somebody else's screen. The light is the one pass over the whole
  screen, because it answers a question about the screen (ADR 0020, ADR 0027).
- **A reference to another item carries `data-points-at`, and a card carries
  `data-key`.** One listener ties them together and lights the card a pill, a
  child's row or a link line names. Both names are set in one file and read in
  another, so a test pins them (ADR 0035).
- **A stack badge goes on the pull request's own card, and the light goes on
  the card the reader points at.** A pull request nested under its issue carries
  the badge there; the issue card around it takes the light, because in a column
  that outer card is the one under the pointer (ADR 0020, ADR 0027).
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
- **`cardMenu.cardMenuRows` decides which rows the menu offers, and nothing
  else does.** Add note on every card, Copy branch name on a pull request, Move
  to on a card that sits in a column, and one row per line the reader wrote in
  Settings that this card can fill (ADR 0031). The first three answers were
  three conditions written into `app.js` one at a time, and the newest of them
  quietly stopped a note being addable anywhere but the columns (ADR 0022).
- **A note is filed under the item's node id, so it belongs to the work and not
  to the place the card is drawn.** A review card and a nested pull request take
  one exactly like a column card does. Do not hide the box by where the card
  sits; that rule existed, in CSS, and it was wrong (ADR 0022).
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
  commented on this morning, so `finishedBetween` has to narrow it at both
  ends. Drop that filter and the last column fills with last year's work; drop
  the far end and "Done yesterday" also shows today (ADR 0034).
- **The last column is a range, and only `doneRange.js` says where a day
  starts.** The range travels in the link, so its written forms are permanent,
  exactly like a sort id. Changing it asks GitHub again, because the range is
  the window in the call (ADR 0034).
- **`finishedAt` is the one answer to "did this land?"** A pull request is
  finished when it merged, an issue when it closed, and a pull request closed
  without merging is never finished. REST carries `merged_at` inside
  `pull_request`, so no GraphQL call is needed to tell them apart.
- **The last column is the one the reader's order does not decide.** It
  is a log, not a queue, so it reads newest first; `groupIntoColumns` does
  that one reorder and nothing else (ADR 0017).
- **A column is computed, never maintained.** The rules read what GitHub
  already knows, and the order of the checks in `automaticColumn` is the whole
  decision: merged beats everything, and anything that wants the author beats
  an approval. A pull request closed without merging counts for nothing
  (ADR 0011).
- **"Needs attention" keeps the id `needs-changes`.** The column grew from
  reviews alone to everything that waits on the author, and only the label
  changed: the id is written into `board.json` the moment a card is moved by
  hand, so renaming it would strand every card already moved there (ADR 0011).
- **`mergeable: "UNKNOWN"` is not "fine".** GitHub works that field out only
  when somebody asks for it, so the first answer for a quiet pull request says
  nothing. Only `CONFLICTING` is a conflict. In the same way, a pull request
  with no checks has no `statusCheckRollup`, which is not a pass (ADR 0011).
- **`includeClosedPrs` must stay true in the relationship query.** A merged pull
  request is a closed one, so leaving it out hides exactly the work that belongs
  in "Done".
- **`latestOpinionatedReviews` and `requestedReviewer` must stay in the
  relationship query.** Trim either and `askedAgain` is false on every card:
  nothing errors, every test that builds its own answer stays green, and
  answered work sits in "Needs attention" for ever. A test pins both names.
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
  batched GraphQL call, or two when a child needs asking about, and are never
  saved to `board.json`: they are GitHub's data, not the reader's.
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
  Owners and counts are facts the board discovered, and they
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
  answers**, never matched by its label, which is wording and changes.
  `CONNECTION_CHECKS` here holds only `identity` and `issues`: the notes badge
  is the shared cloud storage's own check now, driven by `cloudMessages.describeSync`
  over the checks the store runs (ADR 0019, root ADR 0016).
- **The connection checks live folded inside the token they are about**, not
  in one list. `summariseChecks` writes the shut line and names a single
  failure rather than counting it. A one-off message goes to a notice line in
  the screen that raised it (`settings-notice`, `add-token-notice`).
- **`renderLoading` must be changed whenever a list in Settings is.** It
  wrote placeholders into the check list after that list was removed, threw,
  and left the board stuck on "Reading GitHub..." with every test green. That
  is three times now that an `app.js` change was caught by opening the page
  and not by the suite.
- **The masthead toggle is the only way between the views, and the masthead
  scrolls with the page.** It was sticky while settings was about twice the
  height of a window; the token guide moved out (ADR 0018), settings shrank to
  about one screen, and the stickiness went with the reason for it (ADR 0023).
  The add-token screen is the one still longer than a window, and it carries its
  own Cancel at the end of the last step. Measure before adding a second exit or
  putting the stickiness back: board 983, settings 1067, add a token 2110, in a
  window of 898.
- **The order lives in the masthead**, beside the way to Settings, and is
  hidden on the screens it does not govern (ADR 0023).
- **A placeholder mirrors the row it replaces, line for line.** A token row is
  two stacked lines and two buttons, so its placeholder is too. Two bars appended
  to a plain `div` render as one line with no gap, which is what the first
  version did: give the container `.token-lines` (ADR 0004).
- **Build a screen from the five parts** (`.button` and its variants, `.input`,
  `.card`, `.badge`, `.tooltip`), and give any new interactive part a hover, a
  press and a focus-visible state. `invariants.test.js` fails when a
  `.button-*` variant has no `:hover`.
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
| [0010](adr/0010-relationships-come-from-githubs-graph.md) | Relationships come from GitHub's graph, batched per token |
| [0011](adr/0011-columns-are-read-from-github-and-overridden-by-hand.md) | Columns are read from GitHub, and overridden by hand |
| [0012](adr/0012-the-card-menu-lives-in-the-top-layer.md) | The card menu lives in the top layer, and one menu serves the board |
| [0013](adr/0013-work-waiting-on-you-is-a-row-above-the-board.md) | Work waiting on you is a row above the board, not a column in it |
| [0014](adr/0014-a-note-box-appears-only-when-there-is-a-note.md) | A note box appears only when there is a note |
| [0015](adr/0015-settings-hands-the-token-back.md) | Settings hands the token back, behind one warning |
| [0016](adr/0016-the-smart-order-puts-a-stack-in-merge-order.md) | The smart order is oldest first, with each stack in merge order |
| [0017](adr/0017-done-is-today-and-the-board-asks-a-second-question.md) | "Done" is today, and it takes a second question |
| [0018](adr/0018-five-columns-two-headings-and-a-screen-for-adding-a-token.md) | Five columns, two headings, and a screen for adding a token |
| [0019](adr/0019-the-notes-say-whether-they-are-getting-through.md) | The notes say whether they are getting through |
| [0020](adr/0020-a-review-card-says-which-stack-it-is-in.md) | A card says which stack it is in, and where |
| [0021](adr/0021-a-title-is-split-and-a-branch-is-one-tap-away.md) | A title is split from the change it announces, and a branch is one tap away |
| [0022](adr/0022-a-note-belongs-to-the-work-not-to-the-card.md) | A note belongs to the work, not to the place the card sits |
| [0023](adr/0023-the-order-goes-to-the-top-and-the-header-scrolls-away.md) | The order goes to the top, and the header scrolls away |
| [0024](adr/0024-how-the-board-looks-is-the-readers-and-travels-with-them.md) | How the board looks is the reader's, and travels with them |
| [0025](adr/0025-the-board-asks-again-on-a-schedule-this-browser-keeps.md) | The board asks again on a schedule this browser keeps |
| [0026](adr/0026-work-the-reader-pushed-down-sinks-and-takes-its-stack-with-it.md) | Work the reader pushed down sinks, and takes what waits on it |
| [0027](adr/0027-a-stack-lights-up-and-its-number-says-what-it-is.md) | A stack lights up, and its number says which pull request it is |
| [0028](adr/0028-a-card-shows-the-people-and-which-people-depends-on-the-list.md) | A card shows the people, and which people depends on the list |
| [0029](adr/0029-a-button-that-asks-now-and-says-when-it-last-did.md) | A button that asks now, and says when it last did |
| [0030](adr/0030-the-tab-carries-the-number-and-the-reader-decides-what-it-counts.md) | The tab carries the number, and the reader decides what it counts |
| [0031](adr/0031-a-line-you-copy-from-a-card-is-written-by-the-reader.md) | A line you copy from a card is written by the reader |
| [0032](adr/0032-the-children-read-by-what-wants-a-person.md) | The children are a row of pills, and the list is one press away |
| [0033](adr/0033-the-board-draws-its-own-tooltip.md) | The board draws its own tooltip |
| [0034](adr/0034-the-last-column-takes-a-range-of-days.md) | The last column takes a range of days, and the range is in the link |
| [0035](adr/0035-a-reference-lights-the-card-it-names.md) | A reference lights the card it names |
| [0036](adr/0036-the-page-starts-on-a-start-up-screen.md) | The page starts on a start-up screen, and every other screen starts hidden |

## What is not built yet

Connecting with several tokens, the one list of issues and pull requests,
private notes, sorting, the filters and the settings screen are built.
Still to come, roughly in this order: dragging a card instead of choosing its
column from a dropdown, custom tags, and a "what's next" queue, which the
blocked marking and the columns now make answerable. Every new view state goes in the address bar
beside `view`, `sort`, `kind`, `repo`, `label`, `assignee` and `reviewer`, and the tokens never do.
