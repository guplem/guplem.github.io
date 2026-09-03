// Reading a WebP file: what kind of picture it holds, how big it is, whether
// it keeps transparency, and which chunks carry its pixels.
//
// The browser gives this project WebP files it did not write. `canvas.toBlob`
// hands back a finished file, and the shape of that file changes with the
// quality asked for and with the browser. Three shapes exist:
//
//   VP8X + ALPH + VP8      lossy pixels, transparency in its own chunk
//   VP8L                   lossless pixels, transparency inside the bitstream
//   VP8                    lossy pixels, no transparency
//
// `animate.js` puts those chunks inside frames of an animation, so it needs
// them named and in order. It must never copy a VP8X chunk into a frame, and it
// must never drop an ALPH chunk, which is why this file returns the image
// chunks as an explicit list instead of the whole file.

import { findChunk, readUint24, splitChunks } from "./riff.js";

/** The two ways WebP stores pixels. */
export const LOSSY = "lossy";
export const LOSSLESS = "lossless";

/** Bit masks in the VP8X flags byte. The spec numbers bits from the top. */
const FLAG_ALPHA = 0x10;
const FLAG_ANIMATION = 0x02;

/** The three bytes that follow the frame tag of every VP8 key frame. */
const VP8_START_CODE = [0x9d, 0x01, 0x2a];

const VP8L_SIGNATURE = 0x2f;

/**
 * Read the header of a VP8 (lossy) bitstream.
 *
 * @param {Uint8Array} payload The payload of a "VP8 " chunk.
 * @returns {{ width: number, height: number, isKeyFrame: boolean }}
 */
export function readVp8Header(payload) {
  if (payload.length < 10) throw new Error("This lossy bitstream is too short to hold a header.");
  for (let i = 0; i < VP8_START_CODE.length; i += 1) {
    if (payload[3 + i] !== VP8_START_CODE[i]) {
      throw new Error("This lossy bitstream has no 9d 01 2a start code.");
    }
  }
  const frameTag = readUint24(payload, 0);
  return {
    // Bit 0 of the frame tag is 0 for a key frame and 1 for an interframe.
    isKeyFrame: (frameTag & 1) === 0,
    // Each size is 14 bits. The top 2 bits of the same 16 hold a scale hint
    // that says how to stretch the picture, and are not part of the size.
    width: readUint16(payload, 6) & 0x3fff,
    height: readUint16(payload, 8) & 0x3fff,
  };
}

/**
 * Read the header of a VP8L (lossless) bitstream.
 *
 * @param {Uint8Array} payload The payload of a "VP8L" chunk.
 * @returns {{ width: number, height: number, hasAlpha: boolean, version: number }}
 */
export function readVp8lHeader(payload) {
  if (payload.length < 5) throw new Error("This lossless bitstream is too short to hold a header.");
  if (payload[0] !== VP8L_SIGNATURE) {
    throw new Error("This lossless bitstream has no 0x2f signature.");
  }
  // After the signature the header is one 32 bit little-endian word, read from
  // the lowest bit up: 14 bits of width - 1, 14 of height - 1, 1 alpha flag
  // and 3 of version.
  const header = readUint32(payload, 1);
  return {
    width: (header & 0x3fff) + 1,
    height: ((header >>> 14) & 0x3fff) + 1,
    hasAlpha: ((header >>> 28) & 1) === 1,
    version: (header >>> 29) & 7,
  };
}

/**
 * @typedef {object} WebpImage
 * @property {boolean} animated True when the file is an animation, not a still.
 * @property {"lossy"|"lossless"|null} format How a still stores its pixels.
 * @property {number} width Canvas width in pixels.
 * @property {number} height Canvas height in pixels.
 * @property {boolean} hasAlpha True when the picture keeps transparency.
 * @property {import("./riff.js").RiffChunk[]} imageChunks The chunks that carry
 *   the pixels, ready to drop inside an animation frame. Empty for animations.
 */

/**
 * Read a WebP file.
 *
 * @param {Uint8Array} bytes A whole WebP file, for example from `canvas.toBlob`.
 * @returns {WebpImage}
 * @throws When the bytes are not WebP, or hold no picture.
 */
