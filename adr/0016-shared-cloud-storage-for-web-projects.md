# ADR 0016: Shared cloud storage for web-projects

## Context

Several web-projects keep data a person made and would miss on another device:
the akwaaba-monsters save, the rps-mind-reader history, the mancala record, two
recents lists. Each keeps it in this browser only (ADR 0007). One project,
`github-work-board`, already keeps its data in a private GitHub repository the
reader owns, written through the Contents API, and it solved the hard parts
once: a document shape with a time on every record, a merge that runs record by
record, a save that carries the file's `sha` and retries once on a 409, a token
guide written once, a permission list in the code, and a badge that says whether
saves get through (github-work-board ADR 0002, 0005, 0008, 0015, 0019).

The rule until now was that each web-project is self-contained, with no shared
code (`web-projects/AGENTS.md`, "Conventions"). The one exception was the
directory index (ADR 0008). Four projects also carry the same forty-line
localStorage wrapper, past the "promote at the third copy" rule.

A shared cloud-storage module contradicts the self-contained rule, and it widens
the threat model that github-work-board ADR 0001 wrote for one page: a token in
localStorage is readable by every page on the same origin that chooses to read
it, and now many pages import the code that does.

Options considered:

1. **Copy the board's storage code into each project.** No exception to the
   rule. Every copy drifts, every fix lands N times, and the token setup is
   repeated in every project's settings.
2. **A shared module under `web-projects/`, imported by relative path.** One
   token, one repository, one folder per project, one merge, one settings
   component. A named exception to the self-contained rule.
3. **A server.** Out of the question: GitHub Pages serves static files (ADR 0002).

## Decision

**`web-projects/cloud-storage/` is a shared ES module folder, and the second
deliberate exception to the self-contained rule.** A web-project may import
from `../cloud-storage/` and from nothing else outside its own folder.

- **One token, one repository, for every project.** `cloudSettings.js` is the
  one file that names `localStorage` for the keys `triunity-studios.cloud.token`,
  `triunity-studios.cloud.repo` and `triunity-studios.cloud.reconciled`. The
  repository must be private; a public one fails the check loudly. The token
  needs Metadata (read) and Contents (read and write), listed once in
  `cloudPermissions.js`.
- **One layout.** `triunity-studios-data/<project-slug>/<file>.json` in that
  repository. The folder name never changes; every project's path starts with it.
- **One document shape.** `{schemaVersion, updatedAt, <map>: {<key>: {…, updatedAt}}}`
  (`envelope.js`). Records are only ever added; a removed record keeps its key
  with `removed: true`. `migrate` never throws and copies unknown maps through.
  A project with one blob uses one map with one key. The akwaaba-monsters
  ADR 0002 contract (additive only, permanent identifiers) is now the standard's.
- **One merge.** Record by record, the newer `updatedAt` wins, a tie keeps the
  remote copy (`merge.js`, lifted from github-work-board ADR 0002). A save
  carries the `sha` of the read it merged against and retries once on 409.
- **The local copy always exists.** The store keeps a mirror of every document
  in localStorage (`triunity-studios-data.<project>.<file>`). With nothing
  configured, the mirror is the only copy and the project works as before. With
  cloud storage configured, a page opens from the mirror and merges the cloud
  copy in. ADR 0007 is therefore also the fallback and the cache of this ADR.
- **The first meeting of two copies is a question, asked once per document per
  device** (`reconcile.js`). It comes up only when both copies hold data and
  differ. Three answers: merge both (first, because it loses nothing), keep this
  device's data, use the cloud data. The settings page lists every project with
  the same three answers and a row that answers for all. A device that answered
  keeps a flag; a new token or repository clears every flag.
- **Secrets, caches, binaries and shareable state never sync.** An API key
  stays in this browser; a cache is fetched again; a multi-MB pack stays in
  IndexedDB (whatsapp-sticker-creator ADR 0004); a shareable setup stays in the
  link (ADR 0006). A document is refused above 900 KB, under GitHub's 1 MB
  content limit.
- **Three tiers for a project's data**, and the tier is chosen when the project
  is created: none (URL state), this device (`localStore.js`, the promoted
  wrapper), cloud (`cloudStore.js`). Cloud is required, not optional, for data a
  person made and would miss on another device.
- **The shared module is held to the board's bar.** `invariants.test.js` in the
  folder pins: only `cloudGateway.js` calls `fetch`; only `cloudSettings.js`
  names `localStorage`; the exact keys and folder name; no import from outside
  the folder and none from a CDN; the token never near the address bar; an
  export file never carries the token.

**Security consequence, stated plainly.** Every page that imports this module
holds a credential in its origin's localStorage. Such a page loads no third-party
code and writes nothing remote with `innerHTML`. The module itself is checked by
its invariants; each adopting project is checked when it adopts. A project that
imports a CDN script (the directory index imports `marked`) does not adopt until
the import goes.

**Rejected alternative:** copying the board's storage code into each project.
Rejected because the token setup and the merge are exactly the code that must
not drift, and a person would set the same token up once per project.

## Consequences

**Positive:**

- One setup for every project. The reader pastes one token once, on one page,
  and every project that adopts the standard saves to the same repository.
- The board's proven code is reused, not rewritten. Its ADRs 0002, 0005, 0008,
  0015 and 0019 now describe shared code and point here.
- The board gains a local fallback it never had: with no token, edits used to
  live in memory and vanish on reload.
- Export and import of every project's data in one file, from one page.

**Negative:**

- The self-contained rule now has two exceptions, and a third would need a
  reason as good. The scope below keeps the door narrow.
- A change to the shared module reaches every adopting page at once. The
  invariants and the additive-only contract are the guard, and a bad migration
  would damage a repository shared by every project, not one browser.
- A token in localStorage is now read by more pages. The threat model of
  github-work-board ADR 0001 applies to each of them, and each must keep to the
  two rules above.
- One more hop for a new project: choose a tier, declare record maps, embed the
  panel.

## Scope

Applies to `web-projects/cloud-storage/` and to every web-project that imports
it. The exception to the self-contained rule covers that one folder and nothing
else: a project still imports nothing from another project, from the index, or
from the main site. The three-tier rule applies to every new web-project.
`web-projects/cloud-storage/PLAN.md` holds the phased plan and the adoption
order; `web-projects/cloud-storage/AGENTS.md` holds the module map and the
adoption checklist.
