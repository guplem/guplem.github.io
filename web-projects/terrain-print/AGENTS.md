# web-projects/terrain-print/AGENTS.md

> **SCOPE:** files under `web-projects/terrain-print/`. Read `web-projects/AGENTS.md` first for the rules that cover every web-project.

## What this is

A selection map of the Moon, Mars or Earth, and a build that turns the selection into closed meshes for a slicer: one tile, bed-sized pieces, or a jigsaw puzzle, with an optional frame tray. Vanilla ES modules, no build step. Leaflet (global `L`, cdnjs) draws the map; three.js (import map, jsdelivr, pinned) draws the preview.

Human docs: [README.md](README.md). Decision records:
[ADR 0001](adr/0001-read-heights-the-browser-can-reach-at-the-resolution-the-print-shows.md) (data sources and resolution),
[ADR 0002](adr/0002-measure-a-tiled-copy-against-the-nasa-file-before-trusting-it.md) (calibration),
[ADR 0003](adr/0003-mesh-pieces-with-marching-squares-on-the-height-grid.md) (meshing),
[ADR 0004](adr/0004-project-around-the-centre-and-size-the-box-by-the-view.md) (projection and selection size).

## Module map

| File | Pure? | Responsibility |
|---|---|---|
| `bodies.js` | yes (data) | Each world: radius, height sources in the order to try them, map layers, sea presets, default colours. |
| `elevation.js` | yes | `chooseSource`, level choice, `planTiles` / `planStrips` (with block reads near a pole), bilinear sampling, Terrarium decode, calibration helpers, `runPool`. |
| `lerc1.js` | yes | LERC 1 ("CntZImage") reader for Esri tiles. |
| `geo.js` | yes | Azimuthal equidistant projection, rotation, curvature drop, Mercator tile maths. |
| `heights.js` | yes | `fillGaps`, `floodSea`, `buildHeights` (metres to mm), `edgeHeights`. |
| `outline.js` | yes | Shapes: polygons, offsets, signed distance. |
| `pieces.js` | yes | `planPieces` (grid, merges, knobs, `pieceAt`), `cutDistance`, grid sizing for a count or a bed. |
| `mesher.js` | yes | `meshSolid` (marching squares + earcut bottom + `repairDropped`), `meshFrame`, `isWatertight`, `meshVolume`. |
| `model.js` | yes | `modelGeometry`, `groundPoints`, `footprint`, `buildModel` (the whole build), `layoutOffsets`. |
| `colourPlan.js` | yes | Filament swap heights and `colourAt` for the preview. |
| `exporters.js` | yes | STL, 3MF (one object per part, base-material colours), ZIP, CRC-32. |
| `settings.js` | yes | Defaults per world, printers, filaments, the link (`readSettings` / `writeSearch`). |
| `places.js` | yes (data) | Fact-checked places, Mars shorelines, Earth sea presets. |
| `deployStamp.js`, `deployText.js` | yes | The "deployed at" line (root ADR 0013). |
| `worker.js` | no | Fetch, cache, calibrate, fall back between sources, call `buildModel`, post the meshes. |
| `mapView.js` | no | Leaflet: per-world map, layers, the Earth relief and Mars sea layers, the footprint. |
| `preview.js` | no | three.js scene: bed, parts, band colours, spread, view from below. |
| `app.js` | no | Page glue: controls, the link, worker messages, downloads. |

Data flow: `app.js` (settings) → `worker.js` → `model.modelGeometry` → `model.groundPoints` → `elevation.chooseSource` → fetch → `elevation.sampleTiles` / `sampleStrips` → `model.buildModel` (`heights`, `pieces`, `mesher`) → `app.js` → `preview.show` and `exporters`.

The worker keeps the last height grid. A change to anything except the world, the place, the ground size, the shape, the rotation, the model size or the detail rebuilds the meshes only, in under a second.

## Rules

- **Storage tier: This device** (root ADR 0016). The design lives in the link (root ADR 0006); the printer, the custom bed, the box size and the map layer stay in this browser through `../cloud-storage/localStore.js` and `browserStorage()`, keyed `terrain-print.<name>`. Nothing syncs.

- **Never trust a tiled copy without `calibrateAgainst`.** The ArcGIS Online Moon copy stores heights ×2. See ADR 0002.
- **Keep the resolution rule:** the coarsest level whose samples are no farther apart than one model step. Do not "upgrade" to the finest level: it downloads detail the printer cannot draw (ADR 0001).
- **Every mesh change keeps `isWatertight` true.** The tests check slabs, rings, tiles, puzzles and frames; add a case for any new shape or cut.
- **A strip read must check for HTTP 206.** A server that ignores the range sends the whole file, which is gigabytes.
- **The flat sea is the top of the last sea layer.** `colourAt` starts a band strictly above its `fromMm`, and the swap goes at the first layer boundary at or above the sea surface.

## Gotchas

- **Esri elevation tiles are 513 x 513, not 512.** Sample (i, j) sits on the tile corner grid (pixel-is-point); the 513th column repeats the next tile's first.
- **USGS strip pixels are centred** (pixel-is-area): pixel (col, row) is at `-180 + (col + 0.5) / ppd`. Mixing the two conventions shifts a model by half a pixel.
- **Leaflet with `zoomSnap: 0`:** `GridLayer.redraw()` requests tiles at a fractional zoom. Repaint live tiles instead (`withRepaint` in `mapView.js`).
- **The map must have a size before `zoomForKm`.** On the model screen it is hidden; `viewPixels` assumes 600 px, and `showScreen("map")` sets the view again once the map shows.
- **Light the preview from the north-west.** Light from the camera side turns craters into domes (the crater illusion).
- **The official Esri Moon service (`OnMoon/LOLA_Kaguya`) closed every connection on 2026-10-05.** The page falls back on its own; do not remove it from the list, because it is the finest Moon source when it answers.
- **Headless Chrome in a cloud sandbox** needs `--proxy-server=https=<proxy>`, `--ignore-certificate-errors` and `--no-sandbox` to reach the data. `scripts/captureProjectImage.js` accepts a wrapper script as `CHROME_PATH`.
