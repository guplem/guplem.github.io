import { describe, test, expect } from "bun:test";
import {
  adaptiveThreshold,
  boxBlurMean,
  countInk,
  dilate,
  downscale,
  inkDensity,
  integralImage,
  invertGray,
  toGray,
} from "./imaging.js";

/** An RGBA buffer filled with one colour. */
function solidRgba(width, height, [r, g, b]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe("toGray", () => {
  test("keeps white white and black black", () => {
    const gray = toGray(solidRgba(2, 2, [255, 255, 255]), 2, 2);
    expect([...gray]).toEqual([255, 255, 255, 255]);
    expect([...toGray(solidRgba(1, 1, [0, 0, 0]), 1, 1)]).toEqual([0]);
  });

  test("weights green more than blue, the way human vision does", () => {
    const green = toGray(solidRgba(1, 1, [0, 255, 0]), 1, 1)[0];
    const blue = toGray(solidRgba(1, 1, [0, 0, 255]), 1, 1)[0];
    expect(green).toBeGreaterThan(blue);
  });

  test("blends a transparent pixel onto white, like a browser does", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0]); // fully transparent black
    expect(toGray(data, 1, 1)[0]).toBe(255);
  });
});

describe("downscale", () => {
  test("leaves an image that is already small alone", () => {
    const gray = new Uint8ClampedArray([1, 2, 3, 4]);
    const result = downscale(gray, 2, 2, 100);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect([...result.data]).toEqual([1, 2, 3, 4]);
  });

  test("shrinks the long side to the limit and keeps the shape", () => {
    const gray = new Uint8ClampedArray(400 * 200).fill(128);
    const result = downscale(gray, 400, 200, 100);
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
    expect(result.data).toHaveLength(100 * 50);
    expect(result.scale).toBeCloseTo(0.25, 5);
  });

  test("averages the pixels it merges", () => {
    // A 2x2 image of 0, 100, 100, 200 averages to 100 at half size.
    const gray = new Uint8ClampedArray([0, 100, 100, 200]);
    const result = downscale(gray, 2, 2, 1);
    expect(result.width).toBe(1);
    expect(result.data[0]).toBe(100);
  });
});

describe("integralImage", () => {
  test("holds the running sum of every pixel above and to the left", () => {
    const gray = new Uint8ClampedArray([1, 2, 3, 4]); // 2x2
    const integral = integralImage(gray, 2, 2);
    // The table is (width + 1) x (height + 1) with a zero row and column.
    expect(integral[0]).toBe(0);
    expect(integral[(2 + 1) * 2 + 2]).toBe(1 + 2 + 3 + 4);
  });

  test("boxBlurMean reads the mean of a window back out", () => {
    const gray = new Uint8ClampedArray(10 * 10).fill(50);
    const integral = integralImage(gray, 10, 10);
    expect(boxBlurMean(integral, 10, 10, 5, 5, 3)).toBeCloseTo(50, 5);
  });
});

describe("adaptiveThreshold", () => {
  test("marks a dark stroke as ink and leaves an even background empty", () => {
    const size = 64;
    const gray = new Uint8ClampedArray(size * size).fill(230);
    for (let y = 10; y < 50; y += 1) for (let x = 30; x < 33; x += 1) gray[y * size + x] = 20;
    const mask = adaptiveThreshold(gray, size, size);
    expect(mask[30 * size + 31]).toBe(1);
    expect(mask[2 * size + 2]).toBe(0);
  });

  test("treats the inside of a large solid block as background, by design", () => {
    // The threshold compares each pixel with its neighbours. A block wider than
    // the window has no bright neighbours, so only its edge reads as ink. Grid
    // lines and digits are thin, so this is the behaviour the pipeline wants:
    // a shaded panel behind a puzzle does not flood the mask with ink.
    const size = 64;
    const gray = new Uint8ClampedArray(size * size).fill(230);
    for (let y = 8; y < 56; y += 1) for (let x = 8; x < 56; x += 1) gray[y * size + x] = 60;
    const mask = adaptiveThreshold(gray, size, size);
    expect(mask[32 * size + 32]).toBe(0); // deep inside the block
  });

  test("survives a background gradient, which a fixed cut-off would not", () => {
    const width = 60;
    const height = 60;
    const gray = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) gray[y * width + x] = 40 + Math.round((x / width) * 200);
    }
    // A dark stroke on the bright side stays dark relative to its neighbours.
    for (let y = 20; y < 40; y += 1) for (let x = 50; x < 53; x += 1) gray[y * width + x] = 30;
    const mask = adaptiveThreshold(gray, width, height);
    expect(mask[30 * width + 51]).toBe(1);
    expect(mask[5 * width + 51]).toBe(0);
  });

  test("finds nothing in a flat image", () => {
    const mask = adaptiveThreshold(new Uint8ClampedArray(30 * 30).fill(200), 30, 30);
    expect(countInk(mask)).toBe(0);
  });
});

describe("invertGray", () => {
  test("turns a light-on-dark image into a dark-on-light one", () => {
    const gray = new Uint8ClampedArray([0, 255, 100]);
    expect([...invertGray(gray)]).toEqual([255, 0, 155]);
  });
});

describe("dilate", () => {
  test("grows ink by one pixel in each direction", () => {
    const mask = new Uint8Array(5 * 5);
    mask[2 * 5 + 2] = 1;
    const grown = dilate(mask, 5, 5, 1);
    expect(grown[2 * 5 + 1]).toBe(1);
    expect(grown[1 * 5 + 2]).toBe(1);
    expect(grown[0 * 5 + 0]).toBe(0);
    expect(countInk(grown)).toBe(5); // the centre plus its four neighbours
  });

  test("returns the same mask when the radius is zero", () => {
    const mask = new Uint8Array([1, 0, 0, 1]);
    expect([...dilate(mask, 2, 2, 0)]).toEqual([1, 0, 0, 1]);
  });

  test("joins two strokes that a one-pixel gap separates", () => {
    const mask = new Uint8Array(5 * 5);
    mask[2 * 5 + 1] = 1;
    mask[2 * 5 + 3] = 1;
    expect(dilate(mask, 5, 5, 1)[2 * 5 + 2]).toBe(1);
  });
});

describe("inkDensity", () => {
  test("reports the share of ink in a rectangle", () => {
    const mask = new Uint8Array(10 * 10);
    for (let x = 0; x < 10; x += 1) mask[3 * 10 + x] = 1; // one full row
    expect(inkDensity(mask, 10, 10, 0, 3, 10, 1)).toBe(1);
    expect(inkDensity(mask, 10, 10, 0, 4, 10, 1)).toBe(0);
    expect(inkDensity(mask, 10, 10, 0, 0, 10, 10)).toBeCloseTo(0.1, 5);
  });

  test("clamps a rectangle that runs off the edge", () => {
    const mask = new Uint8Array(4 * 4).fill(1);
    expect(inkDensity(mask, 4, 4, -2, -2, 8, 8)).toBeGreaterThan(0);
    expect(inkDensity(mask, 4, 4, 10, 10, 4, 4)).toBe(0);
  });
});
