// A sticker pack, and the two archives it can leave the page as.
//
// A website cannot install a pack into WhatsApp on its own. WhatsApp reads
// packs from an installed app that answers as a content provider, and a web
// page is not one. So the honest thing to offer is the files, in the two
// layouts something else can install:
//
//   .wastickers   A flat archive the phone apps that import packs read. This
//                 is the route a person on a phone actually uses: save the
//                 file, share it to one of those apps, add the pack. It holds
//                 title.txt, author.txt, a 96 by 96 cover.png, and the
//                 stickers. There is no manifest, so the file names decide
//                 the order.
//
//   contents.json A folder for a developer building their own pack app with
//   plus files    WhatsApp's sample code. The manifest names each sticker and
//                 its emoji, and the order in the manifest is the order in
//                 WhatsApp.
//
// Both are ZIP archives, written by `zip.js`. Neither is compressed, because
// WebP and PNG already are.
//
// Every function here takes a pack and returns a new one. Nothing is changed
// in place, so the editor can keep an earlier pack for undo.

import { isAnimated, sanitizeIdentifier } from "./spec.js";
import { MAX_STICKERS } from "./spec.js";

/** The cover image inside a .wastickers archive. */
export const COVER_NAME = "cover.png";

/** The tray image inside a contents.json folder. */
export const TRAY_NAME = "tray.png";

/** WhatsApp's own manifest file name. */
export const CONTENTS_NAME = "contents.json";

/**
 * A new, empty pack.
 *
 * @param {object} options
 * @param {string} options.name Shown in WhatsApp.
 * @param {string} options.publisher Shown under the name.
 * @param {string} [options.identifier] Derived from the name when missing,
 *   because the identifier allows fewer characters than the name does.
 * @returns {object}
 */
export function createPack({ name, publisher, identifier }) {
  return {
    name,
    publisher,
    identifier: identifier ?? sanitizeIdentifier(name),
    publisherEmail: "",
    publisherWebsite: "",
    privacyPolicyWebsite: "",
    licenseAgreementWebsite: "",
    // WhatsApp caches a pack and re-reads it only when this string changes.
    imageDataVersion: "1",
    tray: null,
    stickers: [],
  };
}

/**
 * Add a finished sticker.
 *
 * @param {object} pack
 * @param {object} sticker
 * @returns {object} A new pack.
 * @throws When the pack already holds thirty stickers.
 */
export function addSticker(pack, sticker) {
  if (pack.stickers.length >= MAX_STICKERS) {
    throw new Error(`A pack holds at most ${MAX_STICKERS} stickers.`);
  }
  return bumpVersion({ ...pack, stickers: [...pack.stickers, sticker] });
}

/**
 * Remove a sticker by its id.
 *
 * @param {object} pack
 * @param {string} id
 * @returns {object} A new pack.
 */
export function removeSticker(pack, id) {
  const stickers = pack.stickers.filter((sticker) => sticker.id !== id);
  if (stickers.length === pack.stickers.length) return { ...pack };
  return bumpVersion({ ...pack, stickers });
}

/**
 * Change one sticker's own fields, for example its emoji.
 *
 * @param {object} pack
 * @param {string} id
 * @param {object} changes
 * @returns {object} A new pack.
 */
export function updateSticker(pack, id, changes) {
  return bumpVersion({
    ...pack,
    stickers: pack.stickers.map((sticker) =>
      sticker.id === id ? { ...sticker, ...changes } : sticker,
    ),
  });
}

/**
 * Reorder the stickers. The order matters twice over: it is the order they
 * appear in WhatsApp, and the first sticker is the one people see first.
 *
 * @param {object} pack
 * @param {number} from
 * @param {number} to
 * @returns {object} A new pack.
 */
export function moveSticker(pack, from, to) {
  if (from < 0 || from >= pack.stickers.length) return { ...pack };
  const stickers = [...pack.stickers];
  const [moved] = stickers.splice(from, 1);
  stickers.splice(Math.min(Math.max(to, 0), stickers.length), 0, moved);
  return bumpVersion({ ...pack, stickers });
}

/**
 * Describe a pack in the shape `spec.checkPack` reads.
 *
 * Sizes are measured from the encoded bytes rather than from anything the
 * editor believes about them, because the rule is about the file.
 *
 * @param {object} pack
 * @returns {import("./spec.js").PackFacts}
 */
