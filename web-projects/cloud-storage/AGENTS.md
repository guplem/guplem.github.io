# web-projects/cloud-storage/AGENTS.md

> **SCOPE:** These rules apply when working on files under `web-projects/cloud-storage/`, and when a web-project adopts it. Root ADR 0016 is the decision; `PLAN.md` is the phased plan and the current phase.

The shared module every web-project uses to keep data in one private GitHub repository: one token, one repository, one folder per project (`triunity-studios-data/<slug>/<file>.json`), one document shape, one merge. With nothing configured, a project keeps working from its local mirror alone.

**This folder is the one allowed import from outside a project's folder.** It is held to the same bar as `github-work-board`: it handles a real credential, so `invariants.test.js` pins the decisions that are cheap to undo and expensive to notice. When one of those tests fails, read root ADR 0016 before you touch the test.

## Module map

| File | Job |
|---|---|
| `envelope.js` | The document shape. `emptyDocument`, `migrate` (never throws, keeps unknown maps), `readRecord`, `writeRecord`, `removeRecord` (keeps the key, marks `removed`), `hasRecords`, `recordCount` (live records only), `serializeDocument`, `parseDocument`, `documentBytes`, `MAX_DOCUMENT_BYTES`, and `defineDocument(recordMaps)` which binds them for one project |
| `merge.js` | `mergeDocuments` (record by record, newer wins, tie to the remote), `sameRecords`, `planSave` → create / update / skip with the sha, `planText` |
| `reconcile.js` | The first meeting of two copies: `describeCopies` → synced / none / local-only / cloud-only / same / ask; `ANSWERS`; `applyAnswer` → the document and which sides to write |
| `cloudSettings.js` | The only file that names `localStorage`. Token, repository, reconciled flags, `DATA_FOLDER`, `DEFAULT_REPO_NAME`, `documentPath`, `mirrorKey`, `browserStorage`, `listMirrors` (every local mirror this browser holds, for the settings page), `newRepoUrl`, `repoUrl` |
| `localStore.js` | `readJson` / `writeJson` / `removeKey` that never throw, and `projectKey(slug, name)`. The promoted wrapper for tier-2 data |
| `cloudPermissions.js` | `REQUIRED_PERMISSIONS`, `PERMISSIONS`, `CONNECTION_CHECKS`, `permissionsFingerprint`, `tokenNeedsUpdate`, `newPermissionsSince` |
| `cloudMessages.js` | `describeFailure` (a failed call as a sentence naming the permission), `summariseChecks`, `describeSync` → local / checking / ok / broken, `MESSAGES` + `say` (the fixed lines for `deployStamp.js`), `escapeHtml` |
| `documentCodec.js` | base64 both ways, UTF-8 safe, newline tolerant |
| `exportBundle.js` | The export file: `encodeBundle`, `readBundle` (every document through `migrate`), `bundleFileName` |
| `cloudGateway.js` | The only file that calls `fetch`: `fetchViewer`, `fetchRepository`, `fetchFolder`, `fetchFile`, `saveFile`. Uniform `{ok, data}` / `{ok: false, status, message, need}`, never throws |
| `cloudStore.js` | Glue a project opens: `openStore({project, file, recordMaps, legacyPath, onChange, onStatus, onQuestion})` → `{document, write, saveNow, reconnect, configured, busy}`. Also `cloudConfiguration` and `runConnectionChecks` |
| `cloudSettingsPanel.js` + `.css` | The settings component: `mountCloudSettings(host, {mode: "full" \| "compact", pageHref, onConfigured})` and `askCopyQuestion(question)`, the dialog a store's `onQuestion` shows. Styled through `--cs-*` custom properties |
| `index.html`, `app.js`, `style.css` | The Cloud storage page, linked from the Playground footer. Reuses the site's global CSS like the index does |
| `deployStamp.js` | The "deployed at" line, copied from the board (root ADR 0013) |
| `invariants.test.js` | The promises above, as tests |
| `PLAN.md` | The plan, the phase we are in, and what each later phase adds |

## Rules

- **Red first.** Every pure module has a test beside it. Write the failing test, watch it fail, then implement (root ADR 0012).
- **Keep the shape.** One file calls the network. One file names `localStorage`. Nothing imports from outside this folder, and nothing from a CDN. The token never goes near `URLSearchParams`, and never into a document or an export file.
- **A new GitHub call that needs new access is one edit**: an entry in `REQUIRED_PERMISSIONS`. Never write a permission into HTML.
- **Additive only.** `schemaVersion` only goes up. `migrate` keeps what it does not understand. A field is added, never renamed or removed. A record is removed by marking it, never by deleting its key.
- **Say the truth about where the data is.** "This device only" is a state, not a fault. Never claim a save reached the cloud until the write answered.
- **A change here reaches every adopting page.** Run `bun test .` from the repo root, not only in this folder, and open one adopting page in the browser before you ship.

## Adopting the standard in a project (the checklist)

1. Decide the tier (root ADR 0016): none, this device, or cloud. Cloud is required for data a person made and would miss on another device. Secrets, caches, binaries and URL state never sync.
2. For tier 2, import `localStore.js` and use `projectKey(slug, name)` as the key.
3. For tier 3, write `document.js` in the project: `const shape = defineDocument([...maps])` plus typed read and write helpers over `shape.read` / `shape.write`, with a test. Then `openStore` at start-up with `onQuestion: askCopyQuestion`, `store.write` on every change, re-render in `onChange`, and mount the compact panel in the project's settings with `onConfigured: () => store.reconnect()`. Link `cloudSettingsPanel.css` from the page and set the `--cs-*` properties on the host if the page has its own palette.
4. Check the page imports no third-party code and writes nothing remote with `innerHTML`. A page that holds a token must own every line it runs.
5. Update the project's `AGENTS.md`, its ADRs, and the "Existing Projects" line in `web-projects/AGENTS.md`.

## Gotchas

- `hasRecords` ignores removed records, so a document that only ever had a record and then lost it counts as empty. `describeCopies` relies on this: a mirror of removals does not trigger the migration question.
- `writeRecord` drops a field named `removed` from what it is given, so a record cannot be un-removed by accident through a stale object. Write it again with fresh fields.
- `sameRecords` and `planSave` ignore the document's own `updatedAt`. Two documents with the same records and different times are the same document; a save of one is a `skip`.
- `saveRepo` with the same owner and name keeps the reconciled flags. A different pair clears them, because a different repository is a different cloud copy.
- `openStore` reads the mirror synchronously, so `store.document` is usable on the first line after the call. The cloud copy arrives through `onChange`; a project that renders only once, before `onChange`, shows stale data.
- The store saves only after this device is reconciled. While the question dialog is open, writes go to the mirror alone and the cloud is untouched; the answer decides which way the first write goes.
- Every `fetchFile` for a document costs one call and every save costs two (read the sha, then write). The panel's table reads every document of every project, so it is not something to run on a timer.
