# ADR 0001: Federate Nominatim + Wikidata + OpenHistoricalMap, client-side, no Overpass

## Context

Street Name History needs three things for an arbitrary user-typed street:

1. **Geocode** the free text to a specific place.
2. **All names** on that place — every language variant and naming role OpenStreetMap records.
3. **History** — former names, etymology, and (where it exists) a dated timeline.

The project is a static, self-contained web-project on GitHub Pages (root ADR 0002: no build system,
no server). So every data source must be reachable directly from the browser (CORS-enabled) with no
API key and no backend of our own.

Candidate OSM access paths for the names:

- **Nominatim** (`/search`) with `namedetails=1&extratags=1` returns the matched element plus **all**
  its `name:*`, `old_name*`, `name:etymology*`, and `wikidata` tags in one response.
- **Overpass** can fetch the full tag set of a specific element too, but it is a separate, heavily
  rate-limited endpoint, and for a single already-geocoded element it returns nothing Nominatim didn't.

History enrichment has no OSM-native home: OSM has `old_name`/etymology tags but no time model.
**Wikidata** (via `wbgetentities`, CORS with `origin=*`) supplies multilingual labels, a description,
an `inception` date, and the "named after" entity. **OpenHistoricalMap** has its own Overpass endpoint
with genuine `start_date`/`end_date` time versioning — the one source with real dated name timelines.

## Decision

**Federate three CORS-enabled APIs directly from the browser, and use Nominatim (not Overpass) as the
sole OpenStreetMap tag source.**

- **Nominatim** does both the geocoding search *and* delivers the OSM tag bag (namedetails + extratags
  merged). No Overpass call is made for OSM data.
- **Wikidata** enriches the "named after & history" panel: street-item description + inception, and the
  honoree entity (explicit `name:etymology:wikidata`, else the street item's `P138`).
- **OpenHistoricalMap** provides a best-effort dated timeline of nearby historical roads.

Enrichment is non-blocking: Wikidata and OHM fire in parallel (`Promise.allSettled`) after the
OSM-derived names have already rendered, and each failure degrades to an inline notice in its own slot.

We honour Nominatim's usage policy: search fires on **submit only** (never per keystroke), is throttled
to ~1 request/second, and OpenStreetMap / Wikidata / OpenHistoricalMap / Nominatim attribution is shown
in the page footer.

## Consequences

**Positive**

- Zero backend, zero keys, zero build — consistent with root ADRs 0001/0002 and GitHub Pages hosting.
- One fewer failure point and no Overpass rate-limit exposure for the primary path (names), since
  Nominatim already carries every tag we need.
- The two enrichment sources are strictly additive: with both down, the app still shows all OSM names.
- Every builder/parser is pure and unit-tested, so the request/response contract is verifiable offline.

**Negative**

- **Coverage is contributor-dependent and uneven.** Historical/multilingual richness varies wildly by
  street; OHM is usually empty outside major cities. The UI must state when data is missing rather than
  imply completeness.
- **Subject to third-party availability and policy.** A Nominatim outage or policy change breaks search;
  the ~1 req/sec limit caps throughput and rules out autocomplete.
- **Two round-trips for a P138-only honoree** (resolve the "named after" QID after the street item),
  accepted as a rare, best-effort path.
- If a future need arises for tags on a *set* of ways (e.g. a whole street split across many segments)
  rather than the single element Nominatim returns, Overpass may have to be revisited — this ADR would
  then be updated.

## Alternatives considered

- **Overpass as the OSM tag source** — rejected: a second rate-limited endpoint for data Nominatim
  already returns for the single matched element.
- **A backend proxy / cache** — rejected: violates the no-server, static-hosting constraint and adds
  operational surface for a portfolio demo.
- **A SPARQL query to the Wikidata Query Service** — heavier and more fragile than `wbgetentities` for
  the handful of entities involved; the REST entity endpoint is enough.
