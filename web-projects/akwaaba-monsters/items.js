// Items, and the bag that holds them.
//
// An item is plain data, like a move. The bag is a plain object of counts, so a
// save file can hold it with no work: { calabash: 5, sachetWater: 2 }.
//
// Catching uses a calabash, the dried gourd every market in the region sells by
// the stack. That is the ball of this game.
//
// Fields:
//   id           permanent identifier. It goes into save files. Never rename one.
//   name         what the player reads.
//   desc         one line for the bag screen.
//   price        what the shop charges. Selling gives half, rounded down.
//   category     "balls", "medicine" or "key". The bag shows one pocket at a time.
//   ballBonus    for a ball: how much easier it makes a catch.
//   healHp       how much health it restores. Infinity means "all of it".
//   cures        which lasting conditions it clears. "all" clears every one.
//   revive       the share of health a fainted creature comes back with.
//   inBattle     whether the battle menu offers it.
//   outside      whether the field menu offers it.

/** The pockets the bag is divided into, in the order the menu shows them. */
export const CATEGORIES = ["balls", "medicine", "key"];

const ITEM_LIST = [
  {
    id: "calabash",
    name: "Calabash",
    desc: "A dried gourd for catching creatures. Every market sells them by the stack.",
    price: 200,
    category: "balls",
    ballBonus: 1,
    inBattle: true,
    outside: false,
  },
  {
    id: "superCalabash",
    name: "Super Calabash",
    desc: "A calabash cured over a slow fire. It holds a creature far better.",
    price: 600,
    category: "balls",
    ballBonus: 2,
    inBattle: true,
    outside: false,
  },
  {
    id: "sachetWater",
    name: "Sachet Water",
    desc: "Cold water in a small plastic bag. Bite the corner. Restores 20 health.",
    price: 150,
    category: "medicine",
    healHp: 20,
    inBattle: true,
    outside: true,
  },
  {
    id: "jollof",
    name: "Bowl of Jollof",
    desc: "Rice cooked in the pot with the stew. Restores 60 health.",
    price: 400,
    category: "medicine",
    healHp: 60,
    inBattle: true,
    outside: true,
  },
  {
    id: "kelewele",
    name: "Kelewele",
    desc: "Ripe plantain fried with ginger and pepper. Restores 120 health.",
    price: 900,
    category: "medicine",
    healHp: 120,
    inBattle: true,
    outside: true,
  },
  {
    id: "bitterLeaf",
    name: "Bitter Leaf",
    desc: "Chewed straight off the stem. Clears poison, and the taste stays all day.",
    price: 120,
    category: "medicine",
    cures: ["poison"],
    inBattle: true,
    outside: true,
  },
  {
    id: "sheaButter",
    name: "Shea Butter",
    desc: "Thick and cool on the skin. Clears a burn.",
    price: 150,
    category: "medicine",
    cures: ["burn"],
    inBattle: true,
    outside: true,
  },
  {
    id: "wakeDrum",
    name: "Wake Drum",
    desc: "One sharp beat on a small drum. Nothing sleeps through it.",
    price: 150,
    category: "medicine",
    cures: ["sleep"],
    inBattle: true,
    outside: true,
  },
  {
    id: "redClay",
    name: "Red Clay",
    desc: "Cool river clay rubbed into stiff limbs. Clears paralysis.",
    price: 150,
    category: "medicine",
    cures: ["paralysis"],
    inBattle: true,
    outside: true,
  },
  {
    id: "herbalPaste",
    name: "Herbal Paste",
    desc: "The village healer's own mix. Clears any lasting condition at all.",
    price: 600,
    category: "medicine",
    cures: "all",
    inBattle: true,
    outside: true,
  },
  {
    id: "revivalNut",
    name: "Revival Nut",
    desc: "A bitter kola nut. Brings a fainted creature back with half its health.",
    price: 1500,
    category: "medicine",
    revive: 0.5,
    inBattle: true,
    outside: true,
  },
  {
    id: "gymBadgeRiver",
    name: "River Stone Badge",
    desc: "Proof that you beat the Bosua gym. The chief carved it himself.",
    price: 0,
    category: "key",
    inBattle: false,
    outside: false,
  },
];

/** Every item, keyed by identifier. */
export const ITEMS = Object.freeze(
  Object.fromEntries(ITEM_LIST.map((item) => [item.id, Object.freeze(item)])),
);

/** Every item identifier, in bag order. */
export const ITEM_IDS = ITEM_LIST.map((item) => item.id);

