// Tests for the link: the whole event lives in one URL parameter.
//
// The link carries the names, the forbidden pairs and the seed, never the
// result. Each phone works the result out again from those three.

import { describe, expect, test } from "bun:test";
import { encodeEvent, decodeEvent, buildShareUrl, readEventFromSearch, cleanNames } from "./urlState.js";

const EVENT = {
  title: "Nadal 2026 🎄",
  names: ["Anna", "Bernat", "Carla", "Jürgen", "Núria"],
  forbidden: [[0, 1], [1, 0], [3, 4]],
  seed: "abc12345",
};

describe("encodeEvent and decodeEvent", () => {
  test("round-trip an event, accents and emoji included", () => {
    expect(decodeEvent(encodeEvent(EVENT))).toEqual(EVENT);
  });

  test("write URL-safe text only", () => {
    expect(encodeEvent(EVENT)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("keep an empty title", () => {
    expect(decodeEvent(encodeEvent({ ...EVENT, title: "" })).title).toBe("");
  });

  test("return null for text that is not an event", () => {
    expect(decodeEvent("")).toBeNull();
    expect(decodeEvent("%%%")).toBeNull();
    expect(decodeEvent("aGVsbG8")).toBeNull(); // "hello"
    expect(decodeEvent(null)).toBeNull();
  });

  test("drop forbidden pairs that point outside the list or at oneself", () => {
    const raw = encodeEvent({ ...EVENT, forbidden: [[0, 1], [0, 9], [2, 2], [-1, 0]] });
    expect(decodeEvent(raw).forbidden).toEqual([[0, 1]]);
  });

  test("refuse an event with fewer than two names or no seed", () => {
    expect(decodeEvent(encodeEvent({ ...EVENT, names: ["Anna"] }))).toBeNull();
    expect(decodeEvent(encodeEvent({ ...EVENT, seed: "" }))).toBeNull();
  });
});

describe("buildShareUrl and readEventFromSearch", () => {
  test("put the event in the e parameter and read it back", () => {
    const url = buildShareUrl("https://triunitystudios.com/web-projects/secret-santa/?x=1#top", EVENT);
    expect(url.startsWith("https://triunitystudios.com/web-projects/secret-santa/?e=")).toBe(true);
    expect(readEventFromSearch(new URL(url).search)).toEqual(EVENT);
  });

  test("read nothing from a link without an event", () => {
    expect(readEventFromSearch("")).toBeNull();
    expect(readEventFromSearch("?e=broken")).toBeNull();
  });
});

describe("cleanNames", () => {
  test("splits pasted text on commas and new lines, and trims", () => {
    expect(cleanNames("Anna, Bernat\n  Carla \n\n;David")).toEqual(["Anna", "Bernat", "Carla", "David"]);
  });

  test("drops repeats, ignoring case and accents", () => {
    expect(cleanNames("Núria, nuria, NURIA, Pau", [])).toEqual(["Núria", "Pau"]);
  });

  test("drops names already in the list", () => {
    expect(cleanNames("Anna, Pau", ["anna"])).toEqual(["Pau"]);
  });

  test("cuts very long names", () => {
    expect(cleanNames("x".repeat(100))[0].length).toBe(40);
  });
});
