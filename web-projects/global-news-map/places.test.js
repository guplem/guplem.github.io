import { describe, expect, test } from "bun:test";
import {
  buildCountryIndex,
  buildGeoIndex,
  chunk,
  collectTitles,
  choosePlace,
  countryName,
  locateStories,
  pinsWithGroupFirst,
  placeLabel,
  placeScale,
} from "./places.js";

/** A story with only the fields the place picker reads. */
const story = (links, topicLinks = []) => ({
  id: links.join("-") || "empty",
  text: "text",
  category: "c",
  topics: [],
  sources: [],
  links,
  topicLinks,
});

/** The shape `buildGeoIndex` produces, written directly for the picker's tests. */
const index = (entries) => new Map(Object.entries(entries));

describe("placeScale", () => {
  // `dim` is the size of the thing in metres, so a smaller one is more specific.
  test("a town scores smaller than the country holding it", () => {
    expect(placeScale({ dim: 10000, type: "city" })).toBeLessThan(placeScale({ dim: 1000000, type: "country" }));
  });

  // Wikipedia sometimes stores a tiny `dim` on a country. Its type has to win, or
  // a story about a town gets pinned to the middle of the country instead.
  test("a country never scores as specific, whatever its dim says", () => {
    expect(placeScale({ dim: 1000, type: "country" })).toBeGreaterThan(placeScale({ dim: 10000, type: "city" }));
  });

  test("a missing dim and a missing type still give a usable number", () => {
    expect(Number.isFinite(placeScale({}))).toBe(true);
    expect(Number.isFinite(placeScale({ dim: null, type: null }))).toBe(true);
  });
});

describe("choosePlace", () => {
  test("picks the most specific place mentioned in the sentence", () => {
    const geo = index({
      Sudan: { title: "Sudan", lat: 15, lon: 32, dim: 1000000, type: "country" },
      "Barah, Sudan": { title: "Barah, Sudan", lat: 13.69, lon: 30.37, dim: 10000, type: "city" },
    });
    expect(choosePlace(story(["Sudan", "Rapid Support Forces", "Barah, Sudan"]), geo).title).toBe("Barah, Sudan");
  });

  test("ignores a link that has no coordinates", () => {
    const geo = index({ Belgorod: { title: "Belgorod", lat: 50.6, lon: 36.6, dim: 1000, type: null } });
    const chosen = choosePlace(story(["Rocket launcher", "Belgorod", "Islamic Revolutionary Guard Corps"]), geo);
    expect(chosen.title).toBe("Belgorod");
  });

  // The sentence is what the story is about. A topic trail like "2026 Iran war"
  // is broader, so it is only worth using when the sentence names no place.
  test("falls back to the topic trail only when the sentence has no place", () => {
    const geo = index({
      Iran: { title: "Iran", lat: 32, lon: 53, dim: 1000000, type: "country" },
      Belgorod: { title: "Belgorod", lat: 50.6, lon: 36.6, dim: 1000, type: null },
    });
    expect(choosePlace(story(["Rocket launcher"], ["Iran"]), geo).title).toBe("Iran");
    expect(choosePlace(story(["Belgorod"], ["Iran"]), geo).title).toBe("Belgorod");
  });

  test("returns null when nothing in the story is a place", () => {
    expect(choosePlace(story(["Rocket launcher", "Inflation"]), index({}))).toBeNull();
  });

  test("keeps the earlier mention when two places are the same size", () => {
    const geo = index({
      Cyprus: { title: "Cyprus", lat: 35, lon: 33, dim: 100000, type: "isle" },
      Turkey: { title: "Turkey", lat: 39, lon: 35, dim: 100000, type: "isle" },
    });
    expect(choosePlace(story(["Cyprus", "Turkey"]), geo).title).toBe("Cyprus");
  });

  test("refuses a coordinate that is not on Earth", () => {
    const geo = index({ Nowhere: { title: "Nowhere", lat: 999, lon: 0, dim: 100, type: null } });
    expect(choosePlace(story(["Nowhere"]), geo)).toBeNull();
  });
});

