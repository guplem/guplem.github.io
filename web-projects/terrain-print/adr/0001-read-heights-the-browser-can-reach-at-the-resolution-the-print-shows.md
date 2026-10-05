# ADR 0001: Read heights from sources the browser can reach, at the resolution the print can show

## Context

The page has no server. Every height must come from a public source that sends
a CORS header (the header that lets a page read bytes from another site), and
that answers fast enough for one person waiting at a progress bar.

The print sets the resolution. One model step is 0.2 mm to 0.6 mm (the
"Detail" choice). On the ground that step is `km × 1000 / sizeMm × spacing`
metres. Data finer than one step is detail the printer cannot draw, and it
costs downloads. Data coarser than one step blurs detail the printer can draw.

On 2026-10-05 these sources answered from a browser:

| World | Source | Form | Finest |
|---|---|---|---|
| Moon | Esri `OnMoon/LOLA_Kaguya` | LERC tile cache | 41 m (level 8) |
| Moon | ArcGIS Online copy of LOLA | LERC tile cache | 166 m (level 6) |
| Moon | USGS LOLA + Kaguya merge, 60°N to 60°S | GeoTIFF, one int16 row per strip | 59 m |
| Moon | USGS LOLA global | GeoTIFF, one int16 row per strip | 118 m |
| Mars | Esri `OnMars/MDEM200M` (HRSC + MOLA blend) | LERC tile cache | 162 m (level 7) |
| Mars | USGS MOLA global | GeoTIFF, one int16 row per strip | 463 m |
| Earth | AWS Terrain Tiles (Terrarium) | PNG tiles, Web Mercator | about 5 m (zoom 15) |

The official Esri Moon service closed every connection during that check. NASA
Trek's Moon height tiles hold 8-bit values only, too coarse for a print.

## Decision

- **List the sources per world in `bodies.js`, in the order to try them.**
- **For each model, `chooseSource` (in `elevation.js`) plans a read with every
  source that has not failed in this session, and keeps the best one.** A
  later source wins only when it is at least 20 % finer, because tiles
  download much faster than file rows.
- **Choose the coarsest level that is still fine enough:** the first level
  whose sample spacing is at most one model step on the ground.
- **Read the USGS files with HTTP range requests,** one per needed row. The
  files are uncompressed and stored row by row, so the byte offset of any
  pixel is known. Consecutive rows that need 40 % or more of the row width
  are read in one request, as whole rows, up to 4 MB per request. Near a pole
  every row spans every longitude. A 60 km model at Shackleton crater needs
  426 rows, and this reads them in 157 requests.
- **Refuse a strip read past 2,500 requests or 64 MB.** A tile source is used
  instead.
- **When a source fails (network error, a status other than 404, data for less
  than half of the area), mark it failed and plan again** with the rest.
- **Earth uses the same tiles for the map and the model.** The map's relief
  layer is drawn from the Terrarium tiles, so the map shows the sea level the
  model will print.

## Consequences

- A model downloads what the printer can show and no more. The panel says
  which source it used and at what resolution.
- The page depends on third-party services it does not control. Every source
  except AWS has a second source behind it. A source that changes its URL
  breaks quietly: the next source answers, and the "Data" line names it.
- A small area on the Moon reads hundreds of file rows. That takes about
  10 seconds on a good connection, and the progress card counts the rows.
- The byte offsets of the USGS files are written in `bodies.js`. They were
  read from each file's TIFF header. If USGS replaces a file, those numbers
  must be read again (the TIFF tags 273 and 279, and the GDAL scale).
