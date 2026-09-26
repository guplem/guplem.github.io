# Wildfire Watch

A wildfire map for Europe that helps you judge real risk, not only see where the dots are. It has two modes:

- **Live data** (the default): real satellite hotspots, weather, the official fire danger forecast, burnt areas, towns and protected sites.
- **Demo**: the full design on invented fires over Catalonia, with the Deepfire, MTG, WeatherNext and ELMFIRE layers the design was drawn for.

**Not an official warning service.** Satellites see heat, not fire. Follow your local emergency service. In an emergency, call 112.

## Features

- **Map layers**, each with its own toggle: fires, the satellite cross-check, wind, the EFFIS fire danger (live mode), context (towns, parks, burnt areas) and spread. Only fires are on at start.
- **Hotspots** from NASA FIRMS (four satellites over Europe), joined into fires, sized by fire radiative power (FRP) and coloured by confidence. Fires last seen 24 to 48 hours ago are faded.
- **Cross-check**: a green ring on fires that two or more satellites saw.
- **Timeline**: past steps show the satellite pixels seen by then (live) or an estimate from the MTG series (demo). Future steps show a shape stretched along the forecast wind, with a dashed uncertainty band. It is not a fire-behaviour model.
- **Impact alerts** for every fire within 10 km of a town, with the town's population.
- **Selected-fire panel**: confidence, a simple fire-weather danger badge, FRP, first and last seen, the satellites, current weather, nearest town, and whether the fire is inside a Natura 2000 site.
- **Search a town** anywhere, and **Use my location** to find the nearest active fire.
- A footer that says how fresh each source is, and a "Data sources" dialog that explains each one and its limits.
- Light and dark theme, remembered in this browser. The mode lives in the link (`?mode=demo`).

## Data sources (live mode)

All of them are free and need no key.

| Source | What it gives | How the page reads it |
|---|---|---|
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) | Hotspots from Suomi NPP, NOAA-20, NOAA-21 (VIIRS) and Terra/Aqua (MODIS), past 48 hours | A scheduled GitHub Action copies the files to the `wildfire-feed` branch every 30 minutes |
| [Open-Meteo](https://open-meteo.com/) | Wind, temperature, humidity, hourly forecast, place search | Directly from the browser |
| [EFFIS](https://effis.jrc.ec.europa.eu/) | Fire Weather Index forecast for today, burnt areas this season | Directly from the browser |
| [EEA Natura 2000](https://www.eea.europa.eu/) | Protected sites near a selected fire | Directly from the browser |
| [GeoNames](https://www.geonames.org/) | Towns of 1,000 or more people | Built into the feed by the Action |

## How to Run

Serve the repository with any HTTP server and open `web-projects/wildfire-watch/`:

```bash
python -m http.server 8000
```

To try live mode before the feed branch exists, build a feed and point a local page at it (`?feed=` works only on `localhost`):

```bash
curl -fsSLO https://download.geonames.org/export/dump/cities1000.zip && unzip cities1000.zip
bun web-projects/wildfire-watch/makeFeed.js --geonames cities1000.txt --out local-feed.json
# then open http://localhost:8000/web-projects/wildfire-watch/?feed=/local-feed.json
```

## Tests

```bash
bun test
```