describe("collectTitles", () => {
  test("gathers every candidate once, across all the stories", () => {
    const titles = collectTitles([story(["A", "B"]), story(["B", "C"], ["D"])]);
    expect(titles).toEqual(["A", "B", "C", "D"]);
  });

  test("asks about the sentence links before the topic links", () => {
    const titles = collectTitles([story(["Sentence"], ["Topic"])]);
    expect(titles.indexOf("Sentence")).toBeLessThan(titles.indexOf("Topic"));
  });
});

describe("chunk", () => {
  // The API takes at most 50 titles in one request.
  test("splits a long list into request-sized pieces", () => {
    const titles = Array.from({ length: 120 }, (unused, i) => `T${i}`);
    const pieces = chunk(titles, 50);
    expect(pieces.map((p) => p.length)).toEqual([50, 50, 20]);
    expect(pieces.flat()).toEqual(titles);
  });

  test("gives nothing back for an empty list", () => {
    expect(chunk([], 50)).toEqual([]);
  });
});

describe("buildGeoIndex", () => {
  const response = {
    query: {
      normalized: [{ from: "barah, sudan", to: "Barah, Sudan" }],
      redirects: [{ from: "US military", to: "United States Armed Forces" }],
      pages: {
        123: {
          title: "Barah, Sudan",
          coordinates: [{ lat: 13.69, lon: 30.37, dim: 10000, type: "city", primary: "" }],
        },
        456: { title: "United States Armed Forces" },
        789: { title: "Belgorod", coordinates: [{ lat: 50.6, lon: 36.6 }] },
      },
    },
  };

  test("maps a title to its coordinates", () => {
    const geo = buildGeoIndex([response]);
    expect(geo.get("Belgorod")).toMatchObject({ lat: 50.6, lon: 36.6 });
  });

  // Wikipedia answers under the title it prefers, so the title we asked about has
  // to be led back to the answer or every renamed place silently loses its pin.
  test("follows a normalization back to the title we asked about", () => {
    const geo = buildGeoIndex([response]);
    expect(geo.get("barah, sudan")).toMatchObject({ lat: 13.69 });
    expect(geo.get("Barah, Sudan")).toMatchObject({ lat: 13.69 });
  });

  test("leaves out a page that carries no coordinates", () => {
    const geo = buildGeoIndex([response]);
    expect(geo.has("United States Armed Forces")).toBe(false);
    expect(geo.has("US military")).toBe(false);
  });

  // Wikipedia's own `country` field is deliberately ignored. It is editor-supplied
  // and wrong in ways that show: it tags the article "Turkey" as a city and would
  // have the page print "Turkey, Türkiye". `dataSource.js` asks Wikidata instead,
  // for every place, so one source answers and countries are excluded in the query.
  test("ignores Wikipedia's own country field, leaving the country for Wikidata", () => {
    const withCountry = {
      query: { pages: { 1: { title: "Ketapang", coordinates: [{ lat: -1.85, lon: 109.98, country: "ID" }] } } },
    };
    expect(buildGeoIndex([withCountry]).get("Ketapang").country).toBeNull();
  });

  test("starts every place with no country rather than dropping it", () => {
    const geo = buildGeoIndex([response]);
    expect(geo.get("Belgorod").country).toBeNull();
    expect(geo.has("Belgorod")).toBe(true);
  });

  test("merges every response into one index", () => {
    const other = { query: { pages: { 1: { title: "Niger", coordinates: [{ lat: 16, lon: 8 }] } } } };
    const geo = buildGeoIndex([response, other]);
    expect(geo.has("Belgorod")).toBe(true);
    expect(geo.has("Niger")).toBe(true);
  });

  test("survives an empty, failed or partial response", () => {
    expect(buildGeoIndex([]).size).toBe(0);
    expect(buildGeoIndex([{}, null, { query: {} }, { query: { pages: {} } }]).size).toBe(0);
  });
});

