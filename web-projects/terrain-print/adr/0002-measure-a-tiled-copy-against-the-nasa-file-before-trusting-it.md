# ADR 0002: Measure a tiled copy against the NASA file before trusting it

## Context

The fast way to read Moon heights is an Esri LERC tile cache. The official one
(`OnMoon/LOLA_Kaguya`) did not answer on 2026-10-05. A copy of LOLA hosted on
ArcGIS Online by another account did answer, with a full pyramid to 166 m.

A check against the NASA LOLA file at six points showed that the copy stores
every height doubled: the ratio was 2.000 at every point. That copy is probably
built for a 3D globe, where relief is often exaggerated. Nothing in its metadata
says so. A model built from it without the check would show the Moon twice as
rugged as it is, with no error anywhere.

The copy belongs to someone else, and its owner can change it at any time.

## Decision

- **A tile source with `calibrateAgainst` in `bodies.js` is measured before its
  first use in a session.** The worker picks up to five points in a fetched
  tile that are far from the datum (so the ratio is clear) and on smooth
  ground (so a half-pixel offset between the two grids cannot change the
  value). It reads the same points from the NASA file, two bytes each.
- **`ratioFromPairs` accepts the copy only when every pair agrees on one ratio
  within 3 %.** The heights are then divided by that ratio.
- **A copy that fails the check is marked failed,** and the next source is
  planned.
- **The official Esri Moon service is measured the same way.** Its ratio is
  expected to be 1.
- **The "Data" line says when a copy was scaled back,** and by how much.

## Consequences

- The copy gives correct heights today, and a change of its scale is caught
  instead of printed.
- The first Moon model of a session costs a few extra two-byte requests.
- Calibration needs the NASA file to answer. If it does not, the copy is
  refused and the NASA file is read directly, which is slower but correct.
