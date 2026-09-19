import { describe, expect, test } from "bun:test";
import { CAMERA_LIMITS, cellAtPoint, cellRect, fitCamera, panBy, zoomAt } from "./camera.js";

const grid = { width: 10, height: 5 };
const viewport = { width: 800, height: 400 };

describe("fitCamera", () => {
  test("scales the grid to fill the viewport and centres it", () => {
    const camera = fitCamera(grid, 12, viewport);
    // 10 tiles wide at 12 px is 120 px; 5 tall is 60 px. The height is the tighter fit: 400 / 60.
    expect(camera.scale).toBeCloseTo(400 / 60, 5);
    const drawnWidth = 120 * camera.scale;
    expect(camera.offsetX).toBeCloseTo((800 - drawnWidth) / 2, 5);
    expect(camera.offsetY).toBeCloseTo(0, 5);
  });

  test("never goes above the top scale, so a tiny grid does not become a blur", () => {
    const camera = fitCamera({ width: 1, height: 1 }, 12, viewport);
    expect(camera.scale).toBeLessThanOrEqual(CAMERA_LIMITS.maxScale);
  });
});

describe("cellRect and cellAtPoint", () => {
  test("are inverses of each other", () => {
    const camera = { offsetX: 10, offsetY: 20, scale: 3 };
    const rect = cellRect(camera, 12, 4, 2);
    expect(rect).toEqual({ x: 10 + 4 * 36, y: 20 + 2 * 36, size: 36 });
    expect(cellAtPoint(camera, 12, grid, rect.x + 1, rect.y + 1)).toEqual({ x: 4, y: 2 });
    expect(cellAtPoint(camera, 12, grid, rect.x + 35, rect.y + 35)).toEqual({ x: 4, y: 2 });
  });

  test("a point outside the grid is null", () => {
    const camera = { offsetX: 0, offsetY: 0, scale: 1 };
    expect(cellAtPoint(camera, 12, grid, -1, 5)).toBeNull();
    expect(cellAtPoint(camera, 12, grid, 10 * 12, 5)).toBeNull();
    expect(cellAtPoint(camera, 12, grid, 5, 5 * 12)).toBeNull();
  });
});

describe("zoomAt", () => {
  test("keeps the point under the pointer where it is", () => {
    const camera = { offsetX: 100, offsetY: 50, scale: 2 };
    const before = cellAtPoint(camera, 12, grid, 148, 74);
    const zoomed = zoomAt(camera, 148, 74, 1.5);
    expect(zoomed.scale).toBeCloseTo(3, 5);
    expect(cellAtPoint(zoomed, 12, grid, 148, 74)).toEqual(before);
    // The world point (148 - 100) / 2 = 24 must still sit at screen 148.
    expect(zoomed.offsetX + 24 * zoomed.scale).toBeCloseTo(148, 5);
  });

  test("stays inside the scale limits", () => {
    const camera = { offsetX: 0, offsetY: 0, scale: 2 };
    expect(zoomAt(camera, 0, 0, 1000).scale).toBe(CAMERA_LIMITS.maxScale);
    expect(zoomAt(camera, 0, 0, 0.0001).scale).toBe(CAMERA_LIMITS.minScale);
  });
});

describe("panBy", () => {
  test("moves the offset and leaves the scale alone", () => {
    expect(panBy({ offsetX: 1, offsetY: 2, scale: 3 }, 10, -5)).toEqual({ offsetX: 11, offsetY: -3, scale: 3 });
  });
});
