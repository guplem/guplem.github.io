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
  DEFAULT_PACE,
  scannerAt,
  timeForScanner,
  launchTime,
  penAt,
  leadAt,
  crossTime,
  numberStateAt,
  hopWobble,
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
  test("turns a hop into a circle sitting on the number line", () => {
    expect(hopArc({ from: 7, to: 14, side: "above" })).toEqual({ center: 10.5, radius: 3.5, offset: 0 });
    expect(hopArc({ from: 2, to: 4, side: "below" })).toEqual({ center: 3, radius: 1, offset: 0 });
  });

  test("a bulge grows the circle and pushes its centre off the line", () => {
    const arc = hopArc({ from: 0, to: 10, side: "above" }, 0.01);
    expect(arc.center).toBe(5);
    expect(arc.radius).toBeCloseTo(5.05, 10);
    // the centre drops by exactly the amount that keeps the ends on the line
    expect(arc.offset).toBeCloseTo(Math.sqrt(5.05 ** 2 - 25), 10);
  });
});

describe("hopSweep", () => {
  test("a finished hop above the line sweeps the upper half clockwise", () => {
    expect(hopSweep({ from: 2, to: 4, side: "above" }, 4)).toEqual({
      start: -Math.PI,
      end: 0,
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

  test("clips a growing hop at the pen", () => {
    const above = hopSweep({ from: 2, to: 4, side: "above" }, 3);
    expect(above.end).toBeCloseTo(-Math.PI / 2, 10); // apex, straight up
    const below = hopSweep({ from: 4, to: 6, side: "below" }, 5);
    expect(below.end).toBeCloseTo(Math.PI / 2, 10); // apex, straight down
  });

  test("clamps a pen past the landing and returns null before the start", () => {
    expect(hopSweep({ from: 2, to: 4, side: "above" }, 99).end).toBeCloseTo(0, 10);
    expect(hopSweep({ from: 2, to: 4, side: "above" }, 2)).toBeNull();
    expect(hopSweep({ from: 2, to: 4, side: "above" }, 1)).toBeNull();
  });
});

// The lines in the reference frames are not smooth where they cross the number line, but
// they do meet: no step, no gap. Drawing each hop a hair flatter than a half circle keeps
// both ends exactly on their numbers while the tangent tilts, so neighbours meet at a
// small corner.
describe("a bulged hop still lands on its numbers", () => {
  const endpoints = (hop, bulge) => {
    const { center, radius, offset } = hopArc(hop, bulge);
    const sweep = hopSweep(hop, hop.to, bulge);
    const lift = hop.side === "above" ? offset : -offset; // centre sits on the far side
    const point = (angle) => ({
      x: center + radius * Math.cos(angle),
      y: lift + radius * Math.sin(angle), // measured down from the number line
    });
    return [point(sweep.start), point(sweep.end)];
  };

  for (const side of ["above", "below"]) {
    test(`both ends of a hop ${side} the line stay on it`, () => {
      for (const bulge of [0, 0.0005, 0.004, 0.02]) {
        const [left, right] = endpoints({ from: 12, to: 30, side }, bulge);
        expect(left.x).toBeCloseTo(12, 9);
        expect(right.x).toBeCloseTo(30, 9);
        expect(left.y).toBeCloseTo(0, 9);
        expect(right.y).toBeCloseTo(0, 9);
      }
    });
  }

  test("a bulge tilts the ends off vertical, which is what makes the corner", () => {
    const straight = hopSweep({ from: 0, to: 10, side: "above" }, 10, 0);
    const tilted = hopSweep({ from: 0, to: 10, side: "above" }, 10, 0.004);
    expect(tilted.start).toBeGreaterThan(straight.start); // starts short of straight down
    expect(Math.abs(tilted.start - straight.start)).toBeLessThan(0.2); // and only just
  });

  test("a bulged hop is a little flatter, never taller", () => {
    const { radius, offset } = hopArc({ from: 0, to: 10, side: "above" }, 0.004);
    expect(radius - offset).toBeLessThan(5);
    expect(radius - offset).toBeGreaterThan(4.5);
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

describe("the pace of the sweep", () => {
  const pace = { scanSpeed: 4, penRatio: 2, introSeconds: 0.7 };

  test("the default pace keeps the pens faster than the scanner", () => {
    expect(DEFAULT_PACE.penRatio).toBeGreaterThan(1);
  });

  test("the scanner waits at 2 through the intro, then walks at a steady speed", () => {
    expect(scannerAt(0, pace)).toBe(2);
    expect(scannerAt(0.7, pace)).toBe(2);
    expect(scannerAt(1.7, pace)).toBeCloseTo(6, 6);
  });

  test("timeForScanner is the inverse of scannerAt", () => {
    expect(timeForScanner(2, pace)).toBeCloseTo(0.7, 6);
    expect(scannerAt(timeForScanner(37, pace), pace)).toBeCloseTo(37, 6);
    expect(timeForScanner(1, pace)).toBeCloseTo(0.7, 6); // clamped to the start
  });

  test("2 leaves at once and every other prime leaves when the scanner reaches it", () => {
    expect(launchTime(2, pace)).toBe(0);
    expect(launchTime(3, pace)).toBeCloseTo(0.95, 6);
    expect(launchTime(11, pace)).toBeCloseTo(2.95, 6);
  });

  test("a pen only exists once its chain has left, then runs at the pen speed", () => {
    expect(penAt(3, 0.5, pace)).toBeNull();
    expect(penAt(3, 0.95, pace)).toBeCloseTo(3, 6);
    expect(penAt(3, 1.95, pace)).toBeCloseTo(11, 6); // 8 numbers per second
    expect(penAt(2, 0.7, pace)).toBeCloseTo(7.6, 6); // the head start that 2 gets
  });

  test("the lead is the pen of 2, and the camera has to fit it", () => {
    expect(leadAt(1.7, pace)).toBeCloseTo(penAt(2, 1.7, pace), 10);
    expect(leadAt(1.7, pace)).toBeGreaterThan(scannerAt(1.7, pace));
  });
});

describe("crossing out the composites", () => {
  const pace = { scanSpeed: 4, penRatio: 2, introSeconds: 0.7 };

  test("a composite is crossed by the chain of its smallest prime factor", () => {
    // 9 waits for the chain of 3: it leaves at 0.95s, then covers 6 numbers at 8 a second
    expect(crossTime(9, pace)).toBeCloseTo(1.7, 6);
    expect(crossTime(4, pace)).toBeCloseTo(0.25, 6); // 2 left at once
  });

  test("1 and the primes are never crossed", () => {
    expect(crossTime(1, pace)).toBeNull();
    expect(crossTime(7, pace)).toBeNull();
    expect(crossTime(97, pace)).toBeNull();
  });

  // This is what keeps the animation honest. The scanner calls a number prime when
  // nothing has crossed it, so no composite may still be standing when it arrives.
  test("every composite is crossed before the scanner reaches it", () => {
    for (let n = 4; n <= 400; n++) {
      if (isPrime(n)) continue;
      expect(crossTime(n, pace)).toBeLessThan(timeForScanner(n, pace));
    }
  });

  test("that safety margin holds for any pen faster than the scanner", () => {
    for (const penRatio of [1.05, 1.5, 3, 8]) {
      const faster = { ...pace, penRatio };
      for (let n = 4; n <= 200; n++) {
        if (isPrime(n)) continue;
        expect(crossTime(n, faster)).toBeLessThan(timeForScanner(n, faster));
      }
    }
  });
});

describe("numberStateAt", () => {
  const pace = { scanSpeed: 4, penRatio: 2, introSeconds: 0.7 };
  const state = (n, t) => numberStateAt(n, t, pace, 0.5);

  test("every number starts unknown, so they are all on screen from the first frame", () => {
    expect(state(9, 0).state).toBe("unknown");
    expect(state(17, 0).state).toBe("unknown");
  });

  test("1 stays unknown for ever: it is neither prime nor a multiple", () => {
    expect(state(1, 99).state).toBe("unknown");
  });

  test("a composite turns crossed, and fades over the fade time", () => {
    const crossed = crossTime(4, pace);
    expect(state(4, crossed - 0.01).state).toBe("unknown");
    expect(state(4, crossed).state).toBe("crossed");
    expect(state(4, crossed).fade).toBeCloseTo(0, 6);
    expect(state(4, crossed + 0.25).fade).toBeCloseTo(0.5, 6);
    expect(state(4, crossed + 5).fade).toBe(1);
  });

  test("a prime turns prime when its own chain leaves", () => {
    expect(state(3, 0.9).state).toBe("unknown");
    expect(state(3, 1).state).toBe("prime");
  });

  test("a composite is crossed while the scanner is still far behind it", () => {
    const t = crossTime(9, pace);
    expect(scannerAt(t, pace)).toBeLessThan(9);
    expect(state(9, t).state).toBe("crossed");
  });
});

describe("hopWobble", () => {
  test("gives the same tiny offset every time for the same hop", () => {
    expect(hopWobble(7, 3)).toBe(hopWobble(7, 3));
  });

  test("stays inside one unit either way", () => {
    for (const p of [2, 3, 5, 41]) {
      for (let k = 0; k < 20; k++) expect(Math.abs(hopWobble(p, k))).toBeLessThanOrEqual(1);
    }
  });

  test("differs between hops, so the kinks never line up", () => {
    const values = [0, 1, 2, 3, 4, 5].map((k) => hopWobble(13, k));
    expect(new Set(values).size).toBeGreaterThan(4);
    expect(hopWobble(13, 0)).not.toBe(hopWobble(17, 0));
  });
});

describe("the timeline", () => {
  const options = {
    limit: 20,
    loop: true,
    holdSeconds: 1,
    fadeSeconds: 0.5,
    pace: { scanSpeed: 4, penRatio: 2, introSeconds: 0.7 },
  };
  const run = (state, seconds, step = 0.1, opts = options) => {
    let next = state;
    for (let t = 0; t < seconds - 1e-9; t += step) next = advanceTimeline(next, step, opts);
    return next;
  };

  test("starts with the scanner parked on 2, sweeping", () => {
    expect(createTimeline()).toEqual({ elapsed: 0, frontier: 2, phase: "sweeping", phaseLeft: 0 });
  });

  test("moves the scanner forward while sweeping", () => {
    const state = run(createTimeline(), 2);
    expect(state.phase).toBe("sweeping");
    expect(state.frontier).toBeCloseTo(7.2, 6); // 2 + 4 * (2 - 0.7)
  });

  test("holds on the finished picture when the scanner reaches the limit", () => {
    const state = run(createTimeline(), 5.3);
    expect(state.frontier).toBe(20);
    expect(state.phase).toBe("holding");
  });

  test("fades and then starts over when looping", () => {
    const fading = run(createTimeline(), 6.5);
    expect(fading.phase).toBe("fading");
    const restarted = run(createTimeline(), 7.4);
    expect(restarted.phase).toBe("sweeping");
    expect(restarted.frontier).toBeLessThan(6); // back near the start of a fresh sweep
  });

  test("stops on the finished picture when looping is off", () => {
    const state = run(createTimeline(), 10, 0.1, { ...options, loop: false });
    expect(state.phase).toBe("done");
    expect(state.frontier).toBe(20);
    expect(advanceTimeline(state, 5, { ...options, loop: false })).toEqual(state);
  });

  test("a frozen frame stays frozen", () => {
    const state = seekTimeline(13, options);
    expect(advanceTimeline(state, 0, options)).toEqual(state);
  });

  test("seekTimeline jumps straight to a number and clamps to the limit", () => {
    expect(seekTimeline(12, options)).toEqual({ elapsed: 3.2, frontier: 12, phase: "sweeping", phaseLeft: 0 });
    expect(seekTimeline(999, options).frontier).toBe(20);
    expect(seekTimeline(999, options).phase).toBe("holding");
    expect(seekTimeline(-5, options).frontier).toBe(2);
  });

  test("fadeAlpha only darkens while fading", () => {
    expect(fadeAlpha(createTimeline(), 0.5)).toBe(0);
    expect(fadeAlpha({ phase: "fading", phaseLeft: 0.5 }, 0.5)).toBeCloseTo(0, 6);
    expect(fadeAlpha({ phase: "fading", phaseLeft: 0.25 }, 0.5)).toBeCloseTo(0.5, 6);
    expect(fadeAlpha({ phase: "fading", phaseLeft: 0 }, 0.5)).toBeCloseTo(1, 6);
  });
});
