import { describe, expect, test } from "bun:test";
import {
  DEFAULT_DECISION_MODEL,
  DEFAULT_NARRATIVE_MODEL,
  FALLBACK_CATALOGUE,
  formatPricePerMillion,
  readCatalogue,
  transportFor,
} from "./models.js";

/** A slice of what `GET /api/v1/models` answers, as observed on 2026-09-19. */
const payload = {
  data: [
    {
      id: "anthropic/claude-sonnet-5",
      name: "Anthropic: Claude Sonnet 5",
      pricing: { prompt: "0.000002", completion: "0.00001" },
      architecture: { modality: "text->text", input_modalities: ["text"], output_modalities: ["text"] },
      supported_parameters: ["response_format", "structured_outputs", "temperature"],
    },
    {
      id: "~typesafe/jev-latest",
      name: "TypeSafe: Jev Latest",
      pricing: { prompt: "0.000000042", completion: "0" },
      architecture: { modality: "text->decisions", input_modalities: ["text"], output_modalities: ["decisions"] },
    },
    {
      id: "google/gemini-3-pro-image",
      name: "Google: Nano Banana Pro",
      pricing: { prompt: "0.000002", completion: "0.000012" },
      architecture: { modality: "text+image->image", input_modalities: ["text"], output_modalities: ["image", "text"] },
      supported_parameters: ["response_format"],
    },
    {
      id: "openai/gpt-5-nano:batch",
      name: "OpenAI: GPT-5 Nano (batch)",
      pricing: { prompt: "0.000000025", completion: "0.0000002" },
      architecture: { modality: "text->text", output_modalities: ["text"] },
      supported_parameters: ["response_format"],
    },
    {
      id: "openai/gpt-5-nano",
      name: "OpenAI: GPT-5 Nano",
      pricing: { prompt: "0.00000005", completion: "0.0000004" },
      architecture: { modality: "text->text", output_modalities: ["text"] },
      supported_parameters: ["temperature"],
    },
    { id: "broken" },
  ],
};

describe("the defaults", () => {
  test("Jev decides and Claude Sonnet writes", () => {
    expect(DEFAULT_DECISION_MODEL).toBe("~typesafe/jev-latest");
    expect(DEFAULT_NARRATIVE_MODEL).toBe("anthropic/claude-sonnet-5");
  });

  test("the fallback catalogue names both defaults, so the pickers work with no network", () => {
    const ids = FALLBACK_CATALOGUE.map((one) => one.id);
    expect(ids).toContain(DEFAULT_DECISION_MODEL);
    expect(ids).toContain(DEFAULT_NARRATIVE_MODEL);
  });
});

describe("readCatalogue", () => {
  test("keeps text and decision models, drops image models, batch variants and broken rows", () => {
    const ids = readCatalogue(payload).map((one) => one.id);
    expect(ids).toEqual(["anthropic/claude-sonnet-5", "openai/gpt-5-nano", "~typesafe/jev-latest"]);
  });

  test("marks what each model can do", () => {
    const byId = Object.fromEntries(readCatalogue(payload).map((one) => [one.id, one]));
    expect(byId["~typesafe/jev-latest"].decisions).toBe(true);
    expect(byId["~typesafe/jev-latest"].text).toBe(false);
    expect(byId["anthropic/claude-sonnet-5"].decisions).toBe(false);
    expect(byId["anthropic/claude-sonnet-5"].text).toBe(true);
    expect(byId["anthropic/claude-sonnet-5"].jsonOutput).toBe(true);
    expect(byId["openai/gpt-5-nano"].jsonOutput).toBe(false);
  });

  test("reads prices as dollars per million tokens", () => {
    const sonnet = readCatalogue(payload).find((one) => one.id === "anthropic/claude-sonnet-5");
    expect(sonnet.promptPerMillion).toBeCloseTo(2, 6);
    expect(sonnet.completionPerMillion).toBeCloseTo(10, 6);
  });

  test("keeps the built-in Jev when the live list names no decision model, as it did on 2026-09-19", () => {
    const withoutJev = { data: payload.data.filter((one) => one.id !== "~typesafe/jev-latest") };
    const ids = readCatalogue(withoutJev).map((one) => one.id);
    expect(ids).toContain(DEFAULT_DECISION_MODEL);
    expect(readCatalogue(withoutJev).find((one) => one.id === DEFAULT_DECISION_MODEL).decisions).toBe(true);
  });

  test("a payload that is not a catalogue gives the fallback", () => {
    expect(readCatalogue(null)).toEqual(FALLBACK_CATALOGUE);
    expect(readCatalogue({ data: "x" })).toEqual(FALLBACK_CATALOGUE);
  });
});

describe("transportFor", () => {
  test("a decisions model goes to the decisions endpoint, a text model to chat", () => {
    const catalogue = readCatalogue(payload);
    expect(transportFor("~typesafe/jev-latest", catalogue)).toBe("decisions");
    expect(transportFor("anthropic/claude-sonnet-5", catalogue)).toBe("chat");
  });

  test("a model the catalogue does not know is judged by its name", () => {
    expect(transportFor("~typesafe/jev-2", [])).toBe("decisions");
    expect(transportFor("typesafe/jev-1.13", [])).toBe("decisions");
    expect(transportFor("someone/new-model", [])).toBe("chat");
  });
});

describe("formatPricePerMillion", () => {
  test("writes a short dollar figure", () => {
    expect(formatPricePerMillion(2)).toBe("$2.00/M");
    expect(formatPricePerMillion(0.042)).toBe("$0.04/M");
    expect(formatPricePerMillion(0)).toBe("free");
    expect(formatPricePerMillion(null)).toBe("");
  });
});
