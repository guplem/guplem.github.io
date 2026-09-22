// The board document: everything this page knows that GitHub does not.
//
// It holds one file, `board.json`, in a private repository the reader owns:
// the notes, the cards moved by hand, the work pushed down the list, the colour
// on each column and whether the board is light or dark. Everything here is the reader's; nothing is GitHub's. Two rules keep it safe to
// change, and ADR 0002 explains why both are worth the cost:
//
// 1. Records are only ever added. A note the reader cleared keeps its key and
//    its timestamp, so the merge can tell "deleted just now" from "never seen".
// 2. A build never deletes what it does not understand. An older tab that saves
//    must not wipe a map a newer build wrote, so `migrate` copies unknown maps
//    through untouched.
//
// Every record, in every map, carries `updatedAt`. That is what `sync.js` uses
// to merge two devices, so a record without it is dropped as unreadable.

import { defaultColour, knownColour, knownTheme } from "./appearance.js";
import { knownPriority } from "./priority.js";
import { defaultCounting } from "./counting.js";
import { orderCopyActions } from "./copyActions.js";

export const SCHEMA_VERSION = 1;

/** The file this page keeps in the reader's data repository. */
export const DOCUMENT_PATH = "board.json";

/** The record maps this build knows about. Adding one here is the whole change. */
export const RECORD_MAPS = ["notes", "columns", "colours", "appearance", "priorities", "counting", "copyActions"];

