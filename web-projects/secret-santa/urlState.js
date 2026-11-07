// The link: the whole event lives in one URL parameter, `e`.
//
// The event is { title, note, names, forbidden, seed }. The note is optional.
//
// The parameter holds a small JSON document, written as base64url so the link
// stays one unbroken word in a chat message. Base64 also keeps the names from
// being read at a glance in the address bar. It is not a secret: the result is
// never in the link, and each phone works it out again from the event and the
// seed (see draw.js). Root ADR 0006 covers URL state for web-projects.

/** The parameter that carries the event. */
export const EVENT_PARAM = "e";
/** The format version, so a later change can still read old links. */
const VERSION = 1;
const MAX_NAME_LENGTH = 40;
/** The longest note the organiser can add. It shows after the reveal. */
export const MAX_NOTE_LENGTH = 100;

/** Cut a text to `max` characters without splitting an emoji in two. */
export function clip(text, max) {
  return Array.from(text).slice(0, max).join("");
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Write an event as URL-safe text. */
export function encodeEvent({ title = "", note = "", names, forbidden, seed }) {
  const data = { v: VERSION, t: title, n: names, x: forbidden, s: seed };
  // The note is optional and was added after the first release, so a link
  // without one stays exactly as it was.
  if (note) data.m = clip(note, MAX_NOTE_LENGTH);
  return toBase64Url(JSON.stringify(data));
}

/**
 * Read an event back. Returns null for anything that is not a usable event,
 * and drops forbidden pairs that make no sense, so a damaged link still works.
 */
export function decodeEvent(text) {
  if (typeof text !== "string" || !text) return null;
  let data;
  try {
    data = JSON.parse(fromBase64Url(text));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const names = Array.isArray(data.n) ? data.n.filter((n) => typeof n === "string" && n.trim()).map(String) : [];
  const seed = typeof data.s === "string" ? data.s : "";
  if (names.length < 2 || !seed) return null;
  const inRange = (i) => Number.isInteger(i) && i >= 0 && i < names.length;
  const forbidden = (Array.isArray(data.x) ? data.x : []).filter(
    (pair) => Array.isArray(pair) && pair.length === 2 && inRange(pair[0]) && inRange(pair[1]) && pair[0] !== pair[1],
  );
  return {
    title: typeof data.t === "string" ? data.t : "",
    note: typeof data.m === "string" ? clip(data.m, MAX_NOTE_LENGTH) : "",
    names,
    forbidden,
    seed,
  };
}

/** The link to share: this page's address with only the event in it. */
export function buildShareUrl(pageUrl, event) {
  const url = new URL(pageUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set(EVENT_PARAM, encodeEvent(event));
  return url.toString();
}

/** Read the event out of `location.search`, or null when there is none. */
export function readEventFromSearch(search) {
  return decodeEvent(new URLSearchParams(search).get(EVENT_PARAM));
}

/** Lower case with no accents, so "Núria" and "nuria" count as one name. */
export function nameKey(name) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Turn typed or pasted text into new names. Splits on commas, semicolons and
 * new lines, trims, cuts long names, and drops repeats and names in `existing`.
 */
export function cleanNames(text, existing = []) {
  const seen = new Set(existing.map(nameKey));
  const result = [];
  for (const part of text.split(/[,;\n]/)) {
    const name = part.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
    const key = nameKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}
