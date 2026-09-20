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
 * What the menu offers about a note: writing the first one is a different act
 * from changing one that is already there.
 */
export function noteMenuLabel(noteText) {
  return typeof noteText === "string" && noteText.trim() !== "" ? "Edit note" : "Add note";
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
