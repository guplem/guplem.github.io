// Pure picking logic. No DOM access -- safe to import from tests.

export function hashStringToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seedInt) {
  let state = seedInt >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRandomSeed(random = Math.random) {
  return random().toString(36).slice(2, 8).padEnd(6, "0");
}

export function pickOptions({ options, count = 1, seed, distinct = true } = {}) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error("options must be a non-empty array");
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count must be a positive integer");
  }
  if (distinct && count > options.length) {
    throw new Error("count cannot exceed options length when distinct is required");
  }
  const usedSeed = seed != null && seed !== "" ? String(seed) : generateRandomSeed();
  const rng = mulberry32(hashStringToSeed(usedSeed));
  const picks = [];
  if (distinct) {
    const pool = options.slice();
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rng() * pool.length);
      picks.push(pool[idx]);
      pool.splice(idx, 1);
    }
  } else {
    for (let i = 0; i < count; i++) {
      picks.push(options[Math.floor(rng() * options.length)]);
    }
  }
  return { picks, seed: usedSeed };
}

export function splitOptionsText(text) {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function optionsToText(options) {
  return Array.isArray(options) ? options.join("\n") : "";
}

export function parseUrlState(searchString) {
  const params = new URLSearchParams(searchString || "");
  const options = params.getAll("o");
  const countRaw = params.get("n");
  const countParsed = countRaw !== null ? parseInt(countRaw, 10) : NaN;
  const count = Number.isInteger(countParsed) && countParsed > 0 ? countParsed : 1;
  const seed = params.get("s") || null;
  const distinct = params.get("d") !== "0";
  return { options, count, seed, distinct };
}

export function serializeUrlState({ options = [], count = 1, seed = null, distinct = true } = {}) {
  const params = new URLSearchParams();
  for (const opt of options) {
    if (typeof opt === "string" && opt.length > 0) params.append("o", opt);
  }
  if (Number.isInteger(count) && count > 1) params.set("n", String(count));
  if (seed) params.set("s", String(seed));
  if (!distinct) params.set("d", "0");
  return params.toString();
}
