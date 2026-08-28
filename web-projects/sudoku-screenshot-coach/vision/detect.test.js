import { describe, test, expect } from "bun:test";
import { adaptiveThreshold, toGray } from "./imaging.js";
import { applyHomography, cornersOfComponent, findGrid, labelComponents, scoreGridLines, solveHomography, warpGray } from "./detect.js";
import { renderSudokuScreenshot } from "./testFixtures.js";

const PUZZLE =
  "530070000" + "600195000" + "098000060" + "800060003" + "400803001" + "700020006" + "060000280" + "000419005" + "000080079";

/** Distance between a detected corner and where the fixture drew it. */
const cornerError = (corner, x, y) => Math.hypot(corner.x - x, corner.y - y);

describe("labelComponents", () => {
  test("finds separate shapes and their bounding boxes", () => {
    const mask = new Uint8Array(20 * 20);
    for (let y = 2; y < 6; y += 1) for (let x = 3; x < 9; x += 1) mask[y * 20 + x] = 1;
    for (let y = 12; y < 15; y += 1) for (let x = 14; x < 18; x += 1) mask[y * 20 + x] = 1;
    const { components } = labelComponents(mask, 20, 20);
    expect(components).toHaveLength(2);
    const first = components.find((component) => component.minX === 3);
    expect(first).toMatchObject({ minX: 3, minY: 2, maxX: 8, maxY: 5, count: 24 });
  });

  test("joins pixels that touch only at a corner", () => {
    const mask = new Uint8Array(6 * 6);
    mask[1 * 6 + 1] = 1;
    mask[2 * 6 + 2] = 1;
    expect(labelComponents(mask, 6, 6).components).toHaveLength(1);
  });

  test("returns nothing for an empty mask", () => {
    expect(labelComponents(new Uint8Array(9), 3, 3).components).toEqual([]);
  });
});

describe("cornersOfComponent", () => {
  test("finds the four corners of an axis-aligned square outline", () => {
    const size = 40;
    const mask = new Uint8Array(size * size);
    for (let i = 5; i <= 30; i += 1) {
      mask[5 * size + i] = 1;
      mask[30 * size + i] = 1;
      mask[i * size + 5] = 1;
      mask[i * size + 30] = 1;
    }
    const { labels, components } = labelComponents(mask, size, size);
    const corners = cornersOfComponent(labels, size, size, components[0]);
    expect(cornerError(corners[0], 5, 5)).toBeLessThan(2); // top-left
    expect(cornerError(corners[1], 30, 5)).toBeLessThan(2); // top-right
    expect(cornerError(corners[2], 30, 30)).toBeLessThan(2); // bottom-right
    expect(cornerError(corners[3], 5, 30)).toBeLessThan(2); // bottom-left
  });
});

describe("solveHomography", () => {
  test("maps the destination square onto the source quad", () => {
    const source = [
      { x: 10, y: 20 },
      { x: 110, y: 25 },
      { x: 115, y: 130 },
      { x: 5, y: 120 },
    ];
    const destination = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const matrix = solveHomography(destination, source);
    for (let index = 0; index < 4; index += 1) {
      const mapped = applyHomography(matrix, destination[index].x, destination[index].y);
      expect(mapped.x).toBeCloseTo(source[index].x, 4);
      expect(mapped.y).toBeCloseTo(source[index].y, 4);
    }
  });

  test("keeps a straight line straight", () => {
    const source = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 0, y: 200 },
    ];
    const destination = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const matrix = solveHomography(destination, source);
    const middle = applyHomography(matrix, 50, 50);
    expect(middle.x).toBeCloseTo(100, 4);
    expect(middle.y).toBeCloseTo(100, 4);
  });

  test("returns null for four points on one line", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(solveHomography(square, line)).toBeNull();
  });
});

describe("warpGray", () => {
  test("pulls a rotated-free region into a square of the requested size", () => {
    const width = 60;
    const height = 60;
    const gray = new Uint8ClampedArray(width * height).fill(255);
    for (let y = 10; y < 40; y += 1) for (let x = 10; x < 40; x += 1) gray[y * width + x] = 0;
    const matrix = solveHomography(
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 30 },
        { x: 0, y: 30 },
      ],
      [
        { x: 10, y: 10 },
        { x: 39, y: 10 },
        { x: 39, y: 39 },
        { x: 10, y: 39 },
      ]
    );
    const warped = warpGray(gray, width, height, matrix, 30);
    expect(warped[15 * 30 + 15]).toBeLessThan(40); // the dark square fills it
  });
});

