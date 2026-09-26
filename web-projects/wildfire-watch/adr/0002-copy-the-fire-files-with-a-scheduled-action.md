# 0002. Copy the fire files with a scheduled GitHub Action, and read the copy

## Context

NASA FIRMS publishes near-real-time hotspot files for Europe with no key. But the files send no CORS header (the header that lets a page on another site read a response), so a browser cannot read them. The FIRMS API and WFS do send the header, but they need a MAP_KEY. A key in a public page is shared by every visitor and hits the per-key limit. EFFIS runs a keyless WFS with CORS, but its hotspot layer stopped in 2021. Overpass (OpenStreetMap) answered with errors and timeouts when tested, so it cannot name the towns near a fire. This site has no server.

## Decision

Run `.github/workflows/wildfire-feed.yml` every 30 minutes. It runs `makeFeed.js`, which:

1. fetches the four keyless FIRMS files (Suomi NPP, NOAA-20 and NOAA-21 VIIRS, and MODIS), 48 hours each;
2. keeps the GeoNames towns (1,000 or more people) within 15 km of any detection;
3. writes one compact `fires.json`.

The job force-pushes that file as the only commit of the `wildfire-feed` branch, so the branch never grows. The page reads it from `raw.githubusercontent.com`, which sends CORS headers. Joining pixels into fires, naming them and all other rules run in the page, in tested modules, so the feed stays raw data.

The job keeps the old feed when every FIRMS file fails, because an empty feed would read as "no fires". The page shows both the newest satellite pass and the age of the copy, and it warns when the copy is more than two hours old.

## Consequences

- No key, no server and no cost: Actions minutes are free for a public repository.
- The data is up to 30 minutes older than FIRMS, plus the cache of `raw.githubusercontent.com` (about 5 minutes). The satellites pass about twice a day each, so this delay is small next to the delay of the satellites.
- GitHub runs a scheduled job late when it is busy, and turns it off after 60 days with no activity in the repository. The page's staleness warning shows both cases.
- The feed covers Europe only. Another region is one more FIRMS file per satellite.
- Only localhost may point the page at another feed (`?feed=`), so a link cannot put invented fires on the live map.
