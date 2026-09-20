// The vocabulary: what can exist in one world, written once per session by a
// text model, and checked here before anything trusts it.
//
// Defining what a "space station" or a "medieval village" is made of is the
// one creative, open-ended job in this project, so it goes to a real language
// model (`generate()`), once. Every later decision is a typed choice among the
// types this file returns (ADR 0002).
//
// The schema is what makes the vocabulary adapt to any setting instead of
// carrying hard-coded NPC and chest logic: each type declares its own
// `instanceFields`, the properties an instance of it will need later. A chest
// says `contents` and `locked`; a station's crew member says `rank` and
// `clearance` rather than a generic "job".
//
// The model is asked for strict JSON, and the answer is validated on receipt.
// On failure the validation errors go back into the prompt and the model
// answers again, up to a small cap. That loop is `generateVocabulary`, and it
// takes the `generate` function as a parameter so a test can play the model.

import { describeSetting } from "./presets.js";

export const VOCABULARY_LIMITS = { minTypes: 6, maxTypes: 24, maxInstanceFields: 8, minStructureSize: 3, maxStructureSize: 8, maxStructureCount: 6 };

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Where a type belongs, relative to the structures: inside one, outside all, in a wall, or anywhere. */
export const ZONES = ["indoor", "outdoor", "wall", "any"];
export const EDGES = ["north", "east", "south", "west"];

/** The placement of a type that declares none: no hard rule at all. */
export const OPEN_PLACEMENT = Object.freeze({ zone: "any", neverNext: [], onlyNext: [], edge: null });

const PLACEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["zone", "neverNext", "onlyNext", "edge"],
  properties: {
    zone: { type: "string", enum: ZONES, description: "indoor: only inside a structure. outdoor: never inside one. wall: in a structure's wall (a door, a window, a sign). any: no rule." },
    neverNext: { type: "array", items: { type: "string" }, description: "Type ids this type is never placed next to (the four neighbours). Name its own id to keep two apart." },
    onlyNext: { type: "array", items: { type: "string" }, description: "When not empty, this type is placed only where one of these type ids is a neighbour. Empty means no rule." },
    edge: { type: "string", enum: ["none", ...EDGES], description: "The one map edge this type is limited to, or none." },
  },
};

const STRUCTURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "wall", "floor", "door", "minSize", "maxSize", "minCount", "maxCount"],
  properties: {
    id: { type: "string", description: "kebab-case, unique among structures, e.g. cottage" },
    label: { type: "string", description: "The name a person sees, e.g. Cottage." },
    wall: { type: "string", description: "The id of the barrier type that outlines it." },
    floor: { type: "string", description: "The id of the walkable type that fills it." },
    door: { type: ["string", "null"], description: "The id of the interactable type set into its wall, or null for a sealed structure." },
    minSize: { type: "integer", description: `Smallest side in cells, walls included, at least ${VOCABULARY_LIMITS.minStructureSize}.` },
    maxSize: { type: "integer", description: `Largest side in cells, walls included, at most ${VOCABULARY_LIMITS.maxStructureSize}.` },
    minCount: { type: "integer", description: "How many of these a map holds at least (0 allowed)." },
    maxCount: { type: "integer", description: `How many at most, up to ${VOCABULARY_LIMITS.maxStructureCount}.` },
  },
};

/** The strict shape the model is asked to fill. `strict: true` models follow it to the letter. */
export const VOCABULARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "summary", "elements", "structures"],
  properties: {
    name: { type: "string", description: "A short name for this world or place." },
    summary: { type: "string", description: "One or two sentences that set the scene." },
    structures: {
      type: "array",
      description: "The buildings and rooms of this world: each names its wall, floor and door types and its size and count. Empty when the world has no enclosed place.",
      items: STRUCTURE_SCHEMA,
    },
    elements: {
      type: "array",
      description: `Between ${VOCABULARY_LIMITS.minTypes} and ${VOCABULARY_LIMITS.maxTypes} element types.`,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "description", "placementRules", "walkable", "interactable", "isBarrier", "visualTag", "instanceFields", "placement"],
        properties: {
          id: { type: "string", description: "kebab-case, unique, e.g. cargo-bay" },
          label: { type: "string", description: "The name a person sees." },
          description: { type: "string", description: "What this element is, in one or two sentences." },
          placementRules: { type: "string", description: "Where it belongs and what it must be next to or never next to. How common it should be." },
          walkable: { type: "boolean", description: "Can a person stand on or pass through this cell?" },
          interactable: { type: "boolean", description: "Can a person do something with it (talk, open, use)?" },
          isBarrier: { type: "boolean", description: "Does it block movement? A barrier is never walkable." },
          visualTag: { type: "string", description: "Exactly one tag from the allowed list." },
          instanceFields: {
            type: "array",
            items: { type: "string" },
            description: "The properties a single instance will need later, e.g. [\"contents\", \"locked\"]. Empty for plain terrain.",
          },
          placement: PLACEMENT_SCHEMA,
        },
      },
    },
  },
};

