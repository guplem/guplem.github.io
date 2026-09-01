// The map's arithmetic: degrees to pixels, and the pan, zoom and grouping that
// go with it.
//
// The projection is equirectangular, which means longitude goes straight across
// and latitude straight down. It is the plainest projection there is: a degree
// of longitude is the same width everywhere, so the whole world is one rectangle
// exactly twice as wide as it is tall. Greenland comes out too big, which is the
// price, and for a map whose job is "a pin in roughly the right country" it is
// the right trade. It also means `project` is two multiplications, so redrawing
// every frame while the reader drags costs nothing.
//
// A view is `{ zoom, cx, cy }`. `cx` and `cy` are the point in the middle of the
// canvas, in world units where the whole world runs 0 to 1 in each direction.
// `zoom` is how many canvas widths the world is wide, so `zoom: 1` is the whole
// world and `zoom: 8` is one eighth of it.
//
// Everything here is pure. `app.js` owns the canvas; this file never touches it.

/** Zoomed all the way out: the world exactly fills the canvas width. */
export const MIN_ZOOM = 1;
/**
 * Zoomed all the way in. The coastlines come from a 1:110m outline, so past
 * about this much the coast is visibly a chain of straight lines and going
 * further only shows off the source data's limits.
 */
export const MAX_ZOOM = 32;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Degrees to world units, both running 0 to 1. North is y = 0. */
export function lonLatToUnit(lon, lat) {
  return { x: (lon + 180) / 360, y: (90 - lat) / 180 };
}

/** World units back to degrees. */
export function unitToLonLat(x, y) {
  return { lon: x * 360 - 180, lat: 90 - y * 180 };
}

/**
 * How big the whole world is on screen, in pixels.
 * The height is always half the width: that ratio *is* the projection, and any
 * other value stretches every coastline.
 */
export function worldSize(view, size) {
  const width = size.width * view.zoom;
  return { width, height: width / 2 };
}

/** Where a place lands on the canvas. */
export function project(lon, lat, view, size) {
  const unit = lonLatToUnit(lon, lat);
  const world = worldSize(view, size);
  return {
    x: (unit.x - view.cx) * world.width + size.width / 2,
    y: (unit.y - view.cy) * world.height + size.height / 2,
  };
}

/** What a point on the canvas is pointing at. */
export function unproject(x, y, view, size) {
  const world = worldSize(view, size);
  return unitToLonLat(
    (x - size.width / 2) / world.width + view.cx,
    (y - size.height / 2) / world.height + view.cy,
  );
}

/**
 * Pull a view back to one that can actually be drawn: a legal zoom, and no gap
 * between the edge of the map and the edge of the canvas.
 *
 * When the map is smaller than the canvas in a direction it cannot fill it, so it
 * is centred in that direction instead of pinned to one side.
 */
export function clampView(view, size) {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
  const world = worldSize({ ...view, zoom }, size);
  // Before the first layout the canvas can have no size at all.
  if (!(world.width > 0) || !(size.width > 0) || !(size.height > 0)) return { zoom, cx: 0.5, cy: 0.5 };

  const halfX = size.width / 2 / world.width;
  const halfY = size.height / 2 / world.height;
  return {
    zoom,
    cx: halfX >= 0.5 ? 0.5 : clamp(view.cx, halfX, 1 - halfX),
    cy: halfY >= 0.5 ? 0.5 : clamp(view.cy, halfY, 1 - halfY),
  };
}

/**
 * Zoom by `factor`, keeping whatever sits under `point` exactly where it is.
 *
 * Without that anchor the map drifts under the cursor on every wheel turn and the
 * reader loses the place they were looking at.
 */
export function zoomAt(view, size, point, factor) {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const before = worldSize(view, size);
  const after = worldSize({ ...view, zoom }, size);
  if (!(before.width > 0) || !(after.width > 0)) return clampView({ ...view, zoom }, size);

  // The world unit currently under the point, then the centre that keeps it there.
  const unitX = (point.x - size.width / 2) / before.width + view.cx;
  const unitY = (point.y - size.height / 2) / before.height + view.cy;
  return clampView(
    {
      zoom,
      cx: unitX - (point.x - size.width / 2) / after.width,
      cy: unitY - (point.y - size.height / 2) / after.height,
    },
    size,
  );
}

/**
 * Drag the map by a distance in pixels. The map follows the finger, so the centre
 * moves the opposite way.
 */
