// Every move in the first area.
//
// A move is plain data. The battle engine reads these fields and never asks a
// move to run code, so a later agent adds a move by adding a row here.
//
// Fields:
//   id        permanent identifier. It goes into save files. Never rename one.
//   name      what the player reads.
//   type      one of the ten in `types.js`.
//   cat       "physical" uses attack against defense,
//             "special" uses spAttack against spDefense,
//             "status" does no damage at all.
//   power     damage base. Null for a "status" move.
//   acc       chance to hit out of 100. Null means it never misses.
//   pp        how many times it can be used before a rest.
//   priority  higher goes first, whatever the speed. Almost always 0.
//   effects   a list. Every entry has a `kind`; see `EFFECT_KINDS` below.
//   desc      one short line for the move screen.

/** The stats a move is allowed to raise or lower. */
export const STAT_STAGES = [
  "attack",
  "defense",
  "spAttack",
  "spDefense",
  "speed",
  "accuracy",
  "evasion",
];

/** The lasting conditions a move is allowed to inflict. */
export const STATUSES = ["poison", "burn", "sleep", "paralysis"];

/** Every effect kind the battle engine knows how to run. */
export const EFFECT_KINDS = ["status", "stat", "heal", "drain", "flinch", "crit"];

/** The three move categories. */
export const CATEGORIES = ["physical", "special", "status"];

