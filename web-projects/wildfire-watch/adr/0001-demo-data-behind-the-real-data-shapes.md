# 0001. Ship demo data first, in the shapes the real sources will fill

## Context

The design uses five sources: Deepfire hotspots, the MTG (Meteosat Third Generation) satellite scans, Google WeatherNext, the ELMFIRE spread model and the Catalan GIS layers. None of the live ones has a free endpoint that a static page can call from the browser without a key and a server. The design still needs to be tried with real people before anyone pays for that plumbing.

## Decision

Ship the page with invented fires and weather in `mockData.js`, over real towns and rough outlines of real protected areas. Keep every rule (danger score, spread shape, past size, alerts) in pure, tested modules that read only the data shapes, so real fetchers can replace `mockData.js` without other changes.

Label the demo in three places: the header badge, the footer, and the "Data sources" dialog. A wildfire map that looks real but is not can mislead a person in danger, so the label is not optional.

Draw the map with Leaflet from cdnjs and OpenStreetMap tiles. The design prototype used Leaflet, and a tile map shows the roads and terrain that a person needs to judge a fire.

The spread ellipse and the danger score are simple stand-ins. They copy the idea of each model (a fire grows fastest downwind; wind, heat and dry air raise the danger), not its physics.

## Consequences

- The page is useful as a design and a demo, not as a warning service.
- Going live means new fetchers and a server or proxy for the keys, not new rendering code.
- The page depends on two third-party hosts (cdnjs and the OpenStreetMap tile servers). If either fails, the map does not draw. The sidebar still shows the facts.
