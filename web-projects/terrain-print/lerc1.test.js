// The LERC 1 reader. The tests build tiny blobs by hand with the encoder
// below, so each block encoding and the mask code are pinned without a
// network or a large fixture. The reader was also checked byte for byte
// against Esri's own decoder (lerc 2.0.0) on real Moon and Mars tiles.
import { describe, expect, test } from "bun:test";
import { decodeLerc1 } from "./lerc1.js";

class Writer {
  constructor() {
    this.bytes = [];
  }
  u8(v) {
    this.bytes.push(v & 255);
  }
  i16(v) {
    const b = new DataView(new ArrayBuffer(2));
    b.setInt16(0, v, true);
    this.raw(b);
  }
  u32(v) {
    const b = new DataView(new ArrayBuffer(4));
    b.setUint32(0, v, true);
    this.raw(b);
  }
  f32(v) {
    const b = new DataView(new ArrayBuffer(4));
    b.setFloat32(0, v, true);
    this.raw(b);
  }
  f64(v) {
    const b = new DataView(new ArrayBuffer(8));
    b.setFloat64(0, v, true);
    this.raw(b);
  }
  raw(dv) {
    for (let i = 0; i < dv.byteLength; i++) this.bytes.push(dv.getUint8(i));
  }
  text(s) {
    for (const ch of s) this.bytes.push(ch.charCodeAt(0));
  }
  buffer() {
    return new Uint8Array(this.bytes).buffer;
  }
}

function header(w, width, height, maxZError) {
  w.text("CntZImage ");
  w.u32(11);
  w.u32(8);
  w.u32(height);
  w.u32(width);
  w.f64(maxZError);
}

// Pack integers MSB first into 32-bit words, the way LERC 1 stores them.
function stuff(w, values, bits) {
  const words = [];
  let word = 0;
  let used = 0;
  for (const v of values) {
    for (let b = bits - 1; b >= 0; b--) {
      word = (word << 1) | ((v >> b) & 1);
      used++;
      if (used === 32) {
        words.push(word >>> 0);
        word = 0;
        used = 0;
      }
    }
  }
  const totalBytes = Math.ceil((values.length * bits) / 8);
  if (used > 0) words.push((word << (32 - used)) >>> 0);
  let written = 0;
  words.forEach((u, i) => {
    const last = i === words.length - 1;
    const k = last ? totalBytes - written : 4;
    const v = last ? u >>> (8 * (4 - k)) : u;
    for (let j = 0; j < k; j++) w.u8(v >>> (8 * j));
    written += k;
  });
}

describe("decodeLerc1", () => {
  test("reads a constant block with no mask", () => {
    const w = new Writer();
    header(w, 2, 2, 0.5);
    w.u32(0), w.u32(0), w.u32(0), w.f32(1); // mask header: no mask, all valid
    w.u32(1), w.u32(1), w.u32(3), w.f32(-1234);
    w.u8(3 | (1 << 6)); // constant, int16 offset
    w.i16(-1234);
    const t = decodeLerc1(w.buffer());
    expect(t.width).toBe(2);
    expect(t.height).toBe(2);
    expect(Array.from(t.data)).toEqual([-1234, -1234, -1234, -1234]);
    expect(t.valid).toBe(4);
  });

  test("reads bit-stuffed values as offset + n × 2 × maxZError", () => {
    const w = new Writer();
    header(w, 3, 1, 0.5);
    w.u32(0), w.u32(0), w.u32(0), w.f32(1);
    w.u32(1), w.u32(1), w.u32(0), w.f32(100);
    w.u8(1 | (2 << 6)); // bit-stuffed, int8 offset
    w.u8(10); // offset 10
    w.u8(4 | (2 << 6)); // 4 bits per value, uint8 count
    w.u8(3);
    stuff(w, [0, 5, 15], 4);
    const t = decodeLerc1(w.buffer());
    expect(Array.from(t.data)).toEqual([10, 15, 25]);
  });

  test("caps a quantised value at the stored maximum", () => {
    const w = new Writer();
    header(w, 2, 1, 0.5);
    w.u32(0), w.u32(0), w.u32(0), w.f32(1);
    w.u32(1), w.u32(1), w.u32(0), w.f32(12.5);
    w.u8(1 | (2 << 6));
    w.u8(10);
    w.u8(3 | (2 << 6));
    w.u8(2);
    stuff(w, [1, 3], 3); // 11 and 13, but 13 is past the max of 12.5
    const t = decodeLerc1(w.buffer());
    expect(Array.from(t.data)).toEqual([11, 12.5]);
  });

  test("applies the run-length mask and marks empty pixels", () => {
    const w = new Writer();
    header(w, 3, 1, 0.5);
    // mask: one byte 0b10100000 (pixels 0 and 2 valid), as a literal run
    const mask = new Writer();
    mask.i16(1);
    mask.u8(0b10100000);
    mask.i16(-32768);
    w.u32(1), w.u32(1), w.u32(mask.bytes.length), w.f32(1);
    w.bytes.push(...mask.bytes);
    w.u32(1), w.u32(1), w.u32(0), w.f32(50);
    w.u8(1 | (2 << 6));
    w.u8(40);
    w.u8(4 | (2 << 6));
    w.u8(2); // two valid pixels only
    stuff(w, [2, 7], 4);
    const t = decodeLerc1(w.buffer(), -9999);
    expect(Array.from(t.data)).toEqual([42, -9999, 47]);
    expect(t.valid).toBe(2);
  });

  test("handles the narrower blocks at the right edge", () => {
    const w = new Writer();
    header(w, 3, 1, 0.5);
    w.u32(0), w.u32(0), w.u32(0), w.f32(1);
    // two blocks across a width of 3: one of width 1 plus a remainder of 1...
    // blocksX = 2 gives blockW = 1 and a third, extra block of width 1.
    w.u32(1), w.u32(2), w.u32(0), w.f32(9);
    for (const v of [7, 8, 9]) {
      w.u8(3 | (2 << 6));
      w.u8(v);
    }
    const t = decodeLerc1(w.buffer());
    expect(Array.from(t.data)).toEqual([7, 8, 9]);
  });

  test("reads an all-zero block", () => {
    const w = new Writer();
    header(w, 2, 1, 0.5);
    w.u32(0), w.u32(0), w.u32(0), w.f32(1);
    w.u32(1), w.u32(1), w.u32(0), w.f32(0);
    w.u8(2);
    expect(Array.from(decodeLerc1(w.buffer()).data)).toEqual([0, 0]);
  });

  test("refuses a blob that is not LERC 1", () => {
    const bytes = new TextEncoder().encode("<!DOCTYPE html><html></html>  padding padding");
    expect(() => decodeLerc1(bytes.buffer)).toThrow(/Not a LERC 1 blob/);
  });
});
