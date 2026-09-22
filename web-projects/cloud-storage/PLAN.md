# Cloud storage for web-projects: the plan

One GitHub token, one private data repository, one folder per web-project. Every
web-project on triunitystudios.com that keeps data a person would miss on
another device stores it there. When the token or the repository is missing,
the project keeps working on this device alone, and offers to move the data
later.

This file is the plan and the handover note (like
`web-projects/akwaaba-monsters/ROADMAP.md`). Each phase updates the status line
below when it lands. Read it before you touch anything under
`web-projects/cloud-storage/`.

**Status:** every phase has landed. Phase 4 shrank on purpose: akwaaba-monsters
is the only other adopter. The owner judged rps-mind-reader, mancala,
unit-converter, whatsapp-no-contact and ai-world-gen not worth a token to the
person using them, and that judgement is now the rule in §2.8 and root ADR 0016:
cloud is the exception, asked for every new project.

---

## 1. What exists today, and what it tells us

**The work board already solves the hard parts once.** `github-work-board`
keeps a document `{schemaVersion, updatedAt, <map>: {<key>: {…, updatedAt}}}` in
`board.json` of a private repository. It reads the file with its `sha`, merges
record by record (the newer `updatedAt` wins, a tie goes to the remote copy,
ADR 0002), writes with the `sha`, and retries once on a 409. The token guide is
written once in a `<template>` (ADR 0008), the permission list lives in code
(ADR 0005), the token is only ever copied, behind one warning (ADR 0015), and a
badge says whether saves get through (ADR 0019). Everything below generalises
that code. It does not invent a second way.

**The work board has one gap the standard must close.** It has no local
fallback. With no writing token, `state.board` lives in memory only and every
edit is lost on reload.

**What the other projects store** (survey of every folder under `web-projects/`):

| Kind of data | Where found | Cloud? |
|---|---|---|
| User-created content, small JSON | akwaaba-monsters save (tens of KB), rps-mind-reader rounds (≤500), mancala record, unit-converter recents, whatsapp-no-contact recents | **Maybe.** This is what the standard is for, but cloud is the exception (§2.8): the owner later kept only akwaaba-monsters on it and left the rest on this device. |
| Preferences | ai-world-gen models/style, mancala setup/speed, language pickers, akwaaba mute/haptics | **Optional.** Sync when a person would want them to follow. Language and mute stay per device. |
| Secrets | ai-world-gen OpenRouter key, work-board tokens, github-stats-dashboard token (memory only) | **Never.** A secret never leaves this browser. |
| Caches of remote data | unit-converter exchange rates | **Never.** Fetch again instead. |
| Shareable state | URL query params in ten projects | **Never.** The link carries it (root ADR 0006). |
| Binary, multi-MB | whatsapp-sticker-creator pack in IndexedDB | **Never.** The contents API returns JSON content only up to 1 MB. Stays local (its ADR 0004). |

Two facts from the survey shape the design:

- The same ~40-line localStorage wrapper (try/catch every read and write,
  refused write = forgotten) is copied in four projects. The promotion rule in
  `web-projects/AGENTS.md` ("when a third project adopts this, promote it")
  already applies. The shared module ships this wrapper too.
- Only akwaaba-monsters and whatsapp-sticker-creator carry a version and a
  `migrate` that never throws and never drops unknown fields. The standard makes
  that mandatory, because a bad migration now damages a shared repository, not
  one browser.

---

## 2. Decisions

Each decision here has a trade-off. Phase 1 records them in **root ADR 0016,
"Shared cloud storage for web-projects"**, and the per-topic ADRs listed in §6.

### 2.1 One shared module, a named exception to "self-contained"

`web-projects/cloud-storage/` is a shared ES module folder that any web-project
imports by relative path (`../cloud-storage/…`). No build, no CDN (root ADR 0002).

This contradicts the sentence "No shared dependencies with the main site or
other projects" (`web-projects/AGENTS.md:12`, root `AGENTS.md` "Web Projects").
It becomes the **second** deliberate exception, next to the directory index
(root ADR 0008). The exception is narrow: a project may import
`web-projects/cloud-storage/` and nothing else outside its folder.

### 2.2 Layout in the repository

```
<data repository>/
  triunity-studios-data/
    README.md                      written once by the settings page, says what this is
    github-work-board/board.json
    rps-mind-reader/history.json
    akwaaba-monsters/save.json
    …
```

- The folder name is fixed: `triunity-studios-data`. The project folder is the
  project slug (its folder name under `web-projects/`). One file per document.
