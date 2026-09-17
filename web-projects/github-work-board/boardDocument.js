// The board document: everything this page knows that GitHub does not.
//
// It holds one file, `board.json`, in a private repository the reader owns.
// Notes today; tags, columns and queue order later. Two rules keep it safe to
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

export const SCHEMA_VERSION = 1;

/** The file this page keeps in the reader's data repository. */
export const DOCUMENT_PATH = "board.json";

/** The record maps this build knows about. Adding one here is the whole change. */
export const RECORD_MAPS = ["notes"];

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
