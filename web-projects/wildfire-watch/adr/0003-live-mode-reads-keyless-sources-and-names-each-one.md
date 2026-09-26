# 0003. The live mode reads only keyless sources, and each layer names its source

## Context

The page is public and static. A key in the page is visible to everyone. The design asked for Deepfire, MTG, WeatherNext and ELMFIRE, which a static page cannot reach (ADR 0001). A live wildfire map must also not claim more certainty than its sources hold.

## Decision

Use only free sources that need no key:

| Need | Source | Why this one |
|---|---|---|
| Hotspots | NASA FIRMS, through the feed (ADR 0002) | The only free near-real-time hotspots for all of Europe |
| Cross-check | Agreement between FIRMS satellites | MTG's fire product needs an EUMETSAT account and a server. Two different satellites that see the same fire are the check that the free data allows |
| Weather and place search | Open-Meteo | Keyless, CORS, many points in one call |
| Official fire danger | EFFIS Fire Weather Index (WMS tiles) | The European reference scale. Its point query returns no values, so the page shows it as a map layer and keeps its own simple badge, labelled as such |
| Burnt areas | EFFIS WFS, this season | Keyless, CORS, current |
| Protected sites | EEA Natura 2000 (ArcGIS REST) | Keyless, CORS, covers the EU. Asked only for the selected fire |
| Towns | GeoNames, through the feed | Overpass was not reliable enough |

Name the source in every layer label, the legend, the footer and the "Data sources" dialog. State the limits in the page: a hotspot can be a farm burn or a factory; the spread shape is not a fire model; the page is not an official warning service.

## Consequences

- Nobody has to register for a key, and no key can leak.
- A source that needs a key (a FIRMS MAP_KEY for other regions, EUMETSAT for MTG) goes into a GitHub Actions secret and `makeFeed.js`, never into the page.
- Open-Meteo is free for non-commercial use. A commercial use of this page needs its paid plan.
