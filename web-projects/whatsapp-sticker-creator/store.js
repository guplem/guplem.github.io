// Keeping a pack on the device between visits.
//
// This is the one file that talks to the browser's storage, and it is split in
// two because the two things saved here are nothing alike.
//
//   The pack goes in IndexedDB. It is megabytes of encoded pictures: thirty
//     stickers at up to 100KB each, or animated ones at up to 500KB. That does
//     not fit in localStorage, which holds about 5MB of text and would need
//     every picture turned into base64 first, making each a third larger
//     again. IndexedDB stores a byte array as it is.
//
//   The chosen language goes in localStorage. It is a two letter string, it is
//     wanted before the first paint, and localStorage is read without waiting.
//     Root ADR 0007 covers exactly this case.
//
// Both are on the device only. Nothing here sends anything anywhere, which is
// the same promise root ADR 0007 makes and the reason it chose browser storage
// over a server in the first place.
//
// Every call can fail and none of them throw. A browser in private mode
// refuses storage on the first write, a phone can be out of room, and a person
// can have blocked site data. None of that is the reader's fault, so a refused
// write is reported and forgotten, and a refused read looks like an empty
// store. `app.js` tells the person their work is not being saved, and the
// editor keeps working.

import { PACK_KEY, STORE_NAME } from "./save.js";

/** Bumped only when the object stores change, not when the save shape does. */
const DATABASE_VERSION = 1;

const LANGUAGE_KEY = "whatsapp-sticker-creator:language";

/**
 * Open the pack database.
 *
 * @returns {Promise<IDBDatabase | null>} Null when this browser will not give
 *   us storage, which is a normal thing for it to do.
 */
export function openStore() {
  return new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(STORE_NAME, DATABASE_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Another tab holding an older version open blocks the upgrade for ever.
    // Give up rather than leave the editor waiting on a promise.
    request.onblocked = () => resolve(null);
  });
}

/**
 * Read the stored pack document.
 *
 * @param {IDBDatabase | null} database
 * @returns {Promise<unknown>} Whatever was stored, or null. `save.js` decides
 *   whether it can be used.
 */
export function readPack(database) {
  return new Promise((resolve) => {
    if (!database) {
      resolve(null);
      return;
    }
    try {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(PACK_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Write the pack document.
 *
 * @param {IDBDatabase | null} database
 * @param {object} document From `serialisePack`.
 * @returns {Promise<boolean>} False when the write was refused, so the page
 *   can say the work is not being kept.
 */
export function writePack(database, document) {
  return new Promise((resolve) => {
    if (!database) {
      resolve(false);
      return;
    }
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(document, PACK_KEY);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Forget the stored pack.
 *
 * @param {IDBDatabase | null} database
 * @returns {Promise<boolean>}
 */
export function clearPack(database) {
  return new Promise((resolve) => {
    if (!database) {
      resolve(false);
      return;
    }
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(PACK_KEY);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * The language chosen on a previous visit.
 *
 * @returns {string | null}
 */
export function readLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Remember the chosen language. A refused write is simply forgotten.
 *
 * @param {string} lang
 */
export function writeLanguage(lang) {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // A browser in private mode throws here, and the page works without it.
  }
}
