// How Settings is split up, and what its search can find.
//
// Settings grew to about four windows of controls that a reader visits to fix
// one thing. It is now five sections, one per subject, and only one is drawn
// at a time. The open section travels in the link beside the view
// (`?view=settings&section=appearance`), so its id is permanent, like a view
// name (ADR 0048).
//
// The search reads a written list of the settings, not the page. A section
// that is not drawn still has its settings found, and so do the rows the
// shared cloud storage panel draws itself. `invariants.test.js` ties every
// entry here to a `data-setting` on the page, so the two cannot drift apart.

export const SETTINGS_SECTIONS = [
  { id: "tokens", label: "GitHub tokens", says: "The tokens that read your work, and what each one may do" },
  { id: "storage", label: "Cloud storage", says: "Where your half of the board is saved, and the cleanup of old notes" },
  { id: "appearance", label: "Look", says: "The theme, the colour of each part, and what is shown" },
  { id: "counting", label: "Tab count", says: "What the number in the browser tab counts" },
  { id: "copy-lines", label: "Copy lines", says: "The lines you copy from a card's menu" },
];

export const DEFAULT_SECTION = "tokens";

const BY_ID = new Map(SETTINGS_SECTIONS.map((one) => [one.id, one]));

/** One of the sections above, whatever was asked for. */
export function readSection(value) {
  return typeof value === "string" && BY_ID.has(value) ? value : DEFAULT_SECTION;
}

/** The name of a section in the index, or an empty string. */
export function sectionLabel(id) {
  return BY_ID.get(id)?.label ?? "";
}

/** The section a screen was opened from, so "back" returns there, or null. */
export function parentSection(view) {
  return { "add-token": "tokens", cleanup: "storage" }[view] ?? null;
}

/**
 * Every setting the search can find. `id` is the `data-setting` on the row the
 * search scrolls to; `keywords` are the words a reader may type instead of the
 * words on the screen.
 */
export const SETTINGS_ENTRIES = [
  { id: "token-list", section: "tokens", label: "Your tokens", keywords: ["token", "pat", "rename", "remove", "delete", "copy", "permissions", "checks", "organisation", "organization"] },
  { id: "add-token", section: "tokens", label: "Add a token", keywords: ["new", "connect", "organisation", "organization", "account"] },
  { id: "recheck-tokens", section: "tokens", label: "Check every permission again", keywords: ["permissions", "access", "test", "verify", "red"] },
  { id: "token-backup", section: "tokens", label: "Copy every token as a backup", keywords: ["backup", "export", "move", "browser", "computer", "profile", "password"] },
  { id: "cloud-storage", section: "storage", label: "Cloud storage", keywords: ["save", "sync", "repository", "repo", "storage token", "data", "export", "import", "notes", "devices"] },
  { id: "cleanup", section: "storage", label: "Suggested cleanup", keywords: ["delete", "notes", "closed", "merged", "old", "clean"] },
  { id: "theme", section: "appearance", label: "Theme", keywords: ["dark", "light", "mode", "night", "automatic"] },
  { id: "column-colours", section: "appearance", label: "Colour on each part of the board", keywords: ["colour", "color", "paint", "tint", "column", "review row"] },
  { id: "column-shown", section: "appearance", label: "Show or hide a part of the board", keywords: ["hide", "show", "column", "review row", "done", "visible"] },
  { id: "card-parts", section: "appearance", label: "What each card shows", keywords: ["hide", "show", "card", "labels", "milestone", "fields", "effort", "priority", "people", "faces", "parent", "blockers", "sub-issues", "children"] },
  { id: "tab-count", section: "counting", label: "What the tab name counts", keywords: ["tab", "title", "number", "count", "badge", "not a priority", "low priority"] },
  { id: "copy-actions", section: "copy-lines", label: "Lines you copy from a card", keywords: ["copy", "template", "line", "snippet", "clipboard", "menu", "branch"] },
  { id: "copy-placeholders", section: "copy-lines", label: "What you can put in a line", keywords: ["placeholder", "number", "link", "title", "variables"] },
];

/** Lower case, with accents taken off, so "Colór" and "color" are one word. */
function fold(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function wordsOf(text) {
  return fold(text).split(/[^a-z0-9]+/).filter(Boolean);
}

function startsAWord(word, words) {
  return words.some((one) => one.startsWith(word));
}

/**
 * The settings that match what the reader typed, best first.
 *
 * Every word typed has to start a word of the setting's name, of a word it is
 * known by, or of its section's name. A match on every word in the name ranks
 * first; past that, the list keeps its own order, so the answer is stable.
 *
 * @returns `[{ entry, section }]`
 */
export function matchSettings(query, entries = SETTINGS_ENTRIES) {
  const typed = wordsOf(query);
  if (typed.length === 0) return [];
  const found = [];
  for (const [index, entry] of (Array.isArray(entries) ? entries : []).entries()) {
    const section = BY_ID.get(entry.section) ?? { id: entry.section, label: "" };
    const name = wordsOf(entry.label);
    const known = [...name, ...(entry.keywords ?? []).flatMap(wordsOf), ...wordsOf(section.label)];
    if (!typed.every((word) => startsAWord(word, known))) continue;
    const byName = typed.every((word) => startsAWord(word, name));
    found.push({ entry, section, rank: byName ? 0 : 1, index });
  }
  return found.sort((a, b) => a.rank - b.rank || a.index - b.index).map(({ entry, section }) => ({ entry, section }));
}
