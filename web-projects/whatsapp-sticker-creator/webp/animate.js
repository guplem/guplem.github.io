// Building an animated WebP out of still WebP files.
//
// The browser can encode one still picture: `canvas.toBlob("image/webp")`. It
// cannot encode an animation. This file closes that gap without a library and
// without a build step, by treating the problem as packing rather than
// encoding. Each frame is drawn on a canvas and encoded on its own, and then
// the finished frames are repacked into one animated file:
//
//   RIFF/WEBP
//     VP8X            the canvas: its size, and flags saying "animated" and
//                     "has transparency"
//     ANIM            background colour and loop count
//     ANMF            frame 1: where, how long, then frame 1's own chunks
//     ANMF            frame 2: ...
//
// The pixels are never touched. Each frame's own image chunks are copied over
// byte for byte, so a frame in an animation looks exactly like the still the
// browser encoded, and no quality is lost twice.
//
// Three details in the format decide whether the result is a sticker or a
// broken square, and each one is covered by its own test:
//
//  1. The alpha flag in VP8X. Without it, decoders throw the transparency
//     away and every sticker becomes a rectangle.
//  2. The blend flag on each frame. Frames here are full-canvas cut-outs, so
//     they must replace the canvas. Alpha blending leaves the frame before
//     showing through the holes of the frame after.
//  3. A frame must not carry its own VP8X chunk. The browser writes one for a
//     still with transparency, and it has to be dropped on the way in.

import { LOSSY, readWebp } from "./container.js";
import { buildChunk, buildRiff, writeUint24 } from "./riff.js";

/**
 * WhatsApp's floor for a single frame. From the official requirements:
 * "Animated stickers must have frames with minimum duration of 8ms."
 */
export const MIN_FRAME_DURATION_MS = 8;

/** A canvas side is stored as 24 bits minus one, so this is the ceiling. */
const MAX_CANVAS_SIDE = 16777216;

const FLAG_ALPHA = 0x10;
const FLAG_ANIMATION = 0x02;

/** Do not blend this frame, and clear the canvas after it. */
const FRAME_REPLACES_CANVAS = 0x03;

/** Bytes in an ANMF header, before the frame's own chunks. */
const FRAME_HEADER_LENGTH = 16;

/**
 * @typedef {object} StillFrame
 * @property {Uint8Array} webp One still WebP file, the whole file.
 * @property {number} durationMs How long it stays on screen.
 */

/**
 * Pack still WebP files into one animated WebP file.
 *
 * @param {object} options
 * @param {StillFrame[]} options.frames In play order. The first frame is the
 *   one WhatsApp shows when the animation stops, so it should be complete on
 *   its own.
 * @param {number} options.width Canvas width. Every frame must match it.
 * @param {number} options.height Canvas height.
 * @param {number} [options.loopCount] 0, the default, plays for ever.
 * @returns {Uint8Array} A complete animated WebP file.
 * @throws When a frame is the wrong size, is itself animated, or the list is
 *   empty.
 */
export function buildAnimatedWebp({ frames, width, height, loopCount = 0 }) {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error("An animation needs at least one frame.");
  }
  assertSide(width, "width");
  assertSide(height, "height");

  const read = frames.map((frame, index) => {
    const image = readWebp(frame.webp);
    if (image.animated) {
      throw new Error(`Frame ${index + 1} is already animated, so it cannot be used as a frame.`);
    }
    if (image.width !== width || image.height !== height) {
      throw new Error(
        `Frame ${index + 1} is ${image.width}x${image.height}, but the canvas is ${width}x${height}.`,
      );
    }
    return image;
  });

  // Any one frame with transparency makes the whole animation transparent.
  // WhatsApp stickers are cut-outs, so this flag is almost always on.
  const hasAlpha = read.some((image) => image.hasAlpha);

  const chunks = [
    { fourCC: "VP8X", payload: buildVp8xPayload({ width, height, hasAlpha }) },
    { fourCC: "ANIM", payload: buildAnimPayload(loopCount) },
    ...read.map((image, index) => ({
      fourCC: "ANMF",
      payload: buildFramePayload({
        image,
        width,
        height,
        durationMs: frames[index].durationMs,
      }),
    })),
  ];

  return buildRiff(chunks);
}

/**
 * How long an animation built from these frames will run, after the minimum
 * frame duration is applied. The pack screen shows this against WhatsApp's ten
 * second ceiling, so it has to count the same milliseconds the file will hold.
 *
 * @param {{ durationMs: number }[]} frames
 * @returns {number} Total milliseconds.
 */
export function animationDurationMs(frames) {
  return frames.reduce((total, frame) => total + frameDurationMs(frame.durationMs), 0);
}

/** The 10 byte VP8X payload: flags, three reserved bytes, then the canvas. */
function buildVp8xPayload({ width, height, hasAlpha }) {
  const payload = new Uint8Array(10);
  payload[0] = FLAG_ANIMATION | (hasAlpha ? FLAG_ALPHA : 0);
  // Bytes 1 to 3 are reserved and stay zero.
  writeUint24(payload, 4, width - 1);
  writeUint24(payload, 7, height - 1);
  return payload;
}

/** The 6 byte ANIM payload: a background colour, then the loop count. */
function buildAnimPayload(loopCount) {
  const payload = new Uint8Array(6);
  // Blue, green, red, alpha. All zero is fully transparent, so the gap a frame
  // leaves behind when it disposes shows nothing at all.
  payload[4] = loopCount & 0xff;
  payload[5] = (loopCount >> 8) & 0xff;
  return payload;
}

/** One frame: a 16 byte header, then the frame's own image chunks. */
function buildFramePayload({ image, width, height, durationMs }) {
  const body = image.imageChunks.map((chunk) => buildChunk(chunk.fourCC, chunk.payload));
  const bodyLength = body.reduce((total, chunk) => total + chunk.length, 0);
  const payload = new Uint8Array(FRAME_HEADER_LENGTH + bodyLength);

  // Offsets are stored halved, so they can only be even. Every frame here
  // covers the whole canvas, so both are zero and nothing is lost.
  writeUint24(payload, 0, 0);
  writeUint24(payload, 3, 0);
  writeUint24(payload, 6, width - 1);
  writeUint24(payload, 9, height - 1);
  writeUint24(payload, 12, frameDurationMs(durationMs));
  payload[15] = FRAME_REPLACES_CANVAS;

  let offset = FRAME_HEADER_LENGTH;
  for (const chunk of body) {
    payload.set(chunk, offset);
    offset += chunk.length;
  }
  return payload;
}

/**
 * A duration the format can hold and WhatsApp accepts: whole milliseconds, and
 * never below the 8 ms floor.
 */
function frameDurationMs(durationMs) {
  const whole = Math.round(Number(durationMs));
  if (!Number.isFinite(whole)) return MIN_FRAME_DURATION_MS;
  return Math.max(MIN_FRAME_DURATION_MS, whole);
}

function assertSide(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_CANVAS_SIDE) {
    throw new Error(`The canvas ${name} must be a whole number between 1 and ${MAX_CANVAS_SIDE}.`);
  }
}

/** Re-exported so callers can name the still formats without a second import. */
export { LOSSY };
