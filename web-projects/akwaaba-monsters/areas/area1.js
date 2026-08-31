// Area 1: Aduma village to the Bosua gym.
//
// EVERYTHING about this area lives in this one file: the maps, the people, the
// trainers and every line anybody says. Nothing outside `areas/` knows that
// Aduma exists. That is the point (see ADR 0003): area 2 is a new file next to
// this one, registered in `areas/index.js`, and no engine code changes.
//
// If you are the agent building area 2, read `ROADMAP.md` first. It lists what
// this area deliberately left out and where the seams are.
//
// ---------------------------------------------------------------------------
// The shape of the area
//
//   playerHouse --+
//   villagerHouse-+-- village ---> route1 ---> river ---> bosua ---> gym
//   profHut ------+                             |          |
//                                              mine      centre
//
// The way east out of `river` is held shut by an Equip Galamsey guard until the
// player beats Nana Sika in the mine. That is the only gate in the area.
//
// ---------------------------------------------------------------------------
// The flags this area sets, in the order the story sets them
//
//   metProfessor    talked to Professor Abenaa
//   gotStarter      chose a first creature
//   beatSopa1/2/3   beat Mama Sopa at the village, the river and the gym door
//   ateSoup         accepted a bowl at least once (a joke, and a poisoned party)
//   ateSoup1/2/3    accepted the bowl at that one meeting. The soup poisons the
//                   party after the fight, so each meeting needs its own flag:
//                   `ateSoup` never clears, and would poison a player who ate
//                   once and refused every time after that.
//   beatGrunt1..4   beat each Equip Galamsey member
//   beatBoss        beat Nana Sika, which opens the road east
//   metNacho        woke the huge thing sleeping by the river
//   gotBadge        beat Nana Kofi
//
// Flag names are permanent: they are written into save files.

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

/**
 * One legend for every map in the area, so a character means the same thing
 * everywhere. A new area may write its own, but keeping these is kinder.
 */
export const LEGEND = {
  ".": "path",
  ",": "grass",
  '"': "tall",
  _: "sand",
  "&": "mud",
  "+": "flowers",
  "~": "water",
  "=": "bridge",
  L: "ledge",
  T: "tree",
  P: "palm",
  R: "rock",
  C: "crop",
  F: "fence",
  H: "hut",
  A: "roof",
  S: "sign",
  D: "door",
  "#": "wall",
  f: "floor",
  m: "mat",
  b: "bed",
  t: "table",
  c: "counter",
  h: "shelf",
  o: "pot",
  u: "statue",
  // The two machines the player presses A on: `e` heals the party and `k`
  // opens the box. Writing one into a map is all it takes; `objects.js` holds
  // what each one says and does.
  e: "healer",
  k: "computer",
  ":": "cave",
  "%": "caveWall",
  "*": "oreRock",
  G: "gymFloor",
  x: "exit",
  ">": "stairs",
};

// ---------------------------------------------------------------------------
// Trainers
// ---------------------------------------------------------------------------

/**
 * Everyone who fights the player.
 *
 * `party` is built into real creatures when the battle starts, so a level here
 * is the whole specification. `prize` is the money a win pays.
 */