/**
 * One item by identifier.
 * @returns {object|null} null when nothing has that identifier
 */
export function getItem(id) {
  return ITEMS[id] ?? null;
}

/** An empty bag. */
export function createBag(contents = {}) {
  return { ...contents };
}

/** How many of one item the bag holds. */
export function countOf(bag, id) {
  return bag[id] ?? 0;
}

/** A copy of the bag with `amount` more of an item, capped at 99 like the real games. */
export function addItem(bag, id, amount = 1) {
  if (!getItem(id) || amount <= 0) return { ...bag };
  const next = { ...bag };
  next[id] = Math.min(99, countOf(bag, id) + Math.floor(amount));
  return next;
}

/** A copy of the bag with `amount` fewer of an item. The entry goes when it hits zero. */
export function removeItem(bag, id, amount = 1) {
  const next = { ...bag };
  const left = countOf(bag, id) - Math.floor(amount);
  if (left > 0) next[id] = left;
  else delete next[id];
  return next;
}

/**
 * What the bag holds in one pocket, ready to list.
 * @returns {Array<{item: object, count: number}>}
 */
export function bagList(bag, category = null) {
  return ITEM_IDS.filter((id) => countOf(bag, id) > 0)
    .filter((id) => category === null || ITEMS[id].category === category)
    .map((id) => ({ item: ITEMS[id], count: bag[id] }));
}

/** True when the bag holds nothing at all in this pocket. */
export function pocketIsEmpty(bag, category) {
  return bagList(bag, category).length === 0;
}

/** True when an item is a ball for catching. */
export function isBall(item) {
  return item?.category === "balls";
}

/** What the shop pays for an item. Half the price, rounded down. */
export function sellPrice(item) {
  return Math.floor((item?.price ?? 0) / 2);
}

/**
 * Whether this item would do anything for this creature right now.
 * @returns {{ok: boolean, reason: string|null}}
 */
export function canUseOn(item, monster) {
  if (!item || !monster) return { ok: false, reason: "There is nothing to use it on." };
  const fainted = monster.hp <= 0;

  if (item.revive) {
    if (!fainted) return { ok: false, reason: "It is not fainted." };
    return { ok: true, reason: null };
  }
  if (fainted) return { ok: false, reason: "It has fainted and cannot use that." };

  if (item.healHp) {
    // The caller knows the real maximum; a full creature is caught in applyItem.
    return { ok: true, reason: null };
  }
  if (item.cures) {
    if (!monster.status) return { ok: false, reason: "It has nothing to cure." };
    if (item.cures !== "all" && !item.cures.includes(monster.status)) {
      return { ok: false, reason: "That will not help with this." };
    }
    return { ok: true, reason: null };
  }
  return { ok: false, reason: "You cannot use that here." };
}

/**
 * Use an item on one creature.
 *
 * Takes the creature's maximum health as an argument rather than working it out,
 * so this module never has to know about species or stats. `app.js` passes
 * `maxHp(monster)`.
 *
 * @returns {{monster: object, used: boolean, message: string}}
 */
export function applyItem(item, monster, maxHealth) {
  const next = structuredClone(monster);
  const name = item?.name ?? "item";

  if (item?.revive) {
    if (monster.hp > 0) return { monster, used: false, message: "It is not fainted." };
    next.hp = Math.max(1, Math.floor(maxHealth * item.revive));
    next.status = null;
    next.sleepTurns = 0;
    return { monster: next, used: true, message: `${name} brought it back!` };
  }

  if (monster.hp <= 0) {
    return { monster, used: false, message: "It has fainted and cannot use that." };
  }

  if (item?.healHp) {
    if (monster.hp >= maxHealth) {
      return { monster, used: false, message: "Its health is already full." };
    }
    const before = next.hp;
    next.hp = Math.min(maxHealth, next.hp + item.healHp);
    return {
      monster: next,
      used: true,
      message: `It recovered ${next.hp - before} health.`,
    };
  }

  if (item?.cures) {
    if (!monster.status) return { monster, used: false, message: "It has nothing to cure." };
    if (item.cures !== "all" && !item.cures.includes(monster.status)) {
      return { monster, used: false, message: "That will not help with this." };
    }
    next.status = null;
    next.sleepTurns = 0;
    return { monster: next, used: true, message: `${name} cleared it up.` };
  }

  return { monster, used: false, message: "You cannot use that here." };
}

/** Money, written the way the shop shows it. */
export function formatMoney(amount) {
  return `${Math.max(0, Math.floor(amount)).toLocaleString("en-GB")} cedi`;
}