export function readWebp(bytes) {
  const chunks = splitChunks(bytes);
  const header = findChunk(chunks, "VP8X");
  const animated = Boolean(header) && (header.payload[0] & FLAG_ANIMATION) !== 0;

  if (animated) {
    return {
      animated: true,
      format: null,
      ...canvasSize(header),
      hasAlpha: (header.payload[0] & FLAG_ALPHA) !== 0,
      // An animation is not a frame. Handing back its chunks would invite a
      // caller to nest one animation inside another, which no decoder reads.
      imageChunks: [],
    };
  }

  const alpha = findChunk(chunks, "ALPH");
  const lossy = findChunk(chunks, "VP8 ");
  const lossless = findChunk(chunks, "VP8L");
  if (!lossy && !lossless) throw new Error("This WebP file holds no image data.");

  const format = lossless ? LOSSLESS : LOSSY;
  const bitstream = lossless
    ? readVp8lHeader(lossless.payload)
    : readVp8Header(lossy.payload);

  return {
    animated: false,
    format,
    // VP8X wins when it is there: it describes the canvas, while a bitstream
    // only describes its own picture, and the two differ in a cropped file.
    ...(header ? canvasSize(header) : { width: bitstream.width, height: bitstream.height }),
    // Three places can claim transparency, and any one of them is enough.
    hasAlpha:
      Boolean(alpha) ||
      (header ? (header.payload[0] & FLAG_ALPHA) !== 0 : false) ||
      Boolean(bitstream.hasAlpha),
    // Order matters: a decoder expects the alpha chunk before the pixels.
    imageChunks: alpha ? [alpha, lossy ?? lossless] : [lossy ?? lossless],
  };
}

/**
 * @typedef {object} WebpAnimationFrame
 * @property {number} x Left edge of the frame on the canvas, in pixels.
 * @property {number} y Top edge of the frame on the canvas, in pixels.
 * @property {number} width Frame width in pixels.
 * @property {number} height Frame height in pixels.
 * @property {number} durationMs How long the frame stays on screen.
 * @property {"alpha"|"none"} blend How the frame mixes with what is behind it.
 * @property {"none"|"background"} dispose What happens to the canvas after it.
 * @property {import("./riff.js").RiffChunk[]} imageChunks The frame's pixels.
 */

/**
 * Read an animated WebP file frame by frame. The editor uses this to reopen an
 * animated sticker, and the tests use it to read back what `animate.js` wrote.
 *
 * @param {Uint8Array} bytes A whole animated WebP file.
 * @returns {{ width: number, height: number, loopCount: number, frames: WebpAnimationFrame[] }}
 * @throws When the file is a still image.
 */
export function readAnimation(bytes) {
  const chunks = splitChunks(bytes);
  const header = findChunk(chunks, "VP8X");
  if (!header || (header.payload[0] & FLAG_ANIMATION) === 0) {
    throw new Error("This WebP file is not animated.");
  }
  const anim = findChunk(chunks, "ANIM");

  const frames = chunks
    .filter((chunk) => chunk.fourCC === "ANMF")
    .map((chunk) => {
      const flags = chunk.payload[15];
      return {
        // ANMF stores the offsets halved, so a frame can only start on an even
        // pixel. Double them back to canvas coordinates.
        x: readUint24(chunk.payload, 0) * 2,
        y: readUint24(chunk.payload, 3) * 2,
        width: readUint24(chunk.payload, 6) + 1,
        height: readUint24(chunk.payload, 9) + 1,
        durationMs: readUint24(chunk.payload, 12),
        blend: (flags & 0x02) === 0 ? "alpha" : "none",
        dispose: (flags & 0x01) === 0 ? "none" : "background",
        // The frame's own chunks start after its 16 byte header.
        imageChunks: splitFrameChunks(chunk.payload.subarray(16)),
      };
    });

  return {
    ...canvasSize(header),
    // 0 means "loop for ever", which is what a sticker wants.
    loopCount: anim ? readUint16(anim.payload, 4) : 0,
    frames,
  };
}

/** Canvas size, stored minus one so that 16777216 pixels fit in 24 bits. */
function canvasSize(header) {
  return {
    width: readUint24(header.payload, 4) + 1,
    height: readUint24(header.payload, 7) + 1,
  };
}

/**
 * Read the chunk list inside an ANMF payload. It is the same layout as a file
 * body, but without the 12 byte RIFF header in front, so `splitChunks` cannot
 * read it directly.
 */
function splitFrameChunks(body) {
  const chunks = [];
  let offset = 0;
  while (offset + 8 <= body.length) {
    const fourCC = String.fromCharCode(
      body[offset],
      body[offset + 1],
      body[offset + 2],
      body[offset + 3],
    );
    const size = readUint32(body, offset + 4);
    const start = offset + 8;
    if (start + size > body.length) break;
    chunks.push({ fourCC, payload: body.subarray(start, start + size) });
    offset = start + size + (size % 2);
  }
  return chunks;
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}