const EXAMPLE = {
  name: "Kepler Relay",
  summary: "A cramped research station in orbit, where the crew keeps to the corridors and one section stays sealed.",
  structures: [{ id: "lab", label: "Lab", wall: "bulkhead", floor: "corridor", door: "airlock", minSize: 3, maxSize: 5, minCount: 1, maxCount: 2 }],
  elements: [
    {
      id: "corridor",
      label: "Corridor",
      description: "A metal walkway joining the station's sections.",
      placementRules: "The most common cell. Forms continuous lines; connects every room. Never isolated.",
      walkable: true,
      interactable: false,
      isBarrier: false,
      visualTag: "metal-floor",
      instanceFields: [],
      placement: { zone: "any", neverNext: [], onlyNext: [], edge: "none" },
    },
    {
      id: "bulkhead",
      label: "Bulkhead",
      description: "A structural wall between sections.",
      placementRules: "Borders rooms and the station edge. Never cuts a corridor into two disconnected parts.",
      walkable: false,
      interactable: false,
      isBarrier: true,
      visualTag: "metal-wall",
      instanceFields: [],
      placement: { zone: "wall", neverNext: [], onlyNext: [], edge: "none" },
    },
    {
      id: "airlock",
      label: "Airlock door",
      description: "A pressure door set into a bulkhead.",
      placementRules: "Uncommon. In a bulkhead, one per room, facing a corridor. Never two adjacent.",
      walkable: true,
      interactable: true,
      isBarrier: false,
      visualTag: "hatch",
      instanceFields: ["locked", "pressureState"],
      placement: { zone: "wall", neverNext: ["airlock"], onlyNext: [], edge: "none" },
    },
    {
      id: "crew-member",
      label: "Crew member",
      description: "A member of the station crew, standing at a post.",
      placementRules: "Rare. Only on walkable cells next to labs or quarters, never next to another crew member.",
      walkable: true,
      interactable: true,
      isBarrier: false,
      visualTag: "crew",
      instanceFields: ["rank", "clearance", "mood"],
      placement: { zone: "any", neverNext: ["crew-member"], onlyNext: [], edge: "none" },
    },
  ],
};

/**
 * The messages that ask a text model for a vocabulary.
 * @param {{location: string, era: string, notes: string}} setting
 * @param {string[]} visualTags every tag the tileset can draw
 */
