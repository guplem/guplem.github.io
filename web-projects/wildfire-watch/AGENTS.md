# wildfire-watch/AGENTS.md

> **SCOPE:** Rules for `web-projects/wildfire-watch/`. `README.md` lists what the page does and its sources.

## Two modes

`mode.js` reads `?mode=` from the link. The plain link is **real** (live sources); `?mode=demo` is the invented data set (ADR 0001). Both modes hand `app.js` the same fire shape through `world.js`, so there is one render path. Put mode differences in data (`MODE_CONFIG`, labels) before you add a branch in the render code.

## Module map

| File | Job |
|---|---|
| `mode.js` | The mode from the link, the mode switch links, and which feed URL to read |
| `world.js` | The common fire shape for both modes: naming, the satellite text, the active flag, the timeline steps |
| `firms.js` | The four keyless NASA FIRMS files and the CSV reader (confidence and time rules) |
| `cluster.js` | Joins hot pixels within 1.5 km into fires: power of the latest pass, first and last seen, satellites, extent |
| `feed.js` | The feed file format (build and read), GeoNames reader, the published feed URL |
| `makeFeed.js` | The script the scheduled Action runs to build the feed. I/O only |
| `weather.js` | Open-Meteo URL, reader, forecast mean (wind as a vector), wind grid points |
| `sources.js` | EEA Natura 2000, EFFIS burnt areas and fire danger, Open-Meteo place search |
| `geo.js` | Spherical helpers, including `nearestIndex` for thousands of towns |
| `fireModel.js` | Colours, marker size, wind bands, the simple danger score, past size (demo), the spread ellipse |
| `alerts.js` | Impact alerts, nearest protected area, the demo town search |
| `freshness.js` | The footer's per-source freshness line, one per mode |
| `mockData.js` | The demo fires, MTG-only detections, towns, protected areas, wind grid |
| `invariants.test.js` | Checks that the Action and the page agree on the feed branch, file and script |
| `app.js` | Leaflet and DOM glue only. Keep every rule in a pure module with a test |

## The feed pipeline (ADR 0002)

`.github/workflows/wildfire-feed.yml` runs `makeFeed.js` every 30 minutes and force-pushes one commit with `fires.json` to the **`wildfire-feed` branch**. The page reads it from `raw.githubusercontent.com`. Never merge, protect or delete that branch. The job exits with an error and keeps the old feed when every FIRMS file fails, because an empty feed would read as "no fires".

## Rules

- **Never fall back to demo data in real mode.** When a live source fails, say so in the status panel and keep the rest working. Invented fires on a real-data map are the worst failure this page can have.
- **Only localhost may swap the feed.** `feedUrl()` ignores `?feed=` on the live site, so a crafted link cannot put fake fires on the map. Keep it that way.
- **Say what each layer is.** A past step is real pixels (live) or an estimate (demo). A future step is a rough wind shape, not a fire model. The danger badge is the page's own simple index; the EFFIS layer is the official one. Every hotspot carries the caveat that it can be a farm burn or an industrial heat source.
- **Label the demo.** The mode switch, the demo footer and the demo part of the "Data sources" dialog all say that the data is invented.
- **Wind is "from".** `windFrom` is the direction the wind comes from, as in weather reports. A fire and a wind arrow point the other way: use `downwindBearing()`.
- **Pane order matters.** Towns, burnt areas and Natura 2000 sites sit in the `context` pane (z-index 300), spread shapes in the `spread` pane (350), under the fire markers in the overlay pane (400). A hotspot must stay clickable on top of its outline.
- **Keep calls few.** Weather loads for at most `VIEW_LIMIT` fires in view, in one Open-Meteo call, and is cached on the fire. Open-Meteo is free for non-commercial use with a daily limit per visitor.
- **To add a source that needs a key** (FIRMS MAP_KEY, EUMETSAT for MTG), put the key in a GitHub Actions secret and fetch it in `makeFeed.js`. Never put a key in the page. Update ADR 0003.

## Storage

Tier **This device**: only the theme, under the `wildfire-watch.theme` key through `../cloud-storage/localStore.js`.
