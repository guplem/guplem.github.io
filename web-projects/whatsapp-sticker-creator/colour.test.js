import { describe, expect, test } from "bun:test";
import { labDelta, labDeltaToColour, rgbToLab, toLab } from "./colour.js";

/** An RGBA buffer filled with one colour. */
function solid(width, height, [r, g, b], alpha = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = alpha;
  }
  return data;
}

const near = (value, expected, tolerance = 0.01) =>
  expect(Math.abs(value - expected)).toBeLessThan(tolerance);

describe("rgbToLab", () => {
  test("puts white at the top of the lightness scale with no colour", () => {
    const lab = rgbToLab(255, 255, 255);
    near(lab.L, 100);
    near(lab.a, 0);
    near(lab.b, 0);
  });

  test("puts black at the bottom", () => {
    const lab = rgbToLab(0, 0, 0);
    near(lab.L, 0);
    near(lab.a, 0);
    near(lab.b, 0);
  });

  test("matches the published values for the primaries", () => {
    // These are the standard sRGB to CIELAB values under a D65 white point.
    // They pin down the whole conversion: the gamma curve, the matrix and the
    // cube root all have to be right to land on them.
    const red = rgbToLab(255, 0, 0);
    near(red.L, 53.2408);
    near(red.a, 80.0925);
    near(red.b, 67.2032);

    const green = rgbToLab(0, 255, 0);
    near(green.L, 87.7347);
    near(green.a, -86.1827);
    near(green.b, 83.1793);

    const blue = rgbToLab(0, 0, 255);
    near(blue.L, 32.297);
    near(blue.a, 79.1875);
    near(blue.b, -107.8602);
  });

  test("leaves a grey with no colour cast", () => {
    const grey = rgbToLab(128, 128, 128);
    near(grey.L, 53.585);
    near(grey.a, 0);
    near(grey.b, 0);
  });

  test("applies the gamma curve rather than treating the value as linear", () => {
    // Mid grey sits near lightness 53, not 50. A conversion that skips the
    // gamma curve lands near 46 and makes every distance wrong.
    near(rgbToLab(128, 128, 128).L, 53.585, 0.1);
  });
});

describe("toLab", () => {
  test("gives three numbers per pixel", () => {
    const lab = toLab(solid(4, 3, [255, 0, 0]), 4, 3);
    expect(lab.length).toBe(4 * 3 * 3);
  });

  test("converts every pixel the same way rgbToLab does", () => {
    const lab = toLab(solid(2, 1, [10, 200, 90]), 2, 1);
    const one = rgbToLab(10, 200, 90);
    near(lab[0], one.L);
    near(lab[1], one.a);
    near(lab[2], one.b);
    // The second pixel holds the same colour, so it holds the same numbers.
    near(lab[3], one.L);
  });

  test("reads a mixed image pixel by pixel", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    const lab = toLab(data, 2, 1);
    near(lab[0], rgbToLab(255, 0, 0).L);
    near(lab[3], rgbToLab(0, 0, 255).L);
  });
});

describe("labDelta", () => {
  test("is zero between a pixel and itself", () => {
    const lab = toLab(solid(2, 1, [40, 90, 160]), 2, 1);
    expect(labDelta(lab, 0, 1)).toBe(0);
  });

  test("grows with how different two colours look", () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, // white
      250, 250, 250, 255, // nearly white
      0, 0, 0, 255, // black
    ]);
    const lab = toLab(data, 3, 1);
    const small = labDelta(lab, 0, 1);
    const large = labDelta(lab, 0, 2);
    expect(small).toBeLessThan(3);
    expect(large).toBeGreaterThan(90);
  });

  test("reads the same RGB step as a bigger difference in the shadows", () => {
    // This is the whole reason for working in LAB. Both pairs below sit the
    // same distance apart in RGB, 51.96, so one RGB tolerance treats them as
    // equally similar. A person does not: the dark pair looks further apart.
    // LAB agrees with the person, which is what lets one tolerance slider
    // behave the same way in a dark photo and a bright one.
    const darks = toLab(new Uint8ClampedArray([10, 10, 10, 255, 40, 40, 40, 255]), 2, 1);
    const brights = toLab(new Uint8ClampedArray([210, 210, 210, 255, 240, 240, 240, 255]), 2, 1);
    near(labDelta(darks, 0, 1), 13.37, 0.05);
    near(labDelta(brights, 0, 1), 10.6, 0.05);
    expect(labDelta(darks, 0, 1)).toBeGreaterThan(labDelta(brights, 0, 1));
  });

  test("is the same in both directions", () => {
    const data = new Uint8ClampedArray([200, 30, 40, 255, 20, 190, 60, 255]);
    const lab = toLab(data, 2, 1);
    expect(labDelta(lab, 0, 1)).toBe(labDelta(lab, 1, 0));
  });
});

describe("labDeltaToColour", () => {
  test("measures a pixel against a colour given directly", () => {
    const lab = toLab(solid(1, 1, [255, 0, 0]), 1, 1);
    const red = rgbToLab(255, 0, 0);
    expect(labDeltaToColour(lab, 0, red.L, red.a, red.b)).toBeCloseTo(0, 5);
  });

  test("agrees with labDelta when the colour is another pixel", () => {
    const data = new Uint8ClampedArray([200, 30, 40, 255, 20, 190, 60, 255]);
    const lab = toLab(data, 2, 1);
    near(labDeltaToColour(lab, 0, lab[3], lab[4], lab[5]), labDelta(lab, 0, 1));
  });
});
