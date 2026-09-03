import { describe, expect, test } from "bun:test";
import { DROP, KEEP, contentBounds } from "./mask.js";
import {
  autoBackgroundMask,
  magicWandMask,
  refineEdgeAlpha,
  sampleBorderColours,
} from "./segment.js";

/**
 * Build an RGBA image from a function, the way `vision/testFixtures.js` does
 * in the sudoku project: a synthetic picture beats a binary file in the
 * repository, and it says in the test what the picture is.
 */
function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = paint(x, y);
      const at = (y * width + x) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
      data[at + 3] = a;
    }
  }
  return data;
}

/** A subject of one colour on a background of another. */
const onFlat = (size, box, subject, background) =>
  image(size, size, (x, y) =>
    x >= box && x < size - box && y >= box && y < size - box ? subject : background,
  );

const keptCount = (mask) => mask.reduce((total, value) => total + (value >= 128 ? 1 : 0), 0);

describe("sampleBorderColours", () => {
  test("finds one colour on a flat background", () => {
    const rgba = onFlat(20, 6, [200, 30, 40], [255, 255, 255]);
    expect(sampleBorderColours(rgba, 20, 20).length / 3).toBe(1);
  });

  test("reads that colour correctly", () => {
    const rgba = onFlat(20, 6, [200, 30, 40], [255, 255, 255]);
    const colours = sampleBorderColours(rgba, 20, 20);
    // White is lightness 100 with no colour cast.
    expect(colours[0]).toBeCloseTo(100, 1);
    expect(colours[1]).toBeCloseTo(0, 1);
  });

  test("finds both colours when the border holds two", () => {
    // Left half white, right half black: a photo shot against a wall and a
    // doorway, which is the case a single averaged colour handles badly.
    const rgba = image(20, 20, (x) => (x < 10 ? [255, 255, 255] : [0, 0, 0]));
    expect(sampleBorderColours(rgba, 20, 20).length / 3).toBe(2);
  });

  test("groups a noisy background into a few colours, not hundreds", () => {
    // Camera noise means no two background pixels match exactly. A sample
    // that kept every distinct colour would be useless as a reference.
    let seed = 7;
    const noisy = image(40, 40, () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const jitter = (seed % 11) - 5;
      return [220 + jitter, 220 + jitter, 220 + jitter];
    });
    const found = sampleBorderColours(noisy, 40, 40).length / 3;
    expect(found).toBeGreaterThan(0);
    expect(found).toBeLessThan(5);
  });

  test("never returns more colours than its cap", () => {
    // A busy border must not produce an unbounded reference list, because
    // every pixel of the fill is measured against all of it.
    const busy = image(60, 60, (x, y) => [(x * 37) % 256, (y * 53) % 256, (x * y) % 256]);
    expect(sampleBorderColours(busy, 60, 60).length / 3).toBeLessThanOrEqual(16);
  });
});

