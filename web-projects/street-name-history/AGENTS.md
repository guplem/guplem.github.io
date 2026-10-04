# web-projects/street-name-history/AGENTS.md

Searches a street, or picks the street tapped on a Leaflet map, and shows all its names across languages, its former names, and its etymology,
by federating three external geodata APIs live in the browser. Vanilla ES modules, no build step.
Human docs: [README.md](README.md). Decision records: [ADR 0001](adr/0001-federated-geodata-sources.md), [ADR 0002](adr/0002-tap-a-street-with-nominatim-reverse.md).

## Module map (pure logic is separated from the DOM/network so it can be unit-tested)

| File | Pure? | Responsibility |
|---|---|---|
| `urlState.js` | yes | Parse/serialize the `q` (query) + `sel` (`<type>/<id>`) URL state. Root ADR 0006. |
| `names.js` | yes | Classify OSM tag keys and turn a tag bag into current / historical / etymology name records; language labels via `Intl.DisplayNames`; period formatting. |
| `sources.js` | yes | URL/query builders and response parsers for Nominatim (search, reverse, lookup), Wikidata, and OpenHistoricalMap. |
| `data-source.js` | no | The ONLY file that calls `fetch`. Wraps the three APIs; throws on failure. |
| `app.js` | no | DOM and Leaflet controller: search form, map taps and highlight, candidate list, detail render, async enrichment. Leaflet loads from cdnjs as the global `L`, before this module. |
| `*.test.js` | no | Bun tests for the three pure modules. Run `bun test` here. |

Data flow: `app.js` → `data-source.searchStreets` (Nominatim search), `reverseStreet` (a map tap) or `lookupStreet` (a link with `sel` and no `q`) → candidate `tags` and `geometry` → `names.extractNames`
renders current/historical/etymology → `app.enrich` fires Wikidata + OHM in parallel and renders each
slot as it resolves.

## Non-obvious conventions & gotchas

- **Nominatim is the sole OSM tag source. Overpass is deliberately NOT used.** `namedetails=1` +
  `extratags=1` on the Nominatim search already return every `name:*`, `old_name*`, `name:etymology*`,
  and `wikidata` tag on the matched element, merged into one `tags` bag by `parseNominatimResults`.
  Adding OSM's Overpass would only be a second, heavily rate-limited endpoint for data we already have.
  (This is scoped to *OpenStreetMap* tags: `fetchOhmTimeline` does POST to OpenHistoricalMap's *own*
  separate Overpass endpoint, a different dataset with the time versioning OSM proper lacks.)
- **Nominatim usage policy: ~1 req/sec, no per-keystroke autocomplete.** Search fires on **submit only**,
  and a map tap fires one reverse call. Every Nominatim call (search, reverse, lookup) waits for one shared slot, `claimNominatimSlot()` with `MIN_NOMINATIM_INTERVAL_MS`. Do not wire search to `input` events, or reverse to map `move` events. Attribution
  is mandatory and lives in the page footer. Keep it. See ADR 0001.
- **Tag classification is table-driven and order-sensitive** (`names.js`): the language-vs-period check
  matters. `old_name:1930-1945` is a *period* (digits fail the language regex), `name:ca` is a *language*,
  `name:left`/`name:source` are *variants*. `name:etymology` and `name:etymology:wikidata` are special-cased
  before the base lookup. Changing the regex order silently reclassifies tags.
- **`wikidata` vs `name:etymology:wikidata`** are different entities: the first is the *street's* own
  Wikidata item (richer multilingual labels, `inception`), the second is the *honoree*. `app.js` also falls
  back to the street item's `P138` (named after) with a best-effort second fetch when no explicit etymology
  entity is tagged.
- **Wikidata needs `origin=*`** for anonymous CORS (`buildWikidataUrl`). `URLSearchParams` leaves `*`
  unencoded: that is correct and intended; do not "fix" it.
- **OpenHistoricalMap is best-effort and usually empty.** `fetchOhmTimeline` returns `[]` for missing
  coordinates or no results, and the OHM slot renders nothing when empty, never an error. OHM coverage is
  thin outside major cities; a blank timeline is the expected common case, not a bug.
- **All external text is escaped through `esc()` before `innerHTML`** (street names, Wikidata labels, OSM
  tag values are untrusted). Never interpolate an API string into `innerHTML` without `esc()`.
- **A reverse answer that is not street-like means "no street here".** With no road near the tap, Nominatim falls back to the area around it (a neighbourhood relation), and `parseNominatimReverse` returns `null` for it. Without this check the map would highlight a whole district. See ADR 0002.
- **A tap below `MIN_PICK_ZOOM` zooms in and picks nothing.** At low zoom one tap covers many streets.
- **The map tiles are dark by a CSS filter** (`invert` + `hue-rotate` on `.leaflet-tile-pane`), not by a dark tile provider. The highlight and the tooltip are outside that pane, so they keep their real colours.
- **Enrichment must never blank the page.** `app.enrich` uses `Promise.allSettled`; a rejected Wikidata/OHM
  call renders an inline notice in its own slot, leaving the OSM-derived names intact.
