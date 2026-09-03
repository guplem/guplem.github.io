// The shape a pack takes when it is put away, and the rules for reading one
// back.
//
// A pack is worth keeping. Someone builds thirty stickers over an evening, and
// a reload that lost them would be the worst thing this tool could do. So the
// pack is written to the browser's own storage on every change and read back
// on the next visit. `store.js` does the writing; this file decides what is
// written and how an older document is brought up to date.
//
// One rule governs every change to this file, borrowed from akwaaba-monsters
// ADR 0002 for the same reason:
//
//   **Only ever add fields, and give every new field a default in `migrate`.**
//
// Never rename a field and never reuse a name for something else. A pack saved
// last month has to keep opening, and the only way to promise that is for old
// documents to stay readable rather than for old code to stay around.
//
// The bytes stay bytes. The browser's storage carries a byte array directly,
// so turning a sticker into base64 text would make every saved pack a third
// larger and buy nothing.

import { sanitizeIdentifier } from "./spec.js";
import { CANVAS_SIZE } from "./geometry.js";

/** Moved only when the shape changes in a way `migrate` has to know about. */
export const SAVE_VERSION = 1;

/** Where the pack lives. The name carries the version, so a future shape can sit beside this one. */
export const STORE_NAME = "whatsapp-sticker-creator";
export const PACK_KEY = "pack:v1";

/**
 * Turn a pack into the document that gets stored.
 *
 * @param {object} pack
 * @returns {object} Plain data, safe for the browser's own storage.
 */
export function serialisePack(pack) {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    name: pack.name ?? "",
    publisher: pack.publisher ?? "",
    identifier: pack.identifier ?? "",
    imageDataVersion: pack.imageDataVersion ?? "1",
    publisherEmail: pack.publisherEmail ?? "",
    publisherWebsite: pack.publisherWebsite ?? "",
    privacyPolicyWebsite: pack.privacyPolicyWebsite ?? "",
    licenseAgreementWebsite: pack.licenseAgreementWebsite ?? "",
    tray: pack.tray
      ? { png: pack.tray.png, width: pack.tray.width, height: pack.tray.height }
      : null,
    stickers: (pack.stickers ?? []).map((sticker) => ({
      id: sticker.id,
      webp: sticker.webp,
      width: sticker.width,
      height: sticker.height,
      frameDurationsMs: [...(sticker.frameDurationsMs ?? [])],
      emojis: [...(sticker.emojis ?? [])],
      accessibilityText: sticker.accessibilityText ?? "",
      hasTransparency: sticker.hasTransparency !== false,
      touchesEdge: sticker.touchesEdge === true,
    })),
  };
}

/**
 * Bring a stored document up to the current shape.
 *
 * Every field the editor reads gets a default here, so a document written by
 * an older version opens rather than crashing on a field that did not exist
 * when it was saved.
 *
 * @param {object} raw
 * @returns {object} A document at the current version.
 */
export function migrate(raw) {
  const state = { ...raw };
  state.version = SAVE_VERSION;
  state.name = state.name ?? "";
  state.publisher = state.publisher ?? "";
  // An older document may hold no identifier. Build one from the name rather
  // than leaving it empty, which WhatsApp refuses.
  state.identifier = state.identifier || sanitizeIdentifier(state.name);
  state.imageDataVersion = state.imageDataVersion ?? "1";
  state.publisherEmail = state.publisherEmail ?? "";
  state.publisherWebsite = state.publisherWebsite ?? "";
  state.privacyPolicyWebsite = state.privacyPolicyWebsite ?? "";
  state.licenseAgreementWebsite = state.licenseAgreementWebsite ?? "";
  state.tray = state.tray ?? null;
  state.stickers = (state.stickers ?? []).map((sticker) => ({
    ...sticker,
    width: sticker.width ?? CANVAS_SIZE,
    height: sticker.height ?? CANVAS_SIZE,
    frameDurationsMs: sticker.frameDurationsMs ?? [],
    // The rule checker counts this list, so a missing one would throw rather
    // than report the rule it breaks.
    emojis: sticker.emojis ?? [],
    accessibilityText: sticker.accessibilityText ?? "",
    hasTransparency: sticker.hasTransparency !== false,
    touchesEdge: sticker.touchesEdge === true,
  }));
  return state;
}

/**
 * Read a stored document back as a pack.
 *
 * @param {unknown} raw Whatever came out of storage.
 * @returns {object | null} Null when it cannot be used, so the caller starts
 *   fresh instead of working with half a pack.
 */
export function deserialisePack(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!Array.isArray(raw.stickers)) return null;
  // A document from a newer version would lose the fields this code does not
  // know about, and then write the loss back. Refusing keeps it intact.
  if (Number(raw.version) > SAVE_VERSION) return null;

  const state = migrate(raw);
  return {
    name: state.name,
    publisher: state.publisher,
    identifier: state.identifier,
    imageDataVersion: state.imageDataVersion,
    publisherEmail: state.publisherEmail,
    publisherWebsite: state.publisherWebsite,
    privacyPolicyWebsite: state.privacyPolicyWebsite,
    licenseAgreementWebsite: state.licenseAgreementWebsite,
    tray: state.tray?.png ? state.tray : null,
    // A sticker with no picture cannot be shown at all, and losing one is far
    // better than losing the pack, so drop it and keep going.
    stickers: state.stickers.filter((sticker) => sticker.webp && sticker.webp.length > 0),
  };
}