export function packFacts(pack) {
  return {
    name: pack.name,
    publisher: pack.publisher,
    identifier: pack.identifier,
    publisherEmail: pack.publisherEmail,
    publisherWebsite: pack.publisherWebsite,
    tray: pack.tray
      ? {
          byteLength: pack.tray.png.length,
          width: pack.tray.width,
          height: pack.tray.height,
          // The tray icon is the one file in a pack that is not WebP.
          isPng: true,
        }
      : null,
    stickers: pack.stickers.map((sticker) => ({
      byteLength: sticker.webp.length,
      width: sticker.width,
      height: sticker.height,
      frameDurationsMs: sticker.frameDurationsMs ?? [],
      emojis: sticker.emojis ?? [],
      accessibilityText: sticker.accessibilityText ?? "",
      hasTransparency: sticker.hasTransparency,
      touchesEdge: sticker.touchesEdge,
    })),
  };
}

/**
 * The file name for the sticker at a position.
 *
 * Numbered from one and padded to two digits. A .wastickers archive has no
 * manifest, so a phone app reads the folder and takes the order it finds:
 * "1.webp" and "10.webp" would sort as 1, 10, 2 and shuffle the pack.
 *
 * @param {number} index
 * @returns {string}
 */
export function stickerFileName(index) {
  return `${String(index + 1).padStart(2, "0")}.webp`;
}

/**
 * The files inside a `.wastickers` archive.
 *
 * @param {object} pack
 * @returns {{ name: string, bytes: Uint8Array }[]} Ready for `buildZip`.
 * @throws When the pack holds no stickers.
 */
export function wastickersFiles(pack) {
  if (pack.stickers.length === 0) throw new Error("This pack has no stickers to export.");
  const encoder = new TextEncoder();
  const files = [
    { name: "title.txt", bytes: encoder.encode(pack.name) },
    { name: "author.txt", bytes: encoder.encode(pack.publisher) },
  ];
  // The reference importer builds a cover from the first sticker when none is
  // there, so an archive without one still imports.
  if (pack.tray) files.push({ name: COVER_NAME, bytes: pack.tray.png });
  pack.stickers.forEach((sticker, index) => {
    files.push({ name: stickerFileName(index), bytes: sticker.webp });
  });
  return files;
}

/**
 * WhatsApp's own manifest for this pack.
 *
 * @param {object} pack
 * @returns {object} Ready for `JSON.stringify`.
 */
export function contentsJson(pack) {
  const animated = pack.stickers.length > 0 && pack.stickers.every((sticker) => isAnimated(sticker));

  return {
    // Empty unless the person publishes an app. WhatsApp's own sample file
    // carries both keys as empty strings, so they are written rather than
    // left out.
    android_play_store_link: "",
    ios_app_store_link: "",
    sticker_packs: [
      {
        identifier: pack.identifier,
        name: pack.name,
        publisher: pack.publisher,
        tray_image_file: TRAY_NAME,
        image_data_version: pack.imageDataVersion,
        // False means WhatsApp may cache the pack, which is what you want
        // once it is finished.
        avoid_cache: false,
        publisher_email: pack.publisherEmail ?? "",
        publisher_website: pack.publisherWebsite ?? "",
        privacy_policy_website: pack.privacyPolicyWebsite ?? "",
        license_agreement_website: pack.licenseAgreementWebsite ?? "",
        // Required for an animated pack. WhatsApp refuses the whole pack
        // without it, even when every sticker really does animate.
        animated_sticker_pack: animated,
        stickers: pack.stickers.map((sticker, index) => ({
          image_file: stickerFileName(index),
          emojis: sticker.emojis ?? [],
          // An empty string is not a description, and the field is optional,
          // so writing "" would claim a description that is not there.
          ...(sticker.accessibilityText
            ? { accessibility_text: sticker.accessibilityText }
            : {}),
        })),
      },
    ],
  };
}

/**
 * The files inside the developer archive: the manifest, the tray icon and the
 * stickers.
 *
 * @param {object} pack
 * @returns {{ name: string, bytes: Uint8Array }[]} Ready for `buildZip`.
 * @throws When the pack has no stickers, or no tray icon for the manifest to
 *   name.
 */
export function contentsZipFiles(pack) {
  if (pack.stickers.length === 0) throw new Error("This pack has no stickers to export.");
  if (!pack.tray) {
    throw new Error("This pack has no tray icon, and the manifest has to name one.");
  }
  const files = [
    {
      name: CONTENTS_NAME,
      // Indented, because a developer opens this file by hand.
      bytes: new TextEncoder().encode(`${JSON.stringify(contentsJson(pack), null, 2)}\n`),
    },
    { name: TRAY_NAME, bytes: pack.tray.png },
  ];
  pack.stickers.forEach((sticker, index) => {
    files.push({ name: stickerFileName(index), bytes: sticker.webp });
  });
  return files;
}

/**
 * Move the image data version on.
 *
 * WhatsApp caches a pack it has already added and re-reads it only when this
 * string changes. An edit that left it alone would never reach the phone.
 */
function bumpVersion(pack) {
  const current = Number(pack.imageDataVersion);
  return {
    ...pack,
    imageDataVersion: String(Number.isFinite(current) ? current + 1 : 1),
  };
}
