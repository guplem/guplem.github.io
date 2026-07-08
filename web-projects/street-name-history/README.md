# Street Name History

Search any street and see **every name it carries across languages**, the **former names** it has shed through history, and **who or what it was named after** — assembled live from OpenStreetMap, Wikidata, and OpenHistoricalMap.

## Features

- **Free-text street search** — type a street (add a city or region to disambiguate) and pick from the matches.
- **All languages** — every `name:*` variant recorded in OpenStreetMap, each labelled with its language, plus official / international / local / alternate names and nicknames.
- **Former names** — historical `old_name` values, including date-namespaced ones (e.g. a name used only 1939–1979), sorted chronologically.
- **Named after & history** — etymology from OpenStreetMap, enriched with Wikidata (description, year established, and the person/event the street honours) and an OpenHistoricalMap timeline where one exists.
- **Shareable links** — the search and the exact street you picked live in the URL, so any link reopens the same view.

> Historical and multilingual coverage depends entirely on what contributors have mapped, so it is rich for some streets (renamed avenues in major cities) and sparse for others (a quiet residential road). The app shows what exists and says plainly when data is missing.

## How to Run

Open `index.html` in a browser, or serve the folder with any HTTP server:

```bash
python -m http.server 8000
# then visit http://localhost:8000/web-projects/street-name-history/
```

A network connection is required — the app calls the OpenStreetMap Nominatim, Wikidata, and OpenHistoricalMap APIs directly from the browser.

## Tests

```bash
bun test
```

Covers the pure logic: URL state, OSM tag classification and name extraction, and the API query-builders and response-parsers. DOM rendering is not unit-tested (see `web-projects/CLAUDE.md`).

## Data & attribution

- Street data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL)
- Etymology / entity data from [Wikidata](https://www.wikidata.org/) (CC0)
- Historical timelines from [OpenHistoricalMap](https://www.openhistoricalmap.org/)
- Geocoding by [Nominatim](https://nominatim.org/)
