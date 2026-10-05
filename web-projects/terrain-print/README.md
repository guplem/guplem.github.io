# Terrain Print

Pick any area of the Moon, Mars or Earth on a map and download a 3D-printable model of its terrain: one tile, pieces that fit your printer bed, or a jigsaw puzzle, with an optional frame.

## Features

- **Three worlds, real data.** NASA LRO LOLA and JAXA SELENE Kaguya heights for the Moon, NASA MGS MOLA and ESA Mars Express HRSC for Mars, and AWS Terrain Tiles (SRTM, GEBCO and more) for Earth.
- **The resolution the print can show.** One model step (0.2 to 0.6 mm) is a known distance on the ground, and the page reads the data level that matches it: no less, no more.
- **Any shape and size.** A circle, a hexagon, a square or a rectangle, turned to any angle. The size slider goes from 40 to 600 mm; a link can ask for up to 1.2 m.
- **Height your way.** Set the relief in mm, or a vertical exaggeration. The panel shows both. Keep the curve of the globe if you like.
- **A sea you can move.** On Earth, a flat sea at today's level, the last ice age (−125 m) or with all land ice melted (+70 m), or the sea floor itself. On Mars, the proposed shorelines of an ancient ocean. A small step at the coast makes the coastline crisp.
- **Pieces.** Split a big map into pieces that each fit your bed, with locking joints, or cut it into a jigsaw puzzle (4 to 150 pieces) with a gap you choose.
- **A frame tray.** The tile or the puzzle drops into a tray with a chosen fit, floor and border.
- **Colour by height.** Pick filament colours; the page gives the layer to swap filament at for the sea, the land and an optional snow line, and the preview shows it.
- **Places to start.** About 25 famous places per world: Apollo and rover landing sites, the biggest mountains and the best-known craters. Earth also searches OpenStreetMap.
- **Downloads.** One 3MF file with every piece as its own coloured object, or STL files (one file for a single part, a ZIP with print notes for more). Every mesh is closed (watertight).

## How to Run

Open `index.html` through any HTTP server (the worker needs one):

```bash
python -m http.server 8000
```

Then go to <http://localhost:8000/web-projects/terrain-print/>.

## Tests

```bash
bun test
```

## URL Parameters

The link holds the whole design, so a shared link rebuilds the same model. Only the world and the place are always written; every other choice is written only when it differs from the default.

| Parameter | What it does |
|---|---|
| `b` | World: `moon`, `mars` or `earth` |
| `lat`, `lon`, `km` | Centre and ground size of the selection (longest side) |
| `shape`, `rot` | `circle`, `hexagon`, `square`, `landscape`, `portrait`; rotation in degrees |
| `mm`, `q` | Model size (longest side, mm); detail `draft`, `standard`, `fine`, `ultra` |
| `hm`, `relief`, `ex`, `base` | Height mode (`relief` or `exaggeration`), relief mm, exaggeration, base mm |
| `curve` | `1` keeps the curve of the globe |
| `sea`, `sl`, `flood`, `step` | Sea on or off, sea level (m), `connected` or `all`, coast step (mm) |
| `split`, `pieces`, `joint`, `gap`, `seed` | `single`, `bed` or `puzzle`; piece count; `knob` or `straight`; gap; cut pattern |
| `frame`, `fit`, `floor`, `border`, `rim`, `rimmm` | Frame tray and its fit, floor, border width and border height |
| `c`, `cs`, `cw`, `cf`, `snow`, `snowm` | Terrain, sea, snow and frame colours; snow on and its line (m) |
| `view` | `model` opens the 3D preview |

## Files

| File | What it holds |
|---|---|
| `index.html`, `style.css` | The page |
| `app.js` | Page glue: controls, link, worker, downloads |
| `mapView.js` | The Leaflet map, the Earth relief layer and the Mars sea |
| `preview.js` | The three.js preview |
| `worker.js` | Fetching, calibration and the build, off the page's thread |
| `bodies.js` | Each world's size, height sources and map layers |
| `elevation.js` | Source choice, tile and row planning, sampling |
| `lerc1.js` | The LERC 1 reader for Esri tiles |
| `geo.js` | Projections and tile grids |
| `heights.js` | Metres to print mm, the sea, the curve |
| `outline.js` | Print shapes |
| `pieces.js` | Jigsaw and bed-sized cuts |
| `mesher.js` | Closed meshes (marching squares) and the frame |
| `model.js` | The whole build, from heights to parts |
| `colourPlan.js` | Filament swap heights |
| `exporters.js` | STL, 3MF and ZIP |
| `settings.js` | Defaults, printers, filaments, the link |
| `places.js` | Places, Mars shorelines and Earth sea levels |
| `deployStamp.js`, `deployText.js` | The "deployed at" line (root ADR 0013) |
| `vendor/earcut.js` | earcut 3.2.4 by Mapbox (ISC), for the flat bottoms |

## Data and attribution

- Moon: NASA LRO LOLA and JAXA SELENE Kaguya, through USGS Astrogeology and Esri. Map: LRO WAC mosaic and LOLA shaded relief through NASA Moon Trek.
- Mars: NASA MGS MOLA and ESA Mars Express HRSC (USGS blend), through Esri and USGS. Map: Viking MDIM 2.1 and MOLA shaded relief through NASA Mars Trek.
- Earth: AWS Terrain Tiles by Mapzen (SRTM, NED, ETOPO1, GEBCO and others). Map: drawn from the same tiles, or OpenStreetMap. Place search: Nominatim (OpenStreetMap).
- Mars shorelines: Head et al. 1999 (Deuteronilus, −3,760 m) and Carr and Head 2003 (Arabia, −2,090 m). Earth sea levels: USGS.

## Privacy

The page sends your selection's tile and row requests to the data services above, and a typed place name to Nominatim when you search on Earth. It keeps your printer and map choice in this browser. It has no account and no server.

## Live Version

<https://triunitystudios.com/web-projects/terrain-print/>
