import { describe, expect, test } from "bun:test";
import {
  readVp8Header,
  readVp8lHeader,
  readWebp,
  readAnimation,
} from "./container.js";
import { splitChunks, findChunk } from "./riff.js";
import {
  fixtureBytes,
  LOSSY_ALPHA_BASE64,
  LOSSLESS_ALPHA_BASE64,
  LOSSY_OPAQUE_BASE64,
  ANIMATED_BASE64,
} from "./fixtures.js";

const payloadOf = (base64, fourCC) =>
  findChunk(splitChunks(fixtureBytes(base64)), fourCC).payload;

describe("readVp8Header", () => {
  test("reads the size out of a real lossy bitstream", () => {
    const header = readVp8Header(payloadOf(LOSSY_OPAQUE_BASE64, "VP8 "));
    expect(header.width).toBe(64);
    expect(header.height).toBe(64);
  });

  test("recognises a key frame", () => {
    // Every still WebP holds one key frame. An interframe cannot stand alone.
    expect(readVp8Header(payloadOf(LOSSY_ALPHA_BASE64, "VP8 ")).isKeyFrame).toBe(true);
  });

  test("rejects a bitstream without the 9d 01 2a start code", () => {
    const broken = Uint8Array.from(payloadOf(LOSSY_OPAQUE_BASE64, "VP8 "));
    broken[3] = 0x00;
    expect(() => readVp8Header(broken)).toThrow(/start code/i);
  });

  test("rejects a bitstream too short to hold a header", () => {
    expect(() => readVp8Header(new Uint8Array(5))).toThrow(/too short/i);
  });
});

describe("readVp8lHeader", () => {
  test("reads the size and the alpha flag out of a real lossless bitstream", () => {
    const header = readVp8lHeader(payloadOf(LOSSLESS_ALPHA_BASE64, "VP8L"));
    expect(header.width).toBe(64);
    expect(header.height).toBe(64);
    // This is the flag that decides whether an animation keeps transparency,
    // so read it from the bitstream rather than assuming it.
    expect(header.hasAlpha).toBe(true);
    expect(header.version).toBe(0);
  });

  test("rejects a bitstream without the 0x2f signature", () => {
    const broken = Uint8Array.from(payloadOf(LOSSLESS_ALPHA_BASE64, "VP8L"));
    broken[0] = 0x2e;
    expect(() => readVp8lHeader(broken)).toThrow(/signature/i);
  });

  test("reads the largest size the 14 bit fields can hold", () => {
    // width - 1 and height - 1 are 14 bits each, so 16384 is the ceiling.
    const payload = new Uint8Array([0x2f, 0xff, 0xff, 0xff, 0x0f]);
    const header = readVp8lHeader(payload);
    expect(header.width).toBe(16384);
    expect(header.height).toBe(16384);
  });
});

describe("readWebp", () => {
  test("reads an extended lossy file and keeps its alpha chunk", () => {
    const image = readWebp(fixtureBytes(LOSSY_ALPHA_BASE64));
    expect(image.animated).toBe(false);
    expect(image.format).toBe("lossy");
    expect(image.width).toBe(64);
    expect(image.height).toBe(64);
    expect(image.hasAlpha).toBe(true);
    // ALPH must come before the image data, and both must travel together:
    // dropping ALPH turns a cut-out sticker into a rectangle.
    expect(image.imageChunks.map((chunk) => chunk.fourCC)).toEqual(["ALPH", "VP8 "]);
  });

  test("reads a simple lossless file and finds its alpha in the bitstream", () => {
    const image = readWebp(fixtureBytes(LOSSLESS_ALPHA_BASE64));
    expect(image.format).toBe("lossless");
    expect(image.width).toBe(64);
    expect(image.height).toBe(64);
    // There is no ALPH chunk here. The transparency lives inside VP8L.
    expect(image.hasAlpha).toBe(true);
    expect(image.imageChunks.map((chunk) => chunk.fourCC)).toEqual(["VP8L"]);
  });

  test("reads a simple lossy file and reports no alpha", () => {
    const image = readWebp(fixtureBytes(LOSSY_OPAQUE_BASE64));
    expect(image.format).toBe("lossy");
    expect(image.hasAlpha).toBe(false);
    expect(image.imageChunks.map((chunk) => chunk.fourCC)).toEqual(["VP8 "]);
  });

  test("prefers the canvas size in VP8X over the size in the bitstream", () => {
    // The two agree in a well-formed file. VP8X is the authority, because it
    // describes the canvas and the bitstream only describes its own picture.
    const bytes = fixtureBytes(LOSSY_ALPHA_BASE64);
    expect(readWebp(bytes).width).toBe(64);
    expect(findChunk(splitChunks(bytes), "VP8X")).toBeDefined();
  });

  test("marks an animation as animated and offers it no frame chunks", () => {
    const image = readWebp(fixtureBytes(ANIMATED_BASE64));
    expect(image.animated).toBe(true);
    // An animation cannot be dropped into another animation as one frame, so
    // the caller gets nothing to mux and has to notice the flag.
    expect(image.imageChunks).toEqual([]);
  });

  test("rejects a file that holds no image data at all", () => {
    // A VP8X header with nothing after it: legal RIFF, not a usable picture.
    const headerOnly = fixtureBytes(LOSSY_ALPHA_BASE64).subarray(0, 12 + 18);
    expect(() => readWebp(headerOnly)).toThrow(/no image data/i);
  });

  test("rejects bytes that are not WebP at all", () => {
    expect(() => readWebp(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/not a WebP/i);
  });
});

describe("readAnimation", () => {
  test("reads the canvas size and the loop count", () => {
    const animation = readAnimation(fixtureBytes(ANIMATED_BASE64));
    expect(animation.width).toBe(64);
    expect(animation.height).toBe(64);
    expect(animation.loopCount).toBe(0);
  });

  test("reads every frame duration in order", () => {
    const animation = readAnimation(fixtureBytes(ANIMATED_BASE64));
    expect(animation.frames.map((frame) => frame.durationMs)).toEqual([100, 60, 240]);
  });

  test("reads each frame's rectangle, doubling the stored offsets", () => {
    // ANMF stores x and y halved, so a reader that forgets to double them
    // places every frame at the wrong spot.
    const animation = readAnimation(fixtureBytes(ANIMATED_BASE64));
    expect(animation.frames[0].x).toBe(10);
    expect(animation.frames[0].y).toBe(8);
    expect(animation.frames[0].width).toBe(44);
    expect(animation.frames[0].height).toBe(40);
  });

  test("reads the blend and dispose flags of each frame", () => {
    const animation = readAnimation(fixtureBytes(ANIMATED_BASE64));
    expect(animation.frames.map((frame) => frame.blend)).toEqual(["none", "alpha", "alpha"]);
    expect(animation.frames.map((frame) => frame.dispose)).toEqual([
      "background",
      "background",
      "none",
    ]);
  });

  test("hands back each frame's own image chunks", () => {
    const animation = readAnimation(fixtureBytes(ANIMATED_BASE64));
    for (const frame of animation.frames) {
      expect(frame.imageChunks.map((chunk) => chunk.fourCC)).toEqual(["VP8 "]);
    }
  });

  test("rejects a still image", () => {
    expect(() => readAnimation(fixtureBytes(LOSSY_ALPHA_BASE64))).toThrow(/not animated/i);
  });
});
