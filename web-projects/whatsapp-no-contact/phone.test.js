import { describe, test, expect } from "bun:test";
import {
  digitsOnly,
  normalizeNational,
  parseInternational,
  toE164Digits,
  validateNumber,
  buildWhatsAppUrl,
  formatForDisplay,
  parseUrlState,
  serializeUrlState,
} from "./phone.js";

describe("digitsOnly", () => {
  test("keeps the digits and drops everything else", () => {
    expect(digitsOnly("+34 (123) 45-67.89")).toBe("34123456789");
  });

  test("returns an empty string for input that holds no digits", () => {
    expect(digitsOnly("abc")).toBe("");
    expect(digitsOnly("")).toBe("");
    expect(digitsOnly(null)).toBe("");
    expect(digitsOnly(undefined)).toBe("");
  });

  test("drops non-ASCII digit look-alikes instead of keeping them", () => {
    // Arabic-Indic digits must not reach the link, because WhatsApp reads
    // ASCII digits only.
    expect(digitsOnly("٠١٢")).toBe("");
  });
});

describe("normalizeNational", () => {
  test("removes the trunk zero that people write in national format", () => {
    // A UK mobile is written 07700 900123 nationally but is 44 7700 900123
    // in international format.
    expect(normalizeNational("07700 900123", "44")).toBe("7700900123");
  });

  test("removes several leading zeros", () => {
    expect(normalizeNational("0007700", "44")).toBe("7700");
  });

  test("leaves a number without a trunk zero untouched", () => {
    expect(normalizeNational("123 456 789", "34")).toBe("123456789");
  });

  test("keeps the leading zero for Italy, where it is part of the number", () => {
    expect(normalizeNational("06 6981234", "39")).toBe("066981234");
  });

  test("returns an empty string for empty or digitless input", () => {
    expect(normalizeNational("", "34")).toBe("");
    expect(normalizeNational("abc", "34")).toBe("");
    expect(normalizeNational(null, "34")).toBe("");
  });

  test("still strips zeros when no dial code is given", () => {
    expect(normalizeNational("0123456789", null)).toBe("123456789");
  });
});

describe("parseInternational", () => {
  test("reads a number written with a plus sign", () => {
    expect(parseInternational("+34123456789")).toEqual({ dial: "34", national: "123456789" });
  });

  test("reads a number written with the 00 exit code", () => {
    expect(parseInternational("0034123456789")).toEqual({ dial: "34", national: "123456789" });
  });

  test("tolerates spaces, dashes and brackets", () => {
    expect(parseInternational("+44 (0) 7700 900123")).toEqual({ dial: "44", national: "7700900123" });
  });

  test("tolerates leading and trailing whitespace", () => {
    expect(parseInternational("  +34 123456789  ")).toEqual({ dial: "34", national: "123456789" });
  });

  test("returns null for a number with no international marker", () => {
    // Without a plus or 00 there is no way to tell a country code from an
    // area code, so the selected country must stay in charge.
    expect(parseInternational("123456789")).toBeNull();
    expect(parseInternational("0123456789")).toBeNull();
  });

  test("returns null when the dial code is unassigned", () => {
    expect(parseInternational("+99912345678")).toBeNull();
  });

  test("returns null for empty or non-string input", () => {
    expect(parseInternational("")).toBeNull();
    expect(parseInternational(null)).toBeNull();
    expect(parseInternational(1234)).toBeNull();
  });
});

describe("toE164Digits", () => {
  test("joins the dial code and the normalized national part", () => {
    expect(toE164Digits({ dial: "44", national: "07700 900123" })).toBe("447700900123");
  });

  test("returns an empty string when a part is missing", () => {
    expect(toE164Digits({ dial: "34", national: "" })).toBe("");
    expect(toE164Digits({ dial: null, national: "123456789" })).toBe("");
    expect(toE164Digits({})).toBe("");
  });
});

