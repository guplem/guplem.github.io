# Wildfire Watch

A wildfire-watch map for Catalonia that helps you judge real risk, not only see where the dots are. **This first version runs on demo data**: every fire and weather reading is invented.

## Features

- **Five map layers**, each with its own toggle: fires (Deepfire hotspots), the MTG satellite cross-check, wind, towns and protected areas, and fire spread. Only fires are on at start.
- **Hotspots** sized by fire radiative power (FRP) and coloured by detection confidence.
- **MTG cross-check**: a green ring on fires that MTG also saw, and dashed markers for detections only MTG has made.
- **Timeline**: `-3h` and `-1h` show the fire size estimated from the MTG scan series; `+6h`, `+12h` and `+24h` show a simulated spread, stretched along the wind, with a dashed uncertainty band.
- **Impact alerts** for every fire within 10 km of a town.
- **Selected-fire panel**: confidence, fire-weather danger, FRP, age, MTG status, weather, nearest town and nearest protected area.
- **Search a town**, and **Use my location** to name the nearest fire (Barcelona is the demo fallback).
- A footer that says how fresh each data source is, and a "Data sources" dialog that explains each one and its limits.
- Light and dark theme, remembered in this browser.

## How to Run

Serve the repository with any HTTP server and open `web-projects/wildfire-watch/`:

```bash
python -m http.server 8000
```

The page loads Leaflet from cdnjs and map tiles from OpenStreetMap.

## Tests

```bash
bun test
```