describe("autoBackgroundMask", () => {
  test("keeps the subject and drops a flat background", () => {
    const rgba = onFlat(20, 6, [200, 30, 40], [255, 255, 255]);
    const mask = autoBackgroundMask(rgba, 20, 20, { feather: 0 });
    // The subject is the 8 by 8 middle, so its box is what should survive.
    expect(contentBounds(mask, 20, 20)).toEqual({ x: 6, y: 6, width: 8, height: 8 });
  });

  test("drops the corners and keeps the centre", () => {
    const rgba = onFlat(20, 6, [200, 30, 40], [255, 255, 255]);
    const mask = autoBackgroundMask(rgba, 20, 20, { feather: 0 });
    expect(mask[0]).toBe(DROP);
    expect(mask[19 * 20 + 19]).toBe(DROP);
    expect(mask[10 * 20 + 10]).toBe(KEEP);
  });

  test("follows a background that shades from light to dark", () => {
    // A gradient defeats a single-colour threshold: by the far side the
    // background no longer resembles the corner it started from. Comparing
    // each pixel with its neighbour is what carries the fill across.
    const rgba = image(40, 40, (x, y) => {
      if (x >= 14 && x < 26 && y >= 14 && y < 26) return [200, 30, 40];
      const shade = Math.round(40 + (x / 39) * 200);
      return [shade, shade, shade];
    });
    const mask = autoBackgroundMask(rgba, 40, 40, { feather: 0 });
    expect(contentBounds(mask, 40, 40)).toEqual({ x: 14, y: 14, width: 12, height: 12 });
  });

  test("stops at the subject instead of leaking through a gradient into it", () => {
    // The other half of the same problem. Following neighbours alone will
    // walk up any slope, including one that leads into the subject, so the
    // fill also has to stay near a colour the border actually held.
    const rgba = image(60, 20, (x) => {
      if (x >= 40) return [200, 30, 40];
      const shade = Math.round((x / 39) * 255);
      return [shade, shade, shade];
    });
    const mask = autoBackgroundMask(rgba, 60, 20, { feather: 0, edgeTolerance: 25 });
    // The red block must survive even though a smooth ramp leads to it.
    expect(mask[10 * 60 + 50]).toBe(KEEP);
  });

  test("the tolerance decides how close to the background a subject may be", () => {
    // Two subjects on white: a pale grey one that barely differs from the
    // background, and a red one that plainly does. Turning the tolerance up
    // has to give away the pale one and keep the red one, which is what the
    // slider is for.
    const rgba = image(30, 30, (x, y) => {
      if (x >= 4 && x < 10 && y >= 4 && y < 10) return [225, 225, 225];
      if (x >= 20 && x < 26 && y >= 20 && y < 26) return [200, 30, 40];
      return [255, 255, 255];
    });
    const tight = autoBackgroundMask(rgba, 30, 30, { tolerance: 3, edgeTolerance: 3, feather: 0 });
    const loose = autoBackgroundMask(rgba, 30, 30, {
      tolerance: 40,
      edgeTolerance: 40,
      feather: 0,
    });
    // Tight keeps both squares, 36 pixels each.
    expect(keptCount(tight)).toBe(72);
    // Loose keeps only the red one.
    expect(keptCount(loose)).toBe(36);
    expect(loose[22 * 30 + 22]).toBe(KEEP);
    expect(loose[6 * 30 + 6]).toBe(DROP);
  });

  test("fills a pocket inside the subject that matches the background", () => {
    // A white shirt against a white wall. The pocket is not reachable from
    // the border, so it is a hole in the subject and gets filled back in.
    const rgba = image(30, 30, (x, y) => {
      const inSubject = x >= 8 && x < 22 && y >= 8 && y < 22;
      const inPocket = x >= 13 && x < 17 && y >= 13 && y < 17;
      return inSubject && !inPocket ? [200, 30, 40] : [255, 255, 255];
    });
    const mask = autoBackgroundMask(rgba, 30, 30, { feather: 0 });
    expect(mask[15 * 30 + 15]).toBe(KEEP);
  });

  test("clears a speck of subject colour left out in the background", () => {
    const rgba = image(30, 30, (x, y) => {
      if (x >= 8 && x < 22 && y >= 8 && y < 22) return [200, 30, 40];
      if (x === 2 && y === 2) return [200, 30, 40];
      return [255, 255, 255];
    });
    const mask = autoBackgroundMask(rgba, 30, 30, { feather: 0, minIsland: 4 });
    expect(mask[2 * 30 + 2]).toBe(DROP);
    expect(mask[15 * 30 + 15]).toBe(KEEP);
  });

  test("softens the boundary when asked, and leaves it hard when not", () => {
    const rgba = onFlat(30, 10, [200, 30, 40], [255, 255, 255]);
    const hard = autoBackgroundMask(rgba, 30, 30, { feather: 0 });
    const soft = autoBackgroundMask(rgba, 30, 30, { feather: 2 });
    const partial = (mask) => [...mask].filter((value) => value > DROP && value < KEEP).length;
    expect(partial(hard)).toBe(0);
    expect(partial(soft)).toBeGreaterThan(0);
    // Softening must not eat the middle of the subject.
    expect(soft[15 * 30 + 15]).toBe(KEEP);
  });

  test("keeps everything when the whole picture is one colour", () => {
    // Every border pixel matches every other pixel, so the fill would take
    // the lot and leave nothing. An empty sticker is never the useful answer,
    // so the picture is handed back untouched for the person to cut by hand.
    const flat = image(20, 20, () => [128, 128, 128]);
    expect(keptCount(autoBackgroundMask(flat, 20, 20, { feather: 0 }))).toBe(400);
  });

  test("treats an already transparent pixel as background", () => {
    // A PNG that was cut out elsewhere arrives with holes already in it.
    // Those must not come back as opaque.
    const rgba = image(20, 20, (x, y) =>
      x >= 6 && x < 14 && y >= 6 && y < 14 ? [200, 30, 40, 255] : [0, 0, 0, 0],
    );
    const mask = autoBackgroundMask(rgba, 20, 20, { feather: 0 });
    expect(mask[0]).toBe(DROP);
    expect(mask[10 * 20 + 10]).toBe(KEEP);
  });
});

