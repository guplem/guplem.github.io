import { describe, test, expect } from "bun:test";
import {
  buildNominatimUrl,
  isStreetLike,
  parseNominatimResults,
  buildWikidataUrl,
  formatWikidataTime,
  parseWikidataEntities,
  pickBest,
  buildOhmQuery,
  parseOhmTimeline,
} from "./sources.js";

describe("buildNominatimUrl", () => {
  test("requests the enrichment fields the app depends on", () => {
    const url = buildNominatimUrl("Balmes Barcelona");
    expect(url).toContain("nominatim.openstreetmap.org/search");
    expect(url).toContain("format=jsonv2");
    expect(url).toContain("namedetails=1");
    expect(url).toContain("extratags=1");
    expect(url).toContain("addressdetails=1");
    expect(url).toContain("q=Balmes+Barcelona");
  });

  test("honors a custom limit and accept-language", () => {
    const url = buildNominatimUrl("x", { limit: 3, acceptLanguage: "ca" });
    expect(url).toContain("limit=3");
    expect(url).toContain("accept-language=ca");
  });
});

describe("isStreetLike", () => {
  test("accepts highway category and known street types", () => {
    expect(isStreetLike({ category: "highway", type: "residential" })).toBe(true);
    expect(isStreetLike({ category: "place", type: "pedestrian" })).toBe(true);
  });

  test("rejects non-streets", () => {
    expect(isStreetLike({ category: "amenity", type: "cafe" })).toBe(false);
    expect(isStreetLike(null)).toBe(false);
  });
});

describe("parseNominatimResults", () => {
  const raw = [
    {
      osm_type: "node", osm_id: 5, display_name: "Cafe Balmes", lat: "41.1", lon: "2.1",
      category: "amenity", type: "cafe", importance: 0.9, namedetails: { name: "Cafe Balmes" },
    },
    {
      osm_type: "way", osm_id: 7, display_name: "Carrer de Balmes, Barcelona", lat: "41.2", lon: "2.2",
      category: "highway", type: "residential", importance: 0.4,
      namedetails: { name: "Carrer de Balmes", "name:es": "Calle de Balmes" },
      extratags: { wikidata: "Q123" },
    },
  ];

  test("sorts street-like candidates ahead of POIs despite lower importance", () => {
    const out = parseNominatimResults(raw);
    expect(out[0].osmId).toBe(7);
    expect(out[0].category).toBe("highway");
  });

  test("merges namedetails and extratags into one tag bag", () => {
    const street = parseNominatimResults(raw).find((c) => c.osmId === 7);
    expect(street.tags.name).toBe("Carrer de Balmes");
    expect(street.tags["name:es"]).toBe("Calle de Balmes");
    expect(street.tags.wikidata).toBe("Q123");
  });

  test("builds an osm ref and numeric coordinates", () => {
    const street = parseNominatimResults(raw).find((c) => c.osmId === 7);
    expect(street.ref).toBe("way/7");
    expect(street.lat).toBeCloseTo(41.2);
    expect(street.lon).toBeCloseTo(2.2);
  });

  test("tolerates non-array input", () => {
    expect(parseNominatimResults(null)).toEqual([]);
    expect(parseNominatimResults({})).toEqual([]);
  });
});

describe("buildWikidataUrl", () => {
  test("builds a wbgetentities URL with CORS origin", () => {
    const url = buildWikidataUrl(["Q1", "Q2"]);
    expect(url).toContain("wikidata.org/w/api.php");
    expect(url).toContain("action=wbgetentities");
    expect(url).toContain("ids=Q1%7CQ2"); // Q1|Q2
    expect(url).toContain("origin=*"); // required for anonymous CORS
  });

  test("de-duplicates and drops invalid ids", () => {
    expect(buildWikidataUrl(["Q1", "Q1", "junk"])).toContain("ids=Q1");
  });

  test("returns null when there are no valid ids", () => {
    expect(buildWikidataUrl([])).toBe(null);
    expect(buildWikidataUrl(["nope"])).toBe(null);
  });
});

describe("parseWikidataEntities / formatWikidataTime / pickBest", () => {
  const json = {
    entities: {
      Q123: {
        labels: { en: { value: "Balmes Street" }, ca: { value: "Carrer de Balmes" } },
        descriptions: { en: { value: "a street in Barcelona" } },
        claims: {
          P138: [{ mainsnak: { datavalue: { value: { id: "Q456" } } } }],
          P571: [{ mainsnak: { datavalue: { value: { time: "+1863-01-01T00:00:00Z" } } } }],
        },
      },
      Q999: { missing: "" },
    },
  };

  test("extracts labels, descriptions, named-after, and inception", () => {
    const out = parseWikidataEntities(json);
    expect(out.Q123.labels.ca).toBe("Carrer de Balmes");
    expect(out.Q123.descriptions.en).toBe("a street in Barcelona");
    expect(out.Q123.namedAfter).toEqual(["Q456"]);
    expect(out.Q123.inception).toBe("1863");
  });

  test("marks missing entities", () => {
    expect(parseWikidataEntities(json).Q999.missing).toBe(true);
  });

  test("formatWikidataTime returns the year of a time claim", () => {
    expect(formatWikidataTime(json.entities.Q123, "P571")).toBe("1863");
    expect(formatWikidataTime(json.entities.Q123, "P000")).toBe(null);
  });

  test("pickBest prefers the viewer's language, then English, then anything", () => {
    const labels = { en: "English", ca: "Català", fr: "Français" };
    expect(pickBest(labels, ["ca"]).value).toBe("Català");
    expect(pickBest(labels, ["de"]).value).toBe("English");
    expect(pickBest({ fr: "Français" }, ["de"]).value).toBe("Français");
    expect(pickBest(null)).toBe(null);
  });
});

describe("buildOhmQuery", () => {
  test("embeds the coordinates and a bounded result count", () => {
    const q = buildOhmQuery(41.39, 2.16);
    expect(q).toContain("41.39");
    expect(q).toContain("2.16");
    expect(q).toContain("around:");
    expect(q).toContain("out tags center 40;");
  });

  test("returns null for invalid coordinates", () => {
    expect(buildOhmQuery(NaN, 2)).toBe(null);
    expect(buildOhmQuery("x", "y")).toBe(null);
  });
});

describe("parseOhmTimeline", () => {
  const json = {
    elements: [
      { type: "way", tags: { name: "Avinguda Nova", start_date: "1980", end_date: "2000" } },
      { type: "way", tags: { name: "Avinguda Vella", start_date: "1900", end_date: "1980" } },
      { type: "way", tags: { name: "Avinguda Nova", start_date: "1980", end_date: "2000" } }, // dup
      { type: "way", tags: { old_name: "Camí Antic" } },
      { type: "way", tags: { highway: "residential" } }, // no name -> dropped
    ],
  };

  test("de-duplicates and sorts chronologically by start date", () => {
    const rows = parseOhmTimeline(json);
    expect(rows.map((r) => r.name)).toEqual(["Avinguda Vella", "Avinguda Nova", "Camí Antic"]);
  });

  test("flags rows that came only from an old_name", () => {
    const camiAntic = parseOhmTimeline(json).find((r) => r.name === "Camí Antic");
    expect(camiAntic.wasOld).toBe(true);
  });

  test("tolerates missing elements", () => {
    expect(parseOhmTimeline(null)).toEqual([]);
    expect(parseOhmTimeline({})).toEqual([]);
  });
});
