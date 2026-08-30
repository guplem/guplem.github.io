import { describe, test, expect } from "bun:test";
import {
  CHART,
  TYPES,
  TYPE_COLORS,
  TYPE_NAMES,
  effectiveness,
  effectivenessLabel,
  hasStab,
  isType,
  pairEffectiveness,
} from "./types.js";

describe("the type table", () => {
  test("names and colours every type", () => {
    for (const type of TYPES) {
      expect(TYPE_NAMES[type]).toBeString();
      expect(TYPE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("has a chart row for every type", () => {
    for (const type of TYPES) expect(CHART[type]).toBeDefined();
  });

  test("only names real types in the chart", () => {
    for (const [attacker, row] of Object.entries(CHART)) {
      expect(isType(attacker)).toBe(true);
      for (const defender of Object.keys(row)) expect(isType(defender)).toBe(true);
    }
  });

  test("only uses the multipliers 0, one half and 2", () => {
    for (const row of Object.values(CHART)) {
      for (const value of Object.values(row)) expect([0, 0.5, 2]).toContain(value);
    }
  });

  test("gives every type at least one weakness, so no type is unbeatable", () => {
    for (const defender of TYPES) {
      const beatenBy = TYPES.filter((attacker) => pairEffectiveness(attacker, defender) === 2);
      expect(beatenBy.length).toBeGreaterThan(0);
    }
  });

  test("gives every type at least one resistance or immunity, so no type is worthless", () => {
    for (const defender of TYPES) {
      const resisted = TYPES.filter((attacker) => pairEffectiveness(attacker, defender) < 1);
      expect(resisted.length).toBeGreaterThan(0);
    }
  });

  test("gives every type except beast a target it hits hard", () => {
    for (const attacker of TYPES.filter((type) => type !== "beast")) {
      const strongAgainst = TYPES.filter((defender) => pairEffectiveness(attacker, defender) === 2);
      expect(strongAgainst.length).toBeGreaterThan(0);
    }
  });

  test("leaves beast with no advantage at all, on purpose", () => {
    // Beast is the plain type. It never gets a bonus, and that is what keeps
    // the early creatures from outclassing the elemental ones. Do not "fix" it.
    const strongAgainst = TYPES.filter((defender) => pairEffectiveness("beast", defender) === 2);
    expect(strongAgainst).toEqual([]);
  });
});

describe("pairEffectiveness", () => {
  test("reads the written pairs", () => {
    expect(pairEffectiveness("water", "fire")).toBe(2);
    expect(pairEffectiveness("fire", "water")).toBe(0.5);
    expect(pairEffectiveness("thunder", "earth")).toBe(0);
  });

  test("treats a missing pair as plain damage", () => {
    expect(pairEffectiveness("beast", "grass")).toBe(1);
  });

  test("treats an unknown type as plain damage instead of crashing", () => {
    expect(pairEffectiveness("chocolate", "fire")).toBe(1);
    expect(pairEffectiveness("fire", "chocolate")).toBe(1);
  });
});

describe("effectiveness against a whole creature", () => {
  test("multiplies both of a creature's types", () => {
    // Tsetse is poison and sky. Earth beats poison and cannot touch sky at all.
    expect(effectiveness("earth", ["poison", "sky"])).toBe(0);
    // Dungu is earth and metal, and fire beats neither half.
    expect(effectiveness("fire", ["earth", "metal"])).toBe(1);
    // A double weakness really does stack to four times the damage.
    expect(effectiveness("fire", ["grass", "metal"])).toBe(4);
    // And a double resistance stacks the other way.
    expect(effectiveness("grass", ["fire", "sky"])).toBe(0.25);
  });

  test("accepts a single type given on its own", () => {
    expect(effectiveness("water", "fire")).toBe(2);
  });

  test("cancels out when one half resists and the other is weak", () => {
    expect(effectiveness("fire", ["grass", "water"])).toBe(1);
  });
});

describe("the mutual blind spot of beast and spirit", () => {
  test("neither can touch the other", () => {
    expect(pairEffectiveness("beast", "spirit")).toBe(0);
    expect(pairEffectiveness("spirit", "beast")).toBe(0);
  });
});

describe("hasStab", () => {
  test("is true when the move matches one of the attacker's types", () => {
    expect(hasStab("fire", ["fire", "spirit"])).toBe(true);
    expect(hasStab("spirit", ["fire", "spirit"])).toBe(true);
  });

  test("is false otherwise, and survives a missing type list", () => {
    expect(hasStab("water", ["fire"])).toBe(false);
    expect(hasStab("water", undefined)).toBe(false);
  });
});

describe("effectivenessLabel", () => {
  test("names each band the battle log needs", () => {
    expect(effectivenessLabel(0)).toBe("immune");
    expect(effectivenessLabel(0.25)).toBe("notEffective");
    expect(effectivenessLabel(0.5)).toBe("notEffective");
    expect(effectivenessLabel(1)).toBe("normal");
    expect(effectivenessLabel(2)).toBe("veryEffective");
    expect(effectivenessLabel(4)).toBe("veryEffective");
  });
});
