// Carrying every token to another browser.
//
// GitHub shows a token once, at the moment you create it, and never again. So
// this browser holds the only copy. A browser profile somebody signed into by
// mistake, a wiped machine or a new laptop therefore costs a whole set-up, and
// the fix is a text the reader can keep: paste it into the next browser and the
// board is back.
//
// A backup carries only what the reader gave: the token, and the name they
// typed. Everything else in a saved entry is something the board discovered
// (which owners it reached, how much work it found, whether it can write the
// notes file), and a discovered fact goes stale the moment it is written down.
// The board learns all of it again on the first connection.
//
// ADR 0015 holds the reasoning, including why this is no less safe than what
// the browser already stores.

/** The shape of the text. A later shape gets a higher number. */
export const BACKUP_FORMAT = 1;

/** The name in the text, so a blob from another tool is refused rather than half-read. */
export const BACKUP_TOOL = "github-work-board";

/** One `{token, name}` pair, or null when what was handed in is not one. */
function readPair(value) {
  if (!value || typeof value !== "object") return null;
  const token = typeof value.token === "string" ? value.token.trim() : "";
  if (token === "") return null;
  return { token, name: typeof value.name === "string" ? value.name.trim() : "" };
}

/** The text that carries the tokens to another browser. */
export function encodeTokenBackup(entries) {
  const tokens = (Array.isArray(entries) ? entries : []).map(readPair).filter(Boolean);
  return JSON.stringify({ tool: BACKUP_TOOL, backup: BACKUP_FORMAT, tokens }, null, 2);
}

/**
 * Text somebody pasted, read back.
 *
 * @returns `{ok: true, tokens}` or `{ok: false, message}`. A backup holding no
 *   token is refused: half a blob copied out of a chat window must not read as
 *   a success that restores nothing.
 */
export function readTokenBackup(text) {
  let stored = null;
  try {
    stored = JSON.parse(typeof text === "string" ? text : "");
  } catch {
    return { ok: false, message: "That is not a backup. Copy the whole text, from the first { to the last }." };
  }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return { ok: false, message: "That is not a backup." };
  }
  if (stored.tool !== BACKUP_TOOL) {
    return { ok: false, message: "That backup was written by another tool." };
  }
  // A higher format number is accepted. The token and the name are the whole
  // point of the file, so they cannot change shape; anything added later is
  // something this version can safely ignore.
  const tokens = (Array.isArray(stored.tokens) ? stored.tokens : []).map(readPair).filter(Boolean);
  if (tokens.length === 0) {
    return { ok: false, message: "That backup holds no token. It may have been cut short when it was copied." };
  }
  return { ok: true, tokens };
}

/**
 * Whether text was meant to be a backup.
 *
 * One box in Settings takes either a token or a backup. Without this, a backup
 * that was cut short goes to GitHub as a token, and the reader is shown
 * GitHub's own error about a bad credential instead of the truth.
 */
export function looksLikeBackup(text) {
  return typeof text === "string" && text.trim().startsWith("{");
}
