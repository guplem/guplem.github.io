import { describe, expect, test } from "bun:test";
import { visualTagNames } from "./tileset.js";
import {
  VOCABULARY_LIMITS,
  VOCABULARY_SCHEMA,
  buildVocabularyMessages,
  extractJson,
  generateVocabulary,
  normaliseVocabulary,
  parseVocabulary,
  typeById,
} from "./vocabulary.js";

const tags = visualTagNames();
const setting = { location: "A medieval village", era: "1200", notes: "cosy" };

const element = (over = {}) => ({
  id: "grass",
  label: "Grass",
  description: "Open grass between the houses.",
  placementRules: "Anywhere outdoors; never inside a building.",
  walkable: true,
  interactable: false,
  isBarrier: false,
  visualTag: "grass",
  instanceFields: [],
  ...over,
});

const good = () => ({
  name: "Ashford",
  summary: "A farming village at the edge of a dark forest.",
  elements: [
    element(),
    element({ id: "wall", label: "Wall", visualTag: "stone-wall", walkable: false, isBarrier: true }),
    element({ id: "door", label: "Door", visualTag: "door", interactable: true, instanceFields: ["locked"] }),
    element({ id: "chest", label: "Chest", visualTag: "chest", interactable: true, instanceFields: ["contents", "locked"] }),
    element({ id: "villager", label: "Villager", visualTag: "villager", interactable: true, instanceFields: ["name", "trade"] }),
    element({ id: "tree", label: "Tree", visualTag: "tree", walkable: false }),
  ],
});

describe("buildVocabularyMessages", () => {
  test("carries the setting, the allowed tags, the limits and an example", () => {
    const messages = buildVocabularyMessages(setting, tags);
    const text = messages.map((one) => one.content).join("\n");
    expect(messages[0].role).toBe("system");
    expect(messages.at(-1).role).toBe("user");
    expect(text).toContain("A medieval village");
    expect(text).toContain("cosy");
    for (const tag of ["grass", "metal-floor", "unknown"]) expect(text).toContain(tag);
    expect(text).toContain(String(VOCABULARY_LIMITS.minTypes));
    expect(text).toContain(String(VOCABULARY_LIMITS.maxTypes));
    expect(text).toContain("instanceFields");
    expect(text).toContain("crew member");
  });
});

describe("the JSON schema", () => {
  test("names every field of an element and forbids extras", () => {
    const item = VOCABULARY_SCHEMA.properties.elements.items;
    expect(Object.keys(item.properties).sort()).toEqual([
      "description",
      "id",
      "instanceFields",
      "interactable",
      "isBarrier",
      "label",
      "placementRules",
      "visualTag",
      "walkable",
    ]);
    expect(item.additionalProperties).toBe(false);
    expect(item.required).toEqual(Object.keys(item.properties));
    expect(VOCABULARY_SCHEMA.additionalProperties).toBe(false);
  });
});

describe("extractJson", () => {
  test("reads plain JSON, fenced JSON and JSON with prose around it", () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
    expect(extractJson('Here you go:\n```json\n{"a": 1}\n```\nDone.')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a": {"b": [1, 2]}} That is all.')).toEqual({ a: { b: [1, 2] } });
  });

  test("gives null for anything that holds no object", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("")).toBeNull();
    expect(extractJson(null)).toBeNull();
    expect(extractJson("{broken")).toBeNull();
  });
});

