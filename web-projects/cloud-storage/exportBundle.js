// Every document of every project in one file the reader can keep.
//
// The cloud settings page offers "Export": one JSON file holding every
// document under the data folder, from the cloud when it is configured and
// from the local mirrors when it is not. "Import" reads the same file back and
// hands each document to the normal merge, so an import never overwrites
// blindly. The bundle carries documents only. The token is never in it: a
// backup of the token is a different thing with a different warning
// (github-work-board ADR 0015).

import { DATA_FOLDER } from "./cloudSettings.js";
import { isPlainObject, migrate } from "./envelope.js";

/** The shape of the file. A later shape gets a higher number. */
export const BUNDLE_FORMAT = 1;

/** The name in the file, so a file from another tool is refused rather than half-read. */
export const BUNDLE_TOOL = "triunity-studios-data";

/** The text of the export file. */
export function encodeBundle({ exportedAt, projects }) {
  const clean = {};
  for (const [project, files] of Object.entries(isPlainObject(projects) ? projects : {})) {
    if (!isPlainObject(files)) continue;
    clean[project] = {};
    for (const [file, document] of Object.entries(files)) {
      if (isPlainObject(document)) clean[project][file] = document;
    }
  }
  return `${JSON.stringify({ tool: BUNDLE_TOOL, format: BUNDLE_FORMAT, exportedAt: String(exportedAt), projects: clean }, null, 2)}\n`;
}

/**
 * An export file, read back.
 *
 * @returns `{ok: true, exportedAt, projects}` where every document has been
 *   through `migrate`, or `{ok: false, message}`.
 */
export function readBundle(text) {
  let stored = null;
  try {
    stored = JSON.parse(typeof text === "string" ? text : "");
  } catch {
    return { ok: false, message: "That is not an export file. Choose the file the Export button saved." };
  }
  if (!isPlainObject(stored)) return { ok: false, message: "That is not an export file." };
  if (stored.tool !== BUNDLE_TOOL) return { ok: false, message: "That file was written by another tool." };
  const exportedAt = typeof stored.exportedAt === "string" ? stored.exportedAt : "";
  const projects = {};
  for (const [project, files] of Object.entries(isPlainObject(stored.projects) ? stored.projects : {})) {
    if (!isPlainObject(files)) continue;
    const kept = {};
    for (const [file, document] of Object.entries(files)) {
      if (isPlainObject(document)) kept[file] = migrate(document, [], exportedAt);
    }
    if (Object.keys(kept).length > 0) projects[project] = kept;
  }
  return { ok: true, exportedAt, projects };
}

/** The file name the Export button saves under. */
export function bundleFileName(date) {
  return `${DATA_FOLDER}-${date.toISOString().slice(0, 10)}.json`;
}