describe("validateNumber", () => {
  test("accepts a normal mobile number", () => {
    expect(validateNumber({ dial: "34", national: "123456789" })).toEqual({ valid: true, reason: null });
  });

  test("accepts the shortest real numbers", () => {
    // Saint Helena numbers are four digits, so seven digits in total.
    expect(validateNumber({ dial: "290", national: "1234" }).valid).toBe(true);
  });

  test("reports a missing country", () => {
    expect(validateNumber({ dial: null, national: "123456789" })).toEqual({
      valid: false,
      reason: "no-country",
    });
  });

  test("reports an empty number", () => {
    expect(validateNumber({ dial: "34", national: "" })).toEqual({ valid: false, reason: "empty" });
    expect(validateNumber({ dial: "34", national: "abc" })).toEqual({ valid: false, reason: "empty" });
  });

  test("reports a number that is too short", () => {
    expect(validateNumber({ dial: "34", national: "123" })).toEqual({ valid: false, reason: "too-short" });
    expect(validateNumber({ dial: "1", national: "1234" })).toEqual({ valid: false, reason: "too-short" });
  });

  test("reports a number longer than the 15 digits E.164 allows", () => {
    expect(validateNumber({ dial: "34", national: "12345678901234" })).toEqual({
      valid: false,
      reason: "too-long",
    });
  });

  test("validates the number after the trunk zero is removed", () => {
    expect(validateNumber({ dial: "44", national: "07700 900123" }).valid).toBe(true);
  });
});

describe("buildWhatsAppUrl", () => {
  test("builds the api.whatsapp.com link WhatsApp opens without a saved contact", () => {
    expect(buildWhatsAppUrl({ dial: "34", national: "123456789" })).toBe(
      "https://api.whatsapp.com/send?phone=34123456789"
    );
  });

  test("normalizes the number before putting it in the link", () => {
    expect(buildWhatsAppUrl({ dial: "44", national: "(0) 7700 900123" })).toBe(
      "https://api.whatsapp.com/send?phone=447700900123"
    );
  });

  test("returns null when the number is not valid", () => {
    expect(buildWhatsAppUrl({ dial: "34", national: "" })).toBeNull();
    expect(buildWhatsAppUrl({ dial: null, national: "123456789" })).toBeNull();
    expect(buildWhatsAppUrl({ dial: "34", national: "123" })).toBeNull();
  });
});

describe("formatForDisplay", () => {
  test("shows the number the way it is dialled internationally", () => {
    expect(formatForDisplay({ dial: "34", national: "123456789" })).toBe("+34 123456789");
  });

  test("shows the dial code alone when there is no number yet", () => {
    expect(formatForDisplay({ dial: "34", national: "" })).toBe("+34");
  });

  test("returns an empty string when there is no country", () => {
    expect(formatForDisplay({ dial: null, national: "123" })).toBe("");
  });
});

describe("URL state", () => {
  test("reads the number from the p parameter", () => {
    expect(parseUrlState("?p=34123456789")).toEqual({ dial: "34", national: "123456789" });
  });

  test("reads a p parameter that carries a plus sign or an exit code", () => {
    expect(parseUrlState("?p=%2B34123456789")).toEqual({ dial: "34", national: "123456789" });
    expect(parseUrlState("?p=0034123456789")).toEqual({ dial: "34", national: "123456789" });
  });

  test("works with or without the leading question mark", () => {
    expect(parseUrlState("p=34123456789")).toEqual({ dial: "34", national: "123456789" });
  });

  test("returns an empty state when the parameter is absent or unreadable", () => {
    const empty = { dial: null, national: "" };
    expect(parseUrlState("")).toEqual(empty);
    expect(parseUrlState("?x=1")).toEqual(empty);
    expect(parseUrlState("?p=99912345678")).toEqual(empty);
    expect(parseUrlState("?p=abc")).toEqual(empty);
    expect(parseUrlState(null)).toEqual(empty);
  });

  test("serializes a complete number", () => {
    expect(serializeUrlState({ dial: "34", national: "123456789" })).toBe("p=34123456789");
  });

  test("serializes nothing when the number is incomplete, keeping links clean", () => {
    expect(serializeUrlState({ dial: "34", national: "" })).toBe("");
    expect(serializeUrlState({ dial: null, national: "123456789" })).toBe("");
    expect(serializeUrlState({ dial: "34", national: "123" })).toBe("");
  });

  test("round-trips any valid number", () => {
    const cases = [
      { dial: "34", national: "123456789" },
      { dial: "1", national: "2125550123" },
      { dial: "1876", national: "5550123" },
      { dial: "39", national: "066981234" },
      { dial: "351", national: "912345678" },
    ];
    for (const state of cases) {
      expect(parseUrlState("?" + serializeUrlState(state))).toEqual(state);
    }
  });
});