describe("normaliseVocabulary", () => {
  test("accepts a good vocabulary and keeps it as is", () => {
    const result = normaliseVocabulary(good(), tags);
    expect(result.ok).toBe(true);
    expect(result.vocabulary.elements.length).toBe(6);
    expect(result.vocabulary.name).toBe("Ashford");
  });

  test("trims text, lower-cases ids and reads boolean-looking strings", () => {
    const raw = good();
    raw.elements[0] = element({ id: " Grass ", label: "  Grass ", walkable: "true", isBarrier: "false" });
    const result = normaliseVocabulary(raw, tags);
    expect(result.ok).toBe(true);
    expect(result.vocabulary.elements[0].id).toBe("grass");
    expect(result.vocabulary.elements[0].label).toBe("Grass");
    expect(result.vocabulary.elements[0].walkable).toBe(true);
  });

  test("names every problem it finds, with the element it is in", () => {
    const raw = good();
    raw.elements[0] = element({ visualTag: "lawn" });
    raw.elements[1] = element({ id: "Bad Id!", label: "" });
    raw.elements[2] = element({ id: "grass" });
    raw.elements[3] = element({ id: "odd", walkable: true, isBarrier: true, visualTag: "door" });
    const result = normaliseVocabulary(raw, tags);
    expect(result.ok).toBe(false);
    expect(result.errors.some((one) => one.includes("lawn") && one.includes("visualTag"))).toBe(true);
    expect(result.errors.some((one) => one.includes("Bad Id!"))).toBe(true);
    expect(result.errors.some((one) => /label/.test(one) && /Bad Id!/.test(one))).toBe(true);
    expect(result.errors.some((one) => /duplicate|twice|unique/i.test(one) && one.includes("grass"))).toBe(true);
    expect(result.errors.some((one) => one.includes("odd") && /barrier/i.test(one))).toBe(true);
  });

  test("refuses too few or too many types, and a world with nothing walkable", () => {
    const few = { ...good(), elements: good().elements.slice(0, 2) };
    expect(normaliseVocabulary(few, tags).errors.join(" ")).toMatch(/at least/i);

    const many = { ...good(), elements: Array.from({ length: VOCABULARY_LIMITS.maxTypes + 1 }, (_, i) => element({ id: `t${i}` })) };
    expect(normaliseVocabulary(many, tags).errors.join(" ")).toMatch(/at most/i);

    const sealed = { ...good(), elements: good().elements.map((one) => ({ ...one, walkable: false })) };
    expect(normaliseVocabulary(sealed, tags).errors.join(" ")).toMatch(/walkable/i);
  });

  test("instanceFields must be a list of short unique names", () => {
    const raw = good();
    raw.elements[2] = element({ id: "door", visualTag: "door", instanceFields: ["locked", "locked", 42] });
    const result = normaliseVocabulary(raw, tags);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/instanceFields/);
  });

  test("a document that is not an object is one clear error", () => {
    expect(normaliseVocabulary(null, tags).errors.length).toBe(1);
    expect(normaliseVocabulary([], tags).ok).toBe(false);
  });
});

describe("parseVocabulary", () => {
  test("reads the text and then normalises it", () => {
    expect(parseVocabulary(JSON.stringify(good()), tags).ok).toBe(true);
    const bad = parseVocabulary("nothing", tags);
    expect(bad.ok).toBe(false);
    expect(bad.errors[0]).toMatch(/JSON/);
  });
});

describe("typeById", () => {
  test("finds an element or gives null", () => {
    const vocabulary = normaliseVocabulary(good(), tags).vocabulary;
    expect(typeById(vocabulary, "door").label).toBe("Door");
    expect(typeById(vocabulary, "nope")).toBeNull();
  });
});

describe("generateVocabulary", () => {
  test("returns the vocabulary on the first good answer", async () => {
    const calls = [];
    const generate = async (request) => {
      calls.push(request);
      return { ok: true, text: JSON.stringify(good()) };
    };
    const result = await generateVocabulary({ generate, setting, visualTags: tags });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.vocabulary.name).toBe("Ashford");
    expect(calls[0].jsonSchema).toBe(VOCABULARY_SCHEMA);
    expect(calls[0].messages[0].role).toBe("system");
  });

  test("feeds the validation errors back and retries, up to the cap", async () => {
    const answers = ["not json at all", JSON.stringify({ ...good(), elements: [] }), JSON.stringify(good())];
    const calls = [];
    const generate = async (request) => {
      calls.push(request);
      return { ok: true, text: answers[calls.length - 1] };
    };
    const result = await generateVocabulary({ generate, setting, visualTags: tags, attempts: 3 });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(3);
    // The second call carries the first answer and what was wrong with it.
    const second = calls[1].messages;
    expect(second.some((one) => one.role === "assistant" && one.content === "not json at all")).toBe(true);
    expect(second.at(-1).role).toBe("user");
    expect(second.at(-1).content).toMatch(/JSON/);
    expect(calls[2].messages.at(-1).content).toMatch(/at least/i);
  });

  test("gives up after the cap with the last errors", async () => {
    const generate = async () => ({ ok: true, text: "nope" });
    const result = await generateVocabulary({ generate, setting, visualTags: tags, attempts: 2 });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.failure).toBeUndefined();
  });

  test("a transport failure stops at once and is passed through", async () => {
    let calls = 0;
    const generate = async () => {
      calls += 1;
      return { ok: false, status: 401, message: "bad key" };
    };
    const result = await generateVocabulary({ generate, setting, visualTags: tags, attempts: 3 });
    expect(result.ok).toBe(false);
    expect(calls).toBe(1);
    expect(result.failure).toEqual({ ok: false, status: 401, message: "bad key" });
  });
});
