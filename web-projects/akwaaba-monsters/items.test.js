import { describe, test, expect } from "bun:test";
import {
  CATEGORIES,
  ITEMS,
  ITEM_IDS,
  addItem,
  applyItem,
  bagList,
  canUseOn,
  countOf,
  createBag,
  formatMoney,
  getItem,
  isBall,
  pocketIsEmpty,
  removeItem,
  sellPrice,
} from "./items.js";
import { STATUSES } from "./moves.js";

const allItems = ITEM_IDS.map((id) => ITEMS[id]);

function hurt(hp = 5, status = null) {
  return { species: "gori", hp, status, sleepTurns: 0, moves: [] };
}

describe("the item table", () => {
  test("holds every identifier exactly once", () => {
    expect(new Set(ITEM_IDS).size).toBe(ITEM_IDS.length);
  });

  test("gives every item a name, a description and a real category", () => {
    for (const item of allItems) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.desc.length).toBeGreaterThan(15);
      expect(CATEGORIES).toContain(item.category);
    }
  });

  test("never prices an item below zero", () => {
    for (const item of allItems) expect(item.price).toBeGreaterThanOrEqual(0);
  });

  test("only cures conditions the battle engine knows", () => {
    for (const item of allItems) {
      if (!item.cures || item.cures === "all") continue;
      for (const status of item.cures) expect(STATUSES).toContain(status);
    }
  });

  test("gives every ball a bonus of at least one", () => {
    for (const item of allItems) {
      if (item.category !== "balls") continue;
      expect(item.ballBonus).toBeGreaterThanOrEqual(1);
    }
  });

  test("prices a better ball above a plain one", () => {
    expect(ITEMS.superCalabash.price).toBeGreaterThan(ITEMS.calabash.price);
    expect(ITEMS.superCalabash.ballBonus).toBeGreaterThan(ITEMS.calabash.ballBonus);
  });

  test("prices healing by how much it heals", () => {
    expect(ITEMS.jollof.price).toBeGreaterThan(ITEMS.sachetWater.price);
    expect(ITEMS.kelewele.price).toBeGreaterThan(ITEMS.jollof.price);
    expect(ITEMS.jollof.healHp).toBeGreaterThan(ITEMS.sachetWater.healHp);
  });

  test("covers every lasting condition with a cure the player can buy", () => {
    for (const status of STATUSES) {
      const cure = allItems.find(
        (item) => item.cures === "all" || (item.cures ?? []).includes(status),
      );
      expect(cure).toBeDefined();
    }
  });

  test("keeps key items out of shops and out of battle", () => {
    for (const item of allItems) {
      if (item.category !== "key") continue;
      expect(item.price).toBe(0);
      expect(item.inBattle).toBe(false);
    }
  });
});

describe("the bag", () => {
  test("starts empty", () => {
    const bag = createBag();
    expect(countOf(bag, "calabash")).toBe(0);
    expect(bagList(bag)).toEqual([]);
  });

  test("takes items in and gives the count back", () => {
    let bag = createBag();
    bag = addItem(bag, "calabash", 5);
    expect(countOf(bag, "calabash")).toBe(5);
    bag = addItem(bag, "calabash", 3);
    expect(countOf(bag, "calabash")).toBe(8);
  });

  test("never holds more than ninety nine of one thing", () => {
    let bag = createBag();
    bag = addItem(bag, "calabash", 200);
    expect(countOf(bag, "calabash")).toBe(99);
  });

  test("refuses an item that does not exist", () => {
    expect(countOf(addItem(createBag(), "masterball", 1), "masterball")).toBe(0);
  });

  test("ignores a zero or negative amount", () => {
    const bag = addItem(createBag(), "calabash", 0);
    expect(countOf(bag, "calabash")).toBe(0);
  });

  test("takes items out and forgets the entry at zero", () => {
    let bag = addItem(createBag(), "calabash", 2);
    bag = removeItem(bag, "calabash", 1);
    expect(countOf(bag, "calabash")).toBe(1);
    bag = removeItem(bag, "calabash", 1);
    expect(countOf(bag, "calabash")).toBe(0);
    expect(Object.keys(bag)).not.toContain("calabash");
  });

  test("never goes below zero when too many are taken out", () => {
    const bag = removeItem(addItem(createBag(), "calabash", 1), "calabash", 9);
    expect(countOf(bag, "calabash")).toBe(0);
  });

  test("leaves the bag it was given untouched", () => {
    const bag = createBag();
    addItem(bag, "calabash", 5);
    expect(countOf(bag, "calabash")).toBe(0);
  });

  test("lists only one pocket when asked for one", () => {
    let bag = createBag();
    bag = addItem(bag, "calabash", 3);
    bag = addItem(bag, "jollof", 1);
    expect(bagList(bag, "balls").map((entry) => entry.item.id)).toEqual(["calabash"]);
    expect(bagList(bag, "medicine").map((entry) => entry.item.id)).toEqual(["jollof"]);
    expect(bagList(bag).length).toBe(2);
  });

  test("knows when a pocket is empty", () => {
    const bag = addItem(createBag(), "calabash", 1);
    expect(pocketIsEmpty(bag, "balls")).toBe(false);
    expect(pocketIsEmpty(bag, "medicine")).toBe(true);
  });

  test("survives being written to JSON and read back", () => {
    const bag = addItem(addItem(createBag(), "calabash", 4), "jollof", 2);
    expect(JSON.parse(JSON.stringify(bag))).toEqual(bag);
  });
});

