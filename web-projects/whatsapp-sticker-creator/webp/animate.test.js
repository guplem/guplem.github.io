import { describe, expect, test } from "bun:test";
import { MIN_FRAME_DURATION_MS, buildAnimatedWebp } from "./animate.js";
import { readAnimation, readWebp } from "./container.js";
import { findChunk, splitChunks } from "./riff.js";
import {
  fixtureBytes,
  LOSSY_ALPHA_BASE64,
  LOSSLESS_ALPHA_BASE64,
  LOSSY_OPAQUE_BASE64,
  ANIMATED_BASE64,
} from "./fixtures.js";

const lossyAlpha = () => fixtureBytes(LOSSY_ALPHA_BASE64);
const losslessAlpha = () => fixtureBytes(LOSSLESS_ALPHA_BASE64);
const lossyOpaque = () => fixtureBytes(LOSSY_OPAQUE_BASE64);

/** Three real still frames, the shape the editor hands to the muxer. */
const threeFrames = () => [
  { webp: lossyAlpha(), durationMs: 100 },
  { webp: losslessAlpha(), durationMs: 60 },
  { webp: lossyAlpha(), durationMs: 240 },
];

const build = (frames, options = {}) =>
  buildAnimatedWebp({ frames, width: 64, height: 64, ...options });

