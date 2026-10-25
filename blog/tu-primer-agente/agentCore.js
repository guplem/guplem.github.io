// The logic behind the tutorial's extras, kept free of the page so Bun can
// test it (agentCore.test.js). The page reads well without any of it: every
// app, example and message is text in the HTML, and these functions only
// decide which of them the extras show. Both language versions of the post
// load this file, so every value here is an id, never a sentence.

/**
 * The apps the tutorial covers, and where each one looks for skills in the
 * agent's folder. "claude" is the Code tab of the Claude desktop app, which
 * reads .claude/skills only; "codex" is the Codex mode of the ChatGPT desktop
 * app. Goose also reads .claude/skills, but .agents/skills is its default.
 */
export const APPS = {
  claude: { skillsDir: ".claude/skills" },
  codex: { skillsDir: ".agents/skills" },
  antigravity: { skillsDir: ".agents/skills" },
  goose: { skillsDir: ".agents/skills" },
};
export const APP_IDS = Object.keys(APPS);

/** The examples a reader can follow. The ids stay Spanish in both versions, so a shared link works in either. */
export const EXAMPLE_IDS = ["estudiante", "docente", "salud", "diario", "reforma"];

const SUBSCRIPTIONS = ["chatgpt", "claude", "gemini", "api", "none"];

/**
 * Pick the app that fits what the reader already pays for.
 * @param {string[]} subscriptions ids from SUBSCRIPTIONS
 * @returns {{best: string, alternatives: string[], warnings: string[]} | null} null when nothing known is ticked
 */
export function recommendApps(subscriptions) {
  const has = new Set(subscriptions.filter((id) => SUBSCRIPTIONS.includes(id)));
  if (has.size === 0) return null;
  // Antigravity is free for everyone; the ChatGPT app's Codex mode is still reaching free accounts.
  if (has.has("none")) return { best: "antigravity", alternatives: ["codex", "goose"], warnings: ["made-for-code"] };

  const order = [];
  if (has.has("api")) order.push("goose");
  if (has.has("claude")) order.push("claude");
  if (has.has("chatgpt")) order.push("codex", "goose");
  if (has.has("gemini")) order.push("antigravity", "goose");
  const apps = [...new Set(order)];

  const warnings = [];
  if (has.has("chatgpt") && has.has("claude")) warnings.push("no-app-uses-both");
  if (apps[0] === "antigravity") warnings.push("made-for-code");
  if (apps[0] === "goose" && has.has("claude")) warnings.push("no-claude-in-goose");
  return { best: apps[0], alternatives: apps.slice(1), warnings };
}

/**
 * Read the reader's choices from the address. Unknown values are dropped.
 * @param {string} search location.search, with or without the "?"
 * @returns {{app: string | null, example: string | null}}
 */
export function readState(search) {
  const params = new URLSearchParams(search);
  const app = params.get("app");
  const example = params.get("ejemplo") ?? params.get("example");
  return {
    app: APP_IDS.includes(app) ? app : null,
    example: EXAMPLE_IDS.includes(example) ? example : null,
  };
}

/**
 * Write the reader's choices as a query string.
 * @param {{app: string | null, example: string | null}} state
 * @param {"ejemplo" | "example"} exampleParam the name the page's language uses
 * @returns {string} "" when nothing is chosen
 */
