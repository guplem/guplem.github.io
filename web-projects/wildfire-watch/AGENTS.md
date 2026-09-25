# wildfire-watch/AGENTS.md

> **SCOPE:** Rules for `web-projects/wildfire-watch/`. The project's design spec is the source of this build; `README.md` lists what the page does.

## Module map

| File | Job |
|---|---|
| `geo.js` | Spherical helpers: distance, destination point, point in polygon, distance to polygon, nearest item, inverse-distance weighting |
| `fireModel.js` | Colours, marker size, wind bands, the fire-weather danger score, the past-size estimate, the forecast spread ellipse |
| `alerts.js` | Joins fires to the context layer: impact alerts, nearest protected area, the town search |
| `freshness.js` | The footer's per-source freshness line |
| `mockData.js` | The demo fires, MTG-only detections, towns, protected areas and the blended wind grid |
| `i18n.js` | The message catalogue (English; the deploy line also in Spanish) |
| `deployStamp.js` | The "deployed at" footer line (root ADR 0013) |
| `app.js` | Leaflet and DOM glue only. Keep every rule in a pure module with a test |

## Rules

- **Label the demo.** The page runs on invented fires (ADR 0001). The header badge, the footer and the "Data sources" dialog all say so. Never remove one of them while the data is mock.
- **Say what each layer is.** A past step is an estimate from the MTG series, a future step is a model run with its run time, and the context layer is static. Keep those words on the page when you change a layer.
- **Wind is "from".** `weather.windFrom` is the direction the wind comes from, as in weather reports. A fire and a wind arrow point the other way: use `downwindBearing()`.
- **Pane order matters.** Protected areas and towns sit in the `context` pane (z-index 300) and spread shapes in the `spread` pane (350), under the fire markers in the overlay pane (400). A hotspot must stay clickable on top of its outline.
- **To go live**, replace `mockData.js` with fetchers that return the same shapes (`FIRES`, `MTG_ONLY`, `TOWNS`, `PROTECTED_AREAS`, `windGrid()`), and replace the fixed timestamps in `app.js` (`UPDATED`) with the real ones. Update ADR 0001 when you do.

## Storage

Tier **This device**: only the theme, under the `wildfire-watch.theme` key through `../cloud-storage/localStore.js`.
