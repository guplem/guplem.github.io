// Putting two copies of a document back together.
//
// A document lives in one file, and two devices can edit it between saves.
// Whole-file last-write-wins would be one line of code and would throw away
// every record the other device wrote. So the merge runs per record: the phone
// writing record A and the laptop writing record B both keep their work, and
// only the same record on both sides is a real contest.
//
// That contest is settled by `updatedAt`, newest wins. A tie keeps the remote
// side. The tie rule looks arbitrary and is not: both devices must pick the
// same winner, or each keeps pushing its own version back at the other for
// ever. "The remote side wins" is the only rule both devices agree on without
// talking to each other. Lifted unchanged from github-work-board ADR 0002.

import { SCHEMA_VERSION, migrate, recordMapsOf, serializeDocument } from "./envelope.js";

/** A stable text for comparing two sets of records, whatever order their keys are in. */
function stableText(value) {
  if (Array.isArray(value)) return `[${value.map(stableText).join(",")}]`;
  if (value && typeof value === "object") {
    const pairs = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableText(value[key])}`);
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Only the records, without the document's own time, which changes on every save. */
function recordsText(document) {
  const maps = {};
  for (const name of recordMapsOf(document)) maps[name] = document[name];
  return stableText(maps);
}

/** Whether two documents hold the same records, whatever their own times say. */
export function sameRecords(a, b) {
  return recordsText(migrate(a, [], "")) === recordsText(migrate(b, [], ""));
}

/** The newer of two records. A tie keeps the remote one, so every device settles on the same answer. */
function newer(mine, theirs) {
  if (!mine) return theirs;
  if (!theirs) return mine;
  return mine.updatedAt > theirs.updatedAt ? mine : theirs;
}

/**
 * One document out of two, record by record.
 * @param mine the copy this device holds
 * @param theirs the copy the repository holds
 */
export function mergeDocuments(mine, theirs, now) {
  const left = migrate(mine, [], now);
  const right = migrate(theirs, [], now);
  const merged = { schemaVersion: SCHEMA_VERSION, updatedAt: now };
  for (const name of new Set([...recordMapsOf(left), ...recordMapsOf(right)])) {
    const a = left[name] ?? {};
    const b = right[name] ?? {};
    const map = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      map[key] = newer(a[key], b[key]);
    }
    merged[name] = map;
  }
  return merged;
}

/**
 * What to do with the file, given what this device holds and what the last read
 * of the repository returned.
 *
 * `sha` is GitHub's optimistic-concurrency check: it names the version being
 * replaced, and GitHub answers 409 when that is no longer the current one. It
 * must be the sha from the read this plan merged against, never a remembered
 * one, or the save quietly overwrites whatever arrived in between.
 *
 * @returns {{action: "create"|"update"|"skip", document: object, sha: string|null}}
 */
export function planSave({ local, remote, remoteSha = null, now }) {
  const document = mergeDocuments(local, remote, now);
  if (!remote) return { action: "create", document, sha: null };
  if (sameRecords(document, remote)) return { action: "skip", document, sha: remoteSha };
  return { action: "update", document, sha: remoteSha };
}

/** The text that would be uploaded for a plan. */
export function planText(plan) {
  return serializeDocument(plan.document);
}
