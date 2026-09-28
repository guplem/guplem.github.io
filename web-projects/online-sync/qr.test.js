import { describe, expect, it } from "bun:test";
import { encodeQr, qrToSvg } from "./qr.js";
import fixtures from "./qr.fixtures.json";

// The fixtures come from the Python `qrcode` library (8.x), an established encoder, with
// the same text, level and mask. Matching them module for module is the
// proof that a phone camera will read what this file draws.

const toRows = (qr) => qr.modules.map((row) => row.map((dark) => (dark ? "1" : "0")).join(""));

describe("encodeQr", () => {
  fixtures.forEach(({ text, ecc, mask, version, rows }) => {
    it(`matches the reference encoder for version ${version}, level ${ecc}, mask ${mask}`, () => {
      const qr = encodeQr(text, { ecc, mask });
      expect(qr.version).toBe(version);
      expect(qr.size).toBe(rows.length);
      expect(toRows(qr)).toEqual(rows);
    });
  });

  it("picks a mask on its own when none is given", () => {
    const qr = encodeQr("https://triunitystudios.com/web-projects/ghana-ludo/");
    expect(qr.mask).toBeGreaterThanOrEqual(0);
    expect(qr.mask).toBeLessThan(8);
    // Same text, same mask: the result equals the fixed-mask encoding.
    expect(toRows(encodeQr("https://triunitystudios.com/web-projects/ghana-ludo/", { mask: qr.mask }))).toEqual(
      toRows(qr),
    );
  });

  it("grows the version with the text", () => {
    expect(encodeQr("hi", { ecc: "L" }).version).toBe(1);
    expect(encodeQr("y".repeat(200), { ecc: "L" }).version).toBe(9);
  });

  it("refuses an unknown level", () => {
    expect(() => encodeQr("x", { ecc: "Z" })).toThrow();
  });
});

describe("qrToSvg", () => {
  it("draws one square per dark module inside a quiet zone", () => {
    const qr = encodeQr("hello");
    const svg = qrToSvg(qr);
    const dark = qr.modules.flat().filter(Boolean).length;
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${qr.size + 8} ${qr.size + 8}"`);
    expect(svg.match(/h1v1h-1z/g)).toHaveLength(dark);
  });
});