describe("magicWandMask", () => {
  test("selects the touching run of one colour", () => {
    const rgba = onFlat(20, 6, [200, 30, 40], [255, 255, 255]);
    const selection = magicWandMask(rgba, 20, 20, { x: 10, y: 10, tolerance: 10 });
    expect(selection[10 * 20 + 10]).toBe(KEEP);
    expect(selection[0]).toBe(DROP);
    expect(keptCount(selection)).toBe(64);
  });

  test("stops at a colour outside the tolerance", () => {
    const rgba = onFlat(20, 6, [200, 30, 40], [255, 255, 255]);
    const selection = magicWandMask(rgba, 20, 20, { x: 0, y: 0, tolerance: 10 });
    // Clicking the white border selects the white and not the red middle.
    expect(keptCount(selection)).toBe(400 - 64);
  });

  test("takes only the blob it was clicked on when contiguous", () => {
    // Two separate red squares. Clicking one must not select the other.
    const rgba = image(30, 10, (x, y) => {
      const inLeft = x >= 2 && x < 8 && y >= 2 && y < 8;
      const inRight = x >= 20 && x < 26 && y >= 2 && y < 8;
      return inLeft || inRight ? [200, 30, 40] : [255, 255, 255];
    });
    const selection = magicWandMask(rgba, 30, 10, { x: 4, y: 4, tolerance: 10 });
    expect(selection[4 * 30 + 4]).toBe(KEEP);
    expect(selection[4 * 30 + 22]).toBe(DROP);
    expect(keptCount(selection)).toBe(36);
  });

  test("takes every matching pixel when not contiguous", () => {
    const rgba = image(30, 10, (x, y) => {
      const inLeft = x >= 2 && x < 8 && y >= 2 && y < 8;
      const inRight = x >= 20 && x < 26 && y >= 2 && y < 8;
      return inLeft || inRight ? [200, 30, 40] : [255, 255, 255];
    });
    const selection = magicWandMask(rgba, 30, 10, {
      x: 4,
      y: 4,
      tolerance: 10,
      contiguous: false,
    });
    expect(selection[4 * 30 + 22]).toBe(KEEP);
    expect(keptCount(selection)).toBe(72);
  });

  test("selects nothing outside the image", () => {
    const rgba = onFlat(20, 6, [200, 30, 40], [255, 255, 255]);
    expect(keptCount(magicWandMask(rgba, 20, 20, { x: -1, y: 5, tolerance: 10 }))).toBe(0);
    expect(keptCount(magicWandMask(rgba, 20, 20, { x: 5, y: 99, tolerance: 10 }))).toBe(0);
  });

  test("a tolerance of zero selects only the exact colour", () => {
    const rgba = image(10, 1, (x) => [x * 5, x * 5, x * 5]);
    expect(keptCount(magicWandMask(rgba, 10, 1, { x: 5, y: 0, tolerance: 0 }))).toBe(1);
  });
});

describe("refineEdgeAlpha", () => {
  test("turns a hard boundary into a graded one", () => {
    // A real photo blurs the boundary over a pixel or two. Reading that blur
    // as part-way alpha is what removes the ring of background colour left
    // round a hard cut.
    const rgba = image(20, 20, (x) => {
      if (x < 8) return [255, 255, 255];
      if (x > 11) return [200, 30, 40];
      // The blurred band between the two.
      const mix = (x - 8) / 3;
      return [255 + (200 - 255) * mix, 255 + (30 - 255) * mix, 255 + (40 - 255) * mix];
    });
    const mask = new Uint8Array(400);
    for (let y = 0; y < 20; y += 1) {
      for (let x = 10; x < 20; x += 1) mask[y * 20 + x] = KEEP;
    }
    const refined = refineEdgeAlpha(rgba, mask, 20, 20, { radius: 3 });
    const middle = refined[10 * 20 + 9];
    expect(middle).toBeGreaterThan(DROP);
    expect(middle).toBeLessThan(KEEP);
  });

  test("leaves a confident interior fully kept", () => {
    const rgba = onFlat(30, 10, [200, 30, 40], [255, 255, 255]);
    const mask = new Uint8Array(900);
    for (let y = 10; y < 20; y += 1) {
      for (let x = 10; x < 20; x += 1) mask[y * 30 + x] = KEEP;
    }
    const refined = refineEdgeAlpha(rgba, mask, 30, 30, { radius: 2 });
    expect(refined[15 * 30 + 15]).toBe(KEEP);
  });

  test("leaves a confident background fully dropped", () => {
    const rgba = onFlat(30, 10, [200, 30, 40], [255, 255, 255]);
    const mask = new Uint8Array(900);
    for (let y = 10; y < 20; y += 1) {
      for (let x = 10; x < 20; x += 1) mask[y * 30 + x] = KEEP;
    }
    const refined = refineEdgeAlpha(rgba, mask, 30, 30, { radius: 2 });
    expect(refined[0]).toBe(DROP);
  });

  test("changes nothing when the radius is zero", () => {
    const rgba = onFlat(20, 6, [200, 30, 40], [255, 255, 255]);
    const mask = new Uint8Array(400).fill(KEEP);
    expect([...refineEdgeAlpha(rgba, mask, 20, 20, { radius: 0 })]).toEqual([...mask]);
  });
});