export const TRAINERS = {
  mamaSopa1: {
    name: "Mama Sopa",
    sprite: "mamaSopa",
    prize: 240,
    party: [{ species: "kanku", level: 5 }],
    intro: "You look hungry. Everybody who walks past my pot looks hungry.",
    defeat: "Hm. You did not even taste it.",
  },
  mamaSopa2: {
    name: "Mama Sopa",
    sprite: "mamaSopa",
    prize: 520,
    party: [
      { species: "kanku", level: 10 },
      { species: "krabo", level: 11 },
    ],
    intro: "The banku pot is bigger now. I have been busy.",
    defeat: "You are quicker than the last one. He is still lying down.",
  },
  mamaSopa3: {
    name: "Mama Sopa",
    sprite: "mamaSopa",
    prize: 900,
    party: [
      { species: "kanku", level: 12 },
      { species: "tsetse", level: 13 },
      { species: "krabo", level: 14 },
    ],
    intro: "The gym? First you eat. Everybody eats before the gym.",
    defeat: "Go on then. Go and win. I will keep some warm for you.",
  },

  farmerKojo: {
    name: "Farmer Kojo",
    sprite: "villagerMan",
    prize: 200,
    // The first trainer on the road. Nothing here is strong against any
    // starter, which is what makes it the first one. See `balance.test.js`.
    party: [
      { species: "gori", level: 5 },
      { species: "kanku", level: 5 },
    ],
    intro: "This one keeps stealing my groundnuts. Maybe you can tire it out.",
    defeat: "Take a rest. The road north is long and the sun is not kind.",
  },
  watcherAma: {
    name: "Watcher Ama",
    sprite: "villagerWoman",
    prize: 260,
    // She used to bring two creatures of the sky, and the sky is twice as
    // strong against grass, so every move she had beat the grass starter. The
    // thief that empties her nests answers that and tells a better joke.
    party: [
      { species: "sumsu", level: 6 },
      { species: "gori", level: 6 },
    ],
    intro: "Quiet! I have been counting nests since sunrise. You have ruined it.",
    defeat: "Forty one nests. All of them empty. And now I know where the eggs went.",
  },
  fisherKweku: {
    name: "Fisher Kweku",
    sprite: "fisherman",
    prize: 300,
    party: [
      { species: "krabo", level: 8 },
      { species: "volti", level: 9 },
    ],
    intro: "No fish today. No fish for three weeks. You want to know why? Look at the water.",
    defeat: "The river used to be green. Green, not this.",
  },

  grunt1: {
    name: "Galamsey Digger",
    sprite: "grunt",
    prize: 280,
    // Kanku learns Venom Sting at 7, and poison is twice as strong against
    // grass. At level 6 he blocks the road with two creatures instead of one,
    // which is a step up in size and not in element.
    party: [
      { species: "gori", level: 6 },
      { species: "kanku", level: 6 },
    ],
    intro: "This road is ours now. Everything under it is ours too.",
    defeat: "Fine. Go and see the mess for yourself.",
  },
  grunt2: {
    name: "Galamsey Digger",
    sprite: "grunt",
    prize: 340,
    party: [
      { species: "gori", level: 9 },
      { species: "kanku", level: 9 },
    ],
    intro: "The river washes the gold out for us. We only help it along.",
    defeat: "Help it along, poison it, what is the difference to you?",
  },
  grunt3: {
    name: "Galamsey Washer",
    sprite: "grunt",
    prize: 380,
    party: [{ species: "siko", level: 11 }],
    intro: "Look at this one. Walked straight into my pan. It is mine now.",
    defeat: "It was not mine. I know. Do not say it.",
  },
  grunt4: {
    name: "Galamsey Foreman",
    sprite: "grunt",
    prize: 440,
    party: [
      { species: "kanku", level: 11 },
      { species: "tsetse", level: 12 },
    ],
    intro: "Nana Sika is right behind me. Turn around while you still can.",
    defeat: "He will not be as easy as me.",
  },
  nanaSika: {
    name: "Nana Sika",
    sprite: "boss",
    prize: 2000,
    // The biggest fight before the gym, and still under it. All three of these
    // are metal or earth and metal, which resists five of the ten elements, so
    // the party matters more here than the levels do. His ace used to sit at 16,
    // level with the gym leader's, which left the leader nothing to add.
    party: [
      { species: "siko", level: 12 },
      { species: "dungu", level: 13 },
      { species: "carsla", level: 14 },
    ],
    intro:
      "Gold does not belong to a river. It belongs to whoever is willing to take it out. That has always been the rule.",
    defeat: "One child. One child and a rule that has stood for forty years.",
  },

  gymAkosua: {
    name: "Gym Trainer Akosua",
    sprite: "villagerWoman",
    prize: 500,
    party: [
      { species: "dungu", level: 12 },
      { species: "krabo", level: 12 },
    ],
    intro: "Nana Kofi says the ground teaches patience. I am still learning patience.",
    defeat: "Go on. He is waiting at the top.",
  },
  gymYaw: {
    name: "Gym Trainer Yaw",
    sprite: "villagerMan",
    prize: 540,
    party: [{ species: "poya", level: 14 }],
    intro: "Anything that stands on the ground can be knocked back into it.",
    defeat: "Anything that flies, though. That is the trouble.",
  },
  nanaKofi: {
    name: "Nana Kofi",
    sprite: "gymLeader",
    prize: 1600,
    party: [
      { species: "dungu", level: 14 },
      { species: "poya", level: 16 },
    ],
    intro:
      "So you are the one who walked into the mine. Good. Now show me you can hold your ground as well as you can take it.",
    defeat: "The ground gave way. It does that, when somebody stands on it properly.",
  },
};

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

const playerHouse = {
  id: "playerHouse",
  name: "Your Room",
  music: "town",
  width: 10,
  height: 8,
  base: "floor",
  legend: LEGEND,
  ground: [
    "##########",
    "#bfffftfh#",
    "#bffffffh#",
    "#ffmmffff#",
    "#ffmmffff#",
    "#ffffffff#",
    "#fffDffff#",
    "##########",
  ],
  warps: [{ x: 4, y: 6, to: "village", tx: 3, ty: 5, dir: "down" }],
  signs: [
    {
      x: 8,
      y: 1,
      text: "A shelf of school books, and one page of notes about the creatures on Route 1.",
    },
  ],
  npcs: [],
  triggers: [],
};

const villagerHouse = {
  id: "villagerHouse",
  name: "Elder's House",
  music: "town",
  width: 10,
  height: 8,
  base: "floor",
  legend: LEGEND,
  ground: [
    "##########",
    "#hffttffh#",
    "#ffffffff#",
    "#fmmffoff#",
    "#fmmffffb#",
    "#ffffffff#",
    "#fffDffff#",
    "##########",
  ],
  warps: [{ x: 4, y: 6, to: "village", tx: 3, ty: 13, dir: "down" }],
  signs: [{ x: 6, y: 3, text: "A cooking pot, scrubbed and put away." }],
  npcs: [
    {
      id: "elder",
      sprite: "elder",
      x: 3,
      y: 3,
      dir: "down",
      script: [
        ["say", "Sit down, sit down. You are going north, I can see it on you."],
        [
          "say",
          "A calabash is not a trap. You weaken the creature first, and then you ask. Weak and sleeping is best of all.",
        ],
        [
          "if",
          { notFlag: "elderGift" },
          [
            ["say", "Take these. I have no use for them now."],
            ["give", "calabash", 5],
            ["give", "sachetWater", 3],
            ["setFlag", "elderGift"],
          ],
          [["say", "Throw straight, and do not waste them."]],
        ],
      ],
    },
  ],
  triggers: [],
};

