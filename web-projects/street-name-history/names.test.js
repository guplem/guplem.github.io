import { describe, test, expect } from "bun:test";
import {
  classifyNameTag,
  languageLabel,
  formatPeriod,
  extractNames,
  collectWikidataIds,
} from "./names.js";

describe("classifyNameTag", () => {
  test("classifies the plain name key as the primary role", () => {
    expect(classifyNameTag("name")).toEqual({ role: "primary", lang: null, period: null, variant: null });
  });

  test("classifies a language-qualified name", () => {
    expect(classifyNameTag("name:ca")).toEqual({ role: "primary", lang: "ca", period: null, variant: null });
  });

  test("classifies a script/region-qualified language", () => {
    expect(classifyNameTag("name:zh-Hant").lang).toBe("zh-Hant");
    expect(classifyNameTag("name:be-tarask").lang).toBe("be-tarask");
  });

  test("classifies former names with and without a language", () => {
    expect(classifyNameTag("old_name").role).toBe("old");
    expect(classifyNameTag("old_name:de")).toEqual({ role: "old", lang: "de", period: null, variant: null });
  });

  test("reads a date period on old_name as a period, not a language", () => {
    expect(classifyNameTag("old_name:1930-1945")).toEqual({ role: "old", lang: null, period: "1930-1945", variant: null });
    expect(classifyNameTag("old_name:1990")).toEqual({ role: "old", lang: null, period: "1990", variant: null });
    expect(classifyNameTag("old_name:1930-")).toEqual({ role: "old", lang: null, period: "1930-", variant: null });
  });

  test("classifies etymology keys specially", () => {
    expect(classifyNameTag("name:etymology").role).toBe("etymology");
    expect(classifyNameTag("name:etymology:wikidata").role).toBe("etymology-wikidata");
  });

  test("classifies the other naming roles", () => {
    expect(classifyNameTag("official_name").role).toBe("official");
    expect(classifyNameTag("int_name").role).toBe("international");
    expect(classifyNameTag("nat_name").role).toBe("national");
    expect(classifyNameTag("reg_name").role).toBe("regional");
    expect(classifyNameTag("loc_name").role).toBe("local");
    expect(classifyNameTag("short_name").role).toBe("short");
    expect(classifyNameTag("alt_name").role).toBe("alternate");
    expect(classifyNameTag("nickname").role).toBe("nickname");
  });

  test("treats a non-language, non-period suffix as a variant", () => {
    expect(classifyNameTag("name:left")).toEqual({ role: "primary", lang: null, period: null, variant: "left" });
    expect(classifyNameTag("name:source")).toEqual({ role: "primary", lang: null, period: null, variant: "source" });
  });

  test("returns null for keys that are not names we surface", () => {
    expect(classifyNameTag("highway")).toBe(null);
    expect(classifyNameTag("surface")).toBe(null);
    expect(classifyNameTag("wikidata")).toBe(null);
  });
});

describe("languageLabel", () => {
  test("returns the English name of a language code", () => {
    expect(languageLabel("ca")).toBe("Catalan");
    expect(languageLabel("es")).toBe("Spanish");
    expect(languageLabel("de")).toBe("German");
  });

  test("falls back to the raw code for an unknown code", () => {
    expect(languageLabel("qqq")).toBe("qqq");
  });

  test("returns null for an empty code", () => {
    expect(languageLabel("")).toBe(null);
    expect(languageLabel(null)).toBe(null);
  });
});

describe("formatPeriod", () => {
  test("formats a year range with an en dash", () => {
    expect(formatPeriod("1930-1945")).toBe("1930–1945");
  });

  test("formats an open-ended range as 'since'", () => {
    expect(formatPeriod("1930-")).toBe("since 1930");
  });

  test("returns a single year unchanged", () => {
    expect(formatPeriod("1990")).toBe("1990");
  });

  test("returns null for empty input", () => {
    expect(formatPeriod(null)).toBe(null);
  });
});

describe("extractNames", () => {
  const tags = {
    name: "Passeig de Gràcia",
    "name:ca": "Passeig de Gràcia",
    "name:es": "Paseo de Gracia",
    "name:en": "Passeig de Gràcia",
    old_name: "Passeig de Gràcia",
    "old_name:1900-1931": "Passeig de Gràcia",
    "old_name:1939-1979": "Avenida del Generalísimo Franco",
    official_name: "Passeig de Gràcia",
    wikidata: "Q1165642",
    "name:etymology": "the town of Gràcia",
    "name:etymology:wikidata": "Q13410",
    highway: "primary", // ignored
  };

  test("splits current, historical, and etymology buckets", () => {
    const r = extractNames(tags);
    expect(r.current.some((e) => e.role === "primary" && !e.lang)).toBe(true);
    expect(r.historical.length).toBe(3);
    expect(r.etymology.text).toBe("the town of Gràcia");
    expect(r.etymology.wikidata).toBe("Q13410");
    expect(r.wikidata).toBe("Q1165642");
  });

  test("attaches language labels to language-qualified names", () => {
    const es = extractNames(tags).current.find((e) => e.lang === "es");
    expect(es.langLabel).toBe("Spanish");
    expect(es.value).toBe("Paseo de Gracia");
  });

  test("counts distinct languages", () => {
    expect(extractNames(tags).languageCount).toBe(3); // ca, es, en
  });

  test("orders the primary unqualified name first", () => {
    expect(extractNames(tags).current[0].role).toBe("primary");
    expect(extractNames(tags).current[0].lang).toBe(null);
  });

  test("sorts historical entries by starting year, dated before undated", () => {
    const h = extractNames(tags).historical;
    expect(h[0].period).toBe("1900-1931");
    expect(h[1].period).toBe("1939-1979");
    expect(h[2].period).toBe(null); // the plain old_name, undated, sinks last
    expect(h[0].periodLabel).toBe("1900–1931");
  });

  test("flags whether any history exists", () => {
    expect(extractNames(tags).hasHistory).toBe(true);
    expect(extractNames({ name: "Main Street" }).hasHistory).toBe(false);
  });

  test("ignores empty values and non-name tags", () => {
    const r = extractNames({ name: "X", "name:fr": "", highway: "residential", surface: "asphalt" });
    expect(r.current.length).toBe(1);
    expect(r.current[0].value).toBe("X");
  });

  test("tolerates an empty or missing tag bag", () => {
    expect(extractNames({}).current).toEqual([]);
    expect(extractNames(null).current).toEqual([]);
  });

  test("ignores an invalid etymology wikidata id", () => {
    expect(extractNames({ name: "X", "name:etymology:wikidata": "notaqid" }).etymology.wikidata).toBe(null);
  });
});

describe("collectWikidataIds", () => {
  test("collects the street and etymology QIDs", () => {
    expect(collectWikidataIds({ wikidata: "Q1", "name:etymology:wikidata": "Q2" })).toEqual(["Q1", "Q2"]);
  });

  test("de-duplicates and drops invalid ids", () => {
    expect(collectWikidataIds({ wikidata: "Q1", "name:etymology:wikidata": "Q1" })).toEqual(["Q1"]);
    expect(collectWikidataIds({ wikidata: "banana" })).toEqual([]);
  });

  test("returns an empty array for no tags", () => {
    expect(collectWikidataIds({})).toEqual([]);
    expect(collectWikidataIds(null)).toEqual([]);
  });
});
