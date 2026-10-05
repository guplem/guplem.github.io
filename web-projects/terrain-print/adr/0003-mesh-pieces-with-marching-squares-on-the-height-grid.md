# ADR 0003: Mesh every piece with marching squares on the height grid

## Context

A print must be a closed solid: every edge used by exactly two triangles, in
opposite directions. Slicers refuse or "repair" anything else in their own way.

The model has a curved outline (a circle, a hexagon), it can be cut into jigsaw
pieces with knobs, and each piece shrinks by half the gap at every cut, so the
pieces fit. Clipping a height grid to such shapes with polygon clipping is
hard to make watertight, because every cell on a boundary is a special case.

## Decision

- **Describe each solid as a field F on the height grid: positive inside.**
  For the tile, F is the signed distance to the outline. For a piece, F is the
  smaller of the outline distance and "distance to the nearest cut, minus half
  the gap", negative where the point belongs to another piece.
- **Which piece a point belongs to is its grid cell, unless it sits in a knob.**
  A knob is a region of one cell that belongs to its neighbour (`pieces.js`).
  The distance to the cuts is exact within a band around them (`cutDistance`).
- **`meshSolid` walks every grid cell (marching squares).** A crossing point
  lies on a cell edge, and both cells that share the edge compute it from the
  same two values in the same order, so the two cells always agree on it.
  Each piece of outline inside a cell gives one wall quad.
- **The flat bottom is filled from the outline loops with earcut,** not cell by
  cell, which halves the triangle count. earcut skips points that lie exactly
  on a straight line, and a wall still ends at such a point, so
  `repairDropped` splits the triangle over each skipped run.
- **The frame tray is built from exact polygons** (`meshFrame`), because it has
  no terrain and its fit must be exact.
- **Small cells at a round rim merge into their largest neighbour,** and a knob
  is used only where all of it lies well inside the outline.

## Consequences

- Every mesh is watertight by construction. The tests check it for slabs,
  rings, round tiles, puzzles and frames, and check the volumes too.
- A corner of the outline is cut by at most one grid cell (0.3 mm on "Fine").
- Mesh size follows the grid: about 400,000 triangles for a round 150 mm tile
  on "Fine". A round 400 mm model on "Fine" is about 2.8 million triangles.
- The jigsaw shape is our own (a neck and a round head, `knobShape`), seeded,
  so one link always gives the same puzzle.
