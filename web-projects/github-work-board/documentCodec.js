// Turning the board document into what GitHub's Contents API stores, and back.
//
// The API carries file content as base64. The browser's own `btoa` takes one
// byte per character, so it throws on any character above 255: an accent, a
// curly quote, an emoji. Notes are written by a person, so this happens on the
// first real day of use, not in some edge case. The text therefore goes through
// `TextEncoder` first, which turns it into UTF-8 bytes that `btoa` can carry.
//
// Reading back has its own trap: GitHub returns the base64 wrapped in newlines
// every 60 characters, and `atob` refuses them. So `decodeBase64` strips all
// whitespace before it decodes.

/** UTF-8 text as one unbroken base64 line. */
export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  // In chunks, because `String.fromCharCode(...bytes)` on a long document
  // overflows the call stack.
  const CHUNK = 0x8000;
  let binary = "";
  for (let start = 0; start < bytes.length; start += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  }
  return btoa(binary);
}

/**
 * Base64 back into text.
 * @returns {string|null} null when it is not base64, or not UTF-8 once decoded.
 *   A caller that gets null treats the file as unreadable rather than as empty.
 */
export function decodeBase64(value) {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, "");
  if (clean === "") return "";
  try {
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