const profHut = {
  id: "profHut",
  name: "Professor Abenaa's Hut",
  music: "town",
  width: 12,
  height: 9,
  base: "floor",
  legend: LEGEND,
  ground: [
    "############",
    "#hhekffffhh#",
    "#ffffttffff#",
    "#ffffttffff#",
    "#ffffffffff#",
    "#ffoffffoff#",
    "#ffffffffff#",
    "#ffffDfffff#",
    "############",
  ],
  warps: [{ x: 5, y: 7, to: "village", tx: 17, ty: 6, dir: "down" }],
  signs: [
    {
      x: 1,
      y: 1,
      text: "Jars, notebooks and a map of the region with the river marked in red ink.",
    },
  ],
  npcs: [
    {
      id: "professor",
      sprite: "professor",
      x: 5,
      y: 4,
      dir: "down",
      script: [
        [
          "if",
          { flag: "gotStarter" },
          [
            ["say", "Keep going north. And do not drink anything Mama Sopa gives you."],
            ["end"],
          ],
        ],
        ["say", "Akwaaba! You are late, and I am glad you are late, because I only just finished."],
        [
          "say",
          "I am Abenaa. I study the creatures of this region, and lately I have been studying why there are fewer of them every month.",
        ],
        ["setFlag", "metProfessor"],
        ["say", "Three of them have been waiting for somebody. Go on. Choose."],
        ["chooseStarter"],
      ],
    },
    {
      id: "assistant",
      sprite: "shopkeeper",
      x: 9,
      y: 3,
      dir: "left",
      script: [
        [
          "if",
          { flag: "gotStarter" },
          [
            [
              "say",
              "Press A on the tall grass and something will jump out sooner or later. That is the whole method.",
            ],
          ],
          [
            [
              "say",
              "She has been up since four. Do not tell her the third jar is the wrong way round.",
            ],
          ],
        ],
      ],
    },
  ],
  triggers: [],
};

const village = {
  id: "village",
  name: "Aduma Village",
  music: "town",
  width: 22,
  height: 18,
  base: "grass",
  legend: LEGEND,
  ground: [
    "TTTTTTTTTT..TTTTTTTTTT",
    "T,,,,,,,,,..,,,,,,,,,T",
    "T,,,,,,,,,..,,,,,,,,,T",
    "T,AAAA,,,,..,,,AAAAA,T",
    "T,HHHH,,,,..,,,HHHHH,T",
    "T,HDHH,,,,..,,,HHHHH,T",
    "T,,,,,,,,,..,,,HHDHH,T",
    "T,..................,T",
    "T,,,,,,,,,..,,,,,,,,,T",
    "T,,,,,+,,,..,,,,,,,,,T",
    "T,,,,,,,,,..,,,,,,,,,T",
    "T,AAAA,,,,..,,,,,,,,,T",
    "T,HHHH,,,,..,,,,,,,,,T",
    "T,HDHH,,,,..,,,,,,,,,T",
    "T,,,,,,,,,..,,,,,,,,,T",
    "T,,,,,,,,,..,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,T",
    "TTTTTTTTTTTTTTTTTTTTTT",
  ],
  over: [
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "        S             ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
  ],
  warps: [
    { x: 3, y: 5, to: "playerHouse", tx: 4, ty: 6, dir: "up" },
    { x: 17, y: 6, to: "profHut", tx: 5, ty: 7, dir: "up" },
    { x: 3, y: 13, to: "villagerHouse", tx: 4, ty: 6, dir: "up" },
    { x: 10, y: 0, to: "route1", tx: 9, ty: 22, dir: "up" },
    { x: 11, y: 0, to: "route1", tx: 10, ty: 22, dir: "up" },
  ],
  signs: [
    {
      x: 8,
      y: 8,
      text: "ADUMA VILLAGE. Small enough that everyone knows your name. Route 1 is north.",
    },
  ],
  npcs: [
    {
      id: "villageKid",
      sprite: "child",
      x: 7,
      y: 10,
      dir: "down",
      wander: true,
      script: [
        [
          "say",
          "My uncle went up to the river to fish and came back with nothing. Nothing! He is very annoyed.",
        ],
      ],
    },
    {
      id: "villageWoman",
      sprite: "villagerWoman",
      x: 15,
      y: 8,
      dir: "left",
      script: [
        [
          "if",
          { flag: "beatBoss" },
          [["say", "The water is running clear again. My mother has not stopped talking about it."]],
          [["say", "Professor Abenaa is in the big hut. She has been asking for you all morning."]],
        ],
      ],
    },
    {
      id: "villageMan",
      sprite: "villagerMan",
      x: 5,
      y: 15,
      dir: "up",
      script: [
        [
          "say",
          "Bosua is east of the river, past the bridge. There is a gym there. A real one, with a chief who runs it.",
        ],
      ],
    },
    {
      id: "sopaVillage",
      sprite: "mamaSopa",
      x: 13,
      y: 2,
      dir: "left",
      hideWhen: { flag: "beatSopa1" },
      script: [["say", "Go north. The river is waiting, and so am I."]],
    },
    // Stands in the gap and will not move until the player has a creature.
    {
      id: "villageGate",
      sprite: "villagerMan",
      x: 10,
      y: 1,
      dir: "down",
      hideWhen: { flag: "gotStarter" },
      script: [
        [
          "say",
          "Hold on. There is tall grass up there and you are carrying nothing but a bag.",
        ],
        ["say", "Go and see Abenaa first. She has been waiting."],
      ],
    },
  ],
  triggers: [
    {
      x: 10,
      y: 2,
      once: "sopaMet",
      condition: { flag: "gotStarter" },
      script: [
        ["music", "boss"],
        ["say", "Wait small!"],
        ["walk", "sopaVillage", "left", 2],
        ["face", "sopaVillage", "left"],
        [
          "say",
          "You are the one going north. Everybody going north walks past my pot, and nobody walks past my banku hungry.",
        ],
        [
          "ask",
          "Mama Sopa ladles banku and soup into a bowl and holds it out.",
          [
            {
              label: "Eat it",
              then: [
                ["sound", "hit"],
                ["say", "The banku is warm and the soup is warmer. Something in the soup is moving."],
                ["setFlag", "ateSoup"],
                ["setFlag", "ateSoup1"],
                ["say", "Mama Sopa laughs so hard she has to sit down."],
              ],
            },
            {
              label: "Refuse",
              then: [["say", "She looks at you for a long moment. Nobody refuses the soup."]],
            },
          ],
        ],
        ["say", "Then we settle it the other way."],
        ["battle", "mamaSopa1"],
        ["setFlag", "beatSopa1"],
        // The soup only bites once the fight is over. A poisoned party walking
        // into a battle the player cannot leave is a loss with no way out of
        // it, so the poison waits and the leaf comes with it.
        [
          "if",
          { flag: "ateSoup1" },
          [
            ["say", "Then the soup finds your creatures, and every one of them turns a colour."],
            ["poisonParty"],
            [
              "say",
              "Mama Sopa is still laughing. She pushes a handful of dark leaves across the pot at you.",
            ],
            ["give", "bitterLeaf", 3],
            [
              "say",
              "Bitter leaf. Chew it and the poison goes. Open your bag, pick the leaf, pick the creature.",
            ],
          ],
          [["say", "You kept your mouth shut and your creatures thank you for it."]],
        ],
        ["say", "Go on. I will see you at the river."],
        ["hide", "sopaVillage"],
        ["music", "town"],
      ],
    },
  ],
};

