// WhatsApp's sticker rules, and the checks that hold a sticker to them.
//
// This is the file the whole project answers to. A sticker that leaves here
// clean installs in WhatsApp; one that does not is refused by WhatsApp with an
// error the person never sees, so every rule below is checked before export
// rather than hoped for.
//
// Every number here comes from one of two places, and the source matters:
//
//   The written requirements
//     https://github.com/WhatsApp/stickers/blob/main/Android/README.md
//   The validator WhatsApp ships in its own sample app, which is the code that
//     actually accepts or refuses a pack
//     Android/app/src/main/java/com/example/samplestickerapp/StickerPackValidator.java
//
// Where the two differ, the validator wins, because it is what runs. Three
// differences are worth naming, because a tool built from the README alone
// gets all three wrong:
//
//  1. A kilobyte is 1024 bytes in the validator (`KB_IN_BYTES = 1024`), so
//     the real still-sticker ceiling is 102400 bytes, not 100000.
//  2. At least one emoji is required (`EMOJI_MIN_LIMIT = 1`). The README only
//     gives the maximum of three.
//  3. A tray icon may be 24 to 512 pixels on a side, not only 96. 96 is the
//     recommendation, so this tool writes 96 and warns about anything else.
//
// A fourth rule appears only in the validator: in a pack marked animated,
// every sticker must really animate. A single-frame "animated" sticker fails
// the whole pack.
//
// Nothing here touches a canvas or a file. Callers measure a sticker and pass
// the measurements in, which is what lets every rule be tested.

/** Stickers must be exactly this many pixels on each side. */
export const STICKER_SIZE = 512;

/** The tray icon size WhatsApp recommends, and the range its validator allows. */
export const RECOMMENDED_TRAY_SIZE = 96;
export const MIN_TRAY_SIZE = 24;
export const MAX_TRAY_SIZE = 512;

/** A kilobyte is 1024 bytes here, matching `KB_IN_BYTES` in the validator. */
const KB = 1024;

/** "Each static sticker must be less than or equal to 100KB". */
export const MAX_STATIC_BYTES = 100 * KB;

/** "each animated sticker must be less than or equal to 500KB". */
export const MAX_ANIMATED_BYTES = 500 * KB;

/** "Max file size of 50KB" for the tray icon. */
export const MAX_TRAY_BYTES = 50 * KB;

/** "a minimum of 3 stickers and a maximum of 30 stickers". */
export const MIN_STICKERS = 3;
export const MAX_STICKERS = 30;

/** One to three emoji tag every sticker. */
export const MIN_EMOJIS = 1;
export const MAX_EMOJIS = 3;

/** "Animated stickers must have frames with minimum duration of 8ms". */
export const MIN_FRAME_DURATION_MS = 8;

/** "Animation duration should be less than or equal to 10 seconds total". */
export const MAX_ANIMATION_MS = 10000;

/** Name, publisher and identifier each stop at 128 characters. */
export const MAX_TEXT_LENGTH = 128;

/** Accessibility text: 125 characters on a still sticker, 255 on an animated one. */
export const MAX_ACCESSIBILITY_STATIC = 125;
export const MAX_ACCESSIBILITY_ANIMATED = 255;

/**
 * The characters an identifier may hold: letters, digits, underscore, hyphen,
 * dot, comma, apostrophe and a space.
 *
 * This follows the validator's own pattern, `[\w-.,'\s]+`, with one deliberate
 * narrowing. Java's `\s` also matches a tab and a newline, so the validator
 * would accept an identifier with a tab inside it. Nobody means to type that,
 * and it is not in the written guide's list either ("a-z, A-Z, 0-9, and the
 * following characters are also allowed \"_\", \"-\", \".\" and \" \""), so a
 * plain space is the only whitespace allowed here.
 *
 * The comma and the apostrophe go the other way: the guide omits them but the
 * validator accepts them, so refusing them would be a false alarm.
 */
