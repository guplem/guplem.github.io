// The one shape every stored document has.
//
// A document is `{schemaVersion, updatedAt, <map>: {<key>: {…, updatedAt}}}`:
// a few record maps, each a plain object of records, and every record carrying
// the time it was last written. That time is what `merge.js` uses to put two
// devices' copies back together, so a record without it is dropped as
// unreadable. Two rules keep the shape safe to change, and root ADR 0016 says
// why both are worth the cost:
//
// 1. Records are only ever added. A record the reader removed keeps its key
//    and its time, so the merge can tell "removed just now" from "never seen".
// 2. A build never deletes what it does not understand. An older tab that saves
//    must not wipe a map a newer build wrote, so `migrate` copies unknown maps
//    through untouched.
//
// A project with "one blob" (a game save) uses one map with one key. That
// buys it the same merge, the same conflict handling and the same migration
// dialog as everybody else, for nothing.

export const SCHEMA_VERSION = 1;

/**
 * The most bytes one document may take. GitHub's contents API returns file
 * content only up to 1 MB, so the store refuses earlier, with a sentence.
 */
export const MAX_DOCUMENT_BYTES = 900 * 1024;

const RESERVED = new Set(["schemaVersion", "updatedAt"]);

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** One stored record, or null when what is stored is not one. */
function cleanRecord(value) {
  if (!isPlainObject(value)) return null;
  if (typeof value.updatedAt !== "string" || value.updatedAt === "") return null;
  return { ...value };
}

/** A document with nothing in it yet. */
export function emptyDocument(recordMaps, now) {
  const document = { schemaVersion: SCHEMA_VERSION, updatedAt: now };
  for (const name of recordMaps) document[name] = {};
  return document;
}

/**
 * Anything at all into a usable document. This never throws: a document that
 * throws is one the reader cannot recover from, and their data is inside it.
 */
export function migrate(value, recordMaps, now) {
  const source = isPlainObject(value) ? value : {};
  const document = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
  };
  const names = new Set([
    ...recordMaps,
    ...Object.keys(source).filter((key) => !RESERVED.has(key) && isPlainObject(source[key])),
  ]);
  for (const name of names) {
    const raw = isPlainObject(source[name]) ? source[name] : {};
    const map = {};
    for (const [key, record] of Object.entries(raw)) {
      const clean = cleanRecord(record);
      if (clean) map[key] = clean;
    }
    document[name] = map;
  }
  return document;
}

/** The names of the record maps a document holds, whatever build wrote them. */
export function recordMapsOf(document) {
  return isPlainObject(document) ? Object.keys(document).filter((name) => !RESERVED.has(name) && isPlainObject(document[name])) : [];
}

/**
 * One record, with its time, or null when there is none or it was removed.
 * A caller reads the fields it knows and ignores the rest.
 */
export function readRecord(document, mapName, key) {
  const map = isPlainObject(document) ? document[mapName] : null;
  const record = isPlainObject(map) ? cleanRecord(map[key]) : null;
  if (!record || record.removed === true) return null;
  return record;
}

/**
 * The same document with one record written. The document handed in is never
 * changed, so a caller can always fall back to what it already had. The
 * record's time is always `now`; a field named `updatedAt` cannot override it.
 */
export function writeRecord(document, mapName, key, fields, now) {
  const base = migrate(document, [mapName], now);
  const clean = isPlainObject(fields) ? fields : {};
  const { removed, ...kept } = clean;
  return {
    ...base,
    updatedAt: now,
    [mapName]: { ...base[mapName], [key]: { ...kept, updatedAt: now } },
  };
}

/**
 * The same document with one record removed.
 *
 * The record stays, marked removed, with its time. A deleted key would come
 * back from the other device on the next merge.
 */
export function removeRecord(document, mapName, key, now) {
  const base = migrate(document, [mapName], now);
  return {
    ...base,
    updatedAt: now,
    [mapName]: { ...base[mapName], [key]: { updatedAt: now, removed: true } },
  };
}

/** Whether a document holds anything a person would miss. Removed records do not count. */
export function hasRecords(document) {
  for (const name of recordMapsOf(document)) {
    for (const record of Object.values(document[name])) {
      if (cleanRecord(record) && record.removed !== true) return true;
    }
  }
  return false;
}

/** The exact text stored in the repository. Two spaces and a final newline, so a human can read the diff. */
export function serializeDocument(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** The text back into a document. A file somebody broke by hand opens as an empty one. */
export function parseDocument(text, recordMaps, now) {
  try {
    return migrate(JSON.parse(String(text)), recordMaps, now);
  } catch {
    return emptyDocument(recordMaps, now);
  }
}

/** How many bytes a text takes once encoded, which is what GitHub counts. */
export function documentBytes(text) {
  return new TextEncoder().encode(String(text ?? "")).length;
}

/**
 * The same functions with the record maps bound, so a project declares them
 * once: `const shape = defineDocument(["saves"])`.
 */
export function defineDocument(recordMaps) {
  const maps = [...recordMaps];
  return {
    recordMaps: maps,
    empty: (now) => emptyDocument(maps, now),
    migrate: (value, now) => migrate(value, maps, now),
    read: readRecord,
    write: writeRecord,
    remove: removeRecord,
    serialize: serializeDocument,
    parse: (text, now) => parseDocument(text, maps, now),
  };
}

/** How many live records a document holds, across every map. Removed records do not count. */
export function recordCount(document) {
  let count = 0;
  for (const name of recordMapsOf(document)) {
    for (const record of Object.values(document[name])) {
      if (cleanRecord(record) && record.removed !== true) count += 1;
    }
  }
  return count;
}
