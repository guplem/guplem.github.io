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

/**
 * Whether the board file is reaching GitHub, said beside the repository it goes to.
 *
 * The board file holds the half of this board that belongs to the reader
 * (notes, moved cards, and how it looks), and nothing else on the screen says
 * whether it is getting through: the file is read on connecting and written a
 * second after a keystroke or a click, both out of sight. One token reaching
 * the file is the whole answer, because exactly one can (ADR 0007), and the
 * detail is the sentence that names what to fix, so the badge answers rather
 * than sending the reader looking (ADR 0019).
 *
 * A token that cannot reach the repository says nothing about it, on purpose:
 * an organisation's token is not broken for failing to hold somebody's private
 * board (ADR 0007). So no answer at all, once every token has been asked,
 * means no token reached it, and that is the state worth shouting about.
 *
 * @param rows every connection check the board collected, from every token
 * @param asked whether every token has answered yet
 */
export function describeNotesSync(rows, { asked = false } = {}) {
  const board = (Array.isArray(rows) ? rows : []).filter((one) => one && typeof one === "object" && one.id === "board");
  if (board.length === 0 && !asked) {
    return { state: "checking", label: "Checking", detail: "The board is asking GitHub about this repository." };
  }
  if (board.length === 0) {
    return {
      state: "broken",
      label: "Not saving",
      detail:
        "No token reached this repository. The token owned by the account that holds it needs Contents: Read and write, and the repository in its list.",
    };
  }
  const reached = board.find((one) => one.ok === true);
  if (reached) return { state: "ok", label: "Saving", detail: String(reached.detail ?? "") };
  return { state: "broken", label: "Not saving", detail: String(board[0].detail ?? "") };
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
