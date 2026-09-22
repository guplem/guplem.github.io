// The lines the reader copies from a card, written by the reader themselves.
//
// Work is handed to an agent as a sentence now: "/implement-issue #214", or
// "Please, whenever you can, take a look and review <link>". The same sentence
// is typed again for every card, and the two things that change in it are on
// the card already. So the reader writes the sentence once, in Settings, and
// the card menu copies it filled in (ADR 0031).
//
// An action is a **label** and a **template**. A template is plain text with
// placeholders in braces, and this file holds every placeholder the board
// fills. Three rules decide what a template does, and each one is there so the
// reader can see what went wrong without reading any code:
//
// 1. **A placeholder nobody offers is left exactly as it was typed.** `{AUTOR}`
//    copies as `{AUTOR}`. Dropping it would hand back a sentence with a hole in
//    it, and nothing on screen would say why.
// 2. **The case does not matter.** `{url}` and `{URL}` are the same
//    placeholder, because the reader types the template by hand.
// 3. **An action the card cannot fill is not offered at all.** An issue has no
//    branch, so a template using `{BRANCH}` does not appear in an issue's menu.
//    That is the answer "Copy branch name" already gives (ADR 0021).
//
// A token here is written into `board.json` the moment the reader saves a
// template, so it is as permanent as a column id. Renaming one breaks every
// template already saved, and `invariants.test.js` guards the list.

/** Every placeholder a template can carry, and what each one becomes. */
export const PLACEHOLDERS = [
  { token: "{N}", describe: "The number, with no #. For example 214." },
  { token: "{URL}", describe: "The link to it on GitHub." },
  { token: "{TITLE}", describe: "The title, as GitHub holds it." },
  { token: "{REPO}", describe: "The repository, as owner/name." },
  { token: "{BRANCH}", describe: "The branch of a pull request. An issue has none, so a template using it is not offered there." },
];

/**
 * What an empty Settings suggests.
 *
 * Nobody starts with a line, so the boxes have to say what one looks like. The
 * first is the greyed-out example text in the two boxes, and all of them are
 * listed under the boxes until the reader writes their own.
 *
 * The last one is a placeholder and nothing else. The other two wrap words
 * around a placeholder, and on their own they read as if a line has to be a
 * sentence.
 */
export const EXAMPLE_ACTIONS = [
  { label: "Implement this issue", template: "/implement-issue #{N}" },
  { label: "Ask for a review", template: "Please, whenever you can, take a look and review {URL}" },
  { label: "Copy link", template: "{URL}" },
];

/** Anything at all in braces, which is how a typo is found rather than filled. */
const ANY_PLACEHOLDER = /\{[A-Za-z]+\}/g;

const KNOWN = new Set(PLACEHOLDERS.map((one) => one.token));

function text(value) {
  return typeof value === "string" ? value : "";
}

/**
 * What each placeholder becomes for one card.
 *
 * A value the card has not got is an empty string, and `canFillTemplate` is
 * what keeps such a template out of the menu.
 */
function copyValues(item) {
  const card = item && typeof item === "object" ? item : {};
  return {
    "{N}": Number.isInteger(card.number) && card.number > 0 ? String(card.number) : "",
    "{URL}": text(card.url),
    "{TITLE}": text(card.title),
    "{REPO}": text(card.repository),
    "{BRANCH}": text(card.headRefName),
  };
}

/** The placeholders this board fills that a template uses, once each. */
export function placeholdersIn(template) {
  const used = [];
  for (const found of text(template).matchAll(ANY_PLACEHOLDER)) {
    const token = found[0].toUpperCase();
    if (KNOWN.has(token) && !used.includes(token)) used.push(token);
  }
  return used;
}

/** One template, with this card's own values in it. */
export function fillCopyTemplate(template, item) {
  const values = copyValues(item);
  return text(template).replace(ANY_PLACEHOLDER, (found) => {
    const token = found.toUpperCase();
    return KNOWN.has(token) ? values[token] : found;
  });
}

/** Whether this card holds everything the template asks for. */
export function canFillTemplate(template, item) {
  if (!item || typeof item !== "object" || typeof template !== "string") return false;
  const values = copyValues(item);
  return placeholdersIn(template).every((token) => values[token] !== "");
}

/**
 * The stored map into the list Settings and the menu read, in one order.
 *
 * Oldest first, so the list holds still as the reader adds to it, with the id
 * breaking a tie: two devices can write an action in the same second and both
 * have to read the same order.
 *
 * An action with no template left is one the reader removed. It keeps its key
 * in the file, the same way a cleared note keeps its key, so the other device
 * can tell "removed just now" from "never seen" (ADR 0002).
 *
 * @param stored `document.copyActions`, the raw record map
 * @returns `[{id, label, template, createdAt}]`
 */
export function orderCopyActions(stored) {
  const map = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const actions = [];
  for (const [id, record] of Object.entries(map)) {
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    const template = text(record.template).trim();
    if (template === "") continue;
    const label = text(record.label).trim();
    actions.push({ id, label: label === "" ? template : label, template, createdAt: text(record.createdAt) });
  }
  return actions.sort((one, other) =>
    one.createdAt === other.createdAt
      ? one.id.localeCompare(other.id)
      : one.createdAt.localeCompare(other.createdAt),
  );
}
