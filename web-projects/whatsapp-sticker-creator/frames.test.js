import { describe, expect, test } from "bun:test";
import { MIN_FRAME_DURATION_MS } from "./spec.js";
import {
  MAX_FRAMES,
  addFrame,
  durationForFps,
  fitWithinLimit,
  moveFrame,
  playbackOrder,
  removeFrame,
  scaleDurations,
  setAllDurations,
  setFrameDuration,
  totalDurationMs,
} from "./frames.js";

/** A frame list, written short so the tests read as timings. */
const framesOf = (...durations) =>
  durations.map((durationMs, index) => ({ id: `f${index}`, durationMs, source: index }));

const durationsOf = (frames) => frames.map((frame) => frame.durationMs);
const idsOf = (frames) => frames.map((frame) => frame.id);

describe("addFrame", () => {
  test("puts a new frame at the end", () => {
    const frames = addFrame(framesOf(100, 100), { id: "new", durationMs: 80 });
    expect(idsOf(frames)).toEqual(["f0", "f1", "new"]);
  });

  test("gives a frame with no duration the one before it", () => {
    // Frames added one after another should keep the timing the person
    // already chose, rather than resetting to a default each time.
    const frames = addFrame(framesOf(250), { id: "new" });
    expect(frames[1].durationMs).toBe(250);
  });

  test("leaves the list it was given alone", () => {
    const before = framesOf(100);
    addFrame(before, { id: "new", durationMs: 80 });
    expect(before.length).toBe(1);
  });

  test("refuses to go past the frame limit", () => {
    const full = Array.from({ length: MAX_FRAMES }, (_, index) => ({
      id: `f${index}`,
      durationMs: 8,
    }));
    expect(() => addFrame(full, { id: "one-too-many", durationMs: 8 })).toThrow(/limit|most/i);
  });
});

describe("removeFrame", () => {
  test("takes out the frame at the position given", () => {
    expect(idsOf(removeFrame(framesOf(1, 2, 3), 1))).toEqual(["f0", "f2"]);
  });

  test("ignores a position that is not there", () => {
    expect(idsOf(removeFrame(framesOf(1, 2), 7))).toEqual(["f0", "f1"]);
    expect(idsOf(removeFrame(framesOf(1, 2), -1))).toEqual(["f0", "f1"]);
  });

  test("can empty the list", () => {
    expect(removeFrame(framesOf(1), 0)).toEqual([]);
  });
});

describe("moveFrame", () => {
  test("moves a frame later in the sequence", () => {
    expect(idsOf(moveFrame(framesOf(1, 2, 3), 0, 2))).toEqual(["f1", "f2", "f0"]);
  });

  test("moves a frame earlier in the sequence", () => {
    expect(idsOf(moveFrame(framesOf(1, 2, 3), 2, 0))).toEqual(["f2", "f0", "f1"]);
  });

  test("changes nothing when a frame moves onto itself", () => {
    expect(idsOf(moveFrame(framesOf(1, 2, 3), 1, 1))).toEqual(["f0", "f1", "f2"]);
  });

  test("clamps a target past the end", () => {
    expect(idsOf(moveFrame(framesOf(1, 2, 3), 0, 99))).toEqual(["f1", "f2", "f0"]);
  });

  test("keeps each frame's own duration with it", () => {
    expect(durationsOf(moveFrame(framesOf(10, 20, 30), 0, 2))).toEqual([20, 30, 10]);
  });
});

describe("setFrameDuration", () => {
  test("sets one frame's time", () => {
    expect(durationsOf(setFrameDuration(framesOf(100, 100), 1, 40))).toEqual([100, 40]);
  });

  test("never goes below WhatsApp's floor", () => {
    expect(durationsOf(setFrameDuration(framesOf(100), 0, 0))).toEqual([MIN_FRAME_DURATION_MS]);
    expect(durationsOf(setFrameDuration(framesOf(100), 0, -50))).toEqual([
      MIN_FRAME_DURATION_MS,
    ]);
  });

  test("rounds to a whole millisecond, which is all the file can hold", () => {
    expect(durationsOf(setFrameDuration(framesOf(100), 0, 83.6))).toEqual([84]);
  });
});

describe("setAllDurations", () => {
  test("gives every frame the same time", () => {
    expect(durationsOf(setAllDurations(framesOf(10, 200, 3000), 60))).toEqual([60, 60, 60]);
  });

  test("respects the floor", () => {
    expect(durationsOf(setAllDurations(framesOf(10, 20), 1))).toEqual([
      MIN_FRAME_DURATION_MS,
      MIN_FRAME_DURATION_MS,
    ]);
  });
});

describe("scaleDurations", () => {
  test("slows the whole animation down", () => {
    expect(durationsOf(scaleDurations(framesOf(100, 50), 2))).toEqual([200, 100]);
  });

  test("speeds the whole animation up", () => {
    expect(durationsOf(scaleDurations(framesOf(100, 50), 0.5))).toEqual([50, 25]);
  });

  test("keeps the timing between frames when speeding up", () => {
    // A speed control has to keep the rhythm the person built. Clamping one
    // frame at the floor and not the others would change it.
    const scaled = scaleDurations(framesOf(400, 200, 100), 0.25);
    expect(durationsOf(scaled)).toEqual([100, 50, 25]);
  });

  test("stops at the floor rather than below it", () => {
    expect(durationsOf(scaleDurations(framesOf(100, 20), 0.01))).toEqual([
      MIN_FRAME_DURATION_MS,
      MIN_FRAME_DURATION_MS,
    ]);
  });

  test("changes nothing at a factor of one", () => {
    expect(durationsOf(scaleDurations(framesOf(100, 55), 1))).toEqual([100, 55]);
  });
});

