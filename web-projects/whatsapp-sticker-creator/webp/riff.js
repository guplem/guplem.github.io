// The RIFF layer of a WebP file: how to read a file into chunks, and how to
// write chunks back into a file.
//
// A WebP file is a RIFF container. It starts with a 12 byte header and then
// holds a flat list of chunks:
//
//   "RIFF"                  4 bytes
//   file size minus 8       4 bytes, little-endian
//   "WEBP"                  4 bytes
//   chunk, chunk, chunk...
//
// and every chunk looks the same:
//
//   fourCC (the name)       4 bytes, for example "VP8L" or "ANMF"
//   payload size            4 bytes, little-endian
//   payload                 that many bytes
//   pad                     one zero byte, only when the size is odd
//
// Nothing here knows what a payload means. `container.js` reads the payloads
// and `animate.js` writes them. This file only counts bytes.
//
// Two details in the format cause most of the bugs:
//
//  1. The pad byte is not counted in the declared size. A reader that adds
//     only the size walks into the pad and reads it as the next name.
//  2. Names are four bytes and are not trimmed. Lossy image data is "VP8 "
//     with a trailing space, and lossless is "VP8L". Trim the name and the
//     two formats become one.

const RIFF_HEADER_LENGTH = 12;
const CHUNK_HEADER_LENGTH = 8;

/**
 * Read a 24 bit little-endian number. WebP stores canvas sizes, frame offsets
 * and frame durations this way.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {number}
 */
export function readUint24(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

/**
 * Write a 24 bit little-endian number.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {number} value
 */
export function writeUint24(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
}

/**
 * @typedef {object} RiffChunk
 * @property {string} fourCC The four character name, spaces kept.
 * @property {Uint8Array} payload The bytes after the 8 byte chunk header.
 */

/**
 * Read a WebP file into its chunks.
 *
 * @param {Uint8Array} bytes A whole WebP file.
 * @returns {RiffChunk[]} The chunks, in the order the file holds them.
 * @throws When the bytes are not a WebP file, or a chunk runs past the end.
 */
export function splitChunks(bytes) {
  if (bytes.length < RIFF_HEADER_LENGTH) throw new Error("This is not a WebP file: too short.");
  if (readFourCC(bytes, 0) !== "RIFF" || readFourCC(bytes, 8) !== "WEBP") {
    throw new Error("This is not a WebP file: the RIFF/WEBP header is missing.");
  }

  const chunks = [];
  let offset = RIFF_HEADER_LENGTH;
  while (offset + CHUNK_HEADER_LENGTH <= bytes.length) {
    const fourCC = readFourCC(bytes, offset);
    const size = readUint32(bytes, offset + 4);
    const start = offset + CHUNK_HEADER_LENGTH;
    if (start + size > bytes.length) {
      throw new Error(`This WebP file is truncated: chunk "${fourCC}" claims ${size} bytes.`);
    }
    chunks.push({ fourCC, payload: bytes.subarray(start, start + size) });
    // The pad byte keeps every chunk header on an even offset. It is not part
    // of the declared size, so step over it separately.
    offset = start + size + (size % 2);
  }
  return chunks;
}

/**
 * Write one chunk: its name, its size and its payload, padded to an even
 * length. The declared size stays the true payload size, pad byte excluded.
 *
 * @param {string} fourCC A four character name.
 * @param {Uint8Array} payload
 * @returns {Uint8Array}
 */
export function buildChunk(fourCC, payload) {
  if (fourCC.length !== 4) throw new Error(`A chunk name must be four characters, got "${fourCC}".`);
  const padded = payload.length + (payload.length % 2);
  const chunk = new Uint8Array(CHUNK_HEADER_LENGTH + padded);
  for (let i = 0; i < 4; i += 1) chunk[i] = fourCC.charCodeAt(i);
  writeUint32(chunk, 4, payload.length);
  chunk.set(payload, CHUNK_HEADER_LENGTH);
  return chunk;
}

/**
 * Write a whole WebP file around a list of chunks.
 *
 * @param {RiffChunk[]} chunks
 * @returns {Uint8Array} A complete WebP file.
 */
export function buildRiff(chunks) {
  const built = chunks.map((chunk) => buildChunk(chunk.fourCC, chunk.payload));
  const bodyLength = built.reduce((total, chunk) => total + chunk.length, 0);
  const file = new Uint8Array(RIFF_HEADER_LENGTH + bodyLength);

  writeFourCC(file, 0, "RIFF");
  // The declared size covers everything after the name and the size itself,
  // so it counts the "WEBP" tag and every chunk.
  writeUint32(file, 4, file.length - CHUNK_HEADER_LENGTH);
  writeFourCC(file, 8, "WEBP");

  let offset = RIFF_HEADER_LENGTH;
  for (const chunk of built) {
    file.set(chunk, offset);
    offset += chunk.length;
  }
  return file;
}

/**
 * Find the first chunk with a given name.
 *
 * @param {RiffChunk[]} chunks
 * @param {string} fourCC
 * @returns {RiffChunk | undefined}
 */
export function findChunk(chunks, fourCC) {
  return chunks.find((chunk) => chunk.fourCC === fourCC);
}

function readFourCC(bytes, offset) {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}

function writeFourCC(bytes, offset, fourCC) {
  for (let i = 0; i < 4; i += 1) bytes[offset + i] = fourCC.charCodeAt(i);
}

function readUint32(bytes, offset) {
  // `>>> 0` keeps a size with the top bit set from coming back negative.
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}