const MOVE_LIST = [
  // --- Beast --------------------------------------------------------------
  {
    id: "tackle",
    name: "Tackle",
    type: "beast",
    cat: "physical",
    power: 40,
    acc: 100,
    pp: 35,
    desc: "Throws its whole body at the target.",
  },
  {
    id: "scratch",
    name: "Scratch",
    type: "beast",
    cat: "physical",
    power: 40,
    acc: 100,
    pp: 35,
    desc: "Rakes the target with hard claws.",
  },
  {
    id: "growl",
    name: "Growl",
    type: "beast",
    cat: "status",
    power: null,
    acc: 100,
    pp: 40,
    effects: [{ kind: "stat", target: "foe", changes: { attack: -1 }, chance: 100 }],
    desc: "A low growl that makes the target hold back. Lowers its Attack.",
  },
  {
    id: "tailWhip",
    name: "Tail Whip",
    type: "beast",
    cat: "status",
    power: null,
    acc: 100,
    pp: 30,
    effects: [{ kind: "stat", target: "foe", changes: { defense: -1 }, chance: 100 }],
    desc: "Swings its tail to distract the target. Lowers its Defense.",
  },
  {
    id: "bite",
    name: "Bite",
    type: "beast",
    cat: "physical",
    power: 60,
    acc: 100,
    pp: 25,
    effects: [{ kind: "flinch", chance: 20 }],
    desc: "A hard bite. The target sometimes freezes for a turn.",
  },
  {
    id: "bodySlam",
    name: "Body Slam",
    type: "beast",
    cat: "physical",
    power: 80,
    acc: 100,
    pp: 15,
    effects: [{ kind: "status", status: "paralysis", chance: 20 }],
    desc: "Drops its full weight on the target. Can leave it paralysed.",
  },
  {
    id: "bellyDrop",
    name: "Belly Drop",
    type: "beast",
    cat: "physical",
    power: 90,
    acc: 90,
    pp: 15,
    desc: "A belly flop heavy enough to shake the ground.",
  },
  {
    id: "nap",
    name: "Nap",
    type: "beast",
    cat: "status",
    power: null,
    acc: null,
    pp: 10,
    effects: [{ kind: "heal", pct: 50, chance: 100 }],
    desc: "Takes a short nap and gets half its health back.",
  },

  // --- Grass --------------------------------------------------------------
  {
    id: "vineWhip",
    name: "Vine Whip",
    type: "grass",
    cat: "physical",
    power: 45,
    acc: 100,
    pp: 25,
    desc: "Whips the target with a long vine.",
  },
  {
    id: "razorLeaf",
    name: "Razor Leaf",
    type: "grass",
    cat: "physical",
    power: 55,
    acc: 95,
    pp: 25,
    effects: [{ kind: "crit", stage: 1 }],
    desc: "Throws cutting leaves. Lands critical hits often.",
  },
  {
    id: "absorb",
    name: "Absorb",
    type: "grass",
    cat: "special",
    power: 40,
    acc: 100,
    pp: 25,
    effects: [{ kind: "drain", pct: 50, chance: 100 }],
    desc: "Drains the target and keeps half the damage as health.",
  },
  {
    id: "sleepSpores",
    name: "Sleep Spores",
    type: "grass",
    cat: "status",
    power: null,
    acc: 75,
    pp: 15,
    effects: [{ kind: "status", status: "sleep", chance: 100 }],
    desc: "Scatters a dust that puts the target to sleep.",
  },
  {
    id: "deepRoots",
    name: "Deep Roots",
    type: "grass",
    cat: "status",
    power: null,
    acc: null,
    pp: 10,
    effects: [{ kind: "heal", pct: 50, chance: 100 }],
    desc: "Digs its roots into the soil and recovers health.",
  },
  {
    id: "seedBomb",
    name: "Seed Bomb",
    type: "grass",
    cat: "special",
    power: 80,
    acc: 100,
    pp: 15,
    desc: "Fires seeds as hard as stones.",
  },

  // --- Fire ---------------------------------------------------------------
  {
    id: "ember",
    name: "Ember",
    type: "fire",
    cat: "special",
    power: 40,
    acc: 100,
    pp: 25,
    effects: [{ kind: "status", status: "burn", chance: 10 }],
    desc: "Flicks a small ember. It can leave a burn.",
  },
  {
    id: "smokeScreen",
    name: "Smoke Screen",
    type: "fire",
    cat: "status",
    power: null,
    acc: 100,
    pp: 20,
    effects: [{ kind: "stat", target: "foe", changes: { accuracy: -1 }, chance: 100 }],
    desc: "Fills the air with smoke. The target sees less.",
  },
  {
    id: "fireFang",
    name: "Fire Fang",
    type: "fire",
    cat: "physical",
    power: 65,
    acc: 95,
    pp: 15,
    effects: [{ kind: "status", status: "burn", chance: 10 }],
    desc: "Bites with red-hot fangs.",
  },
  {
    id: "fireDance",
    name: "Fire Dance",
    type: "fire",
    cat: "status",
    power: null,
    acc: null,
    pp: 20,
    effects: [{ kind: "stat", target: "self", changes: { spAttack: 1, speed: 1 }, chance: 100 }],
    desc: "Dances around the flames. Raises its own Sp. Atk and Speed.",
  },
  {
    id: "flamethrower",
    name: "Flamethrower",
    type: "fire",
    cat: "special",
    power: 90,
    acc: 85,
    pp: 10,
    effects: [{ kind: "status", status: "burn", chance: 10 }],
    desc: "A long tongue of fire that often burns.",
  },

  // --- Water --------------------------------------------------------------
  {
    id: "waterJet",
    name: "Water Jet",
    type: "water",
    cat: "special",
    power: 40,
    acc: 100,
    pp: 25,
    desc: "Spits a thin jet of water under pressure.",
  },
  {
    id: "bubble",
    name: "Bubble",
    type: "water",
    cat: "special",
    power: 40,
    acc: 100,
    pp: 30,
    effects: [{ kind: "stat", target: "foe", changes: { speed: -1 }, chance: 20 }],
    desc: "Blows bubbles that sometimes slow the target down.",
  },
  {
    id: "pincers",
    name: "Pincers",
    type: "water",
    cat: "physical",
    power: 55,
    acc: 100,
    pp: 25,
    desc: "Grabs the target with hard pincers and squeezes.",
  },
  {
    id: "surge",
    name: "Surge",
    type: "water",
    cat: "special",
    power: 90,
    acc: 100,
    pp: 10,
    desc: "Raises a wave that covers the whole field.",
  },
  {
    id: "hydroBlast",
    name: "Hydro Blast",
    type: "water",
    cat: "special",
    power: 110,
    acc: 80,
    pp: 5,
    desc: "A brutal blast of water, but hard to aim.",
  },

  // --- Earth --------------------------------------------------------------
  {
    id: "sandThrow",
    name: "Sand Throw",
    type: "earth",
    cat: "status",
    power: null,
    acc: 100,
    pp: 15,
    effects: [{ kind: "stat", target: "foe", changes: { accuracy: -1 }, chance: 100 }],
    desc: "Throws red dust into the target's eyes.",
  },
  {
    id: "mudSlam",
    name: "Mud Slam",
    type: "earth",
    cat: "physical",
    power: 60,
    acc: 100,
    pp: 20,
    desc: "Beats the ground and throws up mud and stones.",
  },
  {
    id: "hornCharge",
    name: "Horn Charge",
    type: "earth",
    cat: "physical",
    power: 65,
    acc: 100,
    pp: 25,
    desc: "Charges head down, horn first.",
  },
  {
    id: "sharpStone",
    name: "Sharp Stone",
    type: "earth",
    cat: "physical",
    power: 50,
    acc: 90,
    pp: 15,
    effects: [{ kind: "crit", stage: 1 }],
    desc: "Throws a stone with a cutting edge. Lands critical hits often.",
  },
  {
    id: "earthquake",
    name: "Earthquake",
    type: "earth",
    cat: "physical",
    power: 100,
    acc: 100,
    pp: 10,
    desc: "Shakes the whole battlefield at once.",
  },

  // --- Sky ----------------------------------------------------------------
  {
    id: "peck",
    name: "Peck",
    type: "sky",
    cat: "physical",
    power: 35,
    acc: 100,
    pp: 35,
    desc: "Jabs the target with a sharp beak.",
  },
  {
    id: "wingBeat",
    name: "Wing Beat",
    type: "sky",
    cat: "physical",
    power: 60,
    acc: 100,
    pp: 35,
    desc: "Strikes in passing with an open wing.",
  },
  {
    id: "fineFeather",
    name: "Fine Feather",
    type: "sky",
    cat: "special",
    power: 55,
    acc: 100,
    pp: 25,
    effects: [{ kind: "crit", stage: 1 }],
    desc: "Sends one perfect cutting feather. Lands critical hits often.",
  },
  {
    id: "harmattan",
    name: "Harmattan",
    type: "sky",
    cat: "special",
    power: 85,
    acc: 90,
    pp: 10,
    desc: "Calls the dry desert wind that carries everything away.",
  },

  // --- Thunder ------------------------------------------------------------
  {
    id: "spark",
    name: "Spark",
    type: "thunder",
    cat: "physical",
    power: 40,
    acc: 100,
    pp: 30,
    effects: [{ kind: "status", status: "paralysis", chance: 10 }],
    desc: "Charges in with its body full of electricity.",
  },
  {
    id: "shockWave",
    name: "Shock Wave",
    type: "thunder",
    cat: "status",
    power: null,
    acc: 90,
    pp: 20,
    effects: [{ kind: "status", status: "paralysis", chance: 100 }],
    desc: "A weak jolt that leaves the target paralysed.",
  },
  {
    id: "lightning",
    name: "Lightning",
    type: "thunder",
    cat: "special",
    power: 60,
    acc: 100,
    pp: 20,
    effects: [{ kind: "status", status: "paralysis", chance: 10 }],
    desc: "Lets off an electric discharge.",
  },
  {
    id: "thunderclap",
    name: "Thunderclap",
    type: "thunder",
    cat: "special",
    power: 110,
    acc: 70,
    pp: 10,
    effects: [{ kind: "status", status: "paralysis", chance: 30 }],
    desc: "An enormous bolt. It misses often, but it hurts.",
  },

  // --- Poison -------------------------------------------------------------
  {
    id: "venomSting",
    name: "Venom Sting",
    type: "poison",
    cat: "physical",
    power: 50,
    acc: 100,
    pp: 25,
    effects: [{ kind: "status", status: "poison", chance: 30 }],
    desc: "Drives in a stinger loaded with venom.",
  },
  {
    id: "toxicDust",
    name: "Toxic Dust",
    type: "poison",
    cat: "status",
    power: null,
    acc: 80,
    pp: 20,
    effects: [{ kind: "status", status: "poison", chance: 100 }],
    desc: "Scatters a dust that poisons the target.",
  },
  {
    id: "acid",
    name: "Acid",
    type: "poison",
    cat: "special",
    power: 40,
    acc: 100,
    pp: 30,
    effects: [{ kind: "stat", target: "foe", changes: { spDefense: -1 }, chance: 20 }],
    desc: "Sprays a liquid that eats through anything.",
  },
  {
    id: "bitterSoup",
    name: "Bitter Soup",
    type: "poison",
    cat: "special",
    power: 70,
    acc: 100,
    pp: 15,
    effects: [{ kind: "status", status: "poison", chance: 20 }],
    desc: "A hot bowl that nobody should have eaten.",
  },

  // --- Spirit -------------------------------------------------------------
  {
    id: "shadowTouch",
    name: "Shadow Touch",
    type: "spirit",
    cat: "special",
    power: 50,
    acc: 100,
    pp: 25,
    desc: "Turns the target's own shadow against it.",
  },
  {
    id: "darkStare",
    name: "Dark Stare",
    type: "spirit",
    cat: "status",
    power: null,
    acc: 100,
    pp: 20,
    effects: [{ kind: "stat", target: "foe", changes: { spAttack: -1 }, chance: 100 }],
    desc: "A stare that drains the will to fight. Lowers Sp. Atk.",
  },
  {
    id: "shadowBall",
    name: "Shadow Ball",
    type: "spirit",
    cat: "special",
    power: 80,
    acc: 100,
    pp: 15,
    effects: [{ kind: "stat", target: "foe", changes: { spDefense: -1 }, chance: 20 }],
    desc: "Throws a ball of thick darkness.",
  },

  // --- Metal --------------------------------------------------------------
  {
    id: "metalClaw",
    name: "Metal Claw",
    type: "metal",
    cat: "physical",
    power: 50,
    acc: 95,
    pp: 35,
    effects: [{ kind: "stat", target: "self", changes: { attack: 1 }, chance: 20 }],
    desc: "Cuts with hard claws. Sometimes raises its own Attack.",
  },
  {
    id: "brassShield",
    name: "Brass Shield",
    type: "metal",
    cat: "status",
    power: null,
    acc: null,
    pp: 20,
    effects: [{ kind: "stat", target: "self", changes: { defense: 2 }, chance: 100 }],
    desc: "Hides behind a sheet of beaten brass. Raises Defense sharply.",
  },
  {
    id: "royalOrder",
    name: "Royal Order",
    type: "metal",
    cat: "status",
    power: null,
    acc: 100,
    pp: 20,
    effects: [{ kind: "stat", target: "foe", changes: { attack: -1, defense: -1 }, chance: 100 }],
    desc: "Gives an order nobody dares refuse. Lowers Attack and Defense.",
  },
  {
    id: "goldStrike",
    name: "Gold Strike",
    type: "metal",
    cat: "physical",
    power: 80,
    acc: 95,
    pp: 15,
    desc: "One dry blow with a solid lump of gold.",
  },
];

/** Every move, keyed by identifier. */
export const MOVES = Object.freeze(
  Object.fromEntries(MOVE_LIST.map((move) => [move.id, Object.freeze({ effects: [], ...move })])),
);

/** Every move identifier, in the order they are written above. */
export const MOVE_IDS = MOVE_LIST.map((move) => move.id);

/**
 * One move by identifier.
 * @returns {object|null} null when nothing has that identifier
 */
export function getMove(id) {
  return MOVES[id] ?? null;
}

/** True when the move does no damage. */
export function isStatusMove(move) {
  return move.cat === "status";
}