const route1 = {
  id: "route1",
  name: "Route 1",
  music: "route",
  width: 20,
  height: 24,
  base: "grass",
  legend: LEGEND,
  ground: [
    "TTTTTTTTT..TTTTTTTTT",
    "T,,,,,,,,..,,,,,,,,T",
    'T,"""",,,..,,,""",,T',
    'T,"""",,,..,,,""",,T',
    'T,"""",,,..,,,""",,T',
    "T,,,,,,,,..,,,,,,,,T",
    "T,,,,,,,,..,,,,,,,,T",
    "T,,,RR,,,..,,,,,,,,T",
    "T,,,RR,,,..,,,,,,,,T",
    "T,,,,,,,,..,,,,,,,,T",
    'T,,"""",,..,,"""",,T',
    'T,,"""",,..,,"""",,T',
    'T,,"""",,..,,"""",,T',
    "T,,,,,,,,..,,,,,,,,T",
    "T,LLLLLL,..,,,,,,,,T",
    "T,,,,,,,,..,,,,,,,,T",
    "T,,,,,,,,..,,,,,,,,T",
    'T,"""",,,..,,,""",,T',
    'T,"""",,,..,,,""",,T',
    "T,,,,,,,,..,,,,,,,,T",
    "T,,,PP,,,..,,,PP,,,T",
    "T,,,,,,,,..,,,,,,,,T",
    "T,,,,,,,,..,,,,,,,,T",
    "TTTTTTTTT..TTTTTTTTT",
  ],
  encounters: {
    rate: 0.13,
    table: [
      // Three common creatures, all below the level the starter walks in at.
      // This is Emerald's Route 101: Lv 2-3 creatures in front of a Lv 5
      // starter, so the first hour holds a fight the player can always win.
      // Polete, Hinoko and Poya used to stand here. They are three of the
      // seven, they carry 327 to 432 base stat points against a starter's 298,
      // and they now wait on the river and in the mine.
      { species: "sumsu", min: 2, max: 4, weight: 38 },
      { species: "gori", min: 2, max: 4, weight: 34 },
      { species: "kanku", min: 3, max: 4, weight: 28 },
    ],
  },
  warps: [
    { x: 9, y: 23, to: "village", tx: 10, ty: 1, dir: "down" },
    { x: 10, y: 23, to: "village", tx: 11, ty: 1, dir: "down" },
    { x: 9, y: 0, to: "river", tx: 11, ty: 16, dir: "up" },
    { x: 10, y: 0, to: "river", tx: 12, ty: 16, dir: "up" },
  ],
  signs: [
    {
      x: 4,
      y: 7,
      text: "ROUTE 1. Aduma is south. The Pra river is north. Keep to the path in the afternoon heat.",
    },
    {
      x: 5,
      y: 7,
      text: "Somebody has scratched into the rock: WATCH THE GRASS.",
    },
  ],
  npcs: [
    {
      id: "kojo",
      sprite: "villagerMan",
      x: 6,
      y: 19,
      dir: "right",
      sight: 4,
      trainer: "farmerKojo",
      defeatFlag: "beatKojo",
      script: [["say", "Take a rest. The road north is long and the sun is not kind."]],
    },
    {
      id: "ama",
      sprite: "villagerWoman",
      x: 13,
      y: 9,
      dir: "left",
      sight: 3,
      trainer: "watcherAma",
      defeatFlag: "beatAma",
      script: [["say", "Forty one nests. All of them empty. That bird has a problem."]],
    },
    {
      id: "routeGrunt",
      sprite: "grunt",
      x: 12,
      y: 4,
      dir: "left",
      sight: 3,
      trainer: "grunt1",
      defeatFlag: "beatGrunt1",
      script: [
        ["say", "Go and look at the river then. See how you like it."],
      ],
    },
    {
      id: "routeKid",
      sprite: "child",
      x: 15,
      y: 16,
      dir: "down",
      wander: true,
      script: [
        [
          "say",
          "Obroni! Obroni! ...Sorry. My mother says I should say good afternoon instead. Good afternoon!",
        ],
        [
          "if",
          { notFlag: "kidGift" },
          [
            ["say", "Here. I found it in the grass and I already have two."],
            ["give", "calabash", 2],
            ["setFlag", "kidGift"],
          ],
        ],
      ],
    },
  ],
  triggers: [],
};

