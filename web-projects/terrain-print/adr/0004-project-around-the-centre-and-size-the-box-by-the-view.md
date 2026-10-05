# ADR 0004: Project around the centre of the selection, and size the box by the view

## Context

A model is a flat print of a curved surface. The map is flat too, but in a
projection made for browsing: plate carrée (simple cylindrical) for the Moon
and Mars, Web Mercator for Earth. Both stretch areas away from the equator,
and plate carrée turns a pole into a line. Popular targets sit near poles: the
Moon's Shackleton crater is at 89.67°S.

The selection needs a size on the ground that a person can set quickly, and
that a shared link brings back exactly.

## Decision

- **Every model point is placed with an azimuthal equidistant projection
  around the centre of the selection** (`geo.js`). Distance and direction from
  the centre are kept exactly, at any latitude and across the date line.
- **The map draws the true footprint of the selection:** the outline polygon is
  projected back to latitude and longitude. Near a pole it looks stretched on
  the map, and the panel says that the model is not.
- **The selection stays at the centre of the view.** Its size is a share of the
  view (the "Box size"), so zooming the map changes the ground size, as in a
  camera viewfinder.
- **The link stores the ground size in km, not the zoom.** At start-up the page
  computes the zoom that gives that size. Leaflet zoom snapping is off
  (`zoomSnap: 0`), because a snapped zoom would change the size.
- **Leaflet's `redraw()` is not used on a computed layer.** At a fractional
  zoom it requests tiles at that fractional zoom (it does not round), so a sea
  change repaints the live tiles in place instead.

## Consequences

- A polar crater prints round, and a selection across the date line prints
  whole.
- The selection size changes with the zoom. Someone who wants a fixed size
  types it into the link or picks a place, which sets both.
- The map cannot show a pole well. A polar map view is a possible next step.