- Default repository name: `triunity-studios-data` (owner = the token's login).
  The reader can type another name. The page never creates the repository; it
  links `github.com/new?name=…&visibility=private`, like the board does.
- A **public** repository fails the check loudly. Notes and saves are private.

### 2.3 One document shape for everything

Every stored file is the work board's envelope:

```json
{ "schemaVersion": 1, "updatedAt": "<iso>", "<map>": { "<key>": { "…": "…", "updatedAt": "<iso>" } } }
```

- A project declares its maps (`RECORD_MAPS`). A project with "one blob" (a game
  save) uses one map with one key. This gives every project the same merge rule,
  the same conflict handling and the same migration dialog. No second "opaque"
  kind.
- Records are append-only. `migrate` keeps maps it does not know. `schemaVersion`
  only goes up. Fields are only added (the akwaaba-monsters ADR 0002 contract).
- Merge: record by record, newer `updatedAt` wins, tie goes to the remote copy
  (work board ADR 0002, lifted unchanged).
- A file must stay well under 1 MB. The store refuses a write above 900 KB and
  says so, instead of failing later in the API.

### 2.4 The local copy is always there

The store **always** keeps a local mirror of each document in localStorage under
`triunity-studios-data.<project>.<file>`. Reads come from the mirror first, so a
page opens painted at once (the board's ADR 0024 rule). Then:

- **No token or repository configured:** the mirror is the only copy. The
  project works as today. A small line in its settings says "Saved on this
  device only" and links to the cloud settings page.
- **Configured:** open reads the cloud file, merges into the mirror, renders;
  every write goes to the mirror at once and to the cloud after a 1.2 s rest,
  with the sha dance and one retry on 409.

This closes the work board's gap for free and makes the migration question a
comparison between two copies that both already exist.

### 2.5 The migration question

The question appears when a project opens with cloud storage configured and
finds a document **both** in the mirror and in the cloud, and this device has
**not reconciled that document yet** (a per-device flag, one entry per
`<project>/<file>` in the `triunity-studios.cloud.reconciled` key). Once answered, the mirror
is a mirror, and the question never returns for that document on that device.

Three answers, in this order:

1. **Merge both (recommended).** Record by record, same rule as a normal sync.
   Loses nothing. Offered because the envelope makes it free.
2. **Keep this device's data.** Local overwrites cloud.
3. **Use the cloud data.** Cloud overwrites local.

Inside a project, the question covers that project's documents only. On the
cloud settings page, every project that has both copies is listed, each with
the three buttons, plus one row of **"Merge all" / "Keep this device for all" /
"Use the cloud for all"**. Each answer writes at once and shows the result in
the row.

Special case, the work board: its cloud copy today sits at `board.json` in the
**root** of `work-board-data`. When the new path is missing, the store reads the
legacy path once, treats it as the cloud copy, and the first save writes the new
path. The legacy file is left in place; the settings page says so.

### 2.6 One token, one place, one guide

- `cloudSettings.js` is the only file that names `localStorage` for the cloud
  keys: `triunity-studios.cloud.token` (`{token, name, login, grantedPermissions}`),
  `triunity-studios.cloud.repo` (`{owner, repo}`), and the reconciled flags.
- Permissions needed: **Metadata: read**, **Contents: read and write**, listed
  once in `cloudPermissions.js` with a fingerprint, so a later permission shows
  "your token needs an update" (work board ADR 0005 lifted).
- The work board keeps its own token **list** for reading issues across owners
  (its ADR 0007). Storage uses the shared single token. Its settings gets one
  button: "Use this token for cloud storage too". On first run after the
  change, if the cloud setting is empty and a board token has `canWriteBoard`,
  the board adopts that token and its `dataRepo` as the cloud setting without
  asking, and says so once.
- The token is only copied to the clipboard, behind one warning; a backup file
  never enters a synced document (ADR 0015, with the existing invariant moved
  to the shared module).
- Security consequence to record in root ADR 0016: every page that imports
  cloud-storage holds a token in its origin's localStorage. Such a page loads
  **no third-party code** and writes nothing remote with `innerHTML`. The
  invariants test of the shared module checks the first; adoption of a project
  that imports a CDN (the index page imports `marked`; ai-world-gen must be
  checked) requires dropping the import first or staying local.

### 2.7 The settings component and the page

`cloudSettingsPanel.js` renders into a host element the project provides, in two
modes:

- **Full** (the cloud settings page, and the work board's settings):
  status checks with the three badges the board uses (identity → login; repository
  reachable and private; folder writable, proven by a GET on the folder, where
  404 is fine and 403 names the missing permission); the token guide from one
  `<template>` with the permission list filled from code; repository name field;
  the per-project list with copy states and the migration buttons; **Export**
  (downloads one file `triunity-studios-data-<date>.json` holding every
  document of every project, from the cloud when configured, else from the
  mirror) and **Import** of that same file (goes through the merge, never
  overwrites blindly); "Copy token" behind the warning; "Forget token" (mirrors
  stay; the text says so).
- **Compact** (any project's settings): one line with the sync badge, "Saved on
  this device only" or "Saved to <owner>/<repo>", and a link to the full page.
  The migration dialog, when needed, opens from here.

The page: `web-projects/cloud-storage/index.html`, title "Cloud storage", with
the deploy stamp footer (root ADR 0013), linked from the footer of
`web-projects/index.html` as "Cloud storage settings". It is not a portfolio
project and gets no `data/projects/*.json` entry.

Styling: the panel ships `cloudSettingsPanel.css` built on a few custom
properties (`--cs-bg`, `--cs-fg`, `--cs-border`, `--cs-accent`, …) with neutral
defaults, so the work board maps its shadcn tokens onto them and a plainer
project gets a sensible look with no work. The page itself reuses the site's
global variables like the index does.

### 2.8 The rule for new projects (three tiers)

Written into `web-projects/AGENTS.md`, and asked by the `add-web-project` skill
as one question, every time, unless the answer is plain. Cloud is the exception:
setting it up costs a token and a repository, once, and on a phone that is real
work, so a small experiment stays on this device. It is for data whose loss
hurts (hours of game progress, notes written over weeks) or a project whose
point is to follow the person or keep a history.

| Tier | When | What the scaffold does |
|---|---|---|
| **None** | Toys, demos, anything whose state fits the URL | Nothing. URL state per root ADR 0006. |
| **This device** | Preferences, small caches, secrets, binaries | Import `localStore.js` from cloud-storage (the promoted wrapper). Key `<slug>.<name>`. |
| **Cloud** | Data whose loss hurts, or a project whose point is to follow the person or keep a history | Import `cloudStore.js`, declare `RECORD_MAPS`, embed the compact panel in settings, add a migration test. |

The skill asks the tier, then names the files each tier needs (the adoption
checklist in `cloud-storage/AGENTS.md` is the reference; no templates folder,
the snippets live in the skill).

---

## 3. The shared module, file by file

All pure files have a test beside them (root ADR 0012). `bun test .` picks the
folder up with no registration.

| File | Job | Source it generalises |
|---|---|---|
| `cloudSettings.js` | The only file that touches localStorage for cloud keys. Token, repo, reconciled flags. Storage injected. | `github-work-board/settings.js` |
| `cloudPermissions.js` | `REQUIRED_PERMISSIONS`, fingerprint, `tokenNeedsUpdate` | `permissions.js` |
| `cloudGateway.js` | The only file that calls `fetch`: `fetchViewer`, `fetchRepository`, `fetchFolder`, `fetchFile`, `saveFile`. Uniform `{ok, data}` / `{ok:false, status, message, need}`. 15 s timeout, `no-cache`. | `gateway.js` (storage calls only) |
| `documentCodec.js` | base64 both ways, UTF-8 safe | moved as is |
| `envelope.js` | `emptyDocument`, `migrate`, `readRecord`, `writeRecord`, `removeRecord`, `serialize`, `parse` (never throws), `sizeInBytes` | `boardDocument.js` core |
| `merge.js` | `mergeDocuments`, `planSave` → create / update / skip | `sync.js` |
| `reconcile.js` | Pure: given `{local, cloud, reconciled}` → `none / local-only / cloud-only / same / ask`; applies an answer (`merge / keep-local / use-cloud`) → the document to write where | new |
| `cloudMessages.js` | `describeSync(checks)` → `{state, label, detail}`; failure text incl. rate-limit vs permission 403 | `messages.js`, `githubErrors.js` |
| `localStore.js` | The promoted try/catch wrapper: `readJson`, `writeJson`, `remove` | four copies in mancala, unit-converter, ai-world-gen, rps-mind-reader |
| `cloudStore.js` | Glue, thin: `openStore({project, file, recordMaps, now})` → `{document, needsDecision}`; `write(document)` schedules the save; status events for the panel. | `app.js` save scheduling |
| `exportBundle.js` | Pure: build and read the export file `{format, exportedAt, projects: {slug: {file: doc}}}` | new; shape after `tokenBackup.js` |
| `cloudSettingsPanel.js` + `.css` | The DOM component, full and compact | work-board settings view |
| `index.html`, `app.js`, `style.css` | The cloud settings page | — |
| `invariants.test.js` | Only `cloudGateway.js` fetches; only `cloudSettings.js` names localStorage; exact keys; token never in a URL, never in a document, only to `api.github.com`; no CDN import; permission list not written in HTML | `github-work-board/invariants.test.js` |
| `AGENTS.md` + `CLAUDE.md` shim | Module map, the adoption checklist, gotchas | — |
| `templates/` | `document.js`, `document.test.js`, `store.js` starters for the skill | — |

A project's own code after adoption: `document.js` (its `RECORD_MAPS` and typed
read/write helpers over `envelope.js`, plus its test), one `openStore` call at
start-up, `write` on every change, the compact panel in settings. Nothing else.

---

## 4. Phases, one pull request each

Every PR follows the `change-the-board` procedure for the board and the
`web-projects/AGENTS.md` rules elsewhere: red test first, `validate` before the
PR, `docs-checker` after, `adr-checker` in maintain mode, stamp in a second
commit, browser check of every page touched (a green suite never proves a page
loads).

1. **Pure core + decision.** `envelope`, `merge`, `reconcile`, `documentCodec`,
   `cloudPermissions`, `cloudSettings`, `cloudMessages`, `localStore`,
   `exportBundle`, their tests, the shared `invariants.test.js`. Root ADR 0016.
   Update the self-contained sentences in both `AGENTS.md` files. New
   `cloud-storage/AGENTS.md`. No UI, nothing imports it yet. Risk: none to live pages.
2. **Gateway, store, panel, page.** `cloudGateway`, `cloudStore`,
   `cloudSettingsPanel`, the Cloud storage page, the footer link. Verified in
   the browser against a real private repository, including the 409 retry and
   a public-repo refusal. Still no adopter.
3. **Move the work board.** Replace `dataRepo`/`canWriteBoard`, `sync.js`,
   `documentCodec.js` and the envelope half of `boardDocument.js` with imports;
   keep the board's typed read/write helpers. Adopt the old token and repo
   automatically; read legacy root `board.json`; embed the full panel in
   Settings. Loosen the "no import outside the folder" invariant to allow
   `../cloud-storage/`. Update board ADRs 0001, 0002, 0005, 0008, 0015, 0019
   in place, and its `AGENTS.md` module map. This PR closes the "edits lost
   without a token" gap.
4. **Second adopter: akwaaba-monsters.** The save, as one record; mute and
   haptics stay local. The compact panel sits under the game in the page's
   footer, and a cloud copy is applied at the title screen only. **No other
   adopter.** rps-mind-reader, mancala, unit-converter, whatsapp-no-contact and
   ai-world-gen were considered and left on this device: their data is not
   worth a token to the person who owns it.
5. **The rule for new projects.** The three-tier table in `web-projects/AGENTS.md`,
   the tier question and templates in the `add-web-project` skill, the root
   `README.md` and `web-projects/index.html` mention of the Cloud storage page.
   Can merge right after phase 3.

Order of 4 and 5 can swap. Phases 1 to 3 are the standard; 4 and 5 are its
spread.

---

## 5. Things I decided, and you may want to change

- **Merge as a third answer** in the migration dialog, and the recommended one.
  You asked for two. Merge loses nothing and costs nothing, so I put it first.
- **Default repository name `triunity-studios-data`**, same as the folder.
  Existing board users keep `work-board-data` through the automatic adoption.
- **The local mirror always exists**, even with cloud configured. It costs a
  few KB of localStorage per project and buys instant paint, offline reading and
  a clean migration story.
- **Secrets and binaries never sync.** The OpenRouter key stays in this browser.
- **Panel styling through custom properties**, not the site's global CSS,
  so it fits inside the shadcn-styled board and inside a plain project.
- **Cloud is the exception for new projects, not the rule.** The owner is asked
  every time (§2.8), and most user-created content turned out not to be worth
  a token: only akwaaba-monsters took the cloud tier in the end.

---

## 6. ADRs touched

| ADR | Change |
|---|---|
| root **0016** (new) | Shared cloud storage: the exception, the layout, the envelope, the mirror, the migration answers, the security scope, the three tiers |
| root 0007 | Add: localStorage is also the mirror and fallback of cloud storage |
| root 0008 | Add: the index is no longer the only exception |
| board 0001 | Token logic lives in the shared module; blast radius re-derived for many pages |
| board 0002 | Merge rule now lives in `cloud-storage/merge.js`, unchanged |
| board 0005, 0008, 0015, 0019 | Point at the shared permission list, template, hand-back and badge |
| board 0007 | The token list is for reading work; storage uses the one shared token |
| akwaaba-monsters 0002 | Add: its contract is now the standard's contract |

---

## 7. Open questions for the owner

1. Default repository name `triunity-studios-data`, or keep `work-board-data`?
2. Offer **Merge** in the migration dialog, or only the two answers you named?
3. Should language pickers and mute/haptics sync? (Plan says no.)
4. Should the Cloud storage page also list projects that store nothing yet,
   as "Saves on this device only", for orientation? (Plan says yes, small.)