const river = {
  id: "river",
  name: "Pra Riverside",
  music: "route",
  width: 24,
  height: 18,
  base: "grass",
  legend: LEGEND,
  ground: [
    "TTTTTTTTTT%%%%%%TTTTTTTT",
    "T,,,,,,,,,%%%D%%,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,T",
    "T______________________T",
    "T~~~~~~~~~~~=~~~~~~~~~~T",
    "T~~~~~~~~~~~=~~~~~~~~~~T",
    "T~~~~~~~~~~~=~~~~~~~~~~T",
    "T______________________T",
    "T,,,,,,,,,,,,,,,,,,,,,,.",
    "T,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,RR,,,,,,,,,,,,,,,,,,T",
    "T,,RR,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,T",
    'T,,""""",,,,,,,"""",,,,T',
    'T,,""""",,,,,,,"""",,,,T',
    "T,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,T",
    "TTTTTTTTTTT..TTTTTTTTTTT",
  ],
  encounters: {
    rate: 0.13,
    table: [
      // The second grass, and it opens where Route 1 stopped so there is no
      // level wall between them. This is where the first of the seven turn up.
      { species: "krabo", min: 5, max: 8, weight: 24 },
      { species: "tsetse", min: 5, max: 8, weight: 20 },
      { species: "sumsu", min: 5, max: 7, weight: 16 },
      { species: "kanku", min: 5, max: 8, weight: 14 },
      { species: "polete", min: 6, max: 8, weight: 10 },
      { species: "gis", min: 7, max: 9, weight: 10 },
      { species: "hinoko", min: 7, max: 9, weight: 6 },
    ],
  },
  warps: [
    { x: 11, y: 17, to: "route1", tx: 9, ty: 1, dir: "down" },
    { x: 12, y: 17, to: "route1", tx: 10, ty: 1, dir: "down" },
    { x: 13, y: 1, to: "mine", tx: 9, ty: 12, dir: "up" },
    { x: 23, y: 8, to: "bosua", tx: 1, ty: 8, dir: "right" },
  ],
  signs: [
    {
      x: 3,
      y: 10,
      script: [
        [
          "if",
          { flag: "metNacho" },
          [["say", "The dent it left in the sand is still there."], ["end"]],
        ],
        ["say", "Something enormous is asleep against the rock. It is snoring."],
        [
          "ask",
          "Wake it?",
          [
            {
              label: "Wake it",
              then: [
                ["setFlag", "metNacho"],
                ["say", "It opens one eye. It is not pleased."],
                ["wildBattle", "nacho", 16],
              ],
            },
            { label: "Leave it", then: [["say", "Wise. It is very large."]] },
          ],
        ],
      ],
    },
  ],
  npcs: [
    {
      id: "kweku",
      sprite: "fisherman",
      x: 5,
      y: 7,
      dir: "down",
      sight: 3,
      trainer: "fisherKweku",
      defeatFlag: "beatKweku",
      script: [["say", "The river used to be green. Green, not this."]],
    },
    {
      id: "riverGrunt",
      sprite: "grunt",
      x: 13,
      y: 3,
      dir: "left",
      sight: 3,
      trainer: "grunt2",
      defeatFlag: "beatGrunt2",
      script: [["say", "Go up and see him then. See what he says to you."]],
    },
    // The only gate in the area: this one stands in the way east.
    {
      id: "riverGate",
      sprite: "grunt",
      x: 22,
      y: 8,
      dir: "left",
      hideWhen: { flag: "beatBoss" },
      script: [
        ["say", "Road is closed. Equip Galamsey is working."],
        [
          "if",
          { flag: "beatGrunt2" },
          [["say", "Take it up with Nana Sika. He is in the mine, over the bridge."]],
          [["say", "Nobody goes to Bosua until we are finished. And we are never finished."]],
        ],
      ],
    },
    {
      id: "sopaRiver",
      sprite: "mamaSopa",
      x: 15,
      y: 7,
      dir: "left",
      hideWhen: { flag: "beatSopa2" },
      script: [["say", "Eat something. You are all bones."]],
    },
    {
      id: "riverWoman",
      sprite: "villagerWoman",
      x: 17,
      y: 12,
      dir: "down",
      script: [
        [
          "if",
          { flag: "beatBoss" },
          [["say", "Clear water. I could cry. Go on to Bosua, they will have heard by now."]],
          [
            [
              "say",
              "They call it galamsey. Digging for gold with no licence and no care. The mercury goes straight into the water.",
            ],
          ],
        ],
      ],
    },
  ],
  triggers: [
    {
      x: 12,
      y: 7,
      once: "sopaRiver",
      condition: { flag: "beatSopa1" },
      script: [
        ["music", "boss"],
        ["say", "There you are."],
        ["walk", "sopaRiver", "left", 2],
        ["face", "sopaRiver", "left"],
        [
          "say",
          "You walked all that way on an empty stomach. Look at you. Sit. Eat.",
        ],
        [
          "ask",
          "Mama Sopa rolls a ball of banku into a bowl and covers it from the same pot.",
          [
            {
              label: "Eat it",
              then: [
                ["sound", "hit"],
                ["say", "Same banku. Same soup. You recognise the taste, which is the worst part."],
                ["setFlag", "ateSoup"],
                ["setFlag", "ateSoup2"],
              ],
            },
            { label: "Refuse", then: [["say", "Twice. Nobody has ever refused twice."]] },
          ],
        ],
        ["battle", "mamaSopa2"],
        ["setFlag", "beatSopa2"],
        // Same rule as the village: the soup bites after the fight, never before.
        ["if", { flag: "ateSoup2" }, [["poisonParty"]], []],
        ["say", "The gym is in Bosua. I will be outside it. Do not eat before you go in."],
        ["hide", "sopaRiver"],
        ["music", "route"],
      ],
    },
  ],
};

