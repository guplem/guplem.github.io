// Every creature in the first area.
//
// Twenty one species: three starters with their evolutions, the seven that
// stand for the friends on the trip, and eight wild ones that fill the routes.
//
// Fields:
//   id         permanent identifier. It goes into save files. Never rename one.
//   name       what the player reads.
//   types      one or two entries from `types.js`.
//   base       the six base stats. `statsAtLevel` in `monsters.js` grows them.
//   catchRate  3 is almost impossible, 255 is almost free. Same scale as Pokemon.
//   baseExp    how much experience beating one gives.
//   growth     "fast", "medium" or "slow". See `EXP_CURVES` in `monsters.js`.
//   learnset   [level, moveId] pairs, in level order. Level 1 entries are the
//              starting moves. A creature keeps the last four it learned.
//   evolve     { to, level } or null.
//   entry      one or two lines of flavour. The field guide screen is not built
//              yet (see ROADMAP.md) but the text is written and tested already.
//
// A creature holds at most four moves, so a learnset longer than four means the
// player has to choose. That is the intended pressure.

const SPECIES_LIST = [
  // --- The three starters -------------------------------------------------
  {
    id: "baobo",
    name: "Baobo",
    types: ["grass"],
    base: { hp: 50, attack: 48, defense: 55, spAttack: 55, spDefense: 55, speed: 35 },
    catchRate: 45,
    baseExp: 62,
    growth: "medium",
    learnset: [
      [1, "tackle"],
      [1, "growl"],
      [5, "vineWhip"],
      [9, "deepRoots"],
      [13, "razorLeaf"],
      [18, "sleepSpores"],
      [24, "seedBomb"],
    ],
    evolve: { to: "baobanto", level: 16 },
    height: 0.5,
    weight: 9.2,
    entry: "A baobab seedling that pulled itself out of the soil. Its swollen trunk holds enough water to walk through a whole dry season.",
  },
  {
    id: "baobanto",
    name: "Baobanto",
    types: ["grass", "earth"],
    base: { hp: 75, attack: 70, defense: 85, spAttack: 75, spDefense: 75, speed: 45 },
    catchRate: 45,
    baseExp: 160,
    growth: "medium",
    learnset: [
      [1, "tackle"],
      [1, "growl"],
      [1, "vineWhip"],
      [9, "deepRoots"],
      [13, "razorLeaf"],
      [18, "sleepSpores"],
      [26, "seedBomb"],
      [33, "earthquake"],
    ],
    evolve: null,
    height: 1.6,
    weight: 88,
    entry: "Villages plant one at every crossroads. A grown Baobanto remembers every person who has ever rested in its shade.",
  },
  {
    id: "ananse",
    name: "Ananse",
    types: ["fire"],
    base: { hp: 44, attack: 58, defense: 44, spAttack: 60, spDefense: 48, speed: 62 },
    catchRate: 45,
    baseExp: 62,
    growth: "medium",
    learnset: [
      [1, "scratch"],
      [1, "growl"],
      [5, "ember"],
      [9, "smokeScreen"],
      [13, "bite"],
      [18, "fireFang"],
      [24, "fireDance"],
    ],
    evolve: { to: "ansefo", level: 16 },
    height: 0.4,
    weight: 5.5,
    entry: "Named after the storyteller spider. It keeps one ember alive in its web and tells the story of how it got there.",
  },
  {
    id: "ansefo",
    name: "Ansefo",
    types: ["fire", "spirit"],
    base: { hp: 62, attack: 80, defense: 58, spAttack: 82, spDefense: 62, speed: 80 },
    catchRate: 45,
    baseExp: 160,
    growth: "medium",
    learnset: [
      [1, "scratch"],
      [1, "ember"],
      [1, "smokeScreen"],
      [13, "bite"],
      [18, "fireFang"],
      [24, "fireDance"],
      [31, "shadowBall"],
      [38, "flamethrower"],
    ],
    evolve: null,
    height: 1.3,
    weight: 34,
    entry: "Its web catches shadows as easily as insects. Elders say every story it has been told is hanging in there somewhere.",
  },
  {
    id: "volti",
    name: "Volti",
    types: ["water"],
    base: { hp: 55, attack: 45, defense: 58, spAttack: 60, spDefense: 60, speed: 40 },
    catchRate: 45,
    baseExp: 62,
    growth: "medium",
    learnset: [
      [1, "tackle"],
      [1, "tailWhip"],
      [5, "waterJet"],
      [9, "bubble"],
      [13, "bite"],
      [18, "surge"],
      [24, "nap"],
    ],
    evolve: { to: "voltamo", level: 16 },
    height: 0.6,
    weight: 14,
    entry: "A lake calf that follows fishing boats for hours. It surfaces only to check that somebody is still watching.",
  },
  {
    id: "voltamo",
    name: "Voltamo",
    types: ["water", "earth"],
    base: { hp: 85, attack: 72, defense: 80, spAttack: 78, spDefense: 75, speed: 42 },
    catchRate: 45,
    baseExp: 160,
    growth: "medium",
    learnset: [
      [1, "tackle"],
      [1, "waterJet"],
      [1, "bubble"],
      [13, "bite"],
      [18, "surge"],
      [26, "nap"],
      [33, "earthquake"],
      [40, "hydroBlast"],
    ],
    evolve: null,
    height: 2.1,
    weight: 260,
    entry: "It rests on the river bed and lets the current break around it. Boatmen use the ripple it leaves as a channel marker.",
  },

  // --- The seven ----------------------------------------------------------
  {
    id: "hinoko",
    name: "Hinoko",
    types: ["grass"],
    base: { hp: 60, attack: 72, defense: 55, spAttack: 68, spDefense: 58, speed: 77 },
    catchRate: 60,
    baseExp: 145,
    growth: "medium",
    learnset: [
      [1, "scratch"],
      [1, "growl"],
      [6, "vineWhip"],
      [10, "absorb"],
      [14, "razorLeaf"],
      [19, "bite"],
      [25, "sleepSpores"],
      [31, "seedBomb"],
      [37, "deepRoots"],
    ],
    evolve: null,
    height: 1.1,
    weight: 41,
    entry: "Its mane is a knot of living vines that it has never once let anyone comb. Cut one strand and three grow back by morning.",
  },
  {
    id: "polete",
    name: "Polete",
    types: ["thunder"],
    base: { hp: 40, attack: 52, defense: 40, spAttack: 55, spDefense: 45, speed: 95 },
    catchRate: 150,
    baseExp: 82,
    growth: "fast",
    learnset: [
      [1, "tackle"],
      [1, "tailWhip"],
      [4, "spark"],
      [8, "growl"],
      [12, "shockWave"],
      [17, "lightning"],
      [23, "bite"],
      [30, "thunderclap"],
    ],
    evolve: null,
    height: 0.3,
    weight: 3.4,
    entry: "The smallest of the seven and by far the fastest. It has never been seen standing still, not even asleep.",
  },
  {
    id: "nacho",
    name: "Nacho",
    types: ["beast"],
    base: { hp: 130, attack: 95, defense: 78, spAttack: 50, spDefense: 78, speed: 22 },
    catchRate: 25,
    baseExp: 189,
    growth: "slow",
    learnset: [
      [1, "tackle"],
      [1, "nap"],
      [10, "bite"],
      [17, "bodySlam"],
      [24, "bellyDrop"],
      [32, "earthquake"],
    ],
    evolve: null,
    height: 1.9,
    weight: 402,
    entry: "It sleeps eighteen hours a day and eats for the other six. Whatever it is lying on becomes its property.",
  },
  {
    id: "seryi",
    name: "Seryi",
    types: ["fire", "spirit"],
    base: { hp: 65, attack: 60, defense: 60, spAttack: 88, spDefense: 72, speed: 80 },
    catchRate: 45,
    baseExp: 158,
    growth: "medium",
    learnset: [
      [1, "ember"],
      [1, "smokeScreen"],
      [8, "shadowTouch"],
      [13, "fireDance"],
      [19, "darkStare"],
      [25, "fireFang"],
      [32, "shadowBall"],
      [39, "flamethrower"],
    ],
    evolve: null,
    height: 1.5,
    weight: 28,
    entry: "A carved mask that dances with nobody wearing it. The smoke off its long pipe keeps time with the drums, and it will not dance without both.",
  },
  {
    id: "carsla",
    name: "Carsla",
    types: ["metal"],
    base: { hp: 70, attack: 78, defense: 105, spAttack: 70, spDefense: 90, speed: 42 },
    catchRate: 30,
    baseExp: 172,
    growth: "slow",
    learnset: [
      [1, "metalClaw"],
      [1, "growl"],
      [9, "royalOrder"],
      [15, "brassShield"],
      [21, "goldStrike"],
      [28, "darkStare"],
      [35, "earthquake"],
    ],
    evolve: null,
    height: 1.7,
    weight: 190,
    entry: "It has never once raised its voice. It has never once had to. Everything within sight of its crown already knows the rule.",
  },
  {
    id: "gis",
    name: "Gis",
    types: ["sky"],
    base: { hp: 62, attack: 55, defense: 58, spAttack: 88, spDefense: 75, speed: 92 },
    catchRate: 45,
    baseExp: 156,
    growth: "medium",
    learnset: [
      [1, "peck"],
      [1, "tailWhip"],
      [6, "fineFeather"],
      [11, "wingBeat"],
      [17, "smokeScreen"],
      [24, "harmattan"],
      [31, "nap"],
    ],
    evolve: null,
    height: 1.2,
    weight: 22,
    entry: "It will not put a foot on ground it considers dirty, which is nearly all of it. It has been known to wait out a whole rainy season in a tree.",
  },
  {
    id: "poya",
    name: "Poya",
    types: ["earth"],
    base: { hp: 85, attack: 110, defense: 80, spAttack: 40, spDefense: 55, speed: 62 },
    catchRate: 45,
    baseExp: 170,
    growth: "medium",
    learnset: [
      [1, "tackle"],
      [1, "hornCharge"],
      [7, "sandThrow"],
      [12, "mudSlam"],
      [19, "bite"],
      [25, "sharpStone"],
      [32, "earthquake"],
      [39, "bellyDrop"],
    ],
    evolve: null,
    height: 1.6,
    weight: 310,
    entry: "All shoulder and no patience. It charges first and works out what it hit afterwards, and it is rarely sorry.",
  },

  // --- Wild creatures of the first area -----------------------------------
  {
    id: "sumsu",
    name: "Sumsu",
    types: ["sky"],
    base: { hp: 40, attack: 45, defense: 40, spAttack: 35, spDefense: 35, speed: 56 },
    catchRate: 190,
    baseExp: 50,
    growth: "fast",
    learnset: [
      [1, "peck"],
      [1, "growl"],
      [5, "wingBeat"],
      [9, "sandThrow"],
      [14, "fineFeather"],
      [20, "harmattan"],
    ],
    evolve: null,
    height: 0.2,
    weight: 0.9,
    entry: "It weaves a new nest every week and abandons every single one. A tree full of empty Sumsu nests means one very busy bird.",
  },
  {
    id: "gori",
    name: "Gori",
    types: ["beast"],
    base: { hp: 45, attack: 56, defense: 40, spAttack: 35, spDefense: 40, speed: 62 },
    catchRate: 190,
    baseExp: 54,
    growth: "fast",
    learnset: [
      [1, "scratch"],
      [1, "tailWhip"],
      [5, "bite"],
      [10, "growl"],
      [16, "bodySlam"],
      [22, "nap"],
    ],
    evolve: null,
    height: 0.5,
    weight: 6.1,
    entry: "It takes whatever it likes the look of and returns it only in exchange for food. Travellers learn to carry a spare of everything.",
  },
  {
    id: "kanku",
    name: "Kanku",
    types: ["poison"],
    base: { hp: 48, attack: 62, defense: 48, spAttack: 50, spDefense: 45, speed: 50 },
    catchRate: 150,
    baseExp: 58,
    growth: "fast",
    learnset: [
      [1, "tackle"],
      [1, "venomSting"],
      [6, "toxicDust"],
      [11, "bite"],
      [17, "acid"],
      [23, "bitterSoup"],
      [29, "sharpStone"],
    ],
    evolve: null,
    height: 0.9,
    weight: 5.8,
    entry: "It does not move out of the path. The path moves around it. Every child in the region can name it before they can read.",
  },
  {
    id: "krabo",
    name: "Krabo",
    types: ["water"],
    base: { hp: 52, attack: 65, defense: 72, spAttack: 35, spDefense: 45, speed: 40 },
    catchRate: 150,
    baseExp: 62,
    growth: "fast",
    learnset: [
      [1, "tackle"],
      [1, "bubble"],
      [6, "pincers"],
      [11, "sandThrow"],
      [17, "waterJet"],
      [23, "surge"],
      [30, "hydroBlast"],
    ],
    evolve: null,
    height: 0.3,
    weight: 7.4,
    entry: "It walks sideways on purpose so that nothing can work out where it is going. It has been doing this for a very long time.",
  },
  {
    id: "dungu",
    name: "Dungu",
    types: ["earth", "metal"],
    base: { hp: 58, attack: 68, defense: 95, spAttack: 40, spDefense: 60, speed: 35 },
    catchRate: 90,
    baseExp: 96,
    growth: "medium",
    learnset: [
      [1, "scratch"],
      [1, "brassShield"],
      [7, "mudSlam"],
      [13, "metalClaw"],
      [18, "sharpStone"],
      [24, "goldStrike"],
      [31, "earthquake"],
    ],
    evolve: null,
    height: 0.8,
    weight: 33,
    entry: "It rolls into a ball of overlapping scales. Nothing that has tried has ever got in, and a few things are still out there trying.",
  },
  {
    id: "tsetse",
    name: "Tsetse",
    types: ["poison", "sky"],
    base: { hp: 40, attack: 50, defense: 38, spAttack: 62, spDefense: 42, speed: 88 },
    catchRate: 120,
    baseExp: 72,
    growth: "fast",
    learnset: [
      [1, "peck"],
      [1, "venomSting"],
      [5, "toxicDust"],
      [10, "acid"],
      [16, "wingBeat"],
      [22, "fineFeather"],
      [28, "harmattan"],
    ],
    evolve: null,
    height: 0.2,
    weight: 0.4,
    entry: "Small, quiet, and the whole reason nobody sleeps well near the water. Its wings hum in a key that carries for miles.",
  },
  {
    id: "sasabon",
    name: "Sasabon",
    types: ["spirit"],
    base: { hp: 62, attack: 70, defense: 62, spAttack: 88, spDefense: 70, speed: 68 },
    catchRate: 45,
    baseExp: 150,
    growth: "slow",
    learnset: [
      [1, "shadowTouch"],
      [1, "growl"],
      [8, "bite"],
      [14, "darkStare"],
      [20, "smokeScreen"],
      [27, "shadowBall"],
      [34, "nap"],
    ],
    evolve: null,
    height: 1.8,
    weight: 60,
    entry: "A shape in the canopy with its feet hanging down. Everyone who has seen one describes it differently, and all of them are sure.",
  },
  {
    id: "siko",
    name: "Siko",
    types: ["metal"],
    base: { hp: 55, attack: 70, defense: 88, spAttack: 45, spDefense: 60, speed: 30 },
    catchRate: 60,
    baseExp: 110,
    growth: "medium",
    learnset: [
      [1, "tackle"],
      [1, "brassShield"],
      [7, "metalClaw"],
      [13, "sandThrow"],
      [20, "goldStrike"],
      [27, "royalOrder"],
      [33, "earthquake"],
    ],
    evolve: null,
    height: 0.4,
    weight: 96,
    entry: "A lump of river gold that learned to walk. Equip Galamsey wants every one of them, which is exactly why the river hides them.",
  },
];