describe("locateStories", () => {
  const geo = index({
    Belgorod: { title: "Belgorod", lat: 50.6, lon: 36.6, dim: 1000, type: null },
    Niger: { title: "Niger", lat: 16, lon: 8, dim: 1000000, type: "country" },
  });

  test("gives back a pin per story it could place, and says which it could not", () => {
    const located = locateStories([story(["Belgorod"]), story(["Niger"]), story(["Inflation"])], geo);
    expect(located.pins).toHaveLength(2);
    expect(located.unplaced).toHaveLength(1);
    expect(located.pins[0]).toMatchObject({ lat: 50.6, lon: 36.6 });
    expect(located.pins[0].story.id).toBe("Belgorod");
  });

  test("counts nothing twice", () => {
    const stories = [story(["Belgorod"]), story(["Niger"]), story(["Inflation"])];
    const located = locateStories(stories, geo);
    expect(located.pins.length + located.unplaced.length).toBe(stories.length);
  });
});

describe("countryName", () => {
  test("names a country from its ISO code", () => {
    expect(countryName("FR", "en")).toBe("France");
    expect(countryName("RU", "en")).toBe("Russia");
  });

  // The whole reason the code is carried rather than a name: one lookup path
  // gives every country its name in the language the page is being read in.
  test("names it in the language asked for", () => {
    expect(countryName("FR", "es")).toBe("Francia");
    expect(countryName("GB", "es")).toBe("Reino Unido");
  });

  test("gives nothing back for a code it cannot use, rather than throwing", () => {
    for (const bad of ["", null, undefined, "F", "FRA", "fr!", 42, "nonsense"]) {
      expect(countryName(bad, "en")).toBe("");
    }
  });

  test("falls back to English when the language is unknown", () => {
    expect(countryName("FR", "zz-nonsense")).toBe("France");
  });
});

describe("placeLabel", () => {
  test("writes the place and then its country", () => {
    expect(placeLabel({ title: "Caen", country: "FR" }, "en")).toBe("Caen, France");
    expect(placeLabel({ title: "Caen", country: "FR" }, "es")).toBe("Caen, Francia");
  });

  // "Niger, Niger" reads as a mistake. A country is already its own country.
  test("does not repeat a country after itself", () => {
    expect(placeLabel({ title: "Niger", country: "NE", type: "country" }, "en")).toBe("Niger");
    expect(placeLabel({ title: "Japan", country: "JP" }, "en")).toBe("Japan");
  });

  test("leaves the place alone when no country is known", () => {
    expect(placeLabel({ title: "Strait of Hormuz" }, "en")).toBe("Strait of Hormuz");
    expect(placeLabel({ title: "Belgorod", country: null }, "en")).toBe("Belgorod");
  });

  // The title is always in English, but the country name follows the page. Compare
  // against both, or Spanish prints "Barah, Sudan, Sudán".
  test("does not repeat a country the title already ends with, in either language", () => {
    expect(placeLabel({ title: "Barah, Sudan", country: "SD" }, "en")).toBe("Barah, Sudan");
    expect(placeLabel({ title: "Barah, Sudan", country: "SD" }, "es")).toBe("Barah, Sudan");
  });

  test("still appends when the title's last part is a region, not the country", () => {
    expect(placeLabel({ title: "Kure, Hiroshima", country: "JP" }, "en")).toBe("Kure, Hiroshima, Japan");
    expect(placeLabel({ title: "Kure, Hiroshima", country: "JP" }, "es")).toBe("Kure, Hiroshima, Japón");
  });

  // These two are what the live run got wrong. The query now excludes countries,
  // so they arrive with no code at all; this pins the outcome either way.
  test("never writes a country after a country, whatever it is called", () => {
    expect(placeLabel({ title: "Turkey", country: null }, "en")).toBe("Turkey");
    expect(placeLabel({ title: "Jordan", country: null }, "es")).toBe("Jordan");
    // Belt and braces: even if a code did arrive, the name must not double up.
    expect(placeLabel({ title: "Jordan", country: "JO", type: "country" }, "es")).toBe("Jordan");
  });

  test("survives a place with no title at all", () => {
    expect(placeLabel({}, "en")).toBe("");
    expect(placeLabel(null, "en")).toBe("");
  });
});

