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

/**
 * The icons a line can carry in the card menu, as SVG paths on a 24 by 24 grid
 * (Lucide). The reader picks one in Settings, or types one emoji instead.
 *
 * An id is written into `board.json` the moment the reader picks it, so it is
 * as permanent as a placeholder. `invariants.test.js` guards the list.
 */
export const COPY_ICONS = [
  {
    id: "copy",
    label: "Copy",
    paths: [
      "M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z",
      "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
    ],
  },
  {
    id: "link",
    label: "Link",
    paths: [
      "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
      "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    ],
  },
  { id: "terminal", label: "Terminal", paths: ["m4 17 6-6-6-6", "M12 19h8"] },
  { id: "message", label: "Message", paths: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"] },
  {
    id: "send",
    label: "Send",
    paths: [
      "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
      "m21.854 2.147-10.94 10.939",
    ],
  },
  {
    id: "branch",
    label: "Branch",
    paths: ["M6 3v12", "M18 9a9 9 0 0 1-9 9", "M15 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0", "M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  },
  {
    id: "pull-request",
    label: "Pull request",
    paths: ["M13 6h3a2 2 0 0 1 2 2v7", "M6 9v12", "M15 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0", "M3 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  },
  {
    id: "bot",
    label: "Agent",
    paths: [
      "M12 8V4H8",
      "M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z",
      "M2 14h2",
      "M20 14h2",
      "M15 13v2",
      "M9 13v2",
    ],
  },
  {
    id: "eye",
    label: "Review",
    paths: [
      "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
      "M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    ],
  },
  { id: "check", label: "Done", paths: ["M20 6 9 17l-5-5"] },
  {
    id: "rocket",
    label: "Ship",
    paths: [
      "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",
      "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",
      "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0",
      "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
    ],
  },
  {
    id: "star",
    label: "Star",
    paths: [
      "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
    ],
  },
];

/** What a line with no icon, or one this build does not know, draws. */
export const DEFAULT_COPY_ICON = "copy";

/**
 * A character that makes a piece of text an emoji: a pictograph, half of a
 * flag, or the frame of a keycap. Letters and digits alone never are.
 */
const EMOJI_PART = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

/**
 * The text cut where a reader sees one character end. An emoji such as a
 * person at a laptop is several code points joined, and must stay one piece.
 */
function graphemes(value) {
  if (typeof Intl === "object" && typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (one) => one.segment);
  }
  return Array.from(value);
}

/** Whether the text is exactly one emoji, with no space or letter beside it. */
function isOneEmoji(value) {
  const pieces = graphemes(value);
  return pieces.length === 1 && EMOJI_PART.test(pieces[0]);
}

/**
 * What to draw for the icon stored on a line.
 *
 * @returns `{kind: "icon", id, paths}` for an icon from the list, and for no
 *   icon at all; `{kind: "emoji", text}` for one emoji
 */
export function readCopyIcon(value) {
  const written = text(value).trim();
  if (isOneEmoji(written)) return { kind: "emoji", text: written };
  const known = COPY_ICONS.find((one) => one.id === written) ?? COPY_ICONS.find((one) => one.id === DEFAULT_COPY_ICON);
  return { kind: "icon", id: known.id, paths: known.paths };
}

/**
 * The emoji to keep from what the reader typed in the emoji box: the last one,
 * so a second emoji replaces the first. An empty string when there is none.
 */
export function pickEmoji(value) {
  const emojis = graphemes(text(value)).filter((one) => EMOJI_PART.test(one));
  return emojis.length > 0 ? emojis[emojis.length - 1] : "";
}

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
 * @returns `[{id, label, template, icon, createdAt}]`
 */
export function orderCopyActions(stored) {
  const map = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const actions = [];
  for (const [id, record] of Object.entries(map)) {
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    const template = text(record.template).trim();
    if (template === "") continue;
    const label = text(record.label).trim();
    actions.push({
      id,
      label: label === "" ? template : label,
      template,
      icon: text(record.icon).trim(),
      createdAt: text(record.createdAt),
    });
  }
  return actions.sort((one, other) =>
    one.createdAt === other.createdAt
      ? one.id.localeCompare(other.id)
      : one.createdAt.localeCompare(other.createdAt),
  );
}
