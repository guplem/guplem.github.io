import { describe, expect, test } from "bun:test";
import {
  MIN_ZOOM,
  clampView,
  clusterPoints,
  lonLatToUnit,
  panBy,
  project,
  unitToLonLat,
  unproject,
  worldSize,
  zoomAt,
} from "./geo.js";

const SIZE = { width: 800, height: 400 };
const HOME = { zoom: 1, cx: 0.5, cy: 0.5 };
const near = (got, want, slack = 1e-6) => expect(Math.abs(got - want)).toBeLessThan(slack);

describe("lonLatToUnit", () => {
  test("puts longitude across and latitude down, in a 0 to 1 box", () => {
    expect(lonLatToUnit(-180, 90)).toEqual({ x: 0, y: 0 });
    expect(lonLatToUnit(180, -90)).toEqual({ x: 1, y: 1 });
    expect(lonLatToUnit(0, 0)).toEqual({ x: 0.5, y: 0.5 });
  });

  // North is up. Getting this backwards flips the whole map, and a flipped world
  // map is not obviously wrong at a glance.
  test("north is a smaller y than south", () => {
    expect(lonLatToUnit(0, 60).y).toBeLessThan(lonLatToUnit(0, -60).y);
  });

  test("round-trips back to the same degrees", () => {
    for (const [lon, lat] of [
      [0, 0],
      [36.6, 50.6],
      [-74, 40.7],
      [151.2, -33.9],
      [180, -90],
    ]) {
      const unit = lonLatToUnit(lon, lat);
      const back = unitToLonLat(unit.x, unit.y);
      near(back.lon, lon);
      near(back.lat, lat);
    }
  });
});

describe("worldSize", () => {
  // The projection is equirectangular, so the whole world is exactly twice as
  // wide as it is tall. Any other ratio stretches every coastline.
  test("keeps the world twice as wide as it is tall", () => {
    const size = worldSize(HOME, SIZE);
    expect(size.width).toBe(size.height * 2);
  });

  test("at the lowest zoom the world is exactly as wide as the canvas", () => {
    expect(worldSize({ ...HOME, zoom: MIN_ZOOM }, SIZE).width).toBe(SIZE.width);
  });

  test("doubling the zoom doubles the world", () => {
    expect(worldSize({ ...HOME, zoom: 2 }, SIZE).width).toBe(worldSize({ ...HOME, zoom: 1 }, SIZE).width * 2);
  });
});

describe("project and unproject", () => {
  test("the centre of the view holds the centre of the world", () => {
    const point = project(0, 0, HOME, SIZE);
    near(point.x, SIZE.width / 2);
    near(point.y, SIZE.height / 2);
  });

  test("the date line sits at each edge", () => {
    near(project(-180, 0, HOME, SIZE).x, 0);
    near(project(180, 0, HOME, SIZE).x, SIZE.width);
  });

  test("a screen point turns back into the same degrees", () => {
    for (const view of [HOME, { zoom: 4, cx: 0.3, cy: 0.6 }, { zoom: 12, cx: 0.51, cy: 0.22 }]) {
      for (const [lon, lat] of [
        [0, 0],
        [36.6, 50.6],
        [-122.4, 37.8],
      ]) {
        const point = project(lon, lat, view, SIZE);
        const back = unproject(point.x, point.y, view, SIZE);
        near(back.lon, lon, 1e-6);
        near(back.lat, lat, 1e-6);
      }
    }
  });

  test("moving the centre east moves the drawing west", () => {
    const still = project(0, 0, HOME, SIZE).x;
    const shifted = project(0, 0, { ...HOME, cx: 0.6 }, SIZE).x;
    expect(shifted).toBeLessThan(still);
  });
});

describe("zoomAt", () => {
  // The point under the cursor must not move. Without this, zooming drifts and
  // the reader loses the place they were looking at.
  test("keeps the place under the cursor exactly where it was", () => {
    const anchor = { x: 620, y: 130 };
    const before = unproject(anchor.x, anchor.y, HOME, SIZE);
    const zoomed = zoomAt(HOME, SIZE, anchor, 2.5);
    const after = unproject(anchor.x, anchor.y, zoomed, SIZE);
    near(after.lon, before.lon, 1e-6);
    near(after.lat, before.lat, 1e-6);
  });

  test("holds the anchor through a zoom in and back out", () => {
    const anchor = { x: 200, y: 300 };
    const start = { zoom: 3, cx: 0.4, cy: 0.45 };
    const before = unproject(anchor.x, anchor.y, start, SIZE);
    const after = unproject(anchor.x, anchor.y, zoomAt(zoomAt(start, SIZE, anchor, 2), SIZE, anchor, 0.5), SIZE);
    near(after.lon, before.lon, 1e-6);
    near(after.lat, before.lat, 1e-6);
  });

  test("never zooms out past the whole world", () => {
    expect(zoomAt(HOME, SIZE, { x: 400, y: 200 }, 0.01).zoom).toBe(MIN_ZOOM);
  });

  test("stops zooming in somewhere, rather than running to infinity", () => {
    let view = HOME;
    for (let step = 0; step < 200; step += 1) view = zoomAt(view, SIZE, { x: 400, y: 200 }, 2);
    expect(Number.isFinite(view.zoom)).toBe(true);
  });
});

