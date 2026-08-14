import { describe, test, expect } from "bun:test";
import {
  primesUpTo,
  isPrime,
  hopSide,
  hopAt,
  completedHopCount,
  hopInProgress,
  hopArc,
  hopSweep,
  pixelsPerUnit,
  projectUnit,
  frontierAt,
  createTimeline,
  seekTimeline,
  advanceTimeline,
  fadeAlpha,
} from "./sieve.js";

describe("primesUpTo", () => {
  test("returns the primes below the limit", () => {
    expect(primesUpTo(30)).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  });

  test("treats 0, 1 and negative limits as empty", () => {
    expect(primesUpTo(0)).toEqual([]);
    expect(primesUpTo(1)).toEqual([]);
    expect(primesUpTo(-5)).toEqual([]);
  });

  test("includes the limit when the limit is prime", () => {
    expect(primesUpTo(2)).toEqual([2]);
    expect(primesUpTo(13).at(-1)).toBe(13);
  });

  test("counts 168 primes below 1000", () => {
    expect(primesUpTo(1000).length).toBe(168);
  });
});

describe("isPrime", () => {
  test("accepts primes and rejects composites, 1, 0 and negatives", () => {
    for (const n of [2, 3, 5, 7, 97, 101]) expect(isPrime(n)).toBe(true);
    for (const n of [-7, 0, 1, 4, 9, 91, 100]) expect(isPrime(n)).toBe(false);
  });

  test("rejects non-integers", () => {
    expect(isPrime(7.5)).toBe(false);
  });
});

describe("hopSide", () => {
  test("alternates, starting above the number line", () => {
    expect([0, 1, 2, 3].map(hopSide)).toEqual(["above", "below", "above", "below"]);
  });
});

describe("hopAt", () => {
  test("hop k runs from (k+1)p to (k+2)p", () => {
    expect(hopAt(2, 0)).toEqual({ from: 2, to: 4, side: "above" });
    expect(hopAt(2, 1)).toEqual({ from: 4, to: 6, side: "below" });
    expect(hopAt(7, 0)).toEqual({ from: 7, to: 14, side: "above" });
    expect(hopAt(7, 3)).toEqual({ from: 28, to: 35, side: "below" });
  });

  // The chains measured pixel by pixel in the reference frame (see reference/ and AGENTS.md).
  test("reproduces the chains measured in the reference frame", () => {
    const chain = (p, count) =>
      Array.from({ length: count }, (_, k) => {
        const hop = hopAt(p, k);
        return `${hop.from}${hop.side === "above" ? "^" : "v"}${hop.to}`;
      }).join(" ");

    expect(chain(2, 5)).toBe("2^4 4v6 6^8 8v10 10^12");
    expect(chain(3, 4)).toBe("3^6 6v9 9^12 12v15");
    expect(chain(5, 3)).toBe("5^10 10v15 15^20");
    expect(chain(7, 3)).toBe("7^14 14v21 21^28");
    expect(chain(11, 2)).toBe("11^22 22v33");
    expect(chain(13, 2)).toBe("13^26 26v39");
    expect(chain(37, 1)).toBe("37^74");
  });

  test("rejects a negative hop index", () => {
    expect(() => hopAt(5, -1)).toThrow();
  });
});

describe("completedHopCount", () => {
  test("counts only the hops that already landed", () => {
    expect(completedHopCount(2, 1)).toBe(0);
    expect(completedHopCount(2, 3)).toBe(0);
    expect(completedHopCount(2, 4)).toBe(1);
    expect(completedHopCount(2, 5)).toBe(1);
    expect(completedHopCount(2, 6)).toBe(2);
    expect(completedHopCount(7, 13.9)).toBe(0);
    expect(completedHopCount(7, 14)).toBe(1);
    expect(completedHopCount(7, 21)).toBe(2);
  });
});

describe("hopInProgress", () => {
  test("returns the hop that straddles the frontier", () => {
    expect(hopInProgress(3, 7)).toEqual({ from: 6, to: 9, side: "below" });
    expect(hopInProgress(3, 3.5)).toEqual({ from: 3, to: 6, side: "above" });
  });

  test("returns null before the chain starts and on an exact landing", () => {
    expect(hopInProgress(5, 4.9)).toBeNull();
    expect(hopInProgress(5, 10)).toBeNull();
  });
});

describe("hopArc", () => {
  test("turns a hop into a circle centred on the number line", () => {
    expect(hopArc({ from: 7, to: 14, side: "above" })).toEqual({ center: 10.5, radius: 3.5 });
    expect(hopArc({ from: 2, to: 4, side: "below" })).toEqual({ center: 3, radius: 1 });
  });
});

