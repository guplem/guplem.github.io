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
