// A ready vocabulary for every setting preset, so a preset world needs no
// creative call at all (ADR 0004).
//
// The one expensive call in this project is the vocabulary: a few thousand
// tokens of a frontier text model, against hundreds of cheap decisions. For a
// preset the setting is fixed, so its vocabulary can be written once and
// shipped. These were written by Claude in the build session, in the exact
// shape `vocabulary.js` asks a model for, and `presetVocabularies.test.js`
// runs them through the same validation a generated one must pass.
//
// A person can still edit any of them on the setup screen, or clear the box
// and have the model write a fresh one.

/** A type's hard placement rules, with every field present (see `placement` in vocabulary.js). */
const rule = (over = {}) => ({ zone: "any", neverNext: [], onlyNext: [], edge: null, ...over });

const ground = (id, label, description, placementRules, visualTag, placement = {}) => ({
  id,
  label,
  description,
  placementRules,
  walkable: true,
  interactable: false,
  isBarrier: false,
  visualTag,
  instanceFields: [],
  placement: rule(placement),
});

const barrier = (id, label, description, placementRules, visualTag, placement = {}) => ({
  id,
  label,
  description,
  placementRules,
  walkable: false,
  interactable: false,
  isBarrier: true,
  visualTag,
  instanceFields: [],
  placement: rule(placement),
});

const thing = (id, label, description, placementRules, visualTag, instanceFields, walkable = true, placement = {}) => ({
  id,
  label,
  description,
  placementRules,
  walkable,
  interactable: true,
  isBarrier: false,
  visualTag,
  instanceFields,
  placement: rule(placement),
});

