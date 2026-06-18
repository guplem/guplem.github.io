# web-projects/liga-under-tkd/CLAUDE.md

Live tournament site for the Liga UNDER taekwondo event. Reads a public Google Sheet via the gviz
endpoint and renders standings, combats, and athlete profiles. Vanilla ES modules, no build step.
Human docs: [README.md](README.md) (features/run) and [SETUP.md](SETUP.md) (connect the Sheet).
Decision record: [ADR 0008](../../adr/0008-google-sheet-as-database.md).

## Module map (pure logic is separated from the DOM so it can be unit-tested)

| File | Pure? | Responsibility |
|---|---|---|
| `config.js` | — | The one place to edit: `sheetId` (empty = mock/demo mode), poll interval, event date. |
| `i18n.js` | yes | Translations table (ca/es/en) + `detectLanguage`, `t`, `translateToken`. |
| `sheet.js` | yes | gviz URL builder, response parser, value coercers, record normalizers. |
| `engine.js` | yes | Scoring: round/combat results, league points, standings, cross-table, fixtures. |
| `mock-data.js` | — | Sample rows (header-keyed, same shape as gviz) for demo mode. |
| `data-source.js` | — | The ONLY file that does `fetch`. Switches gviz ↔ mock; runs normalizers. |
| `app.js` | — | DOM controller: hash router, polling loop, the four views. |
| `*.test.js` | — | Bun tests for the three pure modules. Run `bun test` here. |

Data flow: `data-source` → (gviz `sheet.js` parse + normalize | mock) → `app.js` holds state →
`engine.js` computes → views render. Players/Groups load once; Combats is polled.

## Conventions specific to this project

- **TDD applies to the pure modules only** (engine/sheet/i18n). Views/DOM are not unit-tested.
- **Stored tokens stay English in the data, translated only for display** via `translateToken`
  (Sex `Masculino`/`Femenino`, Status, Side `Red`/`Blue`, Age). Never localize the sheet values.
- **All sheet-derived text is escaped** through `esc()` before going into `innerHTML` (XSS-safe).
- **Routing is hash-based**: `#/home`, `#/fields`, `#/groups/:groupId`, `#/athletes/:playerId`.
  Group selection and athlete profiles live in the hash so links are shareable.
- **Render vs refresh**: `renderRoute()` rebuilds a view on navigation; `refreshLiveRegions()`
  updates only the combats-driven region on a poll, so it never wipes the search box or scroll.

## Gotchas (non-obvious; a future agent would get these wrong without the note)

- **gviz needs `headers=1`** in the URL so the first sheet row becomes the column labels (the exact
  header strings). Without it, gviz may guess headers and the normalizers (keyed by exact header
  strings) silently return empty records.
- **The gviz response is not JSON**: it is `google.visualization.Query.setResponse({...});`. The
  parser slices between the first `{` and last `}`. Do not `JSON.parse` the raw text.
- **Standings count only `Finished` combats.** `Ongoing`/`Scheduled` are excluded; `Cancelled` is
  ignored entirely. Changing this silently corrupts the table.
- **Points-for/against come from raw round scores; league points come from rounds won.** A
  tie-break decides a round's winner (league points) but does not change points-for.
- **The tiebreaker chain is data** (`DEFAULT_TIEBREAKERS` in `engine.js`): reorder the array to
  change the official ranking rule; do not hardcode comparisons elsewhere.
- **Demo vs live is decided by `config.js` `sheetId`** being empty or not (`isLiveMode`). Polling is
  skipped entirely in demo mode (mock data never changes).