describe("clampView", () => {
  test("refuses a zoom below the whole world", () => {
    expect(clampView({ zoom: 0.2, cx: 0.5, cy: 0.5 }, SIZE).zoom).toBe(MIN_ZOOM);
  });

  test("keeps the map covering the canvas instead of letting a gap in", () => {
    const view = clampView({ zoom: 4, cx: 0, cy: 0 }, SIZE);
    // The left edge of the world must not come inside the canvas.
    expect(project(-180, 0, view, SIZE).x).toBeLessThanOrEqual(0.001);
    expect(project(180, 0, view, SIZE).x).toBeGreaterThanOrEqual(SIZE.width - 0.001);
  });

  test("centres the map when it is shorter than the canvas", () => {
    // A wide, short world inside a tall canvas: it cannot fill the height, so it
    // has to sit in the middle rather than be pinned to the top.
    const tall = { width: 400, height: 800 };
    const view = clampView({ zoom: MIN_ZOOM, cx: 0.5, cy: 0.9 }, tall);
    near(view.cy, 0.5, 1e-9);
  });

  test("leaves a view that is already fine untouched", () => {
    expect(clampView(HOME, SIZE)).toEqual(HOME);
  });

  test("survives a canvas with no size, as happens before the first layout", () => {
    expect(() => clampView(HOME, { width: 0, height: 0 })).not.toThrow();
  });
});

describe("panBy", () => {
  // Zoomed in, because at the lowest zoom the world already fills the canvas and
  // a pan correctly does nothing.
  test("dragging right shows what was to the west", () => {
    const view = { zoom: 4, cx: 0.5, cy: 0.5 };
    const before = unproject(400, 200, view, SIZE).lon;
    const after = unproject(400, 200, panBy(view, SIZE, 100, 0), SIZE).lon;
    expect(after).toBeLessThan(before);
  });

  test("at the lowest zoom the world fills the canvas, so a pan does nothing", () => {
    expect(panBy(HOME, SIZE, 250, 0)).toEqual(HOME);
  });

  test("a drag of nothing changes nothing", () => {
    expect(panBy({ zoom: 3, cx: 0.4, cy: 0.4 }, SIZE, 0, 0)).toEqual(
      clampView({ zoom: 3, cx: 0.4, cy: 0.4 }, SIZE),
    );
  });

  test("cannot drag the map off the canvas", () => {
    const view = panBy({ zoom: 2, cx: 0.5, cy: 0.5 }, SIZE, 100000, 100000);
    expect(project(-180, 0, view, SIZE).x).toBeLessThanOrEqual(0.001);
  });
});

describe("clusterPoints", () => {
  const at = (x, y, id) => ({ x, y, id });

  test("joins points that would overlap on screen", () => {
    const groups = clusterPoints([at(100, 100, "a"), at(104, 103, "b")], 20);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });

  test("leaves points that are far apart alone", () => {
    const groups = clusterPoints([at(100, 100, "a"), at(400, 300, "b")], 20);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.items.length === 1)).toBe(true);
  });

  test("puts the group where its points average out", () => {
    const [group] = clusterPoints([at(100, 100, "a"), at(120, 140, "b")], 50);
    expect(group.x).toBe(110);
    expect(group.y).toBe(120);
  });

  test("never loses or duplicates a point", () => {
    const points = Array.from({ length: 60 }, (unused, i) => at((i * 37) % 800, (i * 53) % 400, `p${i}`));
    const ids = clusterPoints(points, 30).flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toHaveLength(points.length);
    expect(new Set(ids).size).toBe(points.length);
  });

  test("gives the same answer whatever order the points arrive in", () => {
    const points = Array.from({ length: 25 }, (unused, i) => at((i * 61) % 500, (i * 29) % 300, `p${i}`));
    const shape = (groups) =>
      groups
        .map((group) => group.items.map((item) => item.id).sort().join("+"))
        .sort()
        .join(" | ");
    expect(shape(clusterPoints([...points].reverse(), 40))).toBe(shape(clusterPoints(points, 40)));
  });

  test("handles no points at all", () => {
    expect(clusterPoints([], 20)).toEqual([]);
  });
});
