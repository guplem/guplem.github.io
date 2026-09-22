import { describe, expect, test } from "bun:test";
import { decodeBase64, encodeBase64 } from "./documentCodec.js";

describe("encodeBase64 and decodeBase64", () => {
  test("round-trip text a person writes: accents, curly quotes, emoji", () => {
    const text = 'Ámbar said “hola” 🎉';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  test("a long document does not overflow the stack", () => {
    const text = "é".repeat(200_000);
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  // GitHub wraps the base64 in newlines every 60 characters, and atob refuses them.
  test("decoding strips the newlines GitHub wraps the content in", () => {
    const wrapped = encodeBase64("hello world, again").replace(/(.{8})/g, "$1\n");
    expect(decodeBase64(wrapped)).toBe("hello world, again");
  });

  test("something that is not base64, or not UTF-8, decodes to null rather than garbage", () => {
    expect(decodeBase64("!!!not base64!!!")).toBeNull();
    expect(decodeBase64(btoa("\xff\xfe"))).toBeNull();
    expect(decodeBase64(42)).toBeNull();
    expect(decodeBase64("")).toBe("");
  });
});