describe("shops", () => {
  test("buy back at half price, rounded down", () => {
    expect(sellPrice(ITEMS.calabash)).toBe(100);
    expect(sellPrice(ITEMS.bitterLeaf)).toBe(60);
  });

  test("write money with the local name", () => {
    expect(formatMoney(1500)).toBe("1,500 cedi");
    expect(formatMoney(0)).toBe("0 cedi");
    expect(formatMoney(-5)).toBe("0 cedi");
  });
});

describe("isBall", () => {
  test("separates balls from everything else", () => {
    expect(isBall(ITEMS.calabash)).toBe(true);
    expect(isBall(ITEMS.jollof)).toBe(false);
    expect(isBall(null)).toBe(false);
  });
});

describe("using a healing item", () => {
  test("restores exactly what it says", () => {
    const result = applyItem(ITEMS.sachetWater, hurt(5), 100);
    expect(result.used).toBe(true);
    expect(result.monster.hp).toBe(25);
  });

  test("never heals past the maximum", () => {
    const result = applyItem(ITEMS.kelewele, hurt(95), 100);
    expect(result.monster.hp).toBe(100);
  });

  test("is refused on a creature already at full health", () => {
    const result = applyItem(ITEMS.jollof, hurt(100), 100);
    expect(result.used).toBe(false);
    expect(result.message).toContain("already full");
  });

  test("is refused on a fainted creature", () => {
    const result = applyItem(ITEMS.jollof, hurt(0), 100);
    expect(result.used).toBe(false);
  });

  test("leaves the creature it was given untouched", () => {
    const monster = hurt(5);
    applyItem(ITEMS.jollof, monster, 100);
    expect(monster.hp).toBe(5);
  });
});

describe("using a cure", () => {
  test("clears the condition it is meant for", () => {
    const result = applyItem(ITEMS.bitterLeaf, hurt(30, "poison"), 100);
    expect(result.used).toBe(true);
    expect(result.monster.status).toBeNull();
  });

  test("does nothing for the wrong condition", () => {
    const result = applyItem(ITEMS.bitterLeaf, hurt(30, "burn"), 100);
    expect(result.used).toBe(false);
    expect(result.monster.status).toBe("burn");
  });

  test("does nothing for a healthy creature", () => {
    const result = applyItem(ITEMS.bitterLeaf, hurt(30, null), 100);
    expect(result.used).toBe(false);
    expect(result.message).toContain("nothing to cure");
  });

  test("the herbal paste clears every condition there is", () => {
    for (const status of STATUSES) {
      const result = applyItem(ITEMS.herbalPaste, hurt(30, status), 100);
      expect(result.used).toBe(true);
      expect(result.monster.status).toBeNull();
    }
  });

  test("waking a creature also clears how deeply it was sleeping", () => {
    const sleeper = { ...hurt(30, "sleep"), sleepTurns: 3 };
    expect(applyItem(ITEMS.wakeDrum, sleeper, 100).monster.sleepTurns).toBe(0);
  });
});

describe("using a revival nut", () => {
  test("brings a fainted creature back with half its health", () => {
    const result = applyItem(ITEMS.revivalNut, hurt(0), 80);
    expect(result.used).toBe(true);
    expect(result.monster.hp).toBe(40);
  });

  test("always leaves at least one point of health", () => {
    expect(applyItem(ITEMS.revivalNut, hurt(0), 1).monster.hp).toBe(1);
  });

  test("clears whatever condition it fainted with", () => {
    const result = applyItem(ITEMS.revivalNut, hurt(0, "poison"), 80);
    expect(result.monster.status).toBeNull();
  });

  test("is refused on a creature that is still standing", () => {
    const result = applyItem(ITEMS.revivalNut, hurt(10), 80);
    expect(result.used).toBe(false);
    expect(result.message).toContain("not fainted");
  });
});

describe("canUseOn", () => {
  test("agrees with applyItem about a fainted creature", () => {
    expect(canUseOn(ITEMS.jollof, hurt(0)).ok).toBe(false);
    expect(canUseOn(ITEMS.revivalNut, hurt(0)).ok).toBe(true);
    expect(canUseOn(ITEMS.revivalNut, hurt(10)).ok).toBe(false);
  });

  test("agrees with applyItem about cures", () => {
    expect(canUseOn(ITEMS.bitterLeaf, hurt(10, "poison")).ok).toBe(true);
    expect(canUseOn(ITEMS.bitterLeaf, hurt(10, "burn")).ok).toBe(false);
    expect(canUseOn(ITEMS.bitterLeaf, hurt(10, null)).ok).toBe(false);
  });

  test("refuses a ball, which is thrown and not used on your own creature", () => {
    expect(canUseOn(ITEMS.calabash, hurt(10)).ok).toBe(false);
  });

  test("survives being asked about nothing", () => {
    expect(canUseOn(null, hurt(10)).ok).toBe(false);
    expect(canUseOn(ITEMS.jollof, null).ok).toBe(false);
  });
});

describe("getItem", () => {
  test("finds an item and returns null for an unknown one", () => {
    expect(getItem("calabash").name).toBe("Calabash");
    expect(getItem("pokeball")).toBeNull();
  });
});