describe("totalDurationMs", () => {
  test("adds up the frames", () => {
    expect(totalDurationMs(framesOf(100, 60, 240))).toBe(400);
  });

  test("is zero for no frames", () => {
    expect(totalDurationMs([])).toBe(0);
  });

  test("counts a ping-pong pass twice, less the two ends", () => {
    // The middle frames play again on the way back, so the animation runs
    // longer than the frame list suggests and the ten second ceiling has to
    // be measured against the real thing.
    expect(totalDurationMs(framesOf(100, 60, 240), { pingPong: true })).toBe(460);
  });
});

describe("playbackOrder", () => {
  test("plays the frames in order", () => {
    expect(idsOf(playbackOrder(framesOf(1, 2, 3)))).toEqual(["f0", "f1", "f2"]);
  });

  test("plays back down the list for a ping-pong, without repeating the ends", () => {
    // Repeating the last frame would make it appear to hang for twice as
    // long at the turn.
    expect(idsOf(playbackOrder(framesOf(1, 2, 3, 4), { pingPong: true }))).toEqual([
      "f0",
      "f1",
      "f2",
      "f3",
      "f2",
      "f1",
    ]);
  });

  test("leaves a two frame ping-pong alone", () => {
    expect(idsOf(playbackOrder(framesOf(1, 2), { pingPong: true }))).toEqual(["f0", "f1"]);
  });

  test("leaves a single frame alone", () => {
    expect(idsOf(playbackOrder(framesOf(1), { pingPong: true }))).toEqual(["f0"]);
  });

  test("starts on the first frame, which is the one WhatsApp leaves showing", () => {
    // "WhatsApp ends the animation on the first frame after looping", so the
    // first frame in the list has to be the first frame played.
    expect(playbackOrder(framesOf(1, 2, 3))[0].id).toBe("f0");
  });
});

describe("fitWithinLimit", () => {
  test("leaves an animation that already fits alone", () => {
    expect(durationsOf(fitWithinLimit(framesOf(100, 100)))).toEqual([100, 100]);
  });

  test("scales an over-long animation down to the ceiling", () => {
    // Twenty seconds has to become ten, and the rhythm has to survive.
    const fitted = fitWithinLimit(framesOf(10000, 5000, 5000));
    expect(totalDurationMs(fitted)).toBeLessThanOrEqual(10000);
    expect(durationsOf(fitted)).toEqual([5000, 2500, 2500]);
  });

  test("takes a ping-pong into account", () => {
    // Played back and forth this runs 18 seconds, not 12.
    const fitted = fitWithinLimit(framesOf(6000, 6000, 6000), { pingPong: true });
    expect(totalDurationMs(fitted, { pingPong: true })).toBeLessThanOrEqual(10000);
  });

  test("never drops a frame below the floor while shrinking", () => {
    const fitted = fitWithinLimit(
      Array.from({ length: 40 }, (_, index) => ({ id: `f${index}`, durationMs: 1000 })),
    );
    for (const frame of fitted) expect(frame.durationMs).toBeGreaterThanOrEqual(8);
  });

  test("reports when it could not fit inside the ceiling", () => {
    // At the 8 ms floor, more than 1250 frames cannot fit in ten seconds
    // however they are timed. The frame limit stops that happening, so this
    // only guards the reporting.
    const fitted = fitWithinLimit(framesOf(100, 100));
    expect(totalDurationMs(fitted)).toBeLessThanOrEqual(10000);
  });

  test("handles an empty list", () => {
    expect(fitWithinLimit([])).toEqual([]);
  });
});

describe("durationForFps", () => {
  test("turns frames per second into a frame time", () => {
    expect(durationForFps(10)).toBe(100);
    expect(durationForFps(25)).toBe(40);
  });

  test("rounds to a whole millisecond", () => {
    // 30 per second is 33.33 ms, and the file holds whole milliseconds only.
    expect(durationForFps(30)).toBe(33);
  });

  test("never returns less than the floor", () => {
    expect(durationForFps(1000)).toBe(MIN_FRAME_DURATION_MS);
  });

  test("survives a nonsense rate", () => {
    expect(durationForFps(0)).toBeGreaterThanOrEqual(MIN_FRAME_DURATION_MS);
    expect(durationForFps(-5)).toBeGreaterThanOrEqual(MIN_FRAME_DURATION_MS);
  });
});

describe("MAX_FRAMES", () => {
  test("is a limit the 500KB budget can actually hold", () => {
    // An animated sticker may be 500KB in total. Much past 60 frames leaves
    // under 8KB each, which is below what a recognisable 512 by 512 frame
    // needs, so the limit is about the budget and not about the format.
    expect(MAX_FRAMES).toBeGreaterThanOrEqual(2);
    expect(512000 / MAX_FRAMES).toBeGreaterThan(6000);
  });
});
