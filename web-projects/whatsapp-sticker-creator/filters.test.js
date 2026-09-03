import { describe, expect, test } from "bun:test";
import {
  FILTER_PRESETS,
  applyMatrix,
  brightnessMatrix,
  buildMatrix,
  composeMatrices,
  contrastMatrix,
  identityMatrix,
  presetMatrix,
  saturationMatrix,
  temperatureMatrix,
} from "./filters.js";

/** One pixel, so a test can read a single result. */
const pixel = (r, g, b, a = 255) => new Uint8ClampedArray([r, g, b, a]);
const asArray = (rgba) => [...rgba];

describe("identityMatrix", () => {
  test("is a 4 by 5 matrix", () => {
    // Four output channels, each mixing four inputs plus a constant.
    expect(identityMatrix().length).toBe(20);
  });

  test("leaves every pixel exactly as it was", () => {
    const before = pixel(17, 200, 99, 123);
    expect(asArray(applyMatrix(before, identityMatrix()))).toEqual([17, 200, 99, 123]);
  });
});

describe("applyMatrix", () => {
  test("never changes alpha, whatever the colour rows say", () => {
    // This is the rule that matters most here. A sticker is a cut-out, and a
    // filter that touched alpha would fill in the transparent background and
    // turn the sticker back into a square.
    const matrix = buildMatrix({ brightness: 0.5, contrast: 2, saturation: 0 });
    for (const alpha of [0, 1, 128, 254, 255]) {
      expect(applyMatrix(pixel(90, 140, 200, alpha), matrix)[3]).toBe(alpha);
    }
  });

  test("clamps a result that runs past the ends", () => {
    const matrix = brightnessMatrix(1);
    expect(asArray(applyMatrix(pixel(200, 200, 200), matrix))).toEqual([255, 255, 255, 255]);
    expect(asArray(applyMatrix(pixel(10, 10, 10), brightnessMatrix(-1)))).toEqual([
      0,
      0,
      0,
      255,
    ]);
  });

  test("works over a whole image, pixel by pixel", () => {
    const image = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    const out = applyMatrix(image, brightnessMatrix(1));
    expect(asArray(out)).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });

  test("does not write over the picture it was given", () => {
    // The editor re-applies filters from the original on every slider move,
    // so writing through the input would compound the change each time.
    const before = pixel(100, 100, 100);
    applyMatrix(before, brightnessMatrix(1));
    expect(asArray(before)).toEqual([100, 100, 100, 255]);
  });
});

describe("brightnessMatrix", () => {
  test("does nothing at zero", () => {
    expect(asArray(applyMatrix(pixel(60, 120, 180), brightnessMatrix(0)))).toEqual([
      60,
      120,
      180,
      255,
    ]);
  });

  test("adds the same amount to every channel", () => {
    // A tenth of the full range is 25.5, so each channel gains 25 or 26.
    const out = applyMatrix(pixel(60, 120, 180), brightnessMatrix(0.1));
    expect(out[0]).toBeGreaterThanOrEqual(85);
    expect(out[0]).toBeLessThanOrEqual(86);
    expect(out[1] - out[0]).toBe(60);
  });
});

describe("contrastMatrix", () => {
  test("does nothing at one", () => {
    expect(asArray(applyMatrix(pixel(60, 120, 180), contrastMatrix(1)))).toEqual([
      60,
      120,
      180,
      255,
    ]);
  });

  test("turns about the middle grey, so a mid tone stays put", () => {
    // Pivoting anywhere else makes every contrast change also a brightness
    // change, which is why one slider would then move two things.
    const out = applyMatrix(pixel(128, 128, 128), contrastMatrix(2));
    expect(out[0]).toBeGreaterThanOrEqual(127);
    expect(out[0]).toBeLessThanOrEqual(129);
  });

  test("pushes a light tone lighter and a dark tone darker", () => {
    expect(applyMatrix(pixel(200, 200, 200), contrastMatrix(1.5))[0]).toBeGreaterThan(200);
    expect(applyMatrix(pixel(60, 60, 60), contrastMatrix(1.5))[0]).toBeLessThan(60);
  });

  test("pulls everything towards the middle below one", () => {
    const out = applyMatrix(pixel(64, 64, 64), contrastMatrix(0.5));
    expect(out[0]).toBe(96);
  });

  test("flattens the picture to one grey at zero", () => {
    expect(applyMatrix(pixel(0, 0, 0), contrastMatrix(0))[0]).toBe(128);
    expect(applyMatrix(pixel(255, 255, 255), contrastMatrix(0))[0]).toBe(128);
  });
});

describe("saturationMatrix", () => {
  test("does nothing at one", () => {
    expect(asArray(applyMatrix(pixel(200, 30, 40), saturationMatrix(1)))).toEqual([
      200,
      30,
      40,
      255,
    ]);
  });

  test("turns a colour to grey at zero, weighted the way eyes are", () => {
    // Green looks far brighter than blue at the same value, so a plain
    // average would turn a red into a mid grey and a green into the same
    // one. These are the Rec.709 weights: 0.2126, 0.7152, 0.0722.
    expect(applyMatrix(pixel(255, 0, 0), saturationMatrix(0))[0]).toBe(54);
    expect(applyMatrix(pixel(0, 255, 0), saturationMatrix(0))[1]).toBe(182);
    expect(applyMatrix(pixel(0, 0, 255), saturationMatrix(0))[2]).toBe(18);
  });

  test("makes all three channels equal at zero", () => {
    const out = applyMatrix(pixel(200, 30, 40), saturationMatrix(0));
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
  });

  test("leaves a grey grey at any setting", () => {
    for (const amount of [0, 0.5, 1, 2]) {
      const out = applyMatrix(pixel(120, 120, 120), saturationMatrix(amount));
      expect(out[0]).toBe(120);
      expect(out[2]).toBe(120);
    }
  });

  test("pushes a colour further from grey above one", () => {
    const before = pixel(180, 100, 90);
    const after = applyMatrix(before, saturationMatrix(2));
    expect(after[0]).toBeGreaterThan(before[0]);
    expect(after[2]).toBeLessThan(before[2]);
  });
});