export const IDENTIFIER_PATTERN = /^[\w\-.,' ]+$/;

/**
 * @typedef {object} Finding
 * @property {string} rule Which rule was broken, for example "sticker.tooBig".
 * @property {"error"|"warning"} severity An error blocks export. A warning
 *   only advises: WhatsApp would still accept the sticker.
 * @property {object} params The numbers the message needs, so `i18n.js` can
 *   write the sentence in any language.
 * @property {number} [stickerIndex] Which sticker, when it came from one.
 */

/**
 * @typedef {object} StickerFacts
 * @property {number} byteLength Size of the encoded file.
 * @property {number} width
 * @property {number} height
 * @property {number[]} frameDurationsMs One entry per frame, empty for a still
 *   sticker. One entry means an animation with a single frame, which is not
 *   the same thing and is not allowed.
 * @property {string[]} emojis The emoji that tag this sticker.
 * @property {string} accessibilityText Optional description for a screen reader.
 * @property {boolean} hasTransparency
 * @property {boolean} touchesEdge True when the drawing reaches the border.
 */

/**
 * The size ceiling for one sticker.
 *
 * @param {boolean} animated
 * @returns {number} Bytes.
 */
export function maxBytesFor(animated) {
  return animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES;
}

/**
 * Does this sticker animate? One frame is a still picture wearing an
 * animation's clothes, and WhatsApp refuses it in an animated pack.
 *
 * @param {StickerFacts} sticker
 * @returns {boolean}
 */
export function isAnimated(sticker) {
  return (sticker.frameDurationsMs?.length ?? 0) > 1;
}

/**
 * Check one sticker against every rule that applies to a sticker.
 *
 * @param {StickerFacts} sticker
 * @returns {Finding[]} Every rule it breaks, not just the first.
 */
export function checkSticker(sticker) {
  const findings = [];
  const frames = sticker.frameDurationsMs ?? [];
  const animated = isAnimated(sticker);
  const error = (rule, params = {}) => findings.push({ rule, severity: "error", params });
  const warn = (rule, params = {}) => findings.push({ rule, severity: "warning", params });

  if (sticker.width !== STICKER_SIZE || sticker.height !== STICKER_SIZE) {
    error("sticker.dimensions", {
      width: sticker.width,
      height: sticker.height,
      expected: STICKER_SIZE,
    });
  }

  const maxBytes = maxBytesFor(animated);
  if (sticker.byteLength > maxBytes) {
    error("sticker.tooBig", { byteLength: sticker.byteLength, maxBytes, animated });
  }

  // A single frame is neither a still sticker nor a legal animation.
  if (frames.length === 1) {
    error("sticker.oneFrame", {});
  }

  if (frames.some((duration) => duration < MIN_FRAME_DURATION_MS)) {
    error("sticker.frameTooShort", { min: MIN_FRAME_DURATION_MS });
  }

  const totalMs = frames.reduce((total, duration) => total + duration, 0);
  if (totalMs > MAX_ANIMATION_MS) {
    error("sticker.tooLong", { totalMs, max: MAX_ANIMATION_MS });
  }

  const emojis = sticker.emojis ?? [];
  if (emojis.length < MIN_EMOJIS) error("sticker.noEmoji", { min: MIN_EMOJIS });
  if (emojis.length > MAX_EMOJIS) error("sticker.tooManyEmojis", { max: MAX_EMOJIS });

  const maxText = animated ? MAX_ACCESSIBILITY_ANIMATED : MAX_ACCESSIBILITY_STATIC;
  if ((sticker.accessibilityText ?? "").length > maxText) {
    error("sticker.accessibilityTooLong", {
      length: sticker.accessibilityText.length,
      max: maxText,
    });
  }

  // The two warnings below come from the design guidance, not the validator.
  // WhatsApp installs the sticker either way, so blocking would be wrong.
  if (sticker.hasTransparency === false) warn("sticker.opaque", {});
  if (sticker.touchesEdge === true) warn("sticker.touchesEdge", {});

  return findings;
}

/**
 * @typedef {object} TrayFacts
 * @property {number} byteLength
 * @property {number} width
 * @property {number} height
 * @property {boolean} isPng
 */

/**
 * @typedef {object} PackFacts
 * @property {string} name
 * @property {string} publisher
 * @property {string} identifier
 * @property {string} [publisherEmail]
 * @property {string} [publisherWebsite]
 * @property {TrayFacts | null} tray
 * @property {StickerFacts[]} stickers
 */

/**
 * Check a whole pack: its own rules, plus every sticker in it.
 *
 * @param {PackFacts} pack
 * @returns {Finding[]} Pack findings first, then each sticker's, tagged with
 *   the sticker it came from.
 */
export function checkPack(pack) {
  const findings = [];
  const error = (rule, params = {}) => findings.push({ rule, severity: "error", params });
  const warn = (rule, params = {}) => findings.push({ rule, severity: "warning", params });
  const stickers = pack.stickers ?? [];

  if (stickers.length < MIN_STICKERS) {
    error("pack.tooFewStickers", { count: stickers.length, min: MIN_STICKERS });
  }
  if (stickers.length > MAX_STICKERS) {
    error("pack.tooManyStickers", { count: stickers.length, max: MAX_STICKERS });
  }

  // "either static or animated stickers, never a mix of both".
  const animatedCount = stickers.filter((sticker) => isAnimated(sticker)).length;
  if (animatedCount > 0 && animatedCount < stickers.length) {
    error("pack.mixed", { animated: animatedCount, total: stickers.length });
  }

  checkText(pack.name, "name", findings);
  checkText(pack.publisher, "publisher", findings);
  checkText(pack.identifier, "identifier", findings);

  const identifier = (pack.identifier ?? "").trim();
  if (identifier && (!IDENTIFIER_PATTERN.test(identifier) || identifier.includes(".."))) {
    error("pack.identifierChars", { identifier });
  }

  if (!pack.tray) {
    error("pack.trayMissing", {});
  } else {
    if (!pack.tray.isPng) error("pack.trayNotPng", {});
    if (pack.tray.byteLength > MAX_TRAY_BYTES) {
      error("pack.trayTooBig", { byteLength: pack.tray.byteLength, maxBytes: MAX_TRAY_BYTES });
    }
    const inRange = (side) => side >= MIN_TRAY_SIZE && side <= MAX_TRAY_SIZE;
    if (!inRange(pack.tray.width) || !inRange(pack.tray.height)) {
      error("pack.trayDimensions", {
        width: pack.tray.width,
        height: pack.tray.height,
        min: MIN_TRAY_SIZE,
        max: MAX_TRAY_SIZE,
      });
    } else if (
      pack.tray.width !== RECOMMENDED_TRAY_SIZE ||
      pack.tray.height !== RECOMMENDED_TRAY_SIZE
    ) {
      warn("pack.trayNotRecommended", {
        width: pack.tray.width,
        height: pack.tray.height,
        recommended: RECOMMENDED_TRAY_SIZE,
      });
    }
  }

  const email = (pack.publisherEmail ?? "").trim();
  // Deliberately loose: something, an @, something, a dot, something. A
  // stricter rule would reject real addresses, and WhatsApp only needs the
  // field to look like an address.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error("pack.emailInvalid", { email });
  }

  const website = (pack.publisherWebsite ?? "").trim();
  if (website && !/^https?:\/\/.+/i.test(website)) {
    error("pack.websiteInvalid", { website });
  }

  stickers.forEach((sticker, stickerIndex) => {
    for (const finding of checkSticker(sticker)) {
      findings.push({ ...finding, stickerIndex });
    }
  });

  return findings;
}

