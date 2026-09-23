import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CLIP_MS,
  DEFAULT_VIDEO_FPS,
  MAX_VIDEO_FPS,
  MIN_VIDEO_FPS,
  defaultClip,
  isVideoFile,
  planVideoFrames,
} from "./video.js";
import { MAX_FRAMES } from "./frames.js";
import { MAX_ANIMATION_MS, MIN_FRAME_DURATION_MS } from "./spec.js";

describe("isVideoFile", () => {
  test("reads the type the browser gives", () => {
    expect(isVideoFile({ type: "video/mp4", name: "reel.mp4" })).toBe(true);
    expect(isVideoFile({ type: "image/png", name: "cat.png" })).toBe(false);
  });

  test("falls back to the name when the browser gives no type", () => {
    // A .mov recorded on an iPhone arrives with an empty type in some
    // browsers, and refusing it there would look like a broken feature.
    expect(isVideoFile({ type: "", name: "IMG_0042.MOV" })).toBe(true);
    expect(isVideoFile({ type: "", name: "notes.txt" })).toBe(false);
  });
});

describe("defaultClip", () => {
  test("takes the first seconds of a long video", () => {
    expect(defaultClip(30000)).toEqual({ startMs: 0, lengthMs: DEFAULT_CLIP_MS });
  });

  test("takes the whole of a short video", () => {
    expect(defaultClip(1200)).toEqual({ startMs: 0, lengthMs: 1200 });
  });
});

describe("planVideoFrames", () => {
  test("samples at the rate asked for, and plays at real speed", () => {
    const plan = planVideoFrames({ durationMs: 10000, startMs: 1000, lengthMs: 1000, fps: 10 });
    expect(plan.timesMs).toEqual([1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900]);
    expect(plan.frameDurationMs).toBe(100);
    expect(plan.capped).toBe(false);
  });

  test("never reads past the end of the video", () => {
    const plan = planVideoFrames({ durationMs: 500, startMs: 0, lengthMs: 5000, fps: 10 });
    expect(Math.max(...plan.timesMs)).toBeLessThan(500);
    expect(plan.lengthMs).toBe(500);
  });

  test("keeps the whole clip when the frame budget runs out, by sampling wider", () => {
    const plan = planVideoFrames({ durationMs: 60000, startMs: 0, lengthMs: 10000, fps: 24 });
    expect(plan.timesMs.length).toBe(MAX_FRAMES);
    expect(plan.capped).toBe(true);
    // The clip still covers the ten seconds asked for, at real speed.
    expect(plan.timesMs.at(-1)).toBeGreaterThan(9000);
    expect(plan.frameDurationMs * plan.timesMs.length).toBeLessThanOrEqual(MAX_ANIMATION_MS);
  });

  test("never asks for more than WhatsApp plays", () => {
    const plan = planVideoFrames({ durationMs: 60000, startMs: 0, lengthMs: 30000, fps: 12 });
    expect(plan.lengthMs).toBe(MAX_ANIMATION_MS);
    expect(plan.frameDurationMs * plan.timesMs.length).toBeLessThanOrEqual(MAX_ANIMATION_MS);
  });

  test("always gives an animation, never one frame", () => {
    // One frame is refused by WhatsApp in an animated pack, so even a video
    // shorter than a single frame time has to give two.
    const plan = planVideoFrames({ durationMs: 40, startMs: 0, lengthMs: 40, fps: 4 });
    expect(plan.timesMs.length).toBeGreaterThanOrEqual(2);
    expect(plan.frameDurationMs).toBeGreaterThanOrEqual(MIN_FRAME_DURATION_MS);
  });

  test("holds the rate inside the range the tool offers", () => {
    expect(planVideoFrames({ durationMs: 4000, lengthMs: 1000, fps: 999 }).fps).toBe(MAX_VIDEO_FPS);
    expect(planVideoFrames({ durationMs: 4000, lengthMs: 1000, fps: 0.5 }).fps).toBe(MIN_VIDEO_FPS);
    expect(planVideoFrames({ durationMs: 4000, lengthMs: 1000 }).fps).toBe(DEFAULT_VIDEO_FPS);
  });

  test("pulls a start beyond the end back into the video", () => {
    const plan = planVideoFrames({ durationMs: 2000, startMs: 5000, lengthMs: 1000, fps: 10 });
    expect(plan.startMs).toBeLessThan(2000);
    expect(plan.timesMs.length).toBeGreaterThanOrEqual(2);
  });

  test("refuses a video with no length", () => {
    expect(() => planVideoFrames({ durationMs: 0, lengthMs: 1000 })).toThrow();
    expect(() => planVideoFrames({ durationMs: Number.NaN, lengthMs: 1000 })).toThrow();
    // A live stream reports an endless duration, and nothing can be sampled.
    expect(() => planVideoFrames({ durationMs: Number.POSITIVE_INFINITY })).toThrow();
  });

  test("every time it hands back is a whole millisecond inside the clip", () => {
    const plan = planVideoFrames({ durationMs: 7000, startMs: 1234, lengthMs: 2500, fps: 15 });
    for (const time of plan.timesMs) {
      expect(Number.isInteger(time)).toBe(true);
      expect(time).toBeGreaterThanOrEqual(1234);
      expect(time).toBeLessThan(1234 + 2500);
    }
  });
});
