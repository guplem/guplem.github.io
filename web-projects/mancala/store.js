// What the browser remembers between visits: the setup you last played and
// your record against each opponent. It is private to your device, it is not
// worth putting in a link, and it should survive a reload, which is exactly
// what root ADR 0007 says localStorage is for.
//
// Every function here takes the storage as an argument and wraps it in
// try/catch, so a browser with storage switched off, a full disk or a private
// window all behave the same: the game still works, it just forgets.

/** One versioned key per purpose, namespaced to this project. */
export const SETUP_KEY = "mancala:setup:v1";
export const RECORD_KEY = "mancala:record:v1";
export const SPEED_KEY = "mancala:speed:v1";

/**
 * Read and parse a key, or give back the fallback.
 * @param {Storage} storage a localStorage-shaped object, or null
 * @param {string} key the key to read
 * @param {*} fallback what to return when the key is missing or broken
 * @returns {*}
 */
function read(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

/**
 * Write a value under a key, and shrug if the browser will not have it.
 * @param {Storage} storage a localStorage-shaped object, or null
 * @param {string} key the key to write
 * @param {*} value anything JSON can hold
 * @returns {boolean} whether it was stored
 */
function write(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * The setup the player used last time, if it is still a setup this build
 * understands.
 * @param {Storage} storage a localStorage-shaped object, or null
 * @param {(setup: Object) => boolean} isValid a check from the caller
 * @returns {Object|null}
 */
export function loadSetup(storage, isValid) {
  const setup = read(storage, SETUP_KEY, null);
  if (!setup || typeof setup !== "object") return null;
  return isValid(setup) ? setup : null;
}

/**
 * Remember a setup for next time.
 * @param {Storage} storage a localStorage-shaped object, or null
 * @param {Object} setup the setup to keep
 * @returns {boolean} whether it was stored
 */
export function saveSetup(storage, setup) {
  return write(storage, SETUP_KEY, setup);
}

/**
 * The player's record: wins, draws and losses against each opponent, per rule
 * set. Keys look like "kalah:deep".
 * @param {Storage} storage a localStorage-shaped object, or null
 * @returns {Object} the record, empty when there is nothing stored
 */
export function loadRecord(storage) {
  const record = read(storage, RECORD_KEY, {});
  return record && typeof record === "object" ? record : {};
}

/**
 * Add one finished game to the record. Pure: it returns the new record and
 * leaves the one it was given alone.
 * @param {Object} record the record as it is now
 * @param {string} mode the rule set played
 * @param {string} opponent the opponent id played against
 * @param {"win"|"draw"|"loss"} outcome how it went for the person
 * @returns {Object} the record with that game added
 */
export function addResult(record, mode, opponent, outcome) {
  const key = `${mode}:${opponent}`;
  const row = record[key] ?? { win: 0, draw: 0, loss: 0 };
  return { ...record, [key]: { ...row, [outcome]: (row[outcome] ?? 0) + 1 } };
}

/**
 * The record against one opponent in one rule set.
 * @param {Object} record the record
 * @param {string} mode the rule set
 * @param {string} opponent the opponent id
 * @returns {{win: number, draw: number, loss: number}}
 */
export function recordFor(record, mode, opponent) {
  return record[`${mode}:${opponent}`] ?? { win: 0, draw: 0, loss: 0 };
}

/**
 * Store the record.
 * @param {Storage} storage a localStorage-shaped object, or null
 * @param {Object} record the record to keep
 * @returns {boolean} whether it was stored
 */
export function saveRecord(storage, record) {
  return write(storage, RECORD_KEY, record);
}

/**
 * The animation speed the player chose: 1 normal, 2 fast.
 * @param {Storage} storage a localStorage-shaped object, or null
 * @returns {number}
 */
export function loadSpeed(storage) {
  const speed = read(storage, SPEED_KEY, 1);
  return speed === 2 ? 2 : 1;
}

/**
 * Remember the animation speed.
 * @param {Storage} storage a localStorage-shaped object, or null
 * @param {number} speed 1 or 2
 * @returns {boolean} whether it was stored
 */
export function saveSpeed(storage, speed) {
  return write(storage, SPEED_KEY, speed === 2 ? 2 : 1);
}
