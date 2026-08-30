// The ten elements and how they beat each other.
//
// Pokemon has eighteen types. Ten is enough to make team building a real
// choice without asking the player to memorise a wall. Every type here has at
// least one weakness and at least one resistance, and `types.test.js` checks
// that, so a future agent cannot quietly add an unbeatable type.
//
// The identifiers are permanent. They appear in save files. Rename one and
// every saved game breaks.

/** Every type identifier, in the order the user interface lists them. */
export const TYPES = [
  "beast",
  "grass",
  "fire",
  "water",
  "earth",
  "sky",
  "thunder",
  "poison",
  "spirit",
  "metal",
];

/** What the player reads. */
export const TYPE_NAMES = {
  beast: "Beast",
  grass: "Grass",
  fire: "Fire",
  water: "Water",
  earth: "Earth",
  sky: "Sky",
  thunder: "Thunder",
  poison: "Poison",
  spirit: "Spirit",
  metal: "Metal",
};

/** The colour each type paints its badge and its move button. */
export const TYPE_COLORS = {
  beast: "#b0a58c",
  grass: "#4f9d3a",
  fire: "#e0622b",
  water: "#2f7fc4",
  earth: "#b07a35",
  sky: "#7fb6de",
  thunder: "#e3b23a",
  poison: "#8a4fa8",
  spirit: "#5a4a8a",
  metal: "#c9a227",
};

/**
 * How much damage an attacking type does to a defending type.
 *
 * Read it as CHART[attacker][defender]. A pair that is missing means 1, so only
 * the interesting pairs are written down.
 */
export const CHART = {
  beast: { spirit: 0, metal: 0.5, earth: 0.5 },
  grass: { water: 2, earth: 2, fire: 0.5, grass: 0.5, sky: 0.5, poison: 0.5, metal: 0.5 },
  fire: { grass: 2, metal: 2, fire: 0.5, water: 0.5, earth: 0.5, spirit: 0.5 },
  water: { fire: 2, earth: 2, water: 0.5, grass: 0.5, thunder: 0.5 },
  earth: { fire: 2, thunder: 2, poison: 2, metal: 2, grass: 0.5, sky: 0 },
  sky: { grass: 2, poison: 2, thunder: 0.5, metal: 0.5, sky: 0.5 },
  thunder: { water: 2, sky: 2, grass: 0.5, thunder: 0.5, earth: 0 },
  poison: { grass: 2, beast: 2, earth: 0.5, poison: 0.5, spirit: 0.5, metal: 0 },
  spirit: { spirit: 2, beast: 0, metal: 0.5 },
  metal: { earth: 2, spirit: 2, fire: 0.5, water: 0.5, thunder: 0.5, metal: 0.5 },
};

/** True when the string names a type this game knows. */
export function isType(value) {
  return TYPES.includes(value);
}

/**
 * The multiplier for one attacking type against one defending type.
 * An unknown type counts as 1, so a typo weakens the game instead of crashing it.
 */
export function pairEffectiveness(attackType, defendType) {
  const row = CHART[attackType];
  if (!row) return 1;
  const value = row[defendType];
  return value === undefined ? 1 : value;
}

/**
 * The multiplier against a whole creature, which can carry two types.
 * @param {string} attackType
 * @param {string[]|string} defendTypes one or two type identifiers
 */
export function effectiveness(attackType, defendTypes) {
  const list = Array.isArray(defendTypes) ? defendTypes : [defendTypes];
  let total = 1;
  for (const defendType of list) total *= pairEffectiveness(attackType, defendType);
  return total;
}

/** True when the move's type is one of the attacker's own types. */
export function hasStab(moveType, attackerTypes) {
  return (attackerTypes ?? []).includes(moveType);
}

/**
 * Which message the battle log shows after a hit.
 * @returns {"immune"|"veryEffective"|"notEffective"|"normal"}
 */
export function effectivenessLabel(multiplier) {
  if (multiplier === 0) return "immune";
  if (multiplier > 1) return "veryEffective";
  if (multiplier < 1) return "notEffective";
  return "normal";
}