const mine = {
  id: "mine",
  name: "Galamsey Pit",
  music: "cave",
  width: 18,
  height: 14,
  base: "cave",
  legend: LEGEND,
  ground: [
    "%%%%%%%%%%%%%%%%%%",
    "%::::::::::::::::%",
    "%::**::::::::**::%",
    "%::**::::::::**::%",
    "%::::::::::::::::%",
    "%:::%%%%%%%%%%:::%",
    "%:::%::::::::%:::%",
    "%:::%::::::::%:::%",
    "%:::%%%%%%%%%%:::%",
    "%::::::::::::::::%",
    "%::**::::::::**::%",
    "%::**::::::::**::%",
    "%::::::::x:::::::%",
    "%%%%%%%%%%%%%%%%%%",
  ],
  encounters: {
    rate: 0.11,
    anywhere: true,
    table: [
      // The last grass before the gym, and the only place Poya lives. It hits
      // harder than anything else in the area, so it waits until the player has
      // a team rather than one starter.
      { species: "dungu", min: 8, max: 11, weight: 28 },
      { species: "siko", min: 9, max: 12, weight: 22 },
      { species: "kanku", min: 8, max: 11, weight: 16 },
      { species: "seryi", min: 10, max: 12, weight: 12 },
      { species: "sasabon", min: 10, max: 12, weight: 12 },
      { species: "poya", min: 10, max: 12, weight: 10 },
    ],
  },
  warps: [{ x: 9, y: 12, to: "river", tx: 13, ty: 2, dir: "down" }],
  signs: [
    {
      x: 4,
      y: 2,
      text: "Gold runs through the rock in threads. Somebody has hacked at it with a machete.",
    },
  ],
  npcs: [
    {
      id: "mineGrunt1",
      sprite: "grunt",
      x: 13,
      y: 9,
      dir: "left",
      sight: 4,
      trainer: "grunt3",
      defeatFlag: "beatGrunt3",
      script: [["say", "It was not mine. I know. Do not say it."]],
    },
    {
      id: "mineGrunt2",
      sprite: "grunt",
      x: 12,
      y: 4,
      dir: "left",
      sight: 4,
      trainer: "grunt4",
      defeatFlag: "beatGrunt4",
      script: [["say", "He will not be as easy as me."]],
    },
    {
      id: "nanaSika",
      sprite: "boss",
      x: 8,
      y: 1,
      dir: "down",
      script: [
        [
          "if",
          { flag: "beatBoss" },
          [
            [
              "say",
              "Take it. Take the whole pit. I will find something else to be the biggest man in.",
            ],
            ["end"],
          ],
        ],
        ["music", "boss"],
        [
          "say",
          "You are the child from Aduma. Somebody said you were coming and I did not believe them.",
        ],
        [
          "say",
          "Do you know what this river gave me? Everything. A house, a truck, forty men who eat because I dig.",
        ],
        ["say", "And you want me to stop, because the fish do not like it."],
        ["battle", "nanaSika"],
        ["setFlag", "beatBoss"],
        [
          "say",
          "One child. One child and a rule that has stood for forty years.",
        ],
        ["say", "Pull the pumps out. All of them. We are finished here."],
        ["shake", 700],
        ["sound", "door"],
        ["say", "Downstream, the water starts running clear before the men are even out of the pit."],
        ["music", "cave"],
      ],
    },
  ],
  triggers: [],
};

