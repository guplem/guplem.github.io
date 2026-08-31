import { describe, test, expect } from "bun:test";
import {
  SUMMARY_PAGES,
  SUMMARY_PAGE_LABELS,
  conditionBadge,
  conditionName,
  expLines,
  measurementLines,
  metLines,
  moveDetailLine,
  moveRows,
  statRows,
} from "./summary.js";
import { STATUSES, getMove } from "./moves.js";
import { createMonster, flatIvs, statsOf, MAX_LEVEL, expForLevel } from "./monsters.js";
import { getSpecies } from "./species.js";

/** A creature with no randomness in it, so every number in a test is fixed. */
function fixture(overrides = {}) {
  return {
    ...createMonster({ species: "baobo", level: 10, ivs: flatIvs(0), metAt: "route1" }),
    ...overrides,
  };
}

describe("the pages of the summary", () => {
  test("are the three the player turns between, in order", () => {
    expect(SUMMARY_PAGES).toEqual(["info", "stats", "moves"]);
  });

  test("each carry a label the tab strip can draw", () => {
    for (const page of SUMMARY_PAGES) {
      expect(typeof SUMMARY_PAGE_LABELS[page]).toBe("string");
      expect(SUMMARY_PAGE_LABELS[page].length).toBeGreaterThan(0);
    }
  });
});

describe("the condition badge", () => {
  test("shows nothing for a creature with nothing wrong with it", () => {
    expect(conditionBadge(fixture())).toBe(null);
  });

  test("shows three letters for a lasting condition", () => {
    expect(conditionBadge(fixture({ status: "poison" }))).toBe("PSN");
    expect(conditionBadge(fixture({ status: "paralysis" }))).toBe("PAR");
  });

  test("shows fainted first, because a fainted creature cannot fight either way", () => {
    expect(conditionBadge(fixture({ hp: 0, status: "poison" }))).toBe("FNT");
    expect(conditionBadge(fixture({ hp: 0 }))).toBe("FNT");
  });
});

describe("the condition in words", () => {
  test("reads as healthy when nothing is wrong", () => {
    expect(conditionName(fixture())).toBe("Healthy");
  });

  test("reads as fainted before it reads as anything else", () => {
    expect(conditionName(fixture({ hp: 0, status: "burn" }))).toBe("Fainted");
  });

  test("gives every lasting condition a word, so a new one cannot show its identifier", () => {
    for (const status of STATUSES) {
      const name = conditionName(fixture({ status }));
      expect(`${status}: ${name}`).not.toBe(`${status}: ${status}`);
      expect(name[0]).toBe(name[0].toUpperCase());
    }
  });
});

describe("where the creature was met", () => {
  test("names the place and the level it was met at", () => {
    expect(metLines(fixture({ metLevel: 5 }), "Route 1")).toEqual(["Met in Route 1", "at level 5"]);
  });

  test("still names the level when the place is unknown", () => {
    expect(metLines(fixture({ metAt: null, metLevel: 5 }), null)).toEqual(["Met at level 5"]);
  });

  test("says nothing at all when the creature carries no record", () => {
    expect(metLines(fixture({ metAt: null, metLevel: null }), null)).toEqual([]);
  });
});

describe("how big the creature is", () => {
  test("gives the height in metres and the weight in kilograms", () => {
    expect(measurementLines(getSpecies("baobo"))).toEqual(["Height 0.5 m", "Weight 9.2 kg"]);
  });

  test("drops a decimal point that says nothing", () => {
    expect(measurementLines({ height: 2, weight: 88 })).toEqual(["Height 2 m", "Weight 88 kg"]);
  });
});

describe("the stat rows", () => {
  test("are the five stats the health bar does not already show", () => {
    const rows = statRows(fixture());
    expect(rows.map((row) => row.label)).toEqual([
      "Attack",
      "Defense",
      "Sp. Atk",
      "Sp. Def",
      "Speed",
    ]);
  });

  test("carry the numbers the battle engine would use", () => {
    const monster = fixture();
    const stats = statsOf(monster);
    const rows = statRows(monster);
    expect(rows.map((row) => row.value)).toEqual([
      stats.attack,
      stats.defense,
      stats.spAttack,
      stats.spDefense,
      stats.speed,
    ]);
  });
});

describe("the experience lines", () => {
  test("show the total and how much the next level still needs", () => {
    const monster = fixture();
    const needed = expForLevel("medium", 11) - monster.exp;
    expect(expLines(monster)).toEqual([`Exp ${monster.exp}`, `To next ${needed}`]);
  });

  test("show a dash at the top level, where there is no next level", () => {
    const monster = fixture({ level: MAX_LEVEL, exp: expForLevel("medium", MAX_LEVEL) });
    expect(expLines(monster)[1]).toBe("To next -");
  });
});

describe("the move rows", () => {
  test("always fill all four slots, so an empty one is visible", () => {
    const monster = fixture({ moves: [{ id: "tackle", pp: 30 }] });
    const rows = moveRows(monster);
    expect(rows.length).toBe(4);
    expect(rows[0].filled).toBe(true);
    expect(rows[1].filled).toBe(false);
    expect(rows[1].name).toBe("-");
  });

  test("carry the name, the type and the points left out of the full number", () => {
    const rows = moveRows(fixture({ moves: [{ id: "tackle", pp: 30 }] }));
    expect(rows[0].name).toBe(getMove("tackle").name);
    expect(rows[0].type).toBe("beast");
    expect(rows[0].pp).toBe(`30/${getMove("tackle").pp}`);
  });

  test("leave an empty slot with no type, so nothing draws a badge for it", () => {
    const rows = moveRows(fixture({ moves: [] }));
    expect(rows[0].type).toBe(null);
    expect(rows[0].pp).toBe("");
    expect(rows[0].desc).toBe("");
  });
});

describe("the line under the highlighted move", () => {
  test("reads the power, the accuracy and the kind of move", () => {
    expect(moveDetailLine(getMove("tackle"))).toBe("Pow 40   Acc 100   Physical");
  });

  test("shows a dash where a status move has no power", () => {
    expect(moveDetailLine(getMove("growl"))).toContain("Pow -");
    expect(moveDetailLine(getMove("growl"))).toContain("Status");
  });

  test("shows a dash for a move that never misses", () => {
    expect(moveDetailLine({ power: 40, acc: null, cat: "physical" })).toContain("Acc -");
  });

  test("says nothing for an empty slot", () => {
    expect(moveDetailLine(null)).toBe("");
  });
});
