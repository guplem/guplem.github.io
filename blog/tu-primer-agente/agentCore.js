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
 * @param {{app: string | null, dataDir: string, exportsDir: string}} options
 * @returns {{id: string, status: "ok" | "warn" | "missing" | "unknown" | "optional", detail?: string}[]}
 */
export function checkFolder(files, { app, dataDir, exportsDir }) {
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
    results.push(elsewhere ? { id: "skills", status: "warn", detail: elsewhere } : { id: "skills", status: "missing" });
  }

  results.push({ id: "scripts", status: inside("scripts").length > 0 ? "ok" : "optional" });
  results.push({ id: "exports", status: inside(exportsDir).length > 0 ? "ok" : "unknown" });
  return results;
}
