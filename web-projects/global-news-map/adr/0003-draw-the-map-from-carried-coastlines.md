# ADR 0003: Draw the map from coastlines the page carries, not from map tiles

## Context

The page needs a world map to put pins on. The usual answer is a mapping library
such as Leaflet with raster tiles from OpenStreetMap. That would give pan, zoom
and street-level detail almost for free.

It would also add a second network dependency, and one that behaves differently
from the first. Wikipedia is asked three questions per day and answers with data.
A tile server is asked for a new image every time the reader drags, forever.

## Decision

Draw the map on a canvas, from coastline data the page ships with, using an
equirectangular projection.

- **The data** is Natural Earth 1:110m land polygons, taken from the `world-atlas`
  TopoJSON build. Natural Earth is public domain. `buildWorld.js` decodes it into
  plain longitude and latitude rings, keeps outer rings only, rounds to two
  decimals (about one kilometre) and drops shapes under 0.6 square degrees. The
  result is `world.js`: 109 shapes, 4,958 points, 64KB before compression.
- **The projection** is equirectangular. Longitude goes straight across and
  latitude straight down, so the whole world is one rectangle exactly twice as
  wide as it is tall, and `project` is two multiplications.
- **Every shape is cut at the 180th meridian before it is drawn.**
  `geo.splitAtAntimeridian` does it, once at start-up, and `app.js` draws the
  result. See the first cost below for why.
- **Every frame is drawn from scratch.** 111 outlines is cheap enough that
  partial redrawing would only add a way for the screen and the state to disagree.

## Consequences

**What this buys.**

- **One service to depend on.** Once the day's news has loaded, the page makes no
  further requests at all. Panning and zooming ask nothing of anyone.
- **The footer's privacy line can be absolute.** The page talks only to Wikipedia,
  full stop, with no "except the map tiles" attached.
- **No third-party attribution requirement** beyond a public-domain credit, and no
  tile-usage policy to comply with.
- **The projection maths is pure, so it is tested.** `geo.test.js` pins the
  round trip from degrees to pixels and back, that north is up, and that zooming
  keeps the point under the cursor exactly where it was. None of that is testable
  through a mapping library.
- **The map is themed with the page.** Land, ocean and graticule are CSS custom
  properties, so dark mode is the same three tokens as everything else, not a
  different tile set.
- **It works offline** once loaded, and it cannot break because a tile host
  changed its rules.

**What it costs.**

- **The page owns the flat-map problems a mapping library would have solved.**
  The 180th meridian, or antimeridian, is where the map's east edge meets its
  west edge. Natural Earth spans it with a vertex at +180 next to a vertex at
  -180. Those two are one place on a globe and opposite sides of a flat picture,
  so a line drawn between them crosses the whole world. Four shapes carry such a
  pair: Eurasia where Chukotka runs past the meridian, Antarctica, Fiji and
  Wrangel Island. Three of them drew a straight line across the map for months,
  and a reader reported them. `geo.splitAtAntimeridian` now cuts every shape at
  the meridian and walks each piece out to its own edge of the map, so the land
  runs off one side and comes back on the other. `geo.test.js` guards the real
  data against the same class of fault returning.
- **No street-level detail, ever.** At 1:110m a coastline is visibly a chain of
  straight lines when zoomed in far. `MAX_ZOOM` is 32 for that reason: past it the
  page would only be showing off the limits of its own data.
- **No place labels.** There are no city names, no borders and no roads on the
  map. The story list beside it carries the place name instead, which is why that
  list is not optional.
- **Greenland is too big.** Equirectangular stretches everything far from the
  equator. For a map whose job is "a pin in roughly the right country" that is
  acceptable; for anything about area it would not be.
- **64KB of coordinates ship with the page.** It compresses well and it is a
  one-off cost, unlike tiles.
- **Pan and zoom are hand-written**, including pinch. That is about 60 lines in
  `app.js` and it is covered indirectly by the pure `geo.js` tests.

**If street detail is ever needed**, this decision is the one to revisit, and
`geo.js` plus `drawLand` in `app.js` are the whole surface that would change.
