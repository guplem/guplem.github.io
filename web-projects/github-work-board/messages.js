// Every sentence the page says, and the one escaper it uses.
//
// The page shows text written by other people (issue titles, label names). It
// reaches the screen through `textContent` everywhere except the deploy line,
// which needs a link inside a sentence and therefore needs `escapeHtml`.

export const MESSAGES = {
  "ui.deployed": "Deployed {date} by pull request {pr}.",
  "ui.deployedUnknown": "Not published yet. See the {history}.",
  "ui.deployHistory": "history of this folder",
};

/**
 * One message, with `{name}` placeholders filled in.
 *
 * An unknown key answers with the key itself. A missing message must never show
 * as an empty line: a blank space and a broken feature look the same.
 */
export function say(key, params = {}) {
  const template = MESSAGES[key];
  if (typeof template !== "string") return String(key);
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    params && name in params ? String(params[name]) : whole,
  );
}

/**
 * The start-up screen's steps, in the order they happen.
 *
 * The browser paints `index.html` before it runs a line of the board's own
 * code, so the first step is written into that file and the rest are set from
 * `app.js` as each one starts. The words live here all the same, so the two
 * copies of the first one cannot drift (ADR 0036).
 */
export const BOOT_STEPS = [
  { id: "code", words: "Loading the board's code" },
  { id: "saved", words: "Reading what this browser saved" },
  { id: "board", words: "Opening your board" },
];

const BOOT_BY_ID = new Map(BOOT_STEPS.map((step) => [step.id, step]));

/** What the start-up screen says it is doing. A step nobody knows says the first one. */
export function bootStepWords(id) {
  return (BOOT_BY_ID.get(id) ?? BOOT_STEPS[0]).words;
}

/**
 * How full the start-up bar is, in whole percent.
 *
 * Never zero: a bar with nothing in it reads as a page that has not started,
 * which is the opposite of what this screen is for.
 */
export function bootStepProgress(id) {
  const at = BOOT_STEPS.findIndex((step) => step.id === id);
  return Math.round(((at < 0 ? 0 : at) + 1) * (100 / BOOT_STEPS.length));
}

// How long ago, in the units a person would say it in.
const SINCE = [
  { unit: "day", ms: 24 * 60 * 60_000 },
  { unit: "hour", ms: 60 * 60_000 },
  { unit: "minute", ms: 60_000 },
  { unit: "second", ms: 1000 },
];

/** Under this, a number is noise: the reader pressed it a moment ago. */
const JUST_NOW_MS = 10_000;

/**
 * When the board last heard from GitHub, for the refresh button to say.
 *
 * The board asks again on its own (ADR 0025), so the reader cannot tell a quiet
 * morning from a board that stopped asking. This is the sentence that tells
 * them (ADR 0029).
 *
 * @param lastAt when the last read finished, in milliseconds, or null
 * @param now the moment to measure against, in milliseconds
 */
export function describeLastRefresh(lastAt, now) {
  if (typeof lastAt !== "number" || !Number.isFinite(lastAt)) return "Not refreshed yet";
  // A clock that moved backwards must never say "refreshed in four hours".
  const waited = Math.max(0, now - lastAt);
  if (waited < JUST_NOW_MS) return "Refreshed just now";

  for (const { unit, ms } of SINCE) {
    const count = Math.floor(waited / ms);
    if (count >= 1) return `Refreshed ${count} ${unit}${count === 1 ? "" : "s"} ago`;
  }
  return "Refreshed just now";
}

/**
 * What the menu offers about a note: writing the first one is a different act
 * from changing one that is already there.
 */
export function noteMenuLabel(noteText) {
  return typeof noteText === "string" && noteText.trim() !== "" ? "Edit note" : "Add note";
}

/**
 * What the menu offers about the reader's own ranking of a card.
 *
 * Each one names what the row does, not what the card is: a menu row is a
 * thing the reader presses (ADR 0026).
 */
export function priorityMenuLabel(priority) {
  return priority === "low" ? "Make it a priority" : "Not a priority";
}

/**
 * The one line on a folded token row.
 *
 * It has to answer "do I need to open this?" on its own. A reader who must
 * unfold every token to find the broken one is not helped by the folding, so
 * one failure is named rather than counted (ADR 0018).
 */
export function summariseChecks(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((one) => one && typeof one === "object");
  if (list.length === 0) return "Not connected yet";
  const failed = list.filter((one) => one.ok !== true);
  if (failed.length === 0) return `All ${list.length} checks passed`;
  if (failed.length === 1) return `${failed[0].label ?? "One check"} did not pass`;
  return `${failed.length} of ${list.length} checks did not pass`;
}


/** A list of names as a person would read it out. */
export function joinWithAnd(names) {
  const clean = (Array.isArray(names) ? names : []).filter((one) => typeof one === "string" && one !== "");
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} and ${clean.at(-1)}`;
}

/**
 * Why the board is empty.
 *
 * "Nothing is assigned to you" is a lie when the truth is "these tokens cannot
 * see where your work lives", and that second case is the common one: a
 * fine-grained token belongs to one owner, so a personal token sees nothing in
 * an organisation. The sentence therefore always says how far the board can
 * actually see (ADR 0007).
 */
export function sayEmptyBoard({ tokenCount = 0, owners = [] } = {}) {
  if (tokenCount === 0) return "No token is connected yet.";
  const counted = tokenCount === 1 ? "1 token" : `${tokenCount} tokens`;
  const reach =
    owners.length > 0
      ? `The board is using ${counted}, which reach ${joinWithAnd(owners)}.`
      : `The board is using ${counted}, and they reached no repository holding work for you.`;
  return `Nothing open is assigned to you. ${reach}`;
}

/** Text made safe to put inside HTML. The ampersand goes first, or the rest double-escape. */
export function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
