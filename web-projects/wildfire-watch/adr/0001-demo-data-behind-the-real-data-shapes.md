# 0001. Keep a demo mode on invented data, in the same shapes as the live data

## Context

The design was drawn for five sources: Deepfire hotspots, the MTG (Meteosat Third Generation) satellite scans, Google WeatherNext, the ELMFIRE spread model and the Catalan GIS layers. None of the live ones has a free endpoint that a static page can call. The first version of the page shipped on invented data only. The page now has a live mode (ADR 0002 and ADR 0003), but the full design, with its 10-minute MTG cross-check and its ELMFIRE runs, can still be shown only on invented data.

## Decision

Keep a **demo mode** (`?mode=demo`) next to the live mode. It reads `mockData.js`: invented fires and weather over real towns and rough outlines of real protected areas. `world.js` turns both data sets into one fire shape, so one render path draws both modes.

Label the demo in three places: the mode switch in the header, the demo footer, and the demo part of the "Data sources" dialog. A wildfire map that looks real but is not can mislead a person in danger.

The spread ellipse and the danger score are simple stand-ins in both modes. They copy the idea of each model (a fire grows fastest downwind; wind, heat and dry air raise the danger), not its physics.

## Consequences

- The demo shows what the page would do with the sources it was designed for.
- A new layer must work for both modes, or be marked as live-only or demo-only in the HTML (`data-only`).
- The live mode is the default, so a visitor lands on real fires.
