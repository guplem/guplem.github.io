// Which models exist, what each can do, and which endpoint each one needs.
//
// OpenRouter is the one gateway (ADR 0001), and it serves two kinds of model
// that are not interchangeable:
//
//   - a **text** model answers `chat/completions` with prose or JSON, and is
//     what `generate()` uses for the vocabulary;
//   - a **decisions** model (TypeSafe's Jev) answers only `alpha/decisions`
//     with a typed choice and its probabilities, and is what `decide()` uses
//     for every cell. Sending it a chat request is a 400.
//
// `transportFor` is the one place that tells them apart, so the client can
// route a call and the picker can offer a text model as a slower stand-in for
// decisions when Jev is down (it is in beta).

export const DEFAULT_DECISION_MODEL = "~typesafe/jev-latest";
export const DEFAULT_NARRATIVE_MODEL = "anthropic/claude-sonnet-5";

/**
 * Enough of a catalogue to fill the pickers when the live list cannot be
 * fetched. Prices are dollars per million tokens, as seen on 2026-09-19.
 */
export const FALLBACK_CATALOGUE = [
  { id: "~typesafe/jev-latest", name: "TypeSafe: Jev Latest", decisions: true, text: false, jsonOutput: false, promptPerMillion: 0.042, completionPerMillion: 0 },
  { id: "anthropic/claude-sonnet-5", name: "Anthropic: Claude Sonnet 5", decisions: false, text: true, jsonOutput: true, promptPerMillion: 2, completionPerMillion: 10 },
  { id: "anthropic/claude-haiku-4.5", name: "Anthropic: Claude Haiku 4.5", decisions: false, text: true, jsonOutput: true, promptPerMillion: 1, completionPerMillion: 5 },
  { id: "openai/gpt-5-mini", name: "OpenAI: GPT-5 Mini", decisions: false, text: true, jsonOutput: true, promptPerMillion: 0.25, completionPerMillion: 2 },
  { id: "google/gemini-2.5-flash", name: "Google: Gemini 2.5 Flash", decisions: false, text: true, jsonOutput: true, promptPerMillion: 0.3, completionPerMillion: 2.5 },
];

function readPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number * 1_000_000 : null;
}

/**
 * The models worth offering, read out of what `GET /api/v1/models` answers:
 * text models and decision models, sorted by id. Image and audio models are
 * left out, and so are the `:batch` variants, which answer hours later.
 */
export function readCatalogue(payload) {
  if (!payload || !Array.isArray(payload.data)) return FALLBACK_CATALOGUE;
  const list = [];
  for (const row of payload.data) {
    if (!row || typeof row.id !== "string" || row.id.includes(":batch")) continue;
    const outputs = Array.isArray(row.architecture?.output_modalities) ? row.architecture.output_modalities : [];
    const decisions = outputs.includes("decisions");
    const text = outputs.includes("text") && !outputs.includes("image") && !outputs.includes("audio");
    if (!decisions && !text) continue;
    const parameters = Array.isArray(row.supported_parameters) ? row.supported_parameters : [];
    list.push({
      id: row.id,
      name: typeof row.name === "string" ? row.name : row.id,
      decisions,
      text,
      jsonOutput: parameters.includes("response_format") || parameters.includes("structured_outputs"),
      promptPerMillion: readPrice(row.pricing?.prompt),
      completionPerMillion: readPrice(row.pricing?.completion),
    });
  }
  // `/api/v1/models` did not list Jev at all on 2026-09-19, though the model
  // answers on the decisions endpoint. Keep the built-in decision models when
  // the live list names none, or the default could never be picked.
  if (!list.some((one) => one.decisions)) {
    list.push(...FALLBACK_CATALOGUE.filter((one) => one.decisions && !list.some((known) => known.id === one.id)));
  }
  // Plain code-point order, so the `~typesafe/...` ids sort after the letters.
  return list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Which endpoint a model answers: "decisions" or "chat".
 * A model the catalogue does not list is judged by its name, so the default
 * works before the catalogue has loaded.
 */
export function transportFor(modelId, catalogue) {
  const known = (catalogue ?? []).find((one) => one.id === modelId);
  if (known) return known.decisions ? "decisions" : "chat";
  return /(^|\/)jev\b|typesafe\//i.test(modelId ?? "") ? "decisions" : "chat";
}

/** A price as the pickers show it. */
export function formatPricePerMillion(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  if (value === 0) return "free";
  return `$${value.toFixed(2)}/M`;
}
