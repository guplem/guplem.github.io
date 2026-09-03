import { describe, test, expect } from "bun:test";
import {
  readUint24,
  writeUint24,
  splitChunks,
  buildChunk,
  buildRiff,
} from "./riff.js";
import {
  fixtureBytes,
  LOSSY_ALPHA_BASE64,
  LOSSLESS_ALPHA_BASE64,
  LOSSY_OPAQUE_BASE64,
  ANIMATED_BASE64,
} from "./fixtures.js";

describe("readUint24 and writeUint24", () => {
  test("round-trip the whole 24 bit range at its edges", () => {
    for (const value of [0, 1, 255, 256, 65535, 65536, 511, 0xffffff]) {
      const bytes = new Uint8Array(3);
      writeUint24(bytes, 0, value);
      expect(readUint24(bytes, 0)).toBe(value);
    }
  });

  test("store the low byte first, because WebP is little-endian", () => {
    const bytes = new Uint8Array(3);
    writeUint24(bytes, 0, 0x030201);
    expect([...bytes]).toEqual([0x01, 0x02, 0x03]);
  });

  test("read and write at an offset without touching the neighbours", () => {
    const bytes = new Uint8Array([0xaa, 0, 0, 0, 0xbb]);
    writeUint24(bytes, 1, 0xffffff);
    expect(bytes[0]).toBe(0xaa);
    expect(bytes[4]).toBe(0xbb);
    expect(readUint24(bytes, 1)).toBe(0xffffff);
  });
});

describe("splitChunks", () => {
  test("lists the chunks of a real extended lossy file", () => {
    const chunks = splitChunks(fixtureBytes(LOSSY_ALPHA_BASE64));
    expect(chunks.map((chunk) => chunk.fourCC)).toEqual(["VP8X", "ALPH", "VP8 "]);
  });

  test("lists the single chunk of a real lossless file", () => {
    const chunks = splitChunks(fixtureBytes(LOSSLESS_ALPHA_BASE64));
    expect(chunks.map((chunk) => chunk.fourCC)).toEqual(["VP8L"]);
  });

  test("keeps the trailing space in the VP8 name", () => {
    const chunks = splitChunks(fixtureBytes(LOSSY_OPAQUE_BASE64));
    // "VP8 " and "VP8L" differ only in that fourth byte, so trimming the name
    // would merge two different formats into one.
    expect(chunks[0].fourCC).toBe("VP8 ");
    expect(chunks[0].fourCC.length).toBe(4);
  });

  test("lists every frame of a real animation", () => {
    const chunks = splitChunks(fixtureBytes(ANIMATED_BASE64));
    expect(chunks.map((chunk) => chunk.fourCC)).toEqual([
      "VP8X",
      "ANIM",
      "ANMF",
      "ANMF",
      "ANMF",
    ]);
  });

  test("returns each payload without its 8 byte header", () => {
    const chunks = splitChunks(fixtureBytes(LOSSY_ALPHA_BASE64));
    const vp8x = chunks[0];
    // A VP8X payload is always 10 bytes: flags, 3 reserved, width-1, height-1.
    expect(vp8x.payload.length).toBe(10);
    expect(readUint24(vp8x.payload, 4)).toBe(63);
    expect(readUint24(vp8x.payload, 7)).toBe(63);
  });

  test("skips the pad byte that follows an odd length payload", () => {
    // Two chunks, the first with a 3 byte (odd) payload. The reader has to
    // step over the pad byte, or it reads the pad as the next fourCC.
    const file = buildRiff([
      { fourCC: "AAAA", payload: new Uint8Array([1, 2, 3]) },
      { fourCC: "BBBB", payload: new Uint8Array([4, 5]) },
    ]);
    const chunks = splitChunks(file);
    expect(chunks.map((chunk) => chunk.fourCC)).toEqual(["AAAA", "BBBB"]);
    expect([...chunks[0].payload]).toEqual([1, 2, 3]);
    expect([...chunks[1].payload]).toEqual([4, 5]);
  });

  test("rejects bytes that are not a RIFF WebP file", () => {
    expect(() => splitChunks(new Uint8Array([1, 2, 3, 4]))).toThrow(/not a WebP/i);
    const pngHeader = new Uint8Array(20);
    pngHeader.set([0x89, 0x50, 0x4e, 0x47], 0);
    expect(() => splitChunks(pngHeader)).toThrow(/not a WebP/i);
  });

  test("rejects a file whose chunk claims more bytes than the file holds", () => {
    const file = buildRiff([{ fourCC: "AAAA", payload: new Uint8Array([1, 2]) }]);
    // Claim a 4 KB payload inside a file that is only a few bytes long.
    file[16] = 0x10;
    expect(() => splitChunks(file)).toThrow(/truncated/i);
  });
});

describe("buildChunk", () => {
  test("writes the name, the little-endian size and the payload", () => {
    const chunk = buildChunk("ANIM", new Uint8Array([9, 8]));
    expect(String.fromCharCode(...chunk.subarray(0, 4))).toBe("ANIM");
    expect(chunk[4]).toBe(2);
    expect([...chunk.subarray(8)]).toEqual([9, 8]);
  });

  test("pads an odd payload to an even length with a zero byte", () => {
    const chunk = buildChunk("AAAA", new Uint8Array([7]));
    expect(chunk.length).toBe(10);
    // The declared size stays odd. Only the stored bytes are padded.
    expect(chunk[4]).toBe(1);
    expect(chunk[9]).toBe(0);
  });

  test("rejects a name that is not exactly four characters", () => {
    expect(() => buildChunk("VP8", new Uint8Array(0))).toThrow(/four/i);
    expect(() => buildChunk("VP8XX", new Uint8Array(0))).toThrow(/four/i);
  });
});

describe("buildRiff", () => {
  test("wraps the chunks in a RIFF WebP header", () => {
    const file = buildRiff([{ fourCC: "VP8L", payload: new Uint8Array([1, 2, 3, 4]) }]);
    expect(String.fromCharCode(...file.subarray(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...file.subarray(8, 12))).toBe("WEBP");
  });

  test("declares a size that counts every byte after the first eight", () => {
    const file = buildRiff([{ fourCC: "VP8L", payload: new Uint8Array([1, 2, 3, 4]) }]);
    const declared = new DataView(file.buffer, file.byteOffset).getUint32(4, true);
    expect(declared).toBe(file.length - 8);
  });

  test("survives a round trip through splitChunks", () => {
    const chunks = [
      { fourCC: "ANIM", payload: new Uint8Array([1, 2, 3, 4, 5, 6]) },
      { fourCC: "ANMF", payload: new Uint8Array([7, 8, 9]) },
      { fourCC: "ANMF", payload: new Uint8Array([10]) },
    ];
    const read = splitChunks(buildRiff(chunks));
    expect(read.map((chunk) => chunk.fourCC)).toEqual(["ANIM", "ANMF", "ANMF"]);
    expect(read.map((chunk) => [...chunk.payload])).toEqual(
      chunks.map((chunk) => [...chunk.payload]),
    );
  });

  test("rebuilds a real file byte for byte from the chunks it was split into", () => {
    // The strongest check available without an encoder: take a file libwebp
    // wrote, split it, put it back together, and expect the same bytes.
    for (const base64 of [LOSSY_ALPHA_BASE64, LOSSLESS_ALPHA_BASE64, ANIMATED_BASE64]) {
      const original = fixtureBytes(base64);
      expect([...buildRiff(splitChunks(original))]).toEqual([...original]);
    }
  });
});