const bosua = {
  id: "bosua",
  name: "Bosua Town",
  music: "town",
  width: 22,
  height: 16,
  base: "grass",
  legend: LEGEND,
  ground: [
    "TTTTTTTTTTTTTTTTTTTTTT",
    "T,,,,,,,,,,,,,,,,,,,,T",
    "T,,AAAAA,,,,,AAAAAA,,T",
    "T,,HHHHH,,,,,HHHHHH,,T",
    "T,,HHDHH,,,,,HHHDHH,,T",
    "T,,,,,,,,,,,,,,,,,,,,T",
    "T....................T",
    "T,,,,,,,,,,,,,,,,,,,,T",
    ".,,,,,,,,,,+,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,T",
    "T,,AAAA,,,,,,,AAAA,,,T",
    "T,,HHHH,,,,,,,HHHH,,,T",
    "T,,HHHH,,,,,,,HHHH,,,T",
    "T,,,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,T",
    "TTTTTTTTTTTTTTTTTTTTTT",
  ],
  over: [
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "               S      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
  ],
  warps: [
    { x: 5, y: 4, to: "centre", tx: 5, ty: 7, dir: "up" },
    { x: 16, y: 4, to: "gym", tx: 6, ty: 14, dir: "up" },
    { x: 0, y: 8, to: "river", tx: 22, ty: 8, dir: "left" },
  ],
  signs: [
    {
      x: 15,
      y: 7,
      text: "BOSUA TOWN. The Akwaaba Centre is west. The gym is east. Nana Kofi takes all challengers.",
    },
  ],
  npcs: [
    {
      id: "bosuaMan",
      sprite: "villagerMan",
      x: 8,
      y: 7,
      dir: "down",
      script: [
        [
          "if",
          { flag: "gotBadge" },
          [["say", "You beat Nana Kofi? On your first badge? The whole town is talking."]],
          [
            [
              "say",
              "Nana Kofi fights with earth. Anything that flies goes over the top of it, if you have something that flies.",
            ],
          ],
        ],
      ],
    },
    {
      id: "bosuaKid",
      sprite: "child",
      x: 12,
      y: 11,
      dir: "up",
      wander: true,
      script: [
        [
          "say",
          "The Akwaaba Centre is free. My grandmother says nothing is free but that one really is.",
        ],
      ],
    },
    {
      id: "sopaBosua",
      sprite: "mamaSopa",
      x: 19,
      y: 5,
      dir: "left",
      hideWhen: { flag: "beatSopa3" },
      script: [["say", "Win, and then eat. That is the correct order, apparently."]],
    },
    {
      id: "bosuaWoman",
      sprite: "villagerWoman",
      x: 17,
      y: 8,
      dir: "left",
      script: [
        [
          "if",
          { flag: "beatBoss" },
          [["say", "You are the one who cleared the river. Go in. He already knows."]],
          [["say", "The gym is shut to strangers while the river is like that. Everything is."]],
        ],
      ],
    },
  ],
  triggers: [
    {
      x: 16,
      y: 5,
      once: "sopaGym",
      condition: { flag: "beatSopa2" },
      script: [
        ["music", "boss"],
        ["say", "Ah! Ah! Not on an empty stomach!"],
        ["walk", "sopaBosua", "left", 2],
        ["face", "sopaBosua", "left"],
        [
          "ask",
          "Mama Sopa has carried the banku pot all the way to Bosua.",
          [
            {
              label: "Eat it",
              then: [
                ["sound", "hit"],
                ["say", "Three times. At this point it is your own fault."],
                ["setFlag", "ateSoup"],
                ["setFlag", "ateSoup3"],
              ],
            },
            {
              label: "Refuse",
              then: [["say", "She sighs. She has carried that pot a very long way."]],
            },
          ],
        ],
        ["battle", "mamaSopa3"],
        ["setFlag", "beatSopa3"],
        // Same rule as the village: the soup bites after the fight, never before.
        ["if", { flag: "ateSoup3" }, [["poisonParty"]], []],
        ["say", "Go on then. Go and win. I will keep some warm for you."],
        ["give", "kelewele", 1],
        ["say", "And take this. Fried, not boiled, and no banku anywhere near it. You will be fine."],
        ["hide", "sopaBosua"],
        ["music", "town"],
      ],
    },
  ],
};

