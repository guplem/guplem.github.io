# web-projects/street-name-history/CLAUDE.md

Searches a street and shows all its names across languages, its former names, and its etymology,
by federating three external geodata APIs live in the browser. Vanilla ES modules, no build step.
Human docs: [README.md](README.md). Decision record: [ADR 0001](adr/0001-federated-geodata-sources.md).

## Module map (pure logic is separated from the DOM/network so it can be unit-tested)

| File | Pure? | Responsibility |
|---|---|---|
| `urlState.js` | yes | Parse/serialize the `q` (query) + `sel` (`<type>/<id>`) URL state. Root ADR 0006. |
| `names.js` | yes | Classify OSM tag keys and turn a tag bag into current / historical / etymology name records; language labels via `Intl.DisplayNames`; period formatting. |
| `sources.js` | yes | URL/query builders and response parsers for Nominatim, Wikidata, and OpenHistoricalMap. |
| `data-source.js` | — | The ONLY file that calls `fetch`. Wraps the three APIs; throws on failure. |
| `app.js` | — | DOM controller: search form, candidate list, detail render, async enrichment. |
| `*.test.js` | — | Bun tests for the three pure modules. Run `bun test` here. |

Data flow: `app.js` → `data-source.searchStreets` (Nominatim) → candidate `tags` → `names.extractNames`
renders current/historical/etymology → `app.enrich` fires Wikidata + OHM in parallel and renders each
slot as it resolves.

## Non-obvious conventions & gotchas

- **Nominatim is the sole OSM tag source — Overpass is deliberately NOT used.** `namedetails=1` +
  `extratags=1` on the Nominatim search already return every `name:*`, `old_name*`, `name:etymology*`,
  and `wikidata` tag on the matched element, merged into one `tags` bag by `parseNominatimResults`.
  Adding Overpass would only add a second, heavily rate-limited endpoint for data we already have.
- **Nominatim usage policy: ~1 req/sec, no per-keystroke autocomplete.** Search fires on **submit only**,
  and `app.js` throttles with `MIN_SEARCH_INTERVAL_MS`. Do not wire search to `input` events. Attribution
  is mandatory and lives in the page footer — keep it. See ADR 0001.
- **Tag classification is table-driven and order-sensitive** (`names.js`): the language-vs-period check
  matters. `old_name:1930-1945` is a *period* (digits fail the language regex), `name:ca` is a *language*,
  `name:left`/`name:source` are *variants*. `name:etymology` and `name:etymology:wikidata` are special-cased
  before the base lookup. Changing the regex order silently reclassifies tags.
- **`wikidata` vs `name:etymology:wikidata`** are different entities: the first is the *street's* own
  Wikidata item (richer multilingual labels, `inception`), the second is the *honoree*. `app.js` also falls
  back to the street item's `P138` (named after) with a best-effort second fetch when no explicit etymology
  entity is tagged.
- **Wikidata needs `origin=*`** for anonymous CORS (`buildWikidataUrl`). `URLSearchParams` leaves `*`
  unencoded — that is correct and intended; do not "fix" it.
- **OpenHistoricalMap is best-effort and usually empty.** `fetchOhmTimeline` returns `[]` for missing
  coordinates or no results, and the OHM slot renders nothing when empty — never an error. OHM coverage is
  thin outside major cities; a blank timeline is the expected common case, not a bug.
- **All external text is escaped through `esc()` before `innerHTML`** (street names, Wikidata labels, OSM
  tag values are untrusted). Never interpolate an API string into `innerHTML` without `esc()`.
- **Enrichment must never blank the page.** `app.enrich` uses `Promise.allSettled`; a rejected Wikidata/OHM
  call renders an inline notice in its own slot, leaving the OSM-derived names intact.