export function buildVocabularyMessages(setting, visualTags) {
  const system = [
    "You design the vocabulary of a tile-based world for a map generator.",
    "You answer with one JSON object and nothing else: no prose, no code fences.",
    "",
    "The object has: name (string), summary (string), elements (array), structures (array).",
    `elements holds between ${VOCABULARY_LIMITS.minTypes} and ${VOCABULARY_LIMITS.maxTypes} element types.`,
    "Each element has exactly these fields: id, label, description, placementRules, walkable, interactable, isBarrier, visualTag, instanceFields, placement.",
    "",
    "Rules:",
    "- id is kebab-case (lowercase letters, digits, hyphens) and unique.",
    "- Include at least one common walkable ground type, at least one barrier, and a few interactable things (people, objects, machines).",
    "- placementRules says where the type belongs, what it must sit next to, what it must never sit next to, and how common it is (most common, common, uncommon, rare). A later model reads only these rules and the neighbouring cells to place each type, so be concrete.",
    "- A barrier is never walkable. isBarrier true means walkable false.",
    "- visualTag is exactly one tag from this list, and nothing else:",
    visualTags.join(", "),
    "- instanceFields lists the properties one instance of that type will need later, specific to this world (a chest: contents, locked; a station's crew member: rank, clearance). Plain terrain has an empty list.",
    `- At most ${VOCABULARY_LIMITS.maxInstanceFields} instanceFields per type.`,
    "- placement is the part of the rules that code enforces: zone (indoor: only inside a structure; outdoor: never inside one; wall: set into a structure's wall, like a door or a window; any), neverNext (type ids it is never next to; name its own id to keep two apart), onlyNext (when not empty, it is placed only next to one of these ids), edge (the one map edge it is limited to, or none).",
    "- structures lists the buildings and rooms: each names its wall type (a barrier with zone wall), its floor type (walkable, zone indoor or any), its door type (interactable, zone wall, or null for a sealed room), and its size and count. The code draws each structure's outline; the model fills it. A world with no enclosed place has an empty list.",
    "",
    "Example for a different setting (a space station), to show the shape only:",
    JSON.stringify(EXAMPLE),
  ].join("\n");

  const user = [
    "Design the vocabulary for this world.",
    describeSetting(setting),
    "Answer with the JSON object only.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/**
 * The first JSON object inside a text, or null.
 * Models wrap JSON in fences or a sentence often enough that reading the raw
 * text first would fail most of the time for no reason.
 */
export function extractJson(text) {
  if (typeof text !== "string") return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      const value = JSON.parse(candidate.slice(start, end + 1));
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function readText(value) {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function readBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^true$/i.test(value.trim())) return true;
    if (/^false$/i.test(value.trim())) return false;
  }
  return null;
}

const readList = (value) => (Array.isArray(value) ? value.map(readText).filter((one) => one !== "") : null);

/** A type's placement, cleaned; an absent one is open. Ids are checked later, once every id is known. */
function normalisePlacement(raw, where, errors) {
  if (raw == null) return { ...OPEN_PLACEMENT, neverNext: [], onlyNext: [] };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(`${where}: placement must be an object with zone, neverNext, onlyNext and edge.`);
    return { ...OPEN_PLACEMENT, neverNext: [], onlyNext: [] };
  }
  const zone = raw.zone == null ? "any" : readText(raw.zone).toLowerCase();
  if (!ZONES.includes(zone)) errors.push(`${where}: placement.zone "${raw.zone}" is not one of ${ZONES.join(", ")}.`);
  const neverNext = readList(raw.neverNext ?? []);
  if (neverNext === null) errors.push(`${where}: placement.neverNext must be an array of type ids.`);
  const onlyNext = readList(raw.onlyNext ?? []);
  if (onlyNext === null) errors.push(`${where}: placement.onlyNext must be an array of type ids.`);
  const edgeText = raw.edge == null ? "none" : readText(raw.edge).toLowerCase();
  const edge = edgeText === "" || edgeText === "none" ? null : edgeText;
  if (edge !== null && !EDGES.includes(edge)) errors.push(`${where}: placement.edge "${raw.edge}" is not one of none, ${EDGES.join(", ")}.`);
  return { zone: ZONES.includes(zone) ? zone : "any", neverNext: neverNext ?? [], onlyNext: onlyNext ?? [], edge };
}

/** The placement ids of every element, checked against the ids that exist. */
function checkPlacementIds(elements, errors) {
  const ids = new Set(elements.map((one) => one.id));
  for (const one of elements) {
    for (const field of ["neverNext", "onlyNext"]) {
      for (const id of one.placement[field]) {
        if (!ids.has(id)) errors.push(`elements (id "${one.id}"): placement.${field} names "${id}", which is not an element id.`);
      }
    }
  }
}

const readInteger = (value) => (Number.isInteger(Number(value)) && String(value).trim() !== "" ? Number(value) : null);

/** One structure, checked against the elements it names. */
function normaliseStructure(raw, index, elements, errors) {
  const where = `structures[${index}]${raw && typeof raw === "object" && raw.id != null ? ` (id "${raw.id}")` : ""}`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(`${where}: must be an object.`);
    return null;
  }
  const byId = (id) => elements.find((one) => one.id === id) ?? null;
  const id = readText(raw.id).toLowerCase();
  const label = readText(raw.label);
  const wall = readText(raw.wall);
  const floor = readText(raw.floor);
  const door = raw.door == null || readText(raw.door) === "" ? null : readText(raw.door);
  if (!ID_PATTERN.test(id)) errors.push(`${where}: id must be kebab-case.`);
  if (label === "") errors.push(`${where}: label must be a non-empty string.`);
  if (!byId(wall)?.isBarrier) errors.push(`${where}: wall "${wall}" must be the id of a barrier element.`);
  const floorType = byId(floor);
  if (!floorType || !floorType.walkable || floorType.isBarrier) errors.push(`${where}: floor "${floor}" must be the id of a walkable element.`);
  if (door !== null && !byId(door)) errors.push(`${where}: door "${door}" must be an element id, or null for a sealed structure.`);
  const { minStructureSize, maxStructureSize, maxStructureCount } = VOCABULARY_LIMITS;
  const minSize = readInteger(raw.minSize);
  const maxSize = readInteger(raw.maxSize);
  const minCount = readInteger(raw.minCount);
  const maxCount = readInteger(raw.maxCount);
  if (minSize === null || minSize < minStructureSize || minSize > maxStructureSize) errors.push(`${where}: minSize must be a whole number from ${minStructureSize} to ${maxStructureSize}.`);
  if (maxSize === null || maxSize > maxStructureSize || (minSize !== null && maxSize < minSize)) errors.push(`${where}: maxSize must be a whole number from minSize to ${maxStructureSize}.`);
  if (minCount === null || minCount < 0 || minCount > maxStructureCount) errors.push(`${where}: minCount must be a whole number from 0 to ${maxStructureCount}.`);
  if (maxCount === null || maxCount > maxStructureCount || (minCount !== null && maxCount < minCount)) errors.push(`${where}: maxCount must be a whole number from minCount to ${maxStructureCount}.`);
  return { id, label, wall, floor, door, minSize, maxSize, minCount, maxCount };
}