const centre = {
  id: "centre",
  name: "Akwaaba Centre",
  music: "town",
  width: 12,
  height: 9,
  base: "floor",
  legend: LEGEND,
  ground: [
    "############",
    "#cccek##ccc#",
    "#fffff##fff#",
    "#ffffffffff#",
    "#ffffffffff#",
    "#ffmmffffff#",
    "#ffmmffffff#",
    "#ffffDfffff#",
    "############",
  ],
  warps: [{ x: 5, y: 7, to: "bosua", tx: 5, ty: 4, dir: "down" }],
  signs: [{ x: 9, y: 1, text: "A shelf of calabashes, water sachets and folded banana leaves." }],
  npcs: [
    {
      id: "nurse",
      sprite: "nurse",
      x: 2,
      y: 2,
      dir: "down",
      script: [
        ["say", "Akwaaba. Shall I look at your creatures? It costs nothing."],
        [
          "ask",
          "Rest here?",
          [
            {
              label: "Yes please",
              then: [
                ["heal"],
                ["say", "There. All of them back on their feet. Come again whenever you need to."],
              ],
            },
            { label: "Not now", then: [["say", "We are open all night. Everybody comes eventually."]] },
          ],
        ],
      ],
    },
    {
      id: "shopkeeper",
      sprite: "shopkeeper",
      x: 9,
      y: 2,
      dir: "down",
      script: [
        ["say", "Calabashes, water, food. What do you need?"],
        [
          "shop",
          ["calabash", "superCalabash", "sachetWater", "jollof", "bitterLeaf", "herbalPaste", "revivalNut"],
        ],
      ],
    },
    {
      id: "centreRester",
      sprite: "villagerMan",
      x: 8,
      y: 5,
      dir: "left",
      script: [
        [
          "say",
          "A creature that is nearly out of health is far easier to catch. So is one that is asleep. Both together is easiest of all.",
        ],
      ],
    },
  ],
  triggers: [],
};

const gym = {
  id: "gym",
  name: "Bosua Gym",
  music: "boss",
  width: 14,
  height: 16,
  base: "gymFloor",
  legend: LEGEND,
  ground: [
    "##############",
    "#GGGGGGGGGGGG#",
    "#GGGGGGGGGGGG#",
    "#GGuGGGGGGuGG#",
    "#GGGGGGGGGGGG#",
    "#GGGGGGGGGGGG#",
    "#GGGGGGGGGGGG#",
    "#GGuGGGGGGuGG#",
    "#GGGGGGGGGGGG#",
    "#GGGGGGGGGGGG#",
    "#GGGGGGGGGGGG#",
    "#GGuGGGGGGuGG#",
    "#GGGGGGGGGGGG#",
    "#GGGGGGGGGGGG#",
    "#GGGGGDGGGGGG#",
    "##############",
  ],
  warps: [{ x: 6, y: 14, to: "bosua", tx: 16, ty: 4, dir: "down" }],
  signs: [
    {
      x: 3,
      y: 11,
      text: "BOSUA GYM. Leader: Nana Kofi. He fights with the ground itself.",
    },
  ],
  npcs: [
    {
      id: "gymAkosua",
      sprite: "villagerWoman",
      x: 4,
      y: 10,
      dir: "right",
      sight: 4,
      trainer: "gymAkosua",
      defeatFlag: "beatGymAkosua",
      script: [["say", "Go on. He is waiting at the top."]],
    },
    {
      id: "gymYaw",
      sprite: "villagerMan",
      x: 9,
      y: 5,
      dir: "left",
      sight: 4,
      trainer: "gymYaw",
      defeatFlag: "beatGymYaw",
      script: [["say", "Anything that flies, though. That is the trouble."]],
    },
    {
      id: "nanaKofi",
      sprite: "gymLeader",
      x: 6,
      y: 2,
      dir: "down",
      script: [
        [
          "if",
          { flag: "gotBadge" },
          [
            [
              "say",
              "The badge is yours. Go north when you are ready. There is more of this region than you have seen.",
            ],
            ["end"],
          ],
        ],
        [
          "if",
          { notFlag: "beatBoss" },
          [
            [
              "say",
              "Not today. While that pit is running, this town has bigger business than badges. Deal with it, and come back.",
            ],
            ["end"],
          ],
        ],
        ["music", "boss"],
        [
          "say",
          "So you are the one who walked into the mine. Good. Now show me you can hold your ground as well as you can take it.",
        ],
        ["battle", "nanaKofi"],
        ["setFlag", "gotBadge"],
        ["badge", "riverStone"],
        [
          "say",
          "The ground gave way. It does that, when somebody stands on it properly.",
        ],
        ["say", "Take the River Stone Badge. I cut it out of the Pra myself, back when you could still see the bottom."],
        ["give", "superCalabash", 3],
        [
          "say",
          "The road north is open to you now. It goes a long way further than Bosua.",
        ],
        ["music", "town"],
      ],
    },
  ],
  triggers: [],
};

/** Every map in this area, in the order the player sees them. */
export const MAPS = {
  playerHouse,
  village,
  villagerHouse,
  profHut,
  route1,
  river,
  mine,
  bosua,
  centre,
  gym,
};

/** The badge this area awards. */
export const BADGES = {
  riverStone: {
    name: "River Stone Badge",
    town: "Bosua",
    leader: "Nana Kofi",
    description: "Cut from the bed of the Pra, back when you could still see the bottom.",
  },
};

/** What the professor offers, in the order she lays them out. */
export const STARTER_CHOICE = [
  {
    species: "baobo",
    level: 5,
    blurb: "A baobab seedling. Slow, stubborn, and it holds water for a whole dry season.",
  },
  {
    species: "ananse",
    level: 5,
    blurb: "The storyteller spider. Quick, sly, and it keeps one ember alive in its web.",
  },
  {
    species: "volti",
    level: 5,
    blurb: "A lake calf. Steady, calm, and it will follow you for hours to see what you do.",
  },
];