describe("buildCountryIndex", () => {
  const response = {
    results: {
      bindings: [
        { title: { value: "Caen" }, code: { value: "FR" } },
        { title: { value: "Belgorod" }, code: { value: "RU" } },
        // A strait touches three countries, so naming one of them would be wrong.
        { title: { value: "Strait of Hormuz" }, code: { value: "IR" } },
        { title: { value: "Strait of Hormuz" }, code: { value: "OM" } },
        { title: { value: "Strait of Hormuz" }, code: { value: "AE" } },
      ],
    },
  };

  test("maps a title to its country code", () => {
    const index = buildCountryIndex(response);
    expect(index.get("Caen")).toBe("FR");
    expect(index.get("Belgorod")).toBe("RU");
  });

  // Better to say nothing than to pick one of three arbitrarily.
  test("leaves out a place that spans more than one country", () => {
    expect(buildCountryIndex(response).has("Strait of Hormuz")).toBe(false);
  });

  test("keeps a title repeated with the same country once", () => {
    const repeated = {
      results: { bindings: [
        { title: { value: "Caen" }, code: { value: "FR" } },
        { title: { value: "Caen" }, code: { value: "FR" } },
      ] },
    };
    expect(buildCountryIndex(repeated).get("Caen")).toBe("FR");
  });

  test("survives an empty, failed or malformed answer", () => {
    expect(buildCountryIndex(null).size).toBe(0);
    expect(buildCountryIndex({}).size).toBe(0);
    expect(buildCountryIndex({ results: {} }).size).toBe(0);
    expect(buildCountryIndex({ results: { bindings: [{}, { title: {} }] } }).size).toBe(0);
  });
});

describe("pinsWithGroupFirst", () => {
  const pins = ["a", "b", "c", "d", "e"].map((id) => ({ story: { id } }));
  const ids = (list) => list.map((pin) => pin.story.id);

  test("brings the chosen group to the top, together", () => {
    expect(ids(pinsWithGroupFirst(pins, ["c", "e"]))).toEqual(["c", "e", "a", "b", "d"]);
  });

  // The reader is looking at a list; a group that keeps the list's own order is
  // easier to follow than one shuffled into the marker's internal order.
  test("keeps the list's own order inside the group and outside it", () => {
    expect(ids(pinsWithGroupFirst(pins, ["e", "c"]))).toEqual(["c", "e", "a", "b", "d"]);
  });

  test("changes nothing when no group is chosen", () => {
    expect(ids(pinsWithGroupFirst(pins, []))).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids(pinsWithGroupFirst(pins, null))).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("ignores an id that is not in the list", () => {
    expect(ids(pinsWithGroupFirst(pins, ["c", "missing"]))).toEqual(["c", "a", "b", "d", "e"]);
  });

  test("never loses or duplicates a story", () => {
    for (const group of [[], ["a"], ["a", "e"], ["a", "b", "c", "d", "e"]]) {
      const out = pinsWithGroupFirst(pins, group);
      expect(out).toHaveLength(pins.length);
      expect(new Set(ids(out)).size).toBe(pins.length);
    }
  });

  test("leaves the original list untouched", () => {
    const before = ids(pins);
    pinsWithGroupFirst(pins, ["e"]);
    expect(ids(pins)).toEqual(before);
  });
});