function normaliseElement(raw, index, visualTags, errors) {
  const where = `elements[${index}]${raw && typeof raw === "object" && raw.id != null ? ` (id "${raw.id}")` : ""}`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(`${where}: must be an object.`);
    return null;
  }
  const id = readText(raw.id).toLowerCase();
  const label = readText(raw.label);
  const description = readText(raw.description);
  const placementRules = readText(raw.placementRules);
  const visualTag = readText(raw.visualTag);
  const walkable = readBoolean(raw.walkable);
  const interactable = readBoolean(raw.interactable);
  const isBarrier = readBoolean(raw.isBarrier);

  if (!ID_PATTERN.test(id)) errors.push(`${where}: id must be kebab-case (lowercase letters, digits, hyphens).`);
  if (label === "") errors.push(`${where}: label must be a non-empty string.`);
  if (description === "") errors.push(`${where}: description must be a non-empty string.`);
  if (placementRules === "") errors.push(`${where}: placementRules must be a non-empty string.`);
  if (walkable === null) errors.push(`${where}: walkable must be true or false.`);
  if (interactable === null) errors.push(`${where}: interactable must be true or false.`);
  if (isBarrier === null) errors.push(`${where}: isBarrier must be true or false.`);
  if (walkable === true && isBarrier === true) errors.push(`${where}: a barrier cannot be walkable. Set walkable false or isBarrier false.`);
  if (!visualTags.includes(visualTag)) {
    errors.push(`${where}: visualTag "${visualTag}" is not in the allowed list. Use exactly one of: ${visualTags.join(", ")}.`);
  }

  let instanceFields = [];
  if (!Array.isArray(raw.instanceFields)) {
    errors.push(`${where}: instanceFields must be an array of strings (empty for plain terrain).`);
  } else {
    instanceFields = raw.instanceFields.map(readText);
    if (raw.instanceFields.some((one) => typeof one !== "string" || one.trim() === "")) {
      errors.push(`${where}: every entry of instanceFields must be a non-empty string.`);
    }
    if (new Set(instanceFields).size !== instanceFields.length) errors.push(`${where}: instanceFields must not repeat a name.`);
    if (instanceFields.length > VOCABULARY_LIMITS.maxInstanceFields) {
      errors.push(`${where}: at most ${VOCABULARY_LIMITS.maxInstanceFields} instanceFields.`);
    }
  }

  const placement = normalisePlacement(raw.placement, where, errors);

  return { id, label, description, placementRules, walkable, interactable, isBarrier, visualTag, instanceFields, placement };
}

/**
 * A vocabulary checked and cleaned, or the list of everything wrong with it.
 * Every error names the element it is about, because the list goes back to
 * the model as the correction prompt.
 * @returns {{ok: true, vocabulary: object} | {ok: false, errors: string[]}}
 */
