// A decoder for LERC version 1 ("CntZImage") blobs, the format Esri's elevation
// tile caches serve. The Moon and Mars elevation tiles arrive in this format.
//
// The format follows Esri's open LERC specification (github.com/Esri/lerc,
// Apache License 2.0). This file is a small rewrite of the version 1 reader
// only: the tiles never use LERC 2, so the larger reader is not needed.
//
// Layout of a blob, all numbers little-endian:
//   "CntZImage " (10 bytes), version int32, type int32, height uint32,
//   width uint32, maxZError float64
//   mask part:  blocksY uint32, blocksX uint32, numBytes uint32, maxValue float32,
//               then numBytes of run-length-coded bitset (one bit per pixel)
//   pixel part: blocksY uint32, blocksX uint32, numBytes uint32, maxValue float32,
//               then one record per block (see readBlock)

const IDENTIFIER = "CntZImage";

/**
 * Decode one LERC 1 blob.
 * @param {ArrayBuffer} buffer the blob
 * @param {number} [noData=NaN] the value written for masked pixels
 * @returns {{width:number, height:number, data:Float32Array, valid:number}}
 *   `valid` counts the pixels that carry data.
 */
export function decodeLerc1(buffer, noData = NaN) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const id = String.fromCharCode(...bytes.subarray(0, 10)).trim();
  if (id !== IDENTIFIER) throw new Error(`Not a LERC 1 blob (starts with "${id}")`);
  let p = 10;
  p += 8; // version and image type: both fixed for these tiles
  const height = view.getUint32(p, true);
  const width = view.getUint32(p + 4, true);
  const maxZError = view.getFloat64(p + 8, true);
  p += 16;

  // Mask part.
  const maskBlocksY = view.getUint32(p, true);
  const maskBytes = view.getUint32(p + 8, true);
  const maskMax = view.getFloat32(p + 12, true);
  p += 16;
  let mask = null;
  if (maskBytes > 0) {
    mask = readMaskBits(view, p, maskBytes, Math.ceil((width * height) / 8));
    p += maskBytes;
  } else if (maskBlocksY === 0 && maskMax === 0) {
    // No mask bytes and a zero max value: every pixel is empty.
    mask = new Uint8Array(Math.ceil((width * height) / 8));
  }

  // Pixel part.
  const blocksY = view.getUint32(p, true);
  const blocksX = view.getUint32(p + 4, true);
  const pixelBytes = view.getUint32(p + 8, true);
  const maxValue = view.getFloat32(p + 12, true);
  p += 16;

  const data = new Float32Array(width * height);
  const blockW = Math.floor(width / blocksX);
  const blockH = Math.floor(height / blocksY);
  const extraX = width % blocksX > 0 ? 1 : 0;
  const extraY = height % blocksY > 0 ? 1 : 0;
  const scale = 2 * maxZError;
  const buf = new Float32Array(Math.max(1, blockW * blockH));
  let valid = 0;

  for (let by = 0; by < blocksY + extraY; by++) {
    const h = by < blocksY ? blockH : height % blocksY;
    for (let bx = 0; bx < blocksX + extraX; bx++) {
      const w = bx < blocksX ? blockW : width % blocksX;
      const block = readBlock(view, bytes, p, pixelBytes);
      p = block.next;
      let values = null;
      if (block.encoding === 0) values = block.raw;
      else if (block.encoding === 1) {
        values = buf;
        unstuff(block, scale, maxValue, values);
      }
      const constant = block.encoding === 2 ? 0 : block.offset;
      let k = 0;
      for (let yy = 0; yy < h; yy++) {
        let o = (by * blockH + yy) * width + bx * blockW;
        for (let xx = 0; xx < w; xx++, o++) {
          if (mask && !(mask[o >> 3] & (128 >> (o & 7)))) {
            data[o] = noData;
            continue;
          }
          data[o] = values ? values[k++] : constant;
          valid++;
        }
      }
      if (block.encoding === 1 && k !== block.count) throw new Error("LERC block and mask do not match");
    }
  }
  return { width, height, data, valid };
}