export function writeQuery(state, exampleParam) {
  const params = new URLSearchParams();
  if (state.app) params.set("app", state.app);
  if (state.example) params.set(exampleParam, state.example);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Read the name and description of a skill from its SKILL.md.
 * @param {string} text the whole file
 * @returns {{name?: string, description?: string} | null} null when there is no frontmatter
 */
export function parseFrontmatter(text) {
  const block = text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
  if (!block) return null;
  const fields = {};
  for (const line of block[1].split("\n")) {
    const pair = line.match(/^(name|description):\s*(.*)$/);
    if (pair) fields[pair[1]] = pair[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return fields;
}

const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Check a folder against the tutorial. A browser lists files, not folders, so
 * a folder with nothing in it cannot be seen: the exports folder, often empty,
 * is "unknown" rather than "missing".
 * @param {{path: string, text?: string}[]} files paths relative to the agent's folder, with "/" separators
 * @param {{app: string | null, dataDir: string, exportsDir: string, seesHiddenFolders?: boolean}} options
 *   seesHiddenFolders: false when the browser leaves out folders that start
 *   with a dot (Safari's folder input does), so missing skills are "unknown"
 * @returns {{id: string, status: "ok" | "warn" | "missing" | "unknown" | "optional", detail?: string}[]}
 */
export function checkFolder(files, { app, dataDir, exportsDir, seesHiddenFolders = true }) {
  if (files.length === 0) return [{ id: "empty", status: "missing" }];
  const results = [];
  const inside = (dir) => files.filter((file) => file.path.startsWith(`${dir}/`));

  const agents = files.find((file) => file.path === "AGENTS.md");
  if (agents) {
    results.push({ id: "agents-md", status: "ok" });
    const words = (agents.text ?? "").trim().split(/\s+/).filter(Boolean).length;
    results.push({ id: "agents-md-content", status: words >= 8 ? "ok" : "warn" });
  } else {
    const nearMiss = files.find((file) => !file.path.includes("/") && /^agents\.md(\.txt)?$/i.test(file.path));
    if (nearMiss) results.push({ id: "agents-md", status: nearMiss.path.toLowerCase().endsWith(".txt") ? "missing" : "warn", detail: nearMiss.path });
    else results.push({ id: "agents-md", status: "missing" });
  }

  results.push({ id: "data", status: inside(dataDir).length > 0 ? "ok" : "missing" });

  const skillDirs = app ? [APPS[app].skillsDir] : [...new Set(Object.values(APPS).map((one) => one.skillsDir))];
  const skillFiles = (dir) => files.filter((file) => file.path.startsWith(`${dir}/`) && /^[^/]+\/SKILL\.md$/.test(file.path.slice(dir.length + 1)));
  const found = skillDirs.flatMap(skillFiles);
  if (found.length > 0) {
    results.push({ id: "skills", status: "ok" });
    const wrong = found
      .filter((file) => {
        const folder = file.path.split("/").at(-2);
        const meta = parseFrontmatter(file.text ?? "");
        return !meta || meta.name !== folder || !SKILL_NAME.test(folder) || !meta.description;
      })
      .map((file) => file.path.split("/").at(-2));
    if (wrong.length > 0) results.push({ id: "skill-format", status: "warn", detail: wrong.join(", ") });
  } else {
    const elsewhere = [...new Set(Object.values(APPS).map((one) => one.skillsDir))].find((dir) => skillFiles(dir).length > 0);
    if (elsewhere) results.push({ id: "skills", status: "warn", detail: elsewhere });
    else results.push({ id: "skills", status: seesHiddenFolders ? "missing" : "unknown" });
  }

  results.push({ id: "scripts", status: inside("scripts").length > 0 ? "ok" : "optional" });
  results.push({ id: "exports", status: inside(exportsDir).length > 0 ? "ok" : "unknown" });
  return results;
}

/**
 * Find the steps of an animated drawing: the moments, within one cycle, when
 * each piece is fully shown. A piece is shown when its opacity rises to its
 * highest value; an animation that only fades out, or never touches the
 * opacity, adds no step. The page reads these timings from its CSS
 * animations, so the drawing's CSS stays the only place that sets the order.
 * @param {{delay: number, duration: number, keyframes: {offset: number, opacity?: number}[]}[]} timings delay and duration in ms
 * @returns {number[]} sorted moments in ms, without repeats
 */
export function animationSteps(timings) {
  const moments = new Set();
  for (const { delay, duration, keyframes } of timings) {
    const frames = keyframes.filter((frame) => typeof frame.opacity === "number");
    if (frames.length === 0) continue;
    const top = Math.max(...frames.map((frame) => frame.opacity));
    const rise = frames.findIndex((frame, i) => i > 0 && frame.opacity === top && frames[i - 1].opacity < top);
    if (rise > 0) moments.add(Math.round(delay + frames[rise].offset * duration));
  }
  return [...moments].sort((a, b) => a - b);
}

/** The next step after `time`, or 0 (the empty drawing) after the last one. */
export function stepAfter(steps, time) {
  return steps.find((step) => step > time + 1) ?? 0;
}

/** The step before `time`, or 0 (the empty drawing) before the first one. */
export function stepBefore(steps, time) {
  return steps.findLast((step) => step < time - 1) ?? 0;
}

/**
 * Find where a drawing is finished: the moment, after its last step, when the
 * first piece starts to clear for the next loop. The page stops there, so the
 * reader keeps the finished picture. A piece that leaves before the last step
 * (a cover that gives way to a summary) does not count.
 * @param {{delay: number, duration: number, keyframes: {offset: number, opacity?: number}[]}[]} timings as for animationSteps
 * @returns {number | null} the moment in ms, or null when the drawing has no steps
 */
export function animationEnd(timings) {
  const steps = animationSteps(timings);
  if (steps.length === 0) return null;
  const last = steps.at(-1);
  let end = Infinity;
  for (const { delay, duration, keyframes } of timings) {
    const frames = keyframes.filter((frame) => typeof frame.opacity === "number");
    if (frames.length === 0) continue;
    const top = Math.max(...frames.map((frame) => frame.opacity));
    const held = frames.findLastIndex((frame) => frame.opacity === top);
    if (held === frames.length - 1) continue;
    const moment = Math.round(delay + frames[held].offset * duration);
    if (moment > last) end = Math.min(end, moment);
  }
  return end === Infinity ? last : end;
}