export const PRESET_VOCABULARIES = {
  "medieval-village": {
    name: "Ashford",
    summary: "A farming village at the edge of a dark forest, with a cold river to the east and a chapel on the green.",
    structures: [
      { id: "cottage", label: "Cottage", wall: "cottage-wall", floor: "cottage-floor", door: "cottage-door", minSize: 3, maxSize: 4, minCount: 1, maxCount: 3 },
      { id: "chapel", label: "Chapel", wall: "stone-wall", floor: "chapel-floor", door: "chapel-door", minSize: 3, maxSize: 4, minCount: 1, maxCount: 1 },
    ],
    elements: [
      ground("grass", "Village green", "Open grass between the cottages, worn by feet and goats.", "The most common cell. Fills every open space outdoors. Never inside a cottage.", "grass", { zone: "outdoor" }),
      ground("dirt-path", "Dirt path", "A packed-earth path between the houses and the fields.", "Common. Forms continuous lines from door to door and out to the fields. Never a lone cell.", "path", { zone: "outdoor" }),
      ground("field", "Barley field", "Rows of barley waiting for the harvest.", "Common on the west side, in blocks of several cells. Never next to the river.", "field", { zone: "outdoor", neverNext: ["river"] }),
      barrier("cottage-wall", "Cottage wall", "Timber frame and daub, with a thatched roof above.", "Common. Forms closed rectangles of about 3 by 3 cells around a cottage floor. Never alone.", "wood-wall", { zone: "wall" }),
      ground("cottage-floor", "Cottage floor", "Swept earth inside a cottage.", "Only inside a rectangle of cottage walls. Never touching grass or field.", "floor", { zone: "indoor" }),
      thing("cottage-door", "Cottage door", "A plank door on iron hinges.", "Uncommon. Exactly one per cottage, in a wall cell that faces a path.", "wood-door", ["locked", "household"], true, { zone: "wall" }),
      barrier("river", "River", "Cold fast water from the hills.", "Common on the east edge only, as one continuous line from north to south. Never elsewhere.", "water", { zone: "outdoor", edge: "east" }),
      ground("bridge", "Wooden bridge", "Planks over the river.", "Rare. Exactly one cell, on the river, where a path meets it.", "bridge", { zone: "outdoor", edge: "east", onlyNext: ["river"] }),
      barrier("oak", "Old oak", "A broad oak, older than the village.", "Uncommon. Along the north edge, where the forest begins, in clusters. Never inside the village.", "tree", { zone: "outdoor", neverNext: ["dirt-path"] }),
      barrier("stone-wall", "Chapel wall", "Grey fieldstone, the only stone building here.", "Uncommon. Forms one closed rectangle near the centre, around the chapel floor.", "stone-wall", { zone: "wall" }),
      ground("chapel-floor", "Chapel floor", "Flagstones worn smooth by kneeling.", "Only inside the chapel walls.", "stone-floor", { zone: "indoor" }),
      thing("chapel-door", "Chapel door", "An arched oak door, never locked.", "Rare. Exactly one, in the chapel wall, facing the green.", "wood-door", ["open", "bellRinging"], true, { zone: "wall" }),
      thing("well", "Village well", "A stone well with a wooden bucket.", "Rare. Exactly one, on the green, with grass on every side.", "barrel", ["waterQuality", "rumour"], true, { zone: "outdoor", onlyNext: ["grass"], neverNext: ["well"] }),
      thing("villager", "Villager", "Someone going about the day's work.", "Rare. On grass, a path or a field, never next to another villager, never indoors.", "villager", ["name", "trade", "mood", "secret"], true, { zone: "outdoor", neverNext: ["villager"] }),
      thing("chest", "Storage chest", "An oak chest with an iron lock.", "Rare. Only on a cottage floor, against a wall.", "chest", ["contents", "locked", "owner"], true, { zone: "indoor", onlyNext: ["cottage-floor", "cottage-wall"], neverNext: ["chest"] }),
      thing("market-stall", "Market stall", "A trestle table under a striped awning.", "Rare. On the green near the chapel, next to a path.", "table", ["goods", "vendor", "prices"], true, { zone: "outdoor", onlyNext: ["dirt-path", "grass"] }),
    ],
  },

  "space-station": {
    name: "Kepler Relay",
    summary: "A cramped research station in orbit around a gas giant. The crew keeps to the corridors, and one section stays sealed.",
    structures: [
      { id: "lab", label: "Lab", wall: "bulkhead", floor: "lab-floor", door: "airlock-door", minSize: 3, maxSize: 4, minCount: 1, maxCount: 2 },
      { id: "quarters", label: "Crew quarters", wall: "bulkhead", floor: "quarters-floor", door: "airlock-door", minSize: 3, maxSize: 3, minCount: 1, maxCount: 2 },
      { id: "hangar", label: "Hangar", wall: "bulkhead", floor: "hangar-floor", door: "airlock-door", minSize: 4, maxSize: 5, minCount: 1, maxCount: 1 },
      { id: "sealed-section", label: "Sealed section", wall: "sealed-bulkhead", floor: "deck", door: null, minSize: 3, maxSize: 3, minCount: 0, maxCount: 1 },
    ],
    elements: [
      ground("deck", "Open deck", "Bare deck plating between the sections, scuffed by boots.", "The most common cell. Fills the open space between the rooms, in blocks of several cells.", "metal-floor", { zone: "outdoor" }),
      ground("corridor", "Corridor", "A marked walkway with a yellow line, joining the station's sections.", "Common. Forms one-cell-wide lines from door to door across the deck. Never a lone cell, never two cells wide.", "pavement", { zone: "outdoor" }),
      barrier("bulkhead", "Bulkhead", "A structural wall between sections.", "Common. Borders rooms and the station edge. Never cuts a corridor into two disconnected parts.", "metal-wall", { zone: "wall" }),
      ground("lab-floor", "Lab floor", "White composite flooring under bright lights.", "Common, in blocks of about 3 by 3 cells enclosed by bulkheads, with one airlock door onto a corridor.", "floor", { zone: "indoor" }),
      ground("quarters-floor", "Crew quarters", "Padded floor of a sleeping cabin.", "Common, in small 2 by 2 rooms enclosed by bulkheads, each with one door.", "bed", { zone: "indoor" }),
      thing("airlock-door", "Airlock door", "A sliding pressure door with a status light.", "Uncommon. In a bulkhead where a room meets a corridor. Never two adjacent.", "hatch", ["locked", "pressureState", "accessLevel"], true, { zone: "wall", neverNext: ["airlock-door"] }),
      barrier("viewport", "Viewport", "Thick glass with the gas giant filling it.", "Uncommon. Only on the station's outer edge, in a bulkhead line.", "window", { zone: "wall", neverNext: ["viewport"] }),
      ground("hangar-floor", "Hangar deck", "Scuffed decking with painted landing marks.", "One large block of about 4 by 4 cells on one edge, enclosed by bulkheads, with one door.", "grate", { zone: "indoor" }),
      thing("shuttle", "Shuttle", "A small orbital shuttle, clamped to the deck.", "Rare. Exactly one, on the hangar deck.", "spaceship", ["fuel", "destination", "condition"], false, { zone: "indoor", onlyNext: ["hangar-floor"], neverNext: ["shuttle"] }),
      thing("console", "Control console", "A workstation with three flickering screens.", "Uncommon. Against a bulkhead on a lab floor. Never in a corridor.", "computer", ["system", "accessLevel", "lastUser"], false, { zone: "indoor", onlyNext: ["lab-floor", "bulkhead"], neverNext: ["console"] }),
      thing("server-rack", "Server rack", "A humming column of blinking drives.", "Rare. In one lab, against a wall, in a line.", "server", ["dataHeld", "temperature"], false, { zone: "indoor", onlyNext: ["lab-floor", "server-rack", "bulkhead"] }),
      barrier("sealed-bulkhead", "Sealed bulkhead", "A bulkhead welded shut, with a hand-painted warning.", "Rare. Forms one small closed room of 2 by 2 in a corner, with no door at all.", "dark-wall", { zone: "wall" }),
      thing("crew-member", "Crew member", "A member of the station crew, standing at a post.", "Rare. Only on a corridor, lab or quarters cell, never next to another crew member.", "crew", ["rank", "clearance", "mood", "assignment"], true, { zone: "any", neverNext: ["crew-member", "maintenance-bot"] }),
      thing("cargo-crate", "Cargo crate", "A sealed supply crate with a manifest tag.", "Uncommon. On the hangar deck or on the open deck against a bulkhead, in pairs.", "crate", ["contents", "manifestId", "sealed"], true, { zone: "any", onlyNext: ["hangar-floor", "deck", "cargo-crate", "bulkhead"] }),
      thing("maintenance-bot", "Maintenance bot", "A squat robot polishing the deck.", "Rare. On the deck or in a corridor, never next to a crew member.", "robot", ["task", "batteryLevel", "chattiness"], true, { zone: "outdoor", onlyNext: ["corridor", "deck"], neverNext: ["crew-member", "maintenance-bot"] }),
      barrier("coolant-pipe", "Coolant pipe", "A thick pipe sweating frost.", "Uncommon. Along bulkheads in a line. Never crossing a corridor.", "pipe", { zone: "outdoor", onlyNext: ["bulkhead", "coolant-pipe"] }),
    ],
  },

  "haunted-mansion": {
    name: "Blackthorn Hall",
    summary: "An abandoned Victorian mansion on a foggy hill. Dust on everything, and the portraits have moved since yesterday.",
    structures: [
      { id: "room", label: "Room", wall: "wall", floor: "hall-floor", door: "door", minSize: 3, maxSize: 5, minCount: 2, maxCount: 4 },
      { id: "cellar", label: "Cellar", wall: "wall", floor: "cellar-floor", door: "door", minSize: 3, maxSize: 4, minCount: 1, maxCount: 1 },
    ],
    elements: [
      ground("hall-floor", "Hall floor", "Warped parquet under a layer of dust.", "The most common cell. Fills every room and corridor. Never outside the house.", "floor", { zone: "any" }),
      barrier("wall", "Panelled wall", "Dark oak panelling, cold to the touch.", "Common. Encloses rooms of 3 by 3 or larger and lines every corridor. Never leaves a room without a door.", "wood-wall", { zone: "wall" }),
      thing("door", "Door", "A heavy door that closes on its own.", "Uncommon. In a wall between two floor cells. Every enclosed room has at least one.", "door", ["locked", "creaks", "leadsTo"], true, { zone: "wall", neverNext: ["door"] }),
      ground("carpet", "Faded carpet", "A red runner, worn to threads down the middle.", "Common in corridors, as a line. Never in a room.", "path", { zone: "outdoor" }),
      thing("portrait", "Portrait", "A painted ancestor whose eyes follow you.", "Uncommon. In a wall cell of a room. Never two side by side.", "banner", ["subject", "expression", "hasMoved"], false, { zone: "wall", neverNext: ["portrait", "mirror"] }),
      thing("bookshelf", "Bookshelf", "Floor-to-ceiling shelves of rotting books.", "Uncommon. Against the wall of one room (the library), in a line.", "bookshelf", ["notableBook", "hiddenLever"], false, { zone: "indoor", onlyNext: ["wall", "bookshelf", "hall-floor"] }),
      thing("grand-piano", "Grand piano", "A piano that plays a chord when nobody is near.", "Rare. Exactly one, in the centre of the largest room (the ballroom).", "table", ["lastTune", "isPlaying"], false, { zone: "indoor", onlyNext: ["hall-floor"], neverNext: ["grand-piano"] }),
      ground("stairs", "Staircase", "A curving stair with a broken banister.", "Rare. Exactly one cell, in the hall floor near the centre.", "stairs", { zone: "any", onlyNext: ["hall-floor"], neverNext: ["stairs"] }),
      barrier("window", "Boarded window", "A tall window boarded from inside.", "Uncommon. In the outer wall line only.", "window", { zone: "wall", neverNext: ["window"] }),
      ground("cellar-floor", "Cellar floor", "Damp flagstones in the dark.", "One block of about 3 by 3 in a corner, enclosed by walls, with one door.", "cave-floor", { zone: "indoor" }),
      thing("candle", "Candlestick", "A candle that is lit, though nobody lit it.", "Uncommon. On a hall floor or carpet cell, next to a wall.", "torch", ["isLit", "wax"], true, { zone: "any", onlyNext: ["wall", "hall-floor", "carpet"], neverNext: ["candle"] }),
      thing("ghost", "Ghost", "A pale figure in old clothes, fading in and out.", "Rare. On a floor cell, never next to another ghost, never in a corridor.", "ghost", ["name", "grievance", "hostile", "yearOfDeath"], true, { zone: "indoor", neverNext: ["ghost"] }),
      thing("chest", "Dowry chest", "A carved chest under a dust sheet.", "Rare. In a room, against a wall.", "chest", ["contents", "locked", "curse"], true, { zone: "indoor", onlyNext: ["wall", "hall-floor", "cellar-floor"], neverNext: ["chest"] }),
      thing("blood-stain", "Old stain", "A dark stain the floor never gave up.", "Rare. On a floor cell, in the cellar or the ballroom.", "blood", ["age", "whoseIsIt"], true, { zone: "indoor", neverNext: ["blood-stain"] }),
      thing("mirror", "Tall mirror", "A mirror that is a second late.", "Rare. In a wall cell. Never next to a portrait.", "magic", ["showsTruth", "cracked"], false, { zone: "wall", neverNext: ["portrait", "mirror"] }),
    ],
  },

  "desert-outpost": {
    name: "Bir Qasim",
    summary: "A trading outpost at a desert oasis on the caravan route. Hot, dusty and busy, with dunes all around.",
    structures: [
      { id: "caravanserai", label: "Caravanserai", wall: "mud-wall", floor: "courtyard", door: "gate", minSize: 3, maxSize: 5, minCount: 1, maxCount: 1 },
    ],
    elements: [
      ground("sand", "Sand", "Fine hot sand that shifts underfoot.", "The most common cell. Fills every outdoor space and the whole map edge.", "sand", { zone: "outdoor" }),
      barrier("dune", "Dune", "A high dune too soft to climb.", "Common along the map edges in clusters of 3 or more. Never inside the outpost.", "mountain", { zone: "outdoor", neverNext: ["oasis-water", "packed-earth"] }),
      ground("oasis-water", "Oasis pool", "Clear water fringed with reeds.", "One block of about 3 by 3 near the centre. Never touching a dune.", "shallow-water", { zone: "outdoor", neverNext: ["dune"] }),
      barrier("palm", "Date palm", "A tall palm heavy with dates.", "Uncommon. Around the oasis pool in a ring. Never far from water.", "tree", { zone: "outdoor", onlyNext: ["oasis-water", "palm", "packed-earth", "sand"] }),
      ground("packed-earth", "Packed earth", "Ground beaten hard by feet and hooves.", "Common around the pool and between the tents, as paths and open ground.", "dirt", { zone: "outdoor" }),
      thing("tent", "Trader's tent", "A goat-hair tent open on one side.", "Uncommon. On packed earth in a loose ring around the oasis, one cell apart.", "tent", ["owner", "goods", "openForBusiness"], true, { zone: "outdoor", onlyNext: ["packed-earth", "sand"], neverNext: ["tent"] }),
      barrier("mud-wall", "Mud-brick wall", "Sun-baked brick, the only permanent building.", "Uncommon. Forms one closed rectangle (the caravanserai) of about 4 by 3, with one gate.", "wall", { zone: "wall" }),
      ground("courtyard", "Caravanserai courtyard", "Shaded flagstones inside the walls.", "Only inside the mud-brick rectangle.", "stone-floor", { zone: "indoor" }),
      thing("gate", "Caravanserai gate", "A wide arch with a carved lintel.", "Rare. Exactly one, in the mud-brick wall, facing the oasis.", "arch", ["open", "guarded"], true, { zone: "wall" }),
      thing("well", "Stone well", "A deep well with a rope worn smooth.", "Rare. Exactly one, on packed earth near the pool.", "barrel", ["depth", "waterLeft"], true, { zone: "outdoor", onlyNext: ["packed-earth", "sand"], neverNext: ["well"] }),
      thing("camel", "Camel", "A resting camel, chewing and watching.", "Uncommon. On sand or packed earth next to a tent. Never next to another camel.", "animal", ["name", "temper", "load"], true, { zone: "outdoor", onlyNext: ["tent", "sand", "packed-earth"], neverNext: ["camel"] }),
      thing("merchant", "Merchant", "A trader in a long robe, counting coins.", "Rare. Next to a tent or in the courtyard. Never next to another merchant.", "merchant", ["name", "wares", "haggling", "hometown"], true, { zone: "any", neverNext: ["merchant"] }),
      thing("guard", "Outpost guard", "A guard with a curved sword, half asleep.", "Rare. Next to the gate or on the courtyard. Never two adjacent.", "guard", ["name", "alertness", "loyalty"], true, { zone: "any", neverNext: ["guard"] }),
      thing("market-stall", "Market stall", "Rugs and spices spread on a low table.", "Uncommon. On packed earth between the tents and the pool.", "food", ["goods", "vendor", "prices"], true, { zone: "outdoor", onlyNext: ["packed-earth", "tent", "market-stall"] }),
      thing("skeleton", "Bleached bones", "Bones of something that did not reach the water.", "Rare. On sand near a dune, far from the pool.", "bones", ["species", "howLongAgo"], true, { zone: "outdoor", onlyNext: ["sand", "dune"], neverNext: ["oasis-water", "skeleton"] }),
    ],
  },

  "cyberpunk-block": {
    name: "Sector 9 Block",
    summary: "One city block in a rain-soaked megacity, at street level. Neon over grime, and everything is watched.",
    structures: [
      { id: "tower", label: "Tower", wall: "tower-wall", floor: "lobby", door: "tower-door", minSize: 3, maxSize: 5, minCount: 1, maxCount: 3 },
    ],
    elements: [
      ground("plaza", "Concrete plaza", "Cracked concrete between the towers, puddles full of neon.", "The most common cell. Fills the open ground between the towers, in blocks of several cells.", "gravel", { zone: "outdoor" }),
      ground("street", "Wet street", "Asphalt shining under the neon.", "Common. One or two straight lines through the block, one cell wide. Never isolated.", "road", { zone: "outdoor" }),
      ground("sidewalk", "Sidewalk", "Cracked concrete with puddles.", "Uncommon. Lines a street or a tower. Never two cells deep.", "pavement", { zone: "outdoor", onlyNext: ["street", "sidewalk", "tower-wall", "tower-door", "noodle-bar", "vending-machine", "pedestrian", "car", "plaza"] }),
      barrier("tower-wall", "Tower facade", "Glass and steel rising out of sight.", "Common. Forms large closed blocks of 3 by 3 or more, each with one entrance.", "skyscraper", { zone: "wall" }),
      ground("lobby", "Corporate lobby", "Polished stone and a scanning gate.", "Only inside a tower block, in a small room by the entrance.", "floor", { zone: "indoor" }),
      thing("tower-door", "Security entrance", "A revolving door with a scanner.", "Uncommon. Exactly one per tower block, in the facade, facing a sidewalk.", "metal-door", ["accessLevel", "guardOnDuty", "camera"], true, { zone: "wall", neverNext: ["tower-door"] }),
      ground("alley", "Back alley", "Narrow, dark and dripping.", "Common. One-cell-wide lines between towers, joining two streets.", "cave-floor", { zone: "outdoor", neverNext: ["street"] }),
      thing("noodle-bar", "Noodle bar", "A steaming counter under a flickering sign.", "Uncommon. On a sidewalk cell against a tower. Never two adjacent.", "shop", ["owner", "special", "openLate", "listeningDevice"], true, { zone: "outdoor", onlyNext: ["sidewalk", "tower-wall"], neverNext: ["noodle-bar"] }),
      thing("vending-machine", "Vending machine", "Sells drinks, and things that are not drinks.", "Uncommon. On a sidewalk or in an alley, against a wall.", "machine", ["stock", "hacked", "priceMultiplier"], false, { zone: "outdoor", onlyNext: ["sidewalk", "alley", "tower-wall"], neverNext: ["vending-machine"] }),
      thing("neon-sign", "Neon sign", "Kanji and English, half the tubes dead.", "Uncommon. In a facade cell above a sidewalk.", "lamp", ["text", "workingTubes"], false, { zone: "wall", onlyNext: ["tower-wall", "sidewalk", "street"], neverNext: ["neon-sign"] }),
      thing("hacker", "Street hacker", "Hood up, deck out, jacked into a junction box.", "Rare. In an alley, never next to a security drone.", "scientist", ["handle", "skill", "currentJob", "wanted"], true, { zone: "outdoor", onlyNext: ["alley"], neverNext: ["security-drone", "hacker"] }),
      thing("security-drone", "Security drone", "A hovering corporate drone with a red eye.", "Rare. Over a street, a sidewalk or the plaza, never in an alley, never two adjacent.", "robot", ["corporation", "alertLevel", "armed"], true, { zone: "outdoor", onlyNext: ["street", "sidewalk", "plaza"], neverNext: ["security-drone", "alley"] }),
      thing("clinic-door", "Unmarked door", "A steel door with a hand-written price list.", "Rare. Exactly one, in an alley wall: the hidden clinic.", "door", ["password", "doctorPresent", "servicesOffered"], true, { zone: "wall", onlyNext: ["alley", "tower-wall"] }),
      thing("car", "Parked car", "A low electric car with tinted windows.", "Uncommon. On a street cell against the sidewalk. Never in an alley.", "car", ["owner", "locked", "contraband"], false, { zone: "outdoor", onlyNext: ["street", "sidewalk"], neverNext: ["alley"] }),
      thing("pedestrian", "Pedestrian", "Somebody hurrying through the rain.", "Uncommon. On a sidewalk, the plaza or crossing a street. Never next to another pedestrian.", "person", ["name", "job", "augmentations", "mood"], true, { zone: "outdoor", onlyNext: ["sidewalk", "street", "plaza"], neverNext: ["pedestrian"] }),
      thing("dumpster", "Dumpster", "Overflowing, and something moved inside.", "Uncommon. In an alley against a wall.", "crate", ["contents", "occupied"], false, { zone: "outdoor", onlyNext: ["alley", "tower-wall"], neverNext: ["dumpster"] }),
      thing("holo-ad", "Holographic billboard", "A dancing advert ten metres tall.", "Rare. In a facade cell over a street corner.", "magic", ["product", "glitching"], false, { zone: "wall", onlyNext: ["tower-wall", "street"], neverNext: ["holo-ad"] }),
    ],
  },

  "jungle-temple": {
    name: "Temple of the Sleeping Jaguar",
    summary: "A ruined temple complex swallowed by the jungle. Overgrown stone, a river, and a chamber that was never opened.",
    structures: [
      { id: "temple", label: "Temple", wall: "temple-wall", floor: "temple-floor", door: "doorway", minSize: 4, maxSize: 6, minCount: 1, maxCount: 2 },
      { id: "hidden-chamber", label: "Hidden chamber", wall: "sealed-door", floor: "hidden-chamber", door: null, minSize: 3, maxSize: 3, minCount: 0, maxCount: 1 },
    ],
    elements: [
      ground("jungle-floor", "Jungle floor", "Roots, leaf litter and damp earth.", "The most common cell. Fills the outdoors around the ruins.", "meadow", { zone: "outdoor" }),
      barrier("dense-jungle", "Dense jungle", "Trees and vines too thick to pass.", "Common along the map edges in clusters. Never inside the temple walls.", "tree", { zone: "outdoor", neverNext: ["temple-floor"] }),
      ground("temple-floor", "Temple floor", "Carved flagstones, cracked by roots.", "Common. Fills the inside of the temple walls and the ceremonial way.", "stone-floor", { zone: "indoor" }),
      barrier("temple-wall", "Temple wall", "Massive stone blocks carved with jaguars.", "Common. Forms the temple as nested rectangles, each with one doorway.", "stone-wall", { zone: "wall" }),
      ground("doorway", "Stone doorway", "A trapezoid doorway, its lintel carved.", "Uncommon. In a temple wall where temple floor meets jungle floor or another room.", "arch", { zone: "wall", neverNext: ["doorway"] }),
      barrier("river", "Jungle river", "Brown water moving fast.", "Common on one edge as one continuous line. Never elsewhere.", "water", { zone: "outdoor", edge: "south" }),
      barrier("ruin", "Collapsed wall", "A wall fallen into rubble and moss.", "Uncommon. Where a temple wall meets the jungle. Never alone.", "ruin", { zone: "wall", onlyNext: ["temple-wall", "ruin", "jungle-floor", "dense-jungle"] }),
      thing("trap", "Pressure plate", "A flagstone slightly higher than its neighbours.", "Rare. On temple floor in a corridor between two walls.", "trap", ["armed", "mechanism", "disarmCode"], true, { zone: "indoor", onlyNext: ["temple-floor"], neverNext: ["trap"] }),
      thing("altar", "Jaguar altar", "A stone altar stained dark.", "Rare. Exactly one, on temple floor in the innermost room.", "altar", ["offering", "inscription", "warm"], false, { zone: "indoor", onlyNext: ["temple-floor"], neverNext: ["altar"] }),
      barrier("sealed-door", "Sealed door", "A stone slab that has never been moved.", "Rare. Exactly one, in an inner temple wall, with no doorway into the room behind.", "dark-wall", { zone: "wall" }),
      ground("hidden-chamber", "Unopened chamber", "A room nobody has entered.", "One block of 2 by 2 behind the sealed door, enclosed by walls, with no doorway.", "floor", { zone: "indoor" }),
      thing("idol", "Golden idol", "A small gold jaguar with jade eyes.", "Rare. Exactly one, in the unopened chamber or on the altar.", "gold", ["weight", "cursed", "value"], true, { zone: "indoor", onlyNext: ["hidden-chamber", "altar", "temple-floor"], neverNext: ["idol"] }),
      thing("explorer", "Explorer", "A sweating archaeologist with a notebook.", "Rare. On jungle floor near the camp, never inside the temple.", "person", ["name", "expertise", "motive", "health"], true, { zone: "outdoor", onlyNext: ["jungle-floor", "camp-tent"], neverNext: ["explorer"] }),
      thing("camp-tent", "Expedition tent", "A canvas tent with a folding table outside.", "Rare. On jungle floor near the river, in a cluster of two.", "tent", ["supplies", "occupant", "journal"], true, { zone: "outdoor", onlyNext: ["jungle-floor", "camp-tent", "river"] }),
      thing("monkey", "Howler monkey", "Watching from a low branch, ready to steal.", "Uncommon. On jungle floor next to dense jungle. Never two adjacent.", "animal", ["stolenItem", "aggression"], true, { zone: "outdoor", onlyNext: ["dense-jungle", "jungle-floor"], neverNext: ["monkey"] }),
      thing("snake", "Fer-de-lance", "A viper coiled on a warm stone.", "Rare. On temple floor or ruin, never near the camp.", "insect", ["length", "asleep"], true, { zone: "any", onlyNext: ["temple-floor", "ruin", "temple-wall"], neverNext: ["snake", "camp-tent", "explorer"] }),
    ],
  },

  "arctic-base": {
    name: "Station Halvorsen",
    summary: "A remote research base on the Antarctic ice, 1982. Prefab modules, a radio room, and something found in the ice.",
    structures: [
      { id: "module", label: "Module", wall: "module-wall", floor: "module-floor", door: "module-door", minSize: 3, maxSize: 4, minCount: 1, maxCount: 3 },
    ],
    elements: [
      ground("snow", "Packed snow", "Wind-hardened snow, blinding in daylight.", "The most common cell. Fills everything outside the modules.", "snow", { zone: "outdoor" }),
      barrier("ice-ridge", "Ice ridge", "A pressure ridge of broken blue ice.", "Common along the map edges in clusters. Never inside the base.", "ice", { zone: "outdoor", neverNext: ["module-floor", "walkway"] }),
      barrier("module-wall", "Module wall", "Insulated prefab panel, orange paint peeling.", "Common. Forms rectangles of about 3 by 3 (the modules), each with one door.", "metal-wall", { zone: "wall" }),
      ground("module-floor", "Module floor", "Rubber matting over plywood, warm underfoot.", "Only inside a module wall rectangle.", "metal-floor", { zone: "indoor" }),
      thing("module-door", "Module door", "A heavy insulated door with a frosted porthole.", "Uncommon. Exactly one per module, facing a walkway.", "metal-door", ["latched", "frozen"], true, { zone: "wall", neverNext: ["module-door"] }),
      ground("walkway", "Rope walkway", "A trodden path with a guide rope on posts.", "Common. Lines from door to door across the snow. Never isolated.", "path", { zone: "outdoor" }),
      thing("radio-set", "Radio set", "A shortwave radio, static and one voice.", "Rare. Exactly one, in a module, against a wall.", "computer", ["frequency", "lastContact", "working"], false, { zone: "indoor", onlyNext: ["module-floor", "module-wall"], neverNext: ["radio-set", "generator"] }),
      thing("generator", "Diesel generator", "The base's only heat, coughing every few minutes.", "Rare. Exactly one, in its own small module.", "gear", ["fuelDays", "running", "noise"], false, { zone: "indoor", onlyNext: ["module-floor", "module-wall"], neverNext: ["generator", "radio-set"] }),
      thing("snowmobile", "Snowmobile", "A yellow snowmobile under a tarp.", "Uncommon. On snow next to a module wall. Never two adjacent.", "car", ["fuel", "starts", "owner"], false, { zone: "outdoor", onlyNext: ["snow", "module-wall", "walkway"], neverNext: ["snowmobile"] }),
      thing("scientist", "Researcher", "Someone in a red parka, breath frosting.", "Rare. In a module or on a walkway. Never next to another researcher.", "scientist", ["name", "field", "trustsWhom", "temperature"], true, { zone: "any", neverNext: ["scientist"] }),
      thing("husky", "Husky", "A sled dog that will not stop staring at the ice pit.", "Rare. On snow near a module, never inside.", "animal", ["name", "agitation"], true, { zone: "outdoor", onlyNext: ["snow", "walkway", "module-wall"], neverNext: ["husky"] }),
      ground("ice-pit", "Excavation pit", "A pit cut into the ice with a ladder.", "One block of 2 by 2 on snow, away from the modules, edged by ice ridge.", "cave-floor", { zone: "outdoor", onlyNext: ["snow", "ice-ridge", "ice-pit", "ice-block"], neverNext: ["module-wall", "walkway"] }),
      thing("ice-block", "Block of old ice", "A translucent block with a shape inside it.", "Rare. Exactly one, in the excavation pit.", "crystal", ["thawing", "whatIsInside", "temperature"], false, { zone: "outdoor", onlyNext: ["ice-pit"], neverNext: ["ice-block"] }),
      thing("fuel-drum", "Fuel drum", "A red drum of diesel, half buried in drift.", "Uncommon. On snow against a module wall, in pairs.", "barrel", ["litres", "leaking"], false, { zone: "outdoor", onlyNext: ["snow", "module-wall", "fuel-drum"] }),
      thing("supply-crate", "Supply crate", "A wooden crate stencilled with a shipping date.", "Uncommon. In a module or by a door.", "crate", ["contents", "opened"], true, { zone: "any", onlyNext: ["module-floor", "module-door", "snow", "module-wall"], neverNext: ["supply-crate"] }),
    ],
  },

  "ghana-market": {
    name: "Nkawie Junction",
    summary: "A busy market town in the Ashanti region of Ghana. Kente stalls, a lorry park, a chop bar and football on the red dirt.",
    structures: [
      { id: "shop", label: "Shop", wall: "shop-wall", floor: "shop-floor", door: "shop-door", minSize: 3, maxSize: 4, minCount: 1, maxCount: 3 },
      { id: "church", label: "Church", wall: "church", floor: "shop-floor", door: "church-door", minSize: 3, maxSize: 4, minCount: 0, maxCount: 1 },
    ],
    elements: [
      ground("red-dirt", "Red dirt", "Laterite ground, red and dusty, with footprints everywhere.", "The most common cell. Fills the open ground and the football pitch.", "dirt", { zone: "outdoor" }),
      ground("main-road", "Main road", "Tarmac with a faded centre line and speed bumps.", "Common. One or two straight lines across the map. Never isolated.", "road", { zone: "outdoor" }),
      barrier("shop-wall", "Shop wall", "Cement block painted with a phone company's colours.", "Common. Forms small rectangles of 2 by 2 or 3 by 2 (shops and homes), each with one door.", "brick-wall", { zone: "wall" }),
      ground("shop-floor", "Shop floor", "Cool cement inside a shop.", "Only inside a shop wall rectangle.", "floor", { zone: "indoor" }),
      thing("shop-door", "Shop door", "A metal door, open, with a bead curtain.", "Uncommon. Exactly one per shop, facing the road or the market.", "door", ["open", "shopName", "owner"], true, { zone: "wall", neverNext: ["shop-door"] }),
      thing("kente-stall", "Kente stall", "Folded strips of kente cloth in gold, green and red.", "Uncommon. On red dirt near the main road, in a row with other stalls.", "banner", ["seller", "patterns", "prices"], true, { zone: "outdoor", onlyNext: ["red-dirt", "main-road", "kente-stall", "market-stall"] }),
      thing("market-stall", "Produce stall", "Yams, plantain and tomatoes on a wooden table under a parasol.", "Common. On red dirt in rows near the road. Never inside a shop.", "food", ["produce", "seller", "freshness"], true, { zone: "outdoor", onlyNext: ["red-dirt", "main-road", "market-stall", "kente-stall"] }),
      thing("chop-bar", "Chop bar", "Benches, a charcoal fire and the smell of jollof.", "Rare. Exactly one, on red dirt near the lorry park.", "campfire", ["dishOfTheDay", "cook", "seats"], true, { zone: "outdoor", onlyNext: ["red-dirt", "lorry-park"], neverNext: ["chop-bar"] }),
      ground("lorry-park", "Lorry park", "Hard-packed ground where the tro-tros wait.", "One block of about 4 by 3 by the main road.", "gravel", { zone: "outdoor", onlyNext: ["main-road", "lorry-park", "red-dirt", "tro-tro", "chop-bar"] }),
      thing("tro-tro", "Tro-tro", "A minibus painted with a proverb, mate leaning out the door.", "Uncommon. On the lorry park, in a row. Never on red dirt.", "bus", ["destination", "proverb", "seatsLeft", "driver"], false, { zone: "outdoor", onlyNext: ["lorry-park", "tro-tro"], neverNext: ["red-dirt"] }),
      barrier("church", "Church", "A cement church with a tin roof and a loud choir.", "Rare. One closed rectangle of 3 by 3 with one door, away from the market.", "church", { zone: "wall" }),
      thing("church-door", "Church door", "Double doors, open for the service.", "Rare. Exactly one, in the church wall.", "wood-door", ["serviceOn", "pastor"], true, { zone: "wall" }),
      barrier("palm", "Oil palm", "A tall palm giving a little shade.", "Uncommon. On red dirt around the edges, never in the lorry park.", "tree", { zone: "outdoor", onlyNext: ["red-dirt", "palm"], neverNext: ["lorry-park"] }),
      thing("trader", "Trader", "Someone calling prices and greeting friends.", "Uncommon. Next to a stall or on the road edge. Never next to another trader.", "villager", ["name", "goods", "mood", "greeting"], true, { zone: "outdoor", onlyNext: ["kente-stall", "market-stall", "main-road", "red-dirt"], neverNext: ["trader"] }),
      thing("footballers", "Footballers", "Children playing barefoot with a half-flat ball.", "Rare. On red dirt in the open, far from the road, in a group of two cells.", "person", ["score", "teamName", "ballCondition"], true, { zone: "outdoor", onlyNext: ["red-dirt", "footballers"], neverNext: ["main-road"] }),
      thing("goat", "Goat", "A goat eating something it should not.", "Uncommon. On red dirt anywhere, never inside a shop. Never two adjacent.", "animal", ["owner", "whatItIsEating"], true, { zone: "outdoor", onlyNext: ["red-dirt", "palm", "market-stall"], neverNext: ["goat"] }),
    ],
  },
};

/** A fresh copy of a preset's vocabulary, or null. A copy, so an edit never changes the shipped one. */
export function presetVocabularyFor(presetId) {
  const vocabulary = PRESET_VOCABULARIES[presetId];
  return vocabulary ? JSON.parse(JSON.stringify(vocabulary)) : null;
}
