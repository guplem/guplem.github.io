// A title split into the change it announces and what it actually says.
//
// Most titles here are written the way conventional commits asks for it:
// `fix(api): the board forgets the note on reload`. The first half is the same
// on hundreds of cards and the second half is the only part worth reading, so
// the card draws the first half as an icon and a small word, and gives the
// title line to the rest (ADR 0021).
//
// **A word this file does not know is left in the title.** The point is to take
// noise off the card, and a word that is not a type is not noise, it is the
// title. "Note: the rate limit is 5000 an hour" keeps every word it has.
//
// The icons are paths rather than an icon set, because this project loads no
// third-party code at all (ADR 0001). They are drawn on a 24x24 box and
// stroked with `currentColor`, like every other icon here.

/**
 * The kinds of change a title can announce.
 *
 * `id` is the word the convention uses, because that is the word the reader
 * sees written in front of them. `aliases` are what people type instead, which
 * on an issue is most of the time.
 */
export const CHANGE_TYPES = [
  {
    id: "feat",
    label: "New feature",
    aliases: ["feature", "features", "new"],
    paths: ["m12 3 2.1 5.6L20 11l-5.9 2.4L12 19l-2.1-5.6L4 11l5.9-2.4z"],
  },
  {
    id: "fix",
    label: "Fix",
    aliases: ["bug", "bugfix", "hotfix", "fixes"],
    paths: ["M14.5 6.5a3.8 3.8 0 0 0 5 5l-9 9-5-5z", "m16 9 2.5-2.5"],
  },
  {
    id: "docs",
    label: "Documentation",
    aliases: ["doc", "documentation"],
    paths: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6M9 17h4"],
  },
  {
    id: "refactor",
    label: "Refactor",
    aliases: ["refac", "rework"],
    paths: [
      "M3 12a9 9 0 0 1 9-9 9.7 9.7 0 0 1 6.7 2.7L21 8",
      "M21 3v5h-5",
      "M21 12a9 9 0 0 1-9 9 9.7 9.7 0 0 1-6.7-2.7L3 16",
      "M3 21v-5h5",
    ],
  },
  {
    id: "test",
    label: "Test",
    aliases: ["tests", "testing"],
    paths: ["M9 3v6.5L4.6 17A2 2 0 0 0 6.3 20h11.4a2 2 0 0 0 1.7-3L15 9.5V3", "M8 3h8", "M7.5 14h9"],
  },
  { id: "perf", label: "Performance", aliases: ["performance"], paths: ["m13 3-8.5 11H11l-1 7 8.5-11H12z"] },
  {
    id: "style",
    label: "Style",
    aliases: ["styles", "formatting", "format"],
    paths: ["M9.5 12 18 3.5a2.1 2.1 0 0 1 3 3L12.5 15", "M9.5 12 12.5 15", "M7 15c-1.7 0-3 1.3-3 3 0 1.3-2 1.5-2 2 1 1.1 2.5 2 4 2a4 4 0 0 0 4-4c0-1.7-1.3-3-3-3z"],
  },
  {
    id: "build",
    label: "Build",
    aliases: ["deps", "dependencies", "release"],
    paths: ["m21 16-9 5-9-5V8l9-5 9 5z", "m3.3 7 8.7 5 8.7-5", "M12 22V12"],
  },
  {
    id: "ci",
    label: "Continuous integration",
    aliases: ["cicd", "workflow", "workflows"],
    paths: [
      "M7 3H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z",
      "M20 16h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z",
      "M5.5 8v5a2 2 0 0 0 2 2H16",
    ],
  },
  {
    id: "chore",
    label: "Chore",
    aliases: ["chores", "maintenance", "misc"],
    paths: [
      "M4 7h8M17.5 7H20M4 17h2.5M12 17h8",
      "M14.8 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
      "M9.2 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    ],
  },
  {
    id: "revert",
    label: "Revert",
    aliases: ["rollback", "undo"],
    paths: ["m9 14-5-5 5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  },
];

/** Every spelling the board answers to, pointing at the type it means. */
const BY_WORD = new Map();
for (const type of CHANGE_TYPES) {
  for (const word of [type.id, ...type.aliases]) BY_WORD.set(word, type);
}

// One word, an optional scope in brackets, an optional `!` for a breaking
// change, a colon, and the rest. The word is bounded so a colon in the middle
// of a sentence is read as punctuation, which is what it is.
const PREFIX = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?:\s*(\S.*)$/;

/**
 * A title, read.
 *
 * @returns `{type, scope, breaking, description}`. `type` is an entry of
 *   `CHANGE_TYPES`, or null when the title announces nothing this file knows,
 *   in which case `description` is the whole title, word for word.
 */
export function readTitle(title) {
  const text = typeof title === "string" ? title.trim() : "";
  const nothing = { type: null, scope: "", breaking: false, description: text };
  if (text === "") return nothing;

  const parts = PREFIX.exec(text);
  if (!parts) return nothing;

  const type = BY_WORD.get(parts[1].toLowerCase()) ?? null;
  if (!type) return nothing;

  return {
    type,
    scope: typeof parts[2] === "string" ? parts[2].trim() : "",
    breaking: parts[3] === "!",
    description: parts[4].trim(),
  };
}