export function normaliseVocabulary(raw, visualTags) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["The answer must be one JSON object with name, summary and elements."] };
  }
  const errors = [];
  const name = readText(raw.name);
  const summary = readText(raw.summary);
  if (name === "") errors.push("name must be a non-empty string.");
  if (summary === "") errors.push("summary must be a non-empty string.");

  if (!Array.isArray(raw.elements)) {
    errors.push("elements must be an array.");
    return { ok: false, errors };
  }
  if (raw.elements.length < VOCABULARY_LIMITS.minTypes) {
    errors.push(`elements must hold at least ${VOCABULARY_LIMITS.minTypes} types (it holds ${raw.elements.length}).`);
  }
  if (raw.elements.length > VOCABULARY_LIMITS.maxTypes) {
    errors.push(`elements must hold at most ${VOCABULARY_LIMITS.maxTypes} types (it holds ${raw.elements.length}).`);
  }

  const elements = raw.elements.map((one, index) => normaliseElement(one, index, visualTags, errors)).filter(Boolean);
  const seen = new Set();
  for (const one of elements) {
    if (seen.has(one.id)) errors.push(`id "${one.id}" is used twice; every id must be unique.`);
    seen.add(one.id);
  }
  if (elements.length > 0 && !elements.some((one) => one.walkable === true && one.isBarrier !== true)) {
    errors.push("At least one type must be walkable and not a barrier, or nobody can move on the map.");
  }
  checkPlacementIds(elements, errors);

  let structures = [];
  if (raw.structures != null) {
    if (!Array.isArray(raw.structures)) errors.push("structures must be an array (empty when the world has no enclosed place).");
    else structures = raw.structures.map((one, index) => normaliseStructure(one, index, elements, errors)).filter(Boolean);
  }
  const structureIds = new Set();
  for (const one of structures) {
    if (structureIds.has(one.id)) errors.push(`structure id "${one.id}" is used twice; every id must be unique.`);
    structureIds.add(one.id);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, vocabulary: { name, summary, elements, structures } };
}

/** The text a model answered, read and checked. */
export function parseVocabulary(text, visualTags) {
  const raw = extractJson(text);
  if (raw === null) return { ok: false, errors: ["The answer did not contain a JSON object. Answer with the JSON object only."] };
  return normaliseVocabulary(raw, visualTags);
}

/**
 * What the vocabulary box on the setup screen holds (ADR 0004): nothing (the
 * model writes it), a valid vocabulary (no creative call needed), or a text
 * with problems. The summary is the one line shown under the box.
 */
export function describeVocabularyText(text, visualTags) {
  const clean = typeof text === "string" ? text.trim() : "";
  if (clean === "") {
    return { state: "empty", vocabulary: null, errors: [], summary: "Empty: the narrative model will write the vocabulary (one paid call)." };
  }
  const parsed = parseVocabulary(clean, visualTags);
  if (!parsed.ok) {
    const count = parsed.errors.length;
    return { state: "invalid", vocabulary: null, errors: parsed.errors, summary: `${count} problem${count === 1 ? "" : "s"}. Fix them, or clear the box to let the model write it.` };
  }
  const { vocabulary } = parsed;
  return {
    state: "valid",
    vocabulary,
    errors: [],
    summary: `Ready: "${vocabulary.name}", ${vocabulary.elements.length} types. No creative call will be made.`,
  };
}

/** A vocabulary as readable JSON for the box. */
export function formatVocabulary(vocabulary) {
  return JSON.stringify(vocabulary, null, 2);
}

export function typeById(vocabulary, id) {
  return vocabulary?.elements?.find((one) => one.id === id) ?? null;
}

/**
 * Ask for a vocabulary, and ask again with the errors when the answer does
 * not pass. A transport failure (no network, a bad key) is not retried here:
 * it comes back as `failure` so the page can say what to fix.
 *
 * @param {object} options
 * @param {(request: {messages: object[], jsonSchema: object}) => Promise<{ok: true, text: string} | {ok: false, status: number, message: string}>} options.generate
 * @param {{location: string, era: string, notes: string}} options.setting
 * @param {string[]} options.visualTags
 * @param {number} [options.attempts]
 * @param {(event: {attempt: number, errors: string[]}) => void} [options.onAttempt]
 */
export async function generateVocabulary({ generate, setting, visualTags, attempts = 3, onAttempt = () => {} }) {
  const messages = buildVocabularyMessages(setting, visualTags);
  let errors = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    onAttempt({ attempt, errors });
    const answer = await generate({ messages, jsonSchema: VOCABULARY_SCHEMA });
    if (!answer.ok) return { ok: false, attempts: attempt, errors, failure: answer };
    const parsed = parseVocabulary(answer.text, visualTags);
    if (parsed.ok) return { ok: true, attempts: attempt, vocabulary: parsed.vocabulary, errors: [] };
    errors = parsed.errors;
    messages.push({ role: "assistant", content: typeof answer.text === "string" ? answer.text : "" });
    messages.push({
      role: "user",
      content: [
        "That JSON has these problems:",
        ...errors.map((one) => `- ${one}`),
        "Answer again with the complete, corrected JSON object only.",
      ].join("\n"),
    });
  }
  return { ok: false, attempts, errors };
}
