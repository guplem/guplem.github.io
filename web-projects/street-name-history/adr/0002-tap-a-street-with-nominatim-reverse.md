# ADR 0002: Pick a tapped street with Nominatim reverse at street zoom, and reject any answer that is not a street

## Context

Readers asked to pick a street on a map instead of typing its name. A tap gives a point (latitude,
longitude). The app must turn that point into one OpenStreetMap element with the same tag bag that a
search returns, so the name panels work unchanged.

The map is Leaflet with OpenStreetMap tiles, loaded from cdnjs. `wildfire-watch` uses the same setup.

Two ways can turn a point into a street:

- **Nominatim `/reverse`** with `zoom=17` answers with the nearest road, never a building or a shop. With
  `namedetails`, `extratags` and `polygon_geojson`, it returns the full tag bag and the line to draw.
- **Overpass** `way(around:R,lat,lon)["highway"]` returns every road near the point with its geometry.
  ADR 0001 rejected Overpass as an OSM tag source, and it is the more heavily rate-limited endpoint.

## Decision

**Use Nominatim `/reverse` at `zoom=17` for a tap, and treat an answer that is not street-like as "no
street here".**

- When no road is near the tap, Nominatim falls back to the area around it, for example a neighbourhood
  relation. `parseNominatimReverse` returns `null` for any answer that `isStreetLike` rejects, and the
  page tells the reader to tap on the line of a street.
- Below map zoom `MIN_PICK_ZOOM` (15), a tap zooms in and picks nothing, because one tap covers many
  streets.
- A tap clears the query: the URL keeps only `sel`. Nominatim `/lookup` reopens such a link.
- Search, reverse and lookup share one ~1 request/second slot (ADR 0001).

## Consequences

**Positive**

- One endpoint and one candidate shape for search, tap and link. The name panels need no change.
- No new rate-limited endpoint, and no build step (root ADR 0002).

**Negative**

- OpenStreetMap often splits a long street into many ways. A tap picks and highlights only the piece
  under the finger. A search has the same limit.
- A tap a little off the road can pick a nearby pedestrian area or side street. The highlight and its
  tooltip show the reader what was picked.
- The map tiles add load on `tile.openstreetmap.org`, which allows light use with attribution. Leaflet
  shows the attribution in the map corner.
