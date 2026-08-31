import { describe, expect, test } from "bun:test";
import { buildSearch, readState } from "./urlState.js";

const NOW = new Date("2026-08-31T12:00:00Z");

describe("readState", () => {
  test("reads the day, the story and the language", () => {
    expect(readState("?day=2026-08-30&story=a-strike-on-belgorod&lang=es", NOW)).toEqual({
      day: "2026-08-30",
      story: "a-strike-on-belgorod",
      lang: "es",
    });
  });

  test("gives nulls for an empty address", () => {
    expect(readState("", NOW)).toEqual({ day: null, story: null, lang: null });
    expect(readState(undefined, NOW)).toEqual({ day: null, story: null, lang: null });
  });

  test("drops a day that is not a real date", () => {
    for (const bad of ["", "yesterday", "2026-02-31", "2026-13-02", "30-08-2026"]) {
      expect(readState(`?day=${encodeURIComponent(bad)}`, NOW).day).toBeNull();
    }
  });

  // Wikipedia cannot have news for a day that has not happened.
  test("drops a day in the future", () => {
    expect(readState("?day=2027-01-01", NOW).day).toBeNull();
    expect(readState("?day=2026-08-31", NOW).day).toBe("2026-08-31");
  });

  test("drops a language the page does not speak", () => {
    expect(readState("?lang=de", NOW).lang).toBeNull();
    expect(readState("?lang=es", NOW).lang).toBe("es");
  });

  // A story id is only ever produced by our own slug function, so anything with
  // other characters in it was written by hand and is not trusted.
  test("drops a story id that we could not have written", () => {
    for (const bad of ["<script>", "a story", "UPPER", "../etc", "-leading", "x".repeat(200)]) {
      expect(readState(`?story=${encodeURIComponent(bad)}`, NOW).story).toBeNull();
    }
  });

  test("keeps the ids the parser really produces", () => {
    for (const good of ["a-ukrainian-missile-strike-on-belgorod", "story", "niger-s-army-says-2"]) {
      expect(readState(`?story=${good}`, NOW).story).toBe(good);
    }
  });
});

describe("buildSearch", () => {
  test("writes the parts that are worth recording", () => {
    expect(buildSearch({ day: "2026-08-30", story: "a-strike", lang: "es" })).toBe(
      "?day=2026-08-30&story=a-strike&lang=es",
    );
  });

  test("leaves out the starting language, to keep a link short", () => {
    expect(buildSearch({ day: "2026-08-30", lang: "en" })).toBe("?day=2026-08-30");
  });

  test("writes nothing at all when there is nothing to record", () => {
    expect(buildSearch({})).toBe("");
    expect(buildSearch(null)).toBe("");
  });

  test("refuses to write a day or a story it would not read back", () => {
    expect(buildSearch({ day: "not-a-day", story: "has spaces" })).toBe("");
  });
});

describe("a link survives a round trip", () => {
  test("what is written is what is read", () => {
    for (const state of [
      { day: "2026-08-30", story: "a-strike", lang: "es" },
      { day: "2001-09-11", story: null, lang: null },
      { day: "2026-08-30", story: "story-2", lang: "en" },
    ]) {
      const back = readState(buildSearch(state), NOW);
      expect(back.day).toBe(state.day);
      expect(back.story).toBe(state.story);
      // English is the starting language, so it is deliberately not written down.
      expect(back.lang).toBe(state.lang === "en" ? null : state.lang);
    }
  });
});