const RESERVED = new Set(["schemaVersion", "updatedAt"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** One stored record, or null when what is stored is not one. */
function readRecord(value) {
  if (!isPlainObject(value)) return null;
  if (typeof value.updatedAt !== "string" || value.updatedAt === "") return null;
  return { ...value };
}

/** A document with nothing in it yet. */
export function emptyDocument(now) {
  const document = { schemaVersion: SCHEMA_VERSION, updatedAt: now };
  for (const name of RECORD_MAPS) document[name] = {};
  return document;
}

/**
 * Anything at all into a usable document. This never throws: a document that
 * throws is one the reader cannot recover from, and their notes are inside it.
 */
export function migrate(value, now) {
  const source = isPlainObject(value) ? value : {};
  const document = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
  };
  const names = new Set([
    ...RECORD_MAPS,
    ...Object.keys(source).filter((key) => !RESERVED.has(key) && isPlainObject(source[key])),
  ]);
  for (const name of names) {
    const raw = isPlainObject(source[name]) ? source[name] : {};
    const map = {};
    for (const [key, record] of Object.entries(raw)) {
      const clean = readRecord(record);
      if (clean) map[key] = clean;
    }
    document[name] = map;
  }
  return document;
}

/** The note filed against one issue, or an empty string when there is none. */
export function readNote(document, issueKey) {
  const record = isPlainObject(document) && isPlainObject(document.notes) ? document.notes[issueKey] : null;
  return isPlainObject(record) && typeof record.body === "string" ? record.body : "";
}

/**
 * The same document with one note written. The document handed in is never
 * changed, so a caller can always fall back to what it already had.
 */
export function writeNote(document, issueKey, body, now) {
  const base = migrate(document, now);
  return {
    ...base,
    updatedAt: now,
    notes: { ...base.notes, [issueKey]: { body: String(body ?? ""), updatedAt: now } },
  };
}

/**
 * The column this item was moved to by hand, or an empty string when its column
 * is left to the rules (ADR 0011).
 */
export function readColumn(document, itemKey) {
  const record = isPlainObject(document) && isPlainObject(document.columns) ? document.columns[itemKey] : null;
  return isPlainObject(record) && typeof record.columnId === "string" ? record.columnId : "";
}

/**
 * The same document with one card moved. The document handed in is not changed.
 *
 * Moving a card back to automatic keeps the record, with an empty column, the
 * same way a cleared note keeps its key: the other device has to be able to
 * tell "moved back just now" from "never moved" (ADR 0002).
 */
export function writeColumn(document, itemKey, columnId, now) {
  const base = migrate(document, now);
  return {
    ...base,
    updatedAt: now,
    columns: { ...base.columns, [itemKey]: { columnId: String(columnId ?? ""), updatedAt: now } },
  };
}

/**
 * The colour painted on one column, or on the review row.
 *
 * **A part nobody has painted wears the colour the board ships** for it
 * (ADR 0024). A record means the reader chose, and their choice wins whatever
 * it is: "None" is a choice like any other, and a column they cleared stays
 * cleared.
 *
 * A colour a newer build knows and this one does not reads as "None". It is
 * left in the file untouched, because a build never deletes what it does not
 * understand (ADR 0002).
 */
export function readColumnColour(document, areaId) {
  const record = isPlainObject(document) && isPlainObject(document.colours) ? document.colours[areaId] : null;
  if (!isPlainObject(record) || typeof record.colourId !== "string") return defaultColour(areaId);
  return knownColour(record.colourId);
}

/**
 * The same document with one area painted. The document handed in is not changed.
 *
 * Choosing "None" again keeps the record, the same way a cleared note keeps its
 * key: the other device has to tell "cleared just now" from "never set".
 */
export function writeColumnColour(document, areaId, colourId, now) {
  const base = migrate(document, now);
  return {
    ...base,
    updatedAt: now,
    colours: { ...base.colours, [areaId]: { colourId: String(colourId ?? ""), updatedAt: now } },
  };
}

/** Light, dark, or the machine's own setting when nothing was chosen. */
export function readTheme(document) {
  const record = isPlainObject(document) && isPlainObject(document.appearance) ? document.appearance.theme : null;
  return knownTheme(isPlainObject(record) ? record.theme : null);
}

/** The same document with the theme chosen. The document handed in is not changed. */
export function writeTheme(document, theme, now) {
  const base = migrate(document, now);
  return {
    ...base,
    updatedAt: now,
    appearance: { ...base.appearance, theme: { theme: String(theme ?? ""), updatedAt: now } },
  };
}

/**
 * Whether the reader pushed this card down the list.
 *
 * The mark belongs to the work, so it is filed under the item's node id and
 * follows the card wherever it is drawn (ADR 0022, ADR 0026).
 */
export function readPriority(document, issueKey) {
  const record = isPlainObject(document) && isPlainObject(document.priorities) ? document.priorities[issueKey] : null;
  return knownPriority(isPlainObject(record) ? record.priority : null);
}

/** The same document with one card marked. The document handed in is not changed. */
export function writePriority(document, issueKey, priority, now) {
  const base = migrate(document, now);
  return {
    ...base,
    updatedAt: now,
    priorities: { ...base.priorities, [issueKey]: { priority: String(priority ?? ""), updatedAt: now } },
  };
}

/**
 * What one part of the board counts: whether it adds to the number in the tab,
 * and whether its own count holds the work the reader pushed down (ADR 0030).
 *
 * Each answer falls back on its own, so a record written by a build that knew
 * only one of them still says what it knows.
 */
export function readCounting(document, areaId) {
  const record = isPlainObject(document) && isPlainObject(document.counting) ? document.counting[areaId] : null;
  const fallback = defaultCounting(areaId);
  if (!isPlainObject(record)) return fallback;
  return {
    counted: typeof record.counted === "boolean" ? record.counted : fallback.counted,
    withLowPriority: typeof record.withLowPriority === "boolean" ? record.withLowPriority : fallback.withLowPriority,
  };
}

/** The same document with one part of the board answering differently. */
export function writeCounting(document, areaId, { counted, withLowPriority }, now) {
  const base = migrate(document, now);
  return {
    ...base,
    updatedAt: now,
    counting: {
      ...base.counting,
      [areaId]: { counted: counted === true, withLowPriority: withLowPriority === true, updatedAt: now },
    },
  };
}

/**
 * The lines the reader copies from a card, oldest first (ADR 0031).
 *
 * One record per action, so two devices that each add one keep both. An action
 * the reader removed keeps its key with an empty template, and `copyActions.js`
 * is what leaves it out of the list.
 */
export function readCopyActions(document) {
  return orderCopyActions(isPlainObject(document) ? document.copyActions : null);
}

/**
 * The same document with one action written. The document handed in is not
 * changed.
 *
 * `createdAt` is what the order reads, so an edit keeps the one the action was
 * made under and only a new action sets it.
 */
export function writeCopyAction(document, id, { label, template, createdAt }, now) {
  const base = migrate(document, now);
  const before = isPlainObject(base.copyActions[id]) ? base.copyActions[id] : {};
  return {
    ...base,
    updatedAt: now,
    copyActions: {
      ...base.copyActions,
      [id]: {
        label: String(label ?? ""),
        template: String(template ?? ""),
        createdAt: String(createdAt ?? before.createdAt ?? now),
        updatedAt: now,
      },
    },
  };
}

/**
 * The same document with one action removed.
 *
 * The record stays, with nothing left to copy. A deleted key would come back
 * from the other device on the next merge (ADR 0002).
 */
export function removeCopyAction(document, id, now) {
  const base = migrate(document, now);
  const before = isPlainObject(base.copyActions[id]) ? base.copyActions[id] : {};
  return writeCopyAction(base, id, { label: before.label ?? "", template: "", createdAt: before.createdAt }, now);
}

/** The exact text stored in the repository. Two spaces and a final newline, so a human can read the diff. */
export function serializeDocument(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** The text back into a document. A file somebody broke by hand opens as an empty one. */
export function parseDocument(text, now) {
  try {
    return migrate(JSON.parse(String(text)), now);
  } catch {
    return emptyDocument(now);
  }
}