// The mask is a bitset compressed with a simple run-length code: a signed
// int16 count, then either `count` literal bytes (count > 0) or one byte
// repeated `-count` times (count < 0). The value -32768 ends the stream.
function readMaskBits(view, start, numBytes, outLength) {
  const out = new Uint8Array(outLength);
  let ip = start;
  const end = start + numBytes;
  let op = 0;
  let count = view.getInt16(ip, true);
  ip += 2;
  while (count !== -32768 && ip < end) {
    if (count > 0) {
      for (let i = 0; i < count; i++) out[op++] = view.getUint8(ip++);
    } else {
      const value = view.getUint8(ip++);
      for (let i = 0; i < -count; i++) out[op++] = value;
    }
    count = view.getInt16(ip, true);
    ip += 2;
  }
  if (op < outLength) throw new Error("LERC mask ends early");
  return out;
}

// One block record. The low 6 bits of the first byte give the encoding:
//   0 raw float32 values, 1 bit-stuffed integers, 2 all zero, 3 constant.
// The top 2 bits give the type of the offset that follows (for 1 and 3):
//   0 float32, 1 int16, 2 int8.
// A bit-stuffed block then has a byte with the bit depth (low 6 bits) and the
// type of the pixel count (top 2 bits: 0 uint32, 1 uint16, 2 uint8).
function readBlock(view, bytes, p, pixelBytes) {
  const head = view.getUint8(p);
  const encoding = head & 63;
  if (encoding > 3) throw new Error(`Bad LERC block encoding ${encoding}`);
  p += 1;
  if (encoding === 2) return { encoding, next: p };
  if (encoding === 0) {
    const n = (pixelBytes - 1) / 4;
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = view.getFloat32(p + 4 * i, true);
    return { encoding, raw, next: p + 4 * n };
  }
  const offsetType = head >> 6;
  let offset;
  if (offsetType === 2) {
    offset = view.getInt8(p);
    p += 1;
  } else if (offsetType === 1) {
    offset = view.getInt16(p, true);
    p += 2;
  } else if (offsetType === 0) {
    offset = view.getFloat32(p, true);
    p += 4;
  } else throw new Error("Bad LERC offset type");
  if (encoding === 3) return { encoding, offset, next: p };

  const bitsByte = view.getUint8(p);
  p += 1;
  const bits = bitsByte & 63;
  const countType = bitsByte >> 6;
  let count;
  if (countType === 2) {
    count = view.getUint8(p);
    p += 1;
  } else if (countType === 1) {
    count = view.getUint16(p, true);
    p += 2;
  } else if (countType === 0) {
    count = view.getUint32(p, true);
    p += 4;
  } else throw new Error("Bad LERC pixel count type");
  const dataBytes = Math.ceil((count * bits) / 8);
  return { encoding, offset, bits, count, bytes: bytes.subarray(p, p + dataBytes), next: p + dataBytes };
}

// Bit-stuffed values: `bits` bits each, packed big-endian inside 32-bit
// little-endian words. The value is offset + n * scale, capped at maxValue
// because quantisation can overshoot it.
function unstuff(block, scale, maxValue, dest) {
  const { bits, count, offset } = block;
  const src = block.bytes;
  const words = Math.ceil(src.length / 4);
  const padded = new Uint8Array(words * 4);
  padded.set(src);
  const u32 = new Uint32Array(words);
  const dv = new DataView(padded.buffer);
  for (let i = 0; i < words; i++) u32[i] = dv.getUint32(4 * i, true);
  // The last word may hold fewer bytes than four; its valid bytes sit at
  // the high end once shifted.
  const tail = words * 4 - src.length;
  if (words > 0) u32[words - 1] = (u32[words - 1] << (8 * tail)) >>> 0;
  const mask = bits === 32 ? 0xffffffff : (1 << bits) - 1;
  const nmax = Math.ceil((maxValue - offset) / scale);
  let i = 0;
  let left = 0;
  let word = 0;
  for (let o = 0; o < count; o++) {
    if (left === 0) {
      word = u32[i++];
      left = 32;
    }
    let n;
    if (left >= bits) {
      n = (word >>> (left - bits)) & mask;
      left -= bits;
    } else {
      const missing = bits - left;
      n = ((word & mask) << missing) & mask;
      word = u32[i++];
      left = 32 - missing;
      n += word >>> left;
    }
    dest[o] = n < nmax ? offset + n * scale : maxValue;
  }
}
