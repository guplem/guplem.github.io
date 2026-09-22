// The first meeting of two copies.
//
// Every project keeps a local mirror of each document, and a project that has
// run without cloud storage has real data in it. When the reader sets cloud
// storage up, the mirror and the cloud file meet for the first time, and
// nothing in either says which one the person wants. Guessing here loses data
// silently, so the store asks, once per document per device, and remembers the
// answer (root ADR 0016).
//
// The question only comes up when both copies hold data and they differ. Every
// other case has one right answer and is taken without asking.

import { hasRecords } from "./envelope.js";
import { mergeDocuments, sameRecords } from "./merge.js";

/** The answers a person can give, in the order the dialog shows them. */
export const ANSWERS = [
  { id: "merge", label: "Merge both", detail: "Keeps every record from both copies. The newer edit of the same record wins. Loses nothing." },
  { id: "keep-local", label: "Keep this device's data", detail: "This device's copy replaces the cloud copy." },
  { id: "use-cloud", label: "Use the cloud data", detail: "The cloud copy replaces this device's copy." },
];

export const ANSWER_IDS = ANSWERS.map((one) => one.id);

/**
 * What the two copies are to each other.
 *
 * @returns "synced" once this device has answered; "none" when neither holds
 *   data; "local-only" and "cloud-only" when one side is empty; "same" when both
 *   hold the same records; "ask" when a person has to decide.
 */
export function describeCopies({ local, cloud, reconciled }) {
  if (reconciled === true) return "synced";
  const here = hasRecords(local);
  const there = hasRecords(cloud);
  if (!here && !there) return "none";
  if (here && !there) return "local-only";
  if (!here && there) return "cloud-only";
  if (sameRecords(local, cloud)) return "same";
  return "ask";
}

/**
 * The document each side ends up with, for one answer.
 *
 * An answer this build does not know merges, because merge is the one answer
 * that loses nothing.
 *
 * @returns {{document: object, writeLocal: boolean, writeCloud: boolean}}
 */
export function applyAnswer(answer, { local, cloud, now }) {
  if (answer === "keep-local") return { document: mergeDocuments(local, null, now), writeLocal: false, writeCloud: true };
  if (answer === "use-cloud") return { document: mergeDocuments(null, cloud, now), writeLocal: true, writeCloud: false };
  return { document: mergeDocuments(local, cloud, now), writeLocal: true, writeCloud: true };
}