describe("temperatureMatrix", () => {
  test("does nothing at zero", () => {
    expect(asArray(applyMatrix(pixel(120, 120, 120), temperatureMatrix(0)))).toEqual([
      120,
      120,
      120,
      255,
    ]);
  });

  test("adds red and takes blue when warm", () => {
    const out = applyMatrix(pixel(120, 120, 120), temperatureMatrix(1));
    expect(out[0]).toBeGreaterThan(120);
    expect(out[2]).toBeLessThan(120);
    // Green is the neutral channel, so it stays put.
    expect(out[1]).toBe(120);
  });

  test("adds blue and takes red when cool", () => {
    const out = applyMatrix(pixel(120, 120, 120), temperatureMatrix(-1));
    expect(out[0]).toBeLessThan(120);
    expect(out[2]).toBeGreaterThan(120);
  });
});

describe("composeMatrices", () => {
  test("composing with the identity changes nothing", () => {
    const matrix = saturationMatrix(0.4);
    const composed = composeMatrices(matrix, identityMatrix());
    const before = pixel(200, 30, 40);
    expect(asArray(applyMatrix(before, composed))).toEqual(asArray(applyMatrix(before, matrix)));
  });

  test("gives the same answer as applying the two in turn", () => {
    // This is what lets a whole stack of sliders become one pass over the
    // pixels instead of one pass each.
    const first = saturationMatrix(0.3);
    const second = brightnessMatrix(0.2);
    const before = pixel(200, 30, 40, 200);
    const stepByStep = applyMatrix(applyMatrix(before, first), second);
    const inOneGo = applyMatrix(before, composeMatrices(first, second));
    for (let channel = 0; channel < 4; channel += 1) {
      // One rounding step is lost by combining, which is the point.
      expect(Math.abs(inOneGo[channel] - stepByStep[channel])).toBeLessThanOrEqual(1);
    }
  });

  test("carries the constant term through", () => {
    // Brightness lives entirely in the constant column, so a compose that
    // dropped it would silently ignore the brightness slider.
    const composed = composeMatrices(brightnessMatrix(0.2), brightnessMatrix(0.2));
    const out = applyMatrix(pixel(0, 0, 0), composed);
    expect(out[0]).toBeGreaterThan(100);
  });

  test("keeps alpha untouched however deep the stack", () => {
    const composed = composeMatrices(
      composeMatrices(saturationMatrix(2), contrastMatrix(1.8)),
      composeMatrices(brightnessMatrix(0.3), temperatureMatrix(-0.5)),
    );
    expect(applyMatrix(pixel(80, 90, 100, 77), composed)[3]).toBe(77);
  });
});

describe("buildMatrix", () => {
  test("returns the identity when every setting is neutral", () => {
    const before = pixel(200, 30, 40, 90);
    expect(asArray(applyMatrix(before, buildMatrix({})))).toEqual([200, 30, 40, 90]);
  });

  test("applies every setting it was given", () => {
    const out = applyMatrix(pixel(200, 30, 40), buildMatrix({ saturation: 0, brightness: 0.2 }));
    expect(out[0]).toBe(out[1]);
    expect(out[0]).toBeGreaterThan(54);
  });
});

describe("FILTER_PRESETS", () => {
  test("offers a set of named looks, starting with none", () => {
    expect(FILTER_PRESETS.length).toBeGreaterThan(4);
    expect(FILTER_PRESETS[0].id).toBe("none");
  });

  test("gives every preset a unique id", () => {
    const ids = FILTER_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("leaves the picture alone under the none preset", () => {
    const before = pixel(200, 30, 40, 90);
    expect(asArray(applyMatrix(before, presetMatrix("none")))).toEqual([200, 30, 40, 90]);
  });

  test("changes the picture under every other preset", () => {
    const before = pixel(200, 90, 40);
    for (const preset of FILTER_PRESETS.slice(1)) {
      const after = applyMatrix(before, presetMatrix(preset.id));
      expect(`${preset.id}: ${asArray(after).join()}`).not.toBe(
        `${preset.id}: ${asArray(before).join()}`,
      );
    }
  });

  test("keeps alpha untouched under every preset", () => {
    for (const preset of FILTER_PRESETS) {
      expect(`${preset.id}`).toBe(`${preset.id}`);
      expect(applyMatrix(pixel(200, 90, 40, 61), presetMatrix(preset.id))[3]).toBe(61);
    }
  });

  test("falls back to no change for an unknown preset", () => {
    // A saved sticker may name a preset a later version renamed. Losing the
    // look is better than losing the sticker.
    const before = pixel(200, 30, 40);
    expect(asArray(applyMatrix(before, presetMatrix("no-such-preset")))).toEqual([
      200,
      30,
      40,
      255,
    ]);
  });
});