export function panBy(view, size, dx, dy) {
  const world = worldSize(view, size);
  if (!(world.width > 0)) return clampView(view, size);
  return clampView({ zoom: view.zoom, cx: view.cx - dx / world.width, cy: view.cy - dy / world.height }, size);
}

/**
 * A step of more than this many degrees of longitude means the outline jumped
 * the 180th meridian. No real coastline moves half the world between two points.
 */
const WHOLE_WORLD_STEP = 180;

/** The edge of the map that a longitude belongs to: the west edge or the east one. */
const edgeFor = (lon) => (lon < 0 ? -180 : 180);

/**
 * Cut one coastline into pieces where it crosses the 180th meridian.
 *
 * The 180th meridian, or antimeridian, is where the map's east edge meets its
 * west edge. Natural Earth cuts a landmass that spans it into a vertex at +180
 * followed by a vertex at -180. On a globe those two are the same place. On a
 * flat map they are opposite sides of the picture, so drawing a line between
 * them draws a line across the whole world.
 *
 * Four shapes in `world.js` carry such a pair, and each one drew such a line:
 * Eurasia where Chukotka runs past the meridian, Antarctica, Fiji and Wrangel
 * Island. A reader reported the lines.
 *
 * Each piece is walked out to the edge of the map it belongs to, so the piece
 * that is closing ends on the edge and the next piece starts on the other edge.
 * The land then runs off one side and comes back on the other, which is what it
 * really does. A piece of fewer than three points encloses no area and is
 * dropped: the crossing vertex is often the shape's own first or last point.
 *
 * @param {number[]} shape flat run of [lon, lat, lon, lat, ...] in degrees
 * @returns {number[][]} one flat run per piece, in the same form
 */
export function splitAtAntimeridian(shape) {
  const points = shape ?? [];
  const pieces = [];
  let piece = [];

  for (let i = 0; i < points.length; i += 2) {
    const lon = points[i];
    const lat = points[i + 1];
    if (piece.length) {
      const lastLon = piece[piece.length - 2];
      const lastLat = piece[piece.length - 1];
      if (Math.abs(lon - lastLon) > WHOLE_WORLD_STEP) {
        piece.push(edgeFor(lastLon), lastLat);
        pieces.push(piece);
        piece = [edgeFor(lon), lat];
      }
    }
    piece.push(lon, lat);
  }
  pieces.push(piece);

  return pieces.filter((run) => run.length >= 6);
}

/**
 * Group points that would sit on top of each other on screen.
 *
 * The points are sorted before grouping, so the answer depends only on where the
 * points are and never on the order they arrived in. Without that sort the same
 * day of news could group differently between two redraws, and pins would appear
 * to jump while the reader did nothing.
 *
 * @param {Array<{x: number, y: number}>} points already projected to the canvas
 * @param {number} radius how close counts as overlapping, in pixels
 * @returns {Array<{x: number, y: number, items: Array<object>}>}
 */
export function clusterPoints(points, radius) {
  const sorted = [...(points ?? [])].sort((a, b) => a.x - b.x || a.y - b.y);
  const groups = [];
  const limit = radius * radius;

  for (const point of sorted) {
    let joined = null;
    let best = Infinity;
    for (const group of groups) {
      const distance = (group.x - point.x) ** 2 + (group.y - point.y) ** 2;
      if (distance <= limit && distance < best) {
        best = distance;
        joined = group;
      }
    }
    if (joined) {
      joined.items.push(point);
      joined.sumX += point.x;
      joined.sumY += point.y;
      joined.x = joined.sumX / joined.items.length;
      joined.y = joined.sumY / joined.items.length;
    } else {
      groups.push({ x: point.x, y: point.y, sumX: point.x, sumY: point.y, items: [point] });
    }
  }
  return groups.map(({ x, y, items }) => ({ x, y, items }));
}

/**
 * Every item that shares a group with the chosen one, the chosen one included.
 *
 * A marker showing "5" stands for five stories, so choosing it has to be able to
 * name all five. Without this the list can only highlight the one story that is
 * open, and the other four look unrelated to the pin the reader just tapped.
 *
 * The groups must be the ones the map actually drew, so the answer changes with
 * the zoom, exactly as the pins do.
 *
 * @param {Array<{items: Array<object>}>} groups output of `clusterPoints`
 * @param {(item: object) => boolean} isChosen picks the item that was chosen
 * @returns {Array<object>} the whole group, or an empty array when nothing matches
 */
export function groupMatesOf(groups, isChosen) {
  return (groups ?? []).find((group) => group.items.some(isChosen))?.items ?? [];
}
