import { describe, expect, test } from "bun:test";
import { decodeBase64, encodeBase64 } from "./documentCodec.js";

describe("encodeBase64", () => {
  test("round-trips plain text", () => {
    expect(decodeBase64(encodeBase64("hello"))).toBe("hello");
  });

  // The reason this module exists. `btoa` takes one byte per character, so it
  // throws on anything outside Latin-1: an accent, a curly quote, an emoji. A
  // note is written by a person, so all three arrive on the first day of use.
  test("round-trips accents, quotes and emoji, which btoa alone cannot", () => {
    const text = 'Anadir cafe con leche, "entre comillas", un emoji 🎉 y 日本語';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  test("never emits line breaks", () => {
    expect(encodeBase64("x".repeat(500))).not.toContain("\n");
  });
});

describe("decodeBase64", () => {
  // GitHub's Contents API returns base64 wrapped at 60 characters. A decoder
  // that does not strip those newlines fails on every file it reads back.
  test("tolerates the line breaks GitHub inserts", () => {
    const text = "a note long enough to be wrapped by the Contents API ".repeat(4);
    const wrapped = encodeBase64(text).replace(/(.{60})/g, "$1\n");
    expect(wrapped).toContain("\n");
    expect(decodeBase64(wrapped)).toBe(text);
  });

  test("returns null rather than throwing on anything unreadable", () => {
    expect(decodeBase64("this is not base64 !!!")).toBeNull();
    expect(decodeBase64("//4=")).toBeNull(); // valid base64, invalid UTF-8
    expect(decodeBase64(null)).toBeNull();
    expect(decodeBase64(undefined)).toBeNull();
    expect(decodeBase64(42)).toBeNull();
  });

  test("reads an empty file as an empty string", () => {
    expect(decodeBase64("")).toBe("");
  });
});