describe("scoreGridLines", () => {
  test("scores a real grid near 1", () => {
    const shot = renderSudokuScreenshot({ puzzle: PUZZLE, clutter: false });
    const gray = toGray(shot.rgba, shot.width, shot.height);
    const matrix = solveHomography(
      [
        { x: 0, y: 0 },
        { x: 288, y: 0 },
        { x: 288, y: 288 },
        { x: 0, y: 288 },
      ],
      [
        { x: shot.origin.x, y: shot.origin.y },
        { x: shot.origin.x + shot.size, y: shot.origin.y },
        { x: shot.origin.x + shot.size, y: shot.origin.y + shot.size },
        { x: shot.origin.x, y: shot.origin.y + shot.size },
      ]
    );
    const warped = warpGray(gray, shot.width, shot.height, matrix, 288);
    expect(scoreGridLines(adaptiveThreshold(warped, 288, 288), 288)).toBeGreaterThan(0.9);
  });

  test("scores a blank square near 0", () => {
    const mask = new Uint8Array(288 * 288);
    expect(scoreGridLines(mask, 288)).toBeLessThan(0.2);
  });

  test("scores an empty-bordered box low, because it has no inner lines", () => {
    const size = 288;
    const mask = new Uint8Array(size * size);
    for (let i = 0; i < size; i += 1) {
      mask[i] = 1;
      mask[(size - 1) * size + i] = 1;
      mask[i * size] = 1;
      mask[i * size + size - 1] = 1;
    }
    expect(scoreGridLines(mask, size)).toBeLessThan(0.35);
  });
});

describe("findGrid", () => {
  test("finds the puzzle in a clean image", () => {
    const shot = renderSudokuScreenshot({ puzzle: PUZZLE, clutter: false });
    const found = findGrid(toGray(shot.rgba, shot.width, shot.height), shot.width, shot.height);
    expect(found).not.toBeNull();
    expect(found.score).toBeGreaterThan(0.8);
    expect(cornerError(found.quad[0], shot.origin.x, shot.origin.y)).toBeLessThan(6);
    expect(cornerError(found.quad[2], shot.origin.x + shot.size, shot.origin.y + shot.size)).toBeLessThan(6);
  });

  test("finds the puzzle among the other things a screenshot holds", () => {
    const shot = renderSudokuScreenshot({ puzzle: PUZZLE, clutter: true });
    const found = findGrid(toGray(shot.rgba, shot.width, shot.height), shot.width, shot.height);
    expect(found).not.toBeNull();
    expect(cornerError(found.quad[0], shot.origin.x, shot.origin.y)).toBeLessThan(6);
    expect(found.warped).toHaveLength(found.warpSize * found.warpSize);
  });

  test("finds a light-on-dark puzzle", () => {
    const shot = renderSudokuScreenshot({ puzzle: PUZZLE, clutter: true, darkMode: true });
    const found = findGrid(toGray(shot.rgba, shot.width, shot.height), shot.width, shot.height);
    expect(found).not.toBeNull();
    expect(found.inverted).toBe(true);
    expect(cornerError(found.quad[0], shot.origin.x, shot.origin.y)).toBeLessThan(6);
  });

  test("finds a small puzzle inside a large screenshot", () => {
    const shot = renderSudokuScreenshot({
      puzzle: PUZZLE,
      cell: 26,
      originX: 420,
      originY: 300,
      width: 1100,
      height: 900,
      clutter: true,
    });
    const found = findGrid(toGray(shot.rgba, shot.width, shot.height), shot.width, shot.height);
    expect(found).not.toBeNull();
    expect(cornerError(found.quad[0], shot.origin.x, shot.origin.y)).toBeLessThan(8);
  });

  test("finds a grid drawn with hairline rules", () => {
    const shot = renderSudokuScreenshot({ puzzle: PUZZLE, lineWidth: 1, clutter: true });
    const found = findGrid(toGray(shot.rgba, shot.width, shot.height), shot.width, shot.height);
    expect(found).not.toBeNull();
    expect(cornerError(found.quad[0], shot.origin.x, shot.origin.y)).toBeLessThan(6);
  });

  test("returns null when the image holds no grid", () => {
    const width = 400;
    const height = 300;
    const gray = new Uint8ClampedArray(width * height).fill(240);
    for (let y = 40; y < 90; y += 1) for (let x = 40; x < 300; x += 1) gray[y * width + x] = 30;
    expect(findGrid(gray, width, height)).toBeNull();
  });
});
