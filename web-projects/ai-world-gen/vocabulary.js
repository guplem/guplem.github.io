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

export const VOCABULARY_LIMITS = { minTypes: 6, maxTypes: 24, maxInstanceFields: 8 };

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** The strict shape the model is asked to fill. `strict: true` models follow it to the letter. */
export const VOCABULARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "summary", "elements"],
  properties: {
    name: { type: "string", description: "A short name for this world or place." },
    summary: { type: "string", description: "One or two sentences that set the scene." },
    elements: {
      type: "array",
      description: `Between ${VOCABULARY_LIMITS.minTypes} and ${VOCABULARY_LIMITS.maxTypes} element types.`,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "description", "placementRules", "walkable", "interactable", "isBarrier", "visualTag", "instanceFields"],
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
        },
      },
    },
  },
};

const EXAMPLE = {
  name: "Kepler Relay",
  summary: "A cramped research station in orbit, where the crew keeps to the corridors and one section stays sealed.",
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
    "The object has: name (string), summary (string), elements (array).",
    `elements holds between ${VOCABULARY_LIMITS.minTypes} and ${VOCABULARY_LIMITS.maxTypes} element types.`,
    "Each element has exactly these fields: id, label, description, placementRules, walkable, interactable, isBarrier, visualTag, instanceFields.",
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

  return { id, label, description, placementRules, walkable, interactable, isBarrier, visualTag, instanceFields };
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

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, vocabulary: { name, summary, elements } };
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
