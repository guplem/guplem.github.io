import { describe, expect, test } from "bun:test";
import { QUALITY_LADDER, encodeWithinBudget, estimateFrameBudget } from "./encode.js";

/**
 * A stand-in encoder whose output shrinks as quality drops. The real one is
 * `canvas.toBlob`, which needs a browser, so it is passed in and this whole
 * search is testable without one.
 */
const fakeEncoder = (sizeAt) => {
  const calls = [];
  return {
    calls,
    encodeAt: async (quality) => {
      calls.push(quality);
      return new Uint8Array(sizeAt(quality));
    },
  };
};

/** Size falls linearly with quality, the way a real encoder roughly behaves. */
const linear = (atFullQuality) => (quality) => Math.round(atFullQuality * quality);

describe("QUALITY_LADDER", () => {
  test("runs from the best quality down to the worst", () => {
    for (let i = 1; i < QUALITY_LADDER.length; i += 1) {
      expect(QUALITY_LADDER[i]).toBeLessThan(QUALITY_LADDER[i - 1]);
    }
  });

  test("stays inside the range an encoder accepts", () => {
    for (const quality of QUALITY_LADDER) {
      expect(quality).toBeGreaterThan(0);
      expect(quality).toBeLessThanOrEqual(1);
    }
  });
});

describe("encodeWithinBudget", () => {
  test("keeps the best quality that fits the budget", async () => {
    // At 200000 bytes for full quality, the budget of 102400 is met from
    // quality 0.5 downwards, so the answer is the highest rung at or below it.
    const encoder = fakeEncoder(linear(200000));
    const result = await encodeWithinBudget(encoder.encodeAt, { maxBytes: 102400 });
    expect(result.bytes.length).toBeLessThanOrEqual(102400);
    // Nothing better could have fitted: one rung up is over the budget.
    const better = QUALITY_LADDER[QUALITY_LADDER.indexOf(result.quality) - 1];
    expect(linear(200000)(better)).toBeGreaterThan(102400);
  });

  test("stops at the top rung when the picture already fits", async () => {
    const encoder = fakeEncoder(linear(1000));
    const result = await encodeWithinBudget(encoder.encodeAt, { maxBytes: 102400 });
    expect(result.quality).toBe(QUALITY_LADDER[0]);
  });

  test("searches rather than walking the ladder rung by rung", async () => {
    // Each attempt is a real encode of a 512 by 512 picture, so the count is
    // what the person waits for. A walk would cost one call per rung.
    const encoder = fakeEncoder(linear(200000));
    await encodeWithinBudget(encoder.encodeAt, { maxBytes: 102400 });
    expect(encoder.calls.length).toBeLessThanOrEqual(5);
    expect(encoder.calls.length).toBeLessThan(QUALITY_LADDER.length);
  });

  test("reports how many attempts it took", async () => {
    const encoder = fakeEncoder(linear(200000));
    const result = await encodeWithinBudget(encoder.encodeAt, { maxBytes: 102400 });
    expect(result.attempts).toBe(encoder.calls.length);
  });

  test("never encodes the same quality twice", async () => {
    const encoder = fakeEncoder(linear(200000));
    await encodeWithinBudget(encoder.encodeAt, { maxBytes: 102400 });
    expect(new Set(encoder.calls).size).toBe(encoder.calls.length);
  });

  test("throws when even the lowest quality is too big", async () => {
    const encoder = fakeEncoder(() => 900000);
    await expect(
      encodeWithinBudget(encoder.encodeAt, { maxBytes: 102400 }),
    ).rejects.toThrow(/does not fit/i);
  });

  test("says how small it managed to get, so the page can explain", async () => {
    const encoder = fakeEncoder(() => 900000);
    try {
      await encodeWithinBudget(encoder.encodeAt, { maxBytes: 102400 });
      throw new Error("should have thrown");
    } catch (failure) {
      expect(failure.smallestBytes).toBe(900000);
    }
  });

  test("takes a ladder of its own", async () => {
    const encoder = fakeEncoder(linear(1000));
    const result = await encodeWithinBudget(encoder.encodeAt, {
      maxBytes: 600,
      ladder: [1, 0.5, 0.25],
    });
    expect(result.quality).toBe(0.5);
  });

  test("copes with an encoder whose size does not fall smoothly", async () => {
    // A real encoder is not perfectly predictable: a lower quality setting
    // can occasionally produce a slightly larger file. The result still has
    // to be inside the budget, which is the promise that matters.
    let call = 0;
    const encodeAt = async () => {
      call += 1;
      return new Uint8Array(call % 2 === 0 ? 90000 : 150000);
    };
    const result = await encodeWithinBudget(encodeAt, { maxBytes: 102400 });
    expect(result.bytes.length).toBeLessThanOrEqual(102400);
  });
});

describe("estimateFrameBudget", () => {
  test("shares the animation budget between the frames", () => {
    // 500KB over 10 frames, less the container's own overhead.
    const perFrame = estimateFrameBudget(512000, 10);
    expect(perFrame).toBeLessThanOrEqual(51200);
    expect(perFrame).toBeGreaterThan(40000);
  });

  test("leaves room for the frame headers", () => {
    // Each frame costs a 24 byte header on top of its pixels, so handing
    // every frame the full share would overshoot the total.
    expect(estimateFrameBudget(512000, 10)).toBeLessThan(512000 / 10);
  });

  test("never returns nothing for a very long animation", () => {
    expect(estimateFrameBudget(512000, 60)).toBeGreaterThan(0);
  });

  test("gives a single frame nearly the whole budget", () => {
    expect(estimateFrameBudget(512000, 1)).toBeGreaterThan(500000);
  });
});