describe("hopSweep", () => {
  const TAU = Math.PI * 2;

  test("a finished hop above the line sweeps the upper half clockwise", () => {
    expect(hopSweep({ from: 2, to: 4, side: "above" }, 4)).toEqual({
      start: Math.PI,
      end: TAU,
      anticlockwise: false,
    });
  });

  test("a finished hop below the line sweeps the lower half anticlockwise", () => {
    expect(hopSweep({ from: 4, to: 6, side: "below" }, 6)).toEqual({
      start: Math.PI,
      end: 0,
      anticlockwise: true,
    });
  });

  test("clips a growing hop at the frontier", () => {
    const above = hopSweep({ from: 2, to: 4, side: "above" }, 3);
    expect(above.end).toBeCloseTo(TAU - Math.PI / 2, 10); // apex, straight up
    const below = hopSweep({ from: 4, to: 6, side: "below" }, 5);
    expect(below.end).toBeCloseTo(Math.PI / 2, 10); // apex, straight down
  });

  test("clamps a frontier past the landing and returns null before the start", () => {
    expect(hopSweep({ from: 2, to: 4, side: "above" }, 99).end).toBeCloseTo(TAU, 10);
    expect(hopSweep({ from: 2, to: 4, side: "above" }, 2)).toBeNull();
    expect(hopSweep({ from: 2, to: 4, side: "above" }, 1)).toBeNull();
  });
});

// The whole point of the animation: the hops land on every composite and never on a prime.
describe("the hops sieve the number line", () => {
  test("a number is composite exactly when some hop lands on it", () => {
    const limit = 300;
    const landed = new Set();
    for (const p of primesUpTo(limit)) {
      for (let k = 0; hopAt(p, k).to <= limit; k++) landed.add(hopAt(p, k).to);
    }
    for (let n = 2; n <= limit; n++) expect(landed.has(n)).toBe(!isPrime(n));
  });
});

describe("camera", () => {
  test("pixelsPerUnit fits the visible span inside the padded width", () => {
    expect(pixelsPerUnit(1000, 100, 0)).toBe(10);
    expect(pixelsPerUnit(1000, 100, 50)).toBe(9);
  });

  test("pixelsPerUnit stays positive for degenerate inputs", () => {
    expect(pixelsPerUnit(100, 0, 0)).toBeGreaterThan(0);
    expect(pixelsPerUnit(10, 100, 40)).toBeGreaterThan(0);
  });

  test("projectUnit places unit 0 at the left padding", () => {
    expect(projectUnit(0, 10, 24)).toBe(24);
    expect(projectUnit(7, 10, 24)).toBe(94);
  });
});

describe("frontierAt", () => {
  test("advances at a constant number-line speed", () => {
    expect(frontierAt(0, 4)).toBe(0);
    expect(frontierAt(2.5, 4)).toBe(10);
  });

  test("never runs backwards", () => {
    expect(frontierAt(-3, 4)).toBe(0);
  });
});

describe("the timeline", () => {
  const options = { speed: 4, limit: 20, loop: true, holdSeconds: 1, fadeSeconds: 0.5 };
  const run = (state, seconds, step = 0.1, opts = options) => {
    let next = state;
    for (let t = 0; t < seconds - 1e-9; t += step) next = advanceTimeline(next, step, opts);
    return next;
  };

  test("starts at zero, sweeping", () => {
    expect(createTimeline()).toEqual({ elapsed: 0, frontier: 0, phase: "sweeping", phaseLeft: 0 });
  });

  test("moves the front forward while sweeping", () => {
    const state = run(createTimeline(), 2);
    expect(state.phase).toBe("sweeping");
    expect(state.frontier).toBeCloseTo(8, 6);
  });

  test("holds on the finished picture when the front reaches the limit", () => {
    const state = run(createTimeline(), 5.2);
    expect(state.frontier).toBe(20);
    expect(state.phase).toBe("holding");
  });

  test("fades and then starts over when looping", () => {
    const fading = run(createTimeline(), 6.4);
    expect(fading.phase).toBe("fading");
    const restarted = run(createTimeline(), 7.2);
    expect(restarted.phase).toBe("sweeping");
    expect(restarted.frontier).toBeLessThan(5); // back near the start of a fresh sweep
  });

  test("stops on the finished picture when looping is off", () => {
    const state = run(createTimeline(), 9, 0.1, { ...options, loop: false });
    expect(state.phase).toBe("done");
    expect(state.frontier).toBe(20);
    expect(advanceTimeline(state, 5, { ...options, loop: false })).toEqual(state);
  });

  test("a frozen frame stays frozen", () => {
    const state = seekTimeline(13, options);
    expect(advanceTimeline(state, 0, options)).toEqual(state);
  });

  test("seekTimeline jumps straight to a number and clamps to the limit", () => {
    expect(seekTimeline(12, options)).toEqual({ elapsed: 3, frontier: 12, phase: "sweeping", phaseLeft: 0 });
    expect(seekTimeline(999, options).frontier).toBe(20);
    expect(seekTimeline(999, options).phase).toBe("holding");
    expect(seekTimeline(-5, options).frontier).toBe(0);
  });

  test("fadeAlpha only darkens while fading", () => {
    expect(fadeAlpha(createTimeline(), 0.5)).toBe(0);
    expect(fadeAlpha({ phase: "fading", phaseLeft: 0.5 }, 0.5)).toBeCloseTo(0, 6);
    expect(fadeAlpha({ phase: "fading", phaseLeft: 0.25 }, 0.5)).toBeCloseTo(0.5, 6);
    expect(fadeAlpha({ phase: "fading", phaseLeft: 0 }, 0.5)).toBeCloseTo(1, 6);
  });
});