/** The three text fields share the same two rules, so they share the check. */
function checkText(value, field, findings) {
  const text = (value ?? "").trim();
  const name = field[0].toUpperCase() + field.slice(1);
  if (!text) {
    findings.push({ rule: `pack.${field}Missing`, severity: "error", params: {} });
  } else if (text.length > MAX_TEXT_LENGTH) {
    findings.push({
      rule: `pack.${field}TooLong`,
      severity: "error",
      params: { length: text.length, max: MAX_TEXT_LENGTH, field: name },
    });
  }
}

/**
 * Would these findings stop an export?
 *
 * @param {{ severity: string }[]} findings
 * @returns {boolean}
 */
export function isBlocking(findings) {
  return findings.some((finding) => finding.severity === "error");
}

/**
 * Turn a pack name into an identifier WhatsApp accepts. The identifier has a
 * narrower character set than the name, so a Spanish or emoji pack name cannot
 * be used as one directly.
 *
 * @param {string} name
 * @returns {string} A legal identifier, never empty.
 */
export function sanitizeIdentifier(name) {
  const stripped = String(name ?? "")
    .normalize("NFD")
    // Drop the accent marks that normalising just separated, so "Año"
    // becomes "Ano" rather than losing the letter altogether.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Anything outside the safe set becomes a hyphen. This is narrower than
    // IDENTIFIER_PATTERN on purpose: a comma and an apostrophe are legal but
    // read badly in a generated name.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // An empty identifier is refused, and so is one that is only punctuation,
  // so a name written in a script this rule strips still needs a result.
  const identifier = stripped || "sticker-pack";
  return identifier.slice(0, MAX_TEXT_LENGTH);
}

/**
 * Split typed text into single emoji.
 *
 * Counting code points is wrong here. A family emoji is several people joined
 * together, a flag is two letters, and a skin tone is a modifier: each is one
 * emoji made of many code points, and counting the pieces would refuse a legal
 * tag. `Intl.Segmenter` groups them the way a reader sees them.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitEmojis(text) {
  const input = String(text ?? "");
  if (!input.trim()) return [];
  const pieces =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(input)].map(
          (piece) => piece.segment,
        )
      : // Older browsers split by code point, which miscounts a joined emoji.
        // That is worse than the line above and better than nothing.
        [...input];
  return pieces.map((piece) => piece.trim()).filter(Boolean);
}

/**
 * How many emoji the text holds.
 *
 * @param {string} text
 * @returns {number}
 */
export function countEmojis(text) {
  return splitEmojis(text).length;
}
