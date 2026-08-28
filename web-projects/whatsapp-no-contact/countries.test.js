import { describe, test, expect } from "bun:test";
import {
  COUNTRIES,
  flagEmoji,
  findByIso2,
  findByDial,
  searchCountries,
  splitDialCode,
  regionFromLocale,
} from "./countries.js";

describe("COUNTRIES data integrity", () => {
  test("holds a substantial list", () => {
    expect(COUNTRIES.length).toBeGreaterThan(180);
  });

  test("every entry has a name, an ISO 3166-1 alpha-2 code and a numeric dial code", () => {
    for (const country of COUNTRIES) {
      expect(typeof country.name).toBe("string");
      expect(country.name.length).toBeGreaterThan(1);
      expect(country.iso2).toMatch(/^[A-Z]{2}$/);
      expect(country.dial).toMatch(/^[1-9][0-9]{0,3}$/);
    }
  });

  test("has no duplicate ISO codes", () => {
    const codes = COUNTRIES.map((c) => c.iso2);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test("is sorted by name so the selector list never needs sorting at runtime", () => {
    const names = COUNTRIES.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en"));
    expect(names).toEqual(sorted);
  });

  test("marks exactly one primary country per shared dial code", () => {
    // Several countries share a dial code (+1, +7, +39, +44). Each such group
    // needs one primary so a pasted number resolves to a single country.
    const byDial = new Map();
    for (const country of COUNTRIES) {
      if (!byDial.has(country.dial)) byDial.set(country.dial, []);
      byDial.get(country.dial).push(country);
    }
    for (const [dial, group] of byDial) {
      const primaries = group.filter((c) => c.primary === true);
      if (group.length > 1) {
        expect(primaries).toHaveLength(1);
      } else {
        expect(primaries).toHaveLength(0);
        expect(dial).toBe(group[0].dial);
      }
    }
  });

  test("includes the countries used across the rest of the tests", () => {
    expect(findByIso2("ES")).toMatchObject({ name: "Spain", dial: "34" });
    expect(findByIso2("US")).toMatchObject({ dial: "1", primary: true });
    expect(findByIso2("GB")).toMatchObject({ name: "United Kingdom", dial: "44" });
    expect(findByIso2("IT")).toMatchObject({ name: "Italy", dial: "39" });
    expect(findByIso2("JM")).toMatchObject({ name: "Jamaica", dial: "1876" });
  });
});

describe("flagEmoji", () => {
  test("builds the flag from regional indicator symbols", () => {
    expect(flagEmoji("ES")).toBe("\u{1F1EA}\u{1F1F8}");
    expect(flagEmoji("US")).toBe("\u{1F1FA}\u{1F1F8}");
  });

  test("accepts lowercase input", () => {
    expect(flagEmoji("es")).toBe(flagEmoji("ES"));
  });

  test("returns an empty string for anything that is not a two-letter code", () => {
    expect(flagEmoji("")).toBe("");
    expect(flagEmoji("ESP")).toBe("");
    expect(flagEmoji(null)).toBe("");
    expect(flagEmoji(42)).toBe("");
  });
});

describe("findByIso2", () => {
  test("finds a country regardless of case", () => {
    expect(findByIso2("de").name).toBe("Germany");
  });

  test("returns null when no country matches", () => {
    expect(findByIso2("ZZ")).toBeNull();
    expect(findByIso2(null)).toBeNull();
  });
});

describe("findByDial", () => {
  test("returns the primary country for a shared dial code", () => {
    expect(findByDial("1").iso2).toBe("US");
    expect(findByDial("7").iso2).toBe("RU");
    expect(findByDial("39").iso2).toBe("IT");
    expect(findByDial("44").iso2).toBe("GB");
  });

  test("returns the only country for an exclusive dial code", () => {
    expect(findByDial("34").iso2).toBe("ES");
    expect(findByDial("1876").iso2).toBe("JM");
  });

  test("ignores a leading plus sign and spaces", () => {
    expect(findByDial("+34").iso2).toBe("ES");
    expect(findByDial(" 34 ").iso2).toBe("ES");
  });

  test("returns null for an unassigned dial code", () => {
    expect(findByDial("999")).toBeNull();
    expect(findByDial("")).toBeNull();
    expect(findByDial(null)).toBeNull();
  });
});

describe("searchCountries", () => {
  test("returns the whole list for an empty query", () => {
    expect(searchCountries("")).toHaveLength(COUNTRIES.length);
    expect(searchCountries("   ")).toHaveLength(COUNTRIES.length);
    expect(searchCountries(null)).toHaveLength(COUNTRIES.length);
  });

  test("matches a name prefix, case-insensitively", () => {
    const results = searchCountries("spa");
    expect(results[0].iso2).toBe("ES");
  });

  test("matches a substring inside the name", () => {
    const names = searchCountries("kingdom").map((c) => c.name);
    expect(names).toContain("United Kingdom");
  });

  test("ranks a name prefix above a mid-name match", () => {
    // "ind" starts India and appears inside British Indian territory names.
    const results = searchCountries("ind");
    expect(results[0].iso2).toBe("IN");
  });

  test("matches the dial code with or without a plus sign", () => {
    expect(searchCountries("+34").map((c) => c.iso2)).toContain("ES");
    expect(searchCountries("34").map((c) => c.iso2)).toContain("ES");
  });

  test("matches the ISO code exactly", () => {
    expect(searchCountries("es")[0].iso2).toBe("ES");
  });

  test("ignores accents so a plain-ASCII query still finds the country", () => {
    const names = searchCountries("reunion").map((c) => c.name);
    expect(names).toContain("Réunion");
  });

  test("returns an empty list when nothing matches", () => {
    expect(searchCountries("zzzzz")).toEqual([]);
  });
});

describe("splitDialCode", () => {
  test("splits a plain international number into dial code and national part", () => {
    expect(splitDialCode("34639078482")).toEqual({ dial: "34", national: "639078482" });
  });

  test("prefers the longest matching dial code", () => {
    // +1 876 is Jamaica; a four-digit code must win over the bare +1.
    expect(splitDialCode("18765550123")).toEqual({ dial: "1876", national: "5550123" });
    expect(splitDialCode("12125550123")).toEqual({ dial: "1", national: "2125550123" });
  });

  test("handles a two-digit and a three-digit code", () => {
    expect(splitDialCode("447911123456")).toEqual({ dial: "44", national: "7911123456" });
    expect(splitDialCode("3519123456789")).toEqual({ dial: "351", national: "9123456789" });
  });

  test("strips a leading plus, zeros and separators before splitting", () => {
    expect(splitDialCode("+34 639 07 84 82")).toEqual({ dial: "34", national: "639078482" });
    expect(splitDialCode("0034-639-078-482")).toEqual({ dial: "34", national: "639078482" });
  });

  test("returns null when no dial code matches", () => {
    expect(splitDialCode("99912345")).toBeNull();
    expect(splitDialCode("")).toBeNull();
    expect(splitDialCode(null)).toBeNull();
  });

  test("returns an empty national part when only the dial code is given", () => {
    expect(splitDialCode("34")).toEqual({ dial: "34", national: "" });
  });
});

describe("regionFromLocale", () => {
  test("reads the region subtag", () => {
    expect(regionFromLocale("es-ES")).toBe("ES");
    expect(regionFromLocale("en-GB")).toBe("GB");
    expect(regionFromLocale("ca-ES-valencia")).toBe("ES");
  });

  test("uppercases a lowercase region subtag", () => {
    expect(regionFromLocale("es-es")).toBe("ES");
  });

  test("infers the likely region when the locale carries none", () => {
    expect(regionFromLocale("ja")).toBe("JP");
  });

  test("returns null for input it cannot read", () => {
    expect(regionFromLocale("")).toBeNull();
    expect(regionFromLocale(null)).toBeNull();
    expect(regionFromLocale("!!!")).toBeNull();
  });
});