/** Every species, keyed by identifier. */
export const SPECIES = Object.freeze(
  Object.fromEntries(SPECIES_LIST.map((species) => [species.id, Object.freeze(species)])),
);

/** Every species identifier, in field-guide order. */
export const SPECIES_IDS = SPECIES_LIST.map((species) => species.id);

/** The three the professor offers, in the order she lays them out. */
export const STARTER_IDS = ["baobo", "ananse", "volti"];

/** The seven that stand for the friends on the trip. */
export const FRIEND_IDS = ["hinoko", "polete", "nacho", "seryi", "carsla", "gis", "poya"];

/**
 * One species by identifier.
 * @returns {object|null} null when nothing has that identifier
 */
export function getSpecies(id) {
  return SPECIES[id] ?? null;
}

/** The sum of a species' six base stats. Used to compare rough power. */
export function baseStatTotal(species) {
  return Object.values(species.base).reduce((sum, value) => sum + value, 0);
}

/**
 * The moves a species knows if it reached this level without ever being taught
 * anything else: the last four it would have learned.
 */
export function movesAtLevel(species, level) {
  const learned = species.learnset
    .filter(([atLevel]) => atLevel <= level)
    .map(([, moveId]) => moveId);
  const unique = [...new Set(learned)];
  return unique.slice(-4);
}

/**
 * The move a species learns exactly on this level, if any.
 * @returns {string[]} usually empty or one entry
 */
export function movesLearnedAt(species, level) {
  return species.learnset.filter(([atLevel]) => atLevel === level).map(([, moveId]) => moveId);
}

/** What this species becomes at this level, or null if nothing changes. */
export function evolutionAt(species, level) {
  if (!species.evolve) return null;
  return level >= species.evolve.level ? species.evolve.to : null;
}
