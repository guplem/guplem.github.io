// The outline of a print: its shape, its size, and two ways to ask about it.
//
// Every shape is convex and centred on (0, 0), x east and y north, in mm.
// `size` is always the longest side, so a 150 mm model is 150 mm across in
// its longest direction whatever the shape.
//
// The mesher asks "how far inside is this point?" (a signed distance,
// positive inside). The frame and the map ask for the polygon itself.

export const SHAPES = {
  circle: { name: "Circle", w: 1, h: 1 },
  hexagon: { name: "Hexagon", w: 1, h: Math.sqrt(3) / 2 },
  square: { name: "Square", w: 1, h: 1 },
  landscape: { name: "Rectangle 3:2", w: 1, h: 2 / 3 },
  portrait: { name: "Rectangle 2:3", w: 2 / 3, h: 1 },
};

export const SHAPE_IDS = Object.keys(SHAPES);

/** Width and height in mm of `shape` at longest side `size`. */
export function shapeSize(shape, size) {
  const s = SHAPES[shape] ?? SHAPES.circle;
  return { width: s.w * size, height: s.h * size };
}

/** Corner points of a polygon shape (not the circle), counter-clockwise. */
function corners(shape, size) {
  const { width: w, height: h } = shapeSize(shape, size);
  if (shape === "hexagon") {
    // Flat top and bottom: corners at 0, 60, ... degrees, radius = width / 2.
    const r = w / 2;
    return Array.from({ length: 6 }, (_, k) => [r * Math.cos((k * Math.PI) / 3), r * Math.sin((k * Math.PI) / 3)]);
  }
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
}

/**
 * The outline as a counter-clockwise polygon, grown outward by `offset` mm.
 * A circle becomes a regular polygon of `segments` sides.
 */
export function outlinePolygon(shape, size, offset = 0, segments = 192) {
  if (shape === "circle" || !SHAPES[shape]) {
    const r = size / 2 + offset;
    return Array.from({ length: segments }, (_, k) => {
      const a = (2 * Math.PI * k) / segments;
      return [r * Math.cos(a), r * Math.sin(a)];
    });
  }
  return offsetConvex(corners(shape, size), offset);
}

/**
 * Grow a convex counter-clockwise polygon outward by `d` (shrink when d < 0),
 * keeping every edge parallel to the original at exactly `d`.
 */
export function offsetConvex(points, d) {
  if (!d) return points.map((p) => [...p]);
  const n = points.length;
  const normals = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [(q[1] - p[1]) / len, -(q[0] - p[0]) / len]; // outward for CCW
  });
  return points.map((p, i) => {
    const a = normals[(i - 1 + n) % n];
    const b = normals[i];
    const k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k];
  });
}

/**
 * Signed distance to the outline: positive inside, in mm.
 * Exact inside; outside it may read short near a corner, but its sign is
 * always right, which is all the mesher needs out there.
 * @returns {(x:number, y:number) => number}
 */
export function outlineDistance(shape, size) {
  if (shape === "circle" || !SHAPES[shape]) {
    const r = size / 2;
    return (x, y) => r - Math.hypot(x, y);
  }
  const pts = corners(shape, size);
  const edges = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const nx = (q[1] - p[1]) / len;
    const ny = -(q[0] - p[0]) / len;
    return [nx, ny, nx * p[0] + ny * p[1]];
  });
  return (x, y) => {
    let best = Infinity;
    for (const [nx, ny, c] of edges) {
      const d = c - (nx * x + ny * y);
      if (d < best) best = d;
    }
    return best;
  };
}

/** Area of a polygon, positive when counter-clockwise. */
export function polygonArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Even-odd point-in-polygon test. */
export function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
