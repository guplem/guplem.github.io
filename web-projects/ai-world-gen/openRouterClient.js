// The only file in this project that touches the network, and it talks to one
// host: openrouter.ai (ADR 0001). The key is sent here and nowhere else.
//
// Two kinds of call, because two kinds of model (see `models.js`):
//   - `generate()` asks a text model for prose or JSON through the
//     OpenAI-shaped `chat/completions` endpoint;
//   - `decide()` asks a decision model (Jev) for a typed choice through the
//     `alpha/decisions` endpoint, whose request is `{model, state, questions}`
//     and whose answer is `{answers: {key: {choice, confidence, probabilities}}}`.
//
// Every call answers with the same shape, and never throws:
//   { ok: true, data | text, elapsedMs }
//   { ok: false, status, message }
// `status` 0 means the request never completed: offline, blocked, or timed out.
//
// Browser CORS was checked against the real endpoints on 2026-09-19: OpenRouter
// answers `Access-Control-Allow-Origin: *` on preflight for `/api/v1/*` and
// `/api/alpha/decisions`. "Test connection" on the AI Setup screen is the same
// check, run live.

const API = "https://openrouter.ai";
const TIMEOUT_MS = 60000;

/** Identifies this app in OpenRouter's usage pages. Both headers are allowed by its preflight. */
const APP_HEADERS = {
  "HTTP-Referer": "https://triunitystudios.com/web-projects/ai-world-gen/",
  "X-Title": "AI World Gen",
};

async function call({ path, method = "GET", apiKey = "", body = null, timeoutMs = TIMEOUT_MS }) {
  const headers = { Accept: "application/json", ...APP_HEADERS };
  if (body !== null) headers["Content-Type"] = "application/json";
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const started = performance.now();
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout?.(timeoutMs),
    });
  } catch {
    return { ok: false, status: 0, message: "The request never completed." };
  }
  const elapsedMs = Math.round(performance.now() - started);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? response.statusText ?? "";
    return { ok: false, status: response.status, message: String(message), elapsedMs };
  }
  return { ok: true, data: payload, elapsedMs };
}

/** Whether a key works, and what OpenRouter knows about it (label, usage, limit). */
export function checkKey(apiKey) {
  return call({ path: "/api/v1/auth/key", apiKey, timeoutMs: 20000 });
}

/** Every model OpenRouter serves. Needs no key. */
export function listModels() {
  return call({ path: "/api/v1/models", timeoutMs: 30000 });
}

/** The text of a chat completion, whatever shape the content came in. */
function readContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  return "";
}

/**
 * Ask a text model. With `jsonSchema` the model is asked for strict JSON in
 * that shape; a model that rejects the format is asked once more without it,
 * and the caller's own validation catches whatever comes back.
 */
export async function generate({ apiKey, model, messages, jsonSchema = null, maxTokens = 4000, temperature = 0.7 }) {
  const body = { model, messages, max_tokens: maxTokens, temperature };
  if (jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: { name: "answer", strict: true, schema: jsonSchema } };
  }
  let result = await call({ path: "/api/v1/chat/completions", method: "POST", apiKey, body });
  if (!result.ok && result.status === 400 && jsonSchema && /response_format|json|schema/i.test(result.message)) {
    delete body.response_format;
    result = await call({ path: "/api/v1/chat/completions", method: "POST", apiKey, body });
  }
  if (!result.ok) return result;
  return { ok: true, text: readContent(result.data), elapsedMs: result.elapsedMs, usage: result.data?.usage ?? null };
}

/**
 * Ask a decision model one or more typed questions about a state.
 * @param {{apiKey: string, model: string, state: object, questions: object}} request
 */
export function decide({ apiKey, model, state, questions }) {
  return call({ path: "/api/alpha/decisions", method: "POST", apiKey, body: { model, state, questions }, timeoutMs: 30000 });
}