describe("buildAnimatedWebp", () => {
  test("writes a file that reads back as an animation", () => {
    const file = build(threeFrames());
    expect(readWebp(file).animated).toBe(true);
    expect(readAnimation(file).frames.length).toBe(3);
  });

  test("lays the chunks out in the order a decoder expects", () => {
    // VP8X must come first and ANIM must come before any frame. A decoder that
    // meets ANMF first has no canvas to draw on and gives up.
    const chunks = splitChunks(build(threeFrames()));
    expect(chunks.map((chunk) => chunk.fourCC)).toEqual([
      "VP8X",
      "ANIM",
      "ANMF",
      "ANMF",
      "ANMF",
    ]);
  });

  test("keeps the canvas size it was given", () => {
    const animation = readAnimation(
      buildAnimatedWebp({ frames: threeFrames(), width: 64, height: 64 }),
    );
    expect(animation.width).toBe(64);
    expect(animation.height).toBe(64);
  });

  test("keeps every frame duration", () => {
    const animation = readAnimation(build(threeFrames()));
    expect(animation.frames.map((frame) => frame.durationMs)).toEqual([100, 60, 240]);
  });

  test("makes every frame cover the whole canvas", () => {
    const animation = readAnimation(build(threeFrames()));
    for (const frame of animation.frames) {
      expect([frame.x, frame.y, frame.width, frame.height]).toEqual([0, 0, 64, 64]);
    }
  });

  test("carries each frame's own image chunks through untouched", () => {
    const animation = readAnimation(build(threeFrames()));
    // Frame one is lossy with a separate alpha chunk, frame two is lossless
    // and carries its transparency inside the bitstream. Both survive.
    expect(animation.frames[0].imageChunks.map((chunk) => chunk.fourCC)).toEqual([
      "ALPH",
      "VP8 ",
    ]);
    expect(animation.frames[1].imageChunks.map((chunk) => chunk.fourCC)).toEqual(["VP8L"]);
    // The bytes are the same bytes, not a re-encode: a sticker must not lose
    // quality just by being placed in an animation.
    const source = readWebp(lossyAlpha());
    expect([...animation.frames[0].imageChunks[1].payload]).toEqual([
      ...source.imageChunks[1].payload,
    ]);
  });

  test("never puts a VP8X chunk inside a frame", () => {
    // The lossy fixture is an extended file, so its own VP8X would be copied
    // by a muxer that just forwards every chunk. No decoder reads that.
    const animation = readAnimation(build(threeFrames()));
    for (const frame of animation.frames) {
      expect(frame.imageChunks.map((chunk) => chunk.fourCC)).not.toContain("VP8X");
    }
  });

  test("tells each frame to replace the canvas rather than blend into it", () => {
    // Every frame here is a full-canvas cut-out. Alpha blending would leave
    // the previous frame showing through the transparent holes of the next.
    const animation = readAnimation(build(threeFrames()));
    for (const frame of animation.frames) {
      expect(frame.blend).toBe("none");
      expect(frame.dispose).toBe("background");
    }
  });

  test("sets the alpha flag when any frame keeps transparency", () => {
    const flags = findChunk(splitChunks(build(threeFrames())), "VP8X").payload[0];
    // 0x10 is alpha and 0x02 is animation. Losing the alpha bit is the bug
    // that turns a cut-out sticker back into a square.
    expect(flags & 0x10).toBe(0x10);
    expect(flags & 0x02).toBe(0x02);
  });

  test("leaves the alpha flag clear when no frame has transparency", () => {
    const file = build([
      { webp: lossyOpaque(), durationMs: 100 },
      { webp: lossyOpaque(), durationMs: 100 },
    ]);
    expect(findChunk(splitChunks(file), "VP8X").payload[0] & 0x10).toBe(0);
  });

  test("loops for ever by default", () => {
    // WhatsApp plays a sticker on a loop, so 0 (for ever) is the right default.
    expect(readAnimation(build(threeFrames())).loopCount).toBe(0);
  });

  test("writes the loop count it was asked for", () => {
    expect(readAnimation(build(threeFrames(), { loopCount: 3 })).loopCount).toBe(3);
  });

  test("uses a fully transparent animation background", () => {
    const anim = findChunk(splitChunks(build(threeFrames())), "ANIM");
    // Frames dispose to this colour between them, so an opaque one would
    // flash a coloured rectangle behind a sticker.
    expect([...anim.payload.subarray(0, 4)]).toEqual([0, 0, 0, 0]);
  });

  test("raises a duration below WhatsApp's floor to the floor", () => {
    // WhatsApp requires frames of at least 8 ms. A 0 ms frame is a frame the
    // viewer never sees, so clamp rather than reject and lose the drawing.
    const animation = readAnimation(
      build([
        { webp: lossyAlpha(), durationMs: 0 },
        { webp: lossyAlpha(), durationMs: 3 },
        { webp: lossyAlpha(), durationMs: 8 },
      ]),
    );
    expect(animation.frames.map((frame) => frame.durationMs)).toEqual([
      MIN_FRAME_DURATION_MS,
      MIN_FRAME_DURATION_MS,
      8,
    ]);
  });

  test("rounds a fractional duration to a whole millisecond", () => {
    // ANMF stores whole milliseconds, so a fraction would be truncated
    // silently and the animation would run slightly fast.
    const animation = readAnimation(build([{ webp: lossyAlpha(), durationMs: 83.7 }]));
    expect(animation.frames[0].durationMs).toBe(84);
  });

  test("accepts a one frame animation", () => {
    // A single frame is still a legal animation, and the editor allows it
    // while the person is still adding frames.
    expect(readAnimation(build([{ webp: lossyAlpha(), durationMs: 100 }])).frames.length).toBe(1);
  });

  test("rejects an empty frame list", () => {
    expect(() => build([])).toThrow(/at least one frame/i);
  });

  test("rejects a frame whose size does not match the canvas", () => {
    expect(() =>
      buildAnimatedWebp({ frames: threeFrames(), width: 512, height: 512 }),
    ).toThrow(/64x64.*512x512|512x512.*64x64/i);
  });

  test("rejects a frame that is itself an animation", () => {
    expect(() =>
      build([{ webp: fixtureBytes(ANIMATED_BASE64), durationMs: 100 }]),
    ).toThrow(/already animated/i);
  });

  test("rejects a canvas larger than the 24 bit fields can hold", () => {
    expect(() =>
      buildAnimatedWebp({ frames: threeFrames(), width: 0, height: 64 }),
    ).toThrow(/between 1 and 16777216/i);
  });

  test("declares a RIFF size that matches the bytes it wrote", () => {
    const file = build(threeFrames());
    expect(new DataView(file.buffer, file.byteOffset).getUint32(4, true)).toBe(file.length - 8);
  });

  test("grows with the number of frames and adds little overhead", () => {
    const one = build([{ webp: lossyAlpha(), durationMs: 100 }]);
    const two = build([
      { webp: lossyAlpha(), durationMs: 100 },
      { webp: lossyAlpha(), durationMs: 100 },
    ]);
    // A second frame costs its own pixels plus one 24 byte frame header, and
    // nothing else. This is what keeps an animation inside 500KB.
    const pixels = readWebp(lossyAlpha()).imageChunks.reduce(
      (total, chunk) => total + chunk.payload.length + 8 + (chunk.payload.length % 2),
      0,
    );
    expect(two.length - one.length).toBe(pixels + 24);
  });
});
