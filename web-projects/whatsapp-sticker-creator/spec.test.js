import { describe, expect, test } from "bun:test";
import {
  MAX_ANIMATED_BYTES,
  MAX_ANIMATION_MS,
  MAX_EMOJIS,
  MAX_STATIC_BYTES,
  MAX_STICKERS,
  MAX_TEXT_LENGTH,
  MAX_TRAY_BYTES,
  MIN_EMOJIS,
  MIN_FRAME_DURATION_MS,
  MIN_STICKERS,
  RECOMMENDED_TRAY_SIZE,
  STICKER_SIZE,
  checkPack,
  checkSticker,
  countEmojis,
  isBlocking,
  maxBytesFor,
  sanitizeIdentifier,
  splitEmojis,
} from "./spec.js";

/** A sticker that breaks no rule, so each test can break exactly one. */
const goodSticker = (overrides = {}) => ({
  byteLength: 40 * 1024,
  width: STICKER_SIZE,
  height: STICKER_SIZE,
  frameDurationsMs: [],
  emojis: ["😀"],
  accessibilityText: "",
  hasTransparency: true,
  touchesEdge: false,
  ...overrides,
});

/** An animated sticker that breaks no rule. */
const goodAnimated = (overrides = {}) =>
  goodSticker({ byteLength: 200 * 1024, frameDurationMs: undefined, frameDurationsMs: [100, 100, 100], ...overrides });

/** A pack that breaks no rule. */
const goodPack = (overrides = {}) => ({
  name: "My Stickers",
  publisher: "Guillem",
  identifier: "my-stickers",
  publisherEmail: "",
  publisherWebsite: "",
  tray: { byteLength: 8 * 1024, width: 96, height: 96, isPng: true },
  stickers: [goodSticker(), goodSticker(), goodSticker()],
  ...overrides,
});

const rulesOf = (findings) => findings.map((finding) => finding.rule);

describe("the published limits", () => {
  test("match WhatsApp's own validator, counting a kilobyte as 1024 bytes", () => {
    // Taken from StickerPackValidator.java, where KB_IN_BYTES = 1024. Getting
    // this wrong by using 1000 lets a sticker through that WhatsApp rejects.
    expect(MAX_STATIC_BYTES).toBe(102400);
    expect(MAX_ANIMATED_BYTES).toBe(512000);
    expect(MAX_TRAY_BYTES).toBe(51200);
  });

  test("match WhatsApp's own numbers everywhere else", () => {
    expect(STICKER_SIZE).toBe(512);
    expect(MIN_STICKERS).toBe(3);
    expect(MAX_STICKERS).toBe(30);
    expect(MIN_EMOJIS).toBe(1);
    expect(MAX_EMOJIS).toBe(3);
    expect(MIN_FRAME_DURATION_MS).toBe(8);
    expect(MAX_ANIMATION_MS).toBe(10000);
    expect(MAX_TEXT_LENGTH).toBe(128);
    expect(RECOMMENDED_TRAY_SIZE).toBe(96);
  });
});

describe("maxBytesFor", () => {
  test("gives a still sticker 100KB and an animated one 500KB", () => {
    expect(maxBytesFor(false)).toBe(MAX_STATIC_BYTES);
    expect(maxBytesFor(true)).toBe(MAX_ANIMATED_BYTES);
  });
});

describe("checkSticker", () => {
  test("passes a sticker that breaks no rule", () => {
    expect(checkSticker(goodSticker())).toEqual([]);
  });

  test("passes an animated sticker that breaks no rule", () => {
    expect(checkSticker(goodAnimated())).toEqual([]);
  });

  test("rejects any size but 512 by 512", () => {
    expect(rulesOf(checkSticker(goodSticker({ width: 511 })))).toContain("sticker.dimensions");
    expect(rulesOf(checkSticker(goodSticker({ height: 1024 })))).toContain("sticker.dimensions");
    // 512 is exact, not a maximum: a smaller sticker is just as invalid.
    expect(rulesOf(checkSticker(goodSticker({ width: 256, height: 256 })))).toContain(
      "sticker.dimensions",
    );
  });

  test("reports the size it found, so the message can name it", () => {
    const finding = checkSticker(goodSticker({ width: 300, height: 400 }))[0];
    expect(finding.params).toMatchObject({ width: 300, height: 400 });
  });

  test("rejects a still sticker over 100KB", () => {
    expect(rulesOf(checkSticker(goodSticker({ byteLength: MAX_STATIC_BYTES + 1 })))).toContain(
      "sticker.tooBig",
    );
    // The limit is inclusive: "less than or equal to 100KB".
    expect(rulesOf(checkSticker(goodSticker({ byteLength: MAX_STATIC_BYTES })))).not.toContain(
      "sticker.tooBig",
    );
  });

  test("rejects an animated sticker over 500KB but allows a still one that size", () => {
    const big = { byteLength: 300 * 1024 };
    expect(rulesOf(checkSticker(goodAnimated(big)))).not.toContain("sticker.tooBig");
    expect(rulesOf(checkSticker(goodSticker(big)))).toContain("sticker.tooBig");
    expect(
      rulesOf(checkSticker(goodAnimated({ byteLength: MAX_ANIMATED_BYTES + 1 }))),
    ).toContain("sticker.tooBig");
  });

  test("rejects a frame shorter than 8 ms", () => {
    expect(
      rulesOf(checkSticker(goodAnimated({ frameDurationsMs: [100, 7, 100] }))),
    ).toContain("sticker.frameTooShort");
    expect(
      rulesOf(checkSticker(goodAnimated({ frameDurationsMs: [8, 8, 8] }))),
    ).not.toContain("sticker.frameTooShort");
  });

  test("rejects an animation longer than ten seconds", () => {
    const long = { frameDurationsMs: [5000, 5000, 1] };
    expect(rulesOf(checkSticker(goodAnimated(long)))).toContain("sticker.tooLong");
    // Exactly ten seconds is allowed.
    expect(
      rulesOf(checkSticker(goodAnimated({ frameDurationsMs: [5000, 5000] }))),
    ).not.toContain("sticker.tooLong");
  });

  test("rejects an animated sticker that holds only one frame", () => {
    // WhatsApp's validator refuses a pack marked animated whose sticker has a
    // single frame. The rule is in the validator but not in the README.
    expect(
      rulesOf(checkSticker(goodSticker({ frameDurationsMs: [500] }))),
    ).toContain("sticker.oneFrame");
  });

  test("requires at least one emoji and allows at most three", () => {
    expect(rulesOf(checkSticker(goodSticker({ emojis: [] })))).toContain("sticker.noEmoji");
    expect(
      rulesOf(checkSticker(goodSticker({ emojis: ["😀", "🎉", "🔥", "💕"] }))),
    ).toContain("sticker.tooManyEmojis");
    expect(
      rulesOf(checkSticker(goodSticker({ emojis: ["😀", "🎉", "🔥"] }))),
    ).toEqual([]);
  });

  test("limits the accessibility text by 125 characters for a still sticker", () => {
    expect(
      rulesOf(checkSticker(goodSticker({ accessibilityText: "a".repeat(126) }))),
    ).toContain("sticker.accessibilityTooLong");
    expect(
      rulesOf(checkSticker(goodSticker({ accessibilityText: "a".repeat(125) }))),
    ).toEqual([]);
  });

  test("allows 255 characters of accessibility text on an animated sticker", () => {
    expect(
      rulesOf(checkSticker(goodAnimated({ accessibilityText: "a".repeat(255) }))),
    ).toEqual([]);
    expect(
      rulesOf(checkSticker(goodAnimated({ accessibilityText: "a".repeat(256) }))),
    ).toContain("sticker.accessibilityTooLong");
  });

  test("warns, but does not block, when a sticker has no transparency", () => {
    // "A sticker is an image that has a transparent background." A solid
    // square still installs, so this is advice and not a blocker.
    const findings = checkSticker(goodSticker({ hasTransparency: false }));
    expect(rulesOf(findings)).toEqual(["sticker.opaque"]);
    expect(findings[0].severity).toBe("warning");
    expect(isBlocking(findings)).toBe(false);
  });

  test("warns when the drawing runs into the edge of the canvas", () => {
    // WhatsApp recommends an 8px white stroke around a sticker, and there is
    // nowhere to put it when the drawing already touches the border.
    const findings = checkSticker(goodSticker({ touchesEdge: true }));
    expect(rulesOf(findings)).toEqual(["sticker.touchesEdge"]);
    expect(findings[0].severity).toBe("warning");
  });

  test("marks every rule that comes from a hard limit as blocking", () => {
    const findings = checkSticker(
      goodSticker({ width: 100, byteLength: MAX_STATIC_BYTES + 1, emojis: [] }),
    );
    expect(findings.every((finding) => finding.severity === "error")).toBe(true);
    expect(isBlocking(findings)).toBe(true);
  });

  test("reports every broken rule at once, not just the first", () => {
    const findings = checkSticker(
      goodSticker({ width: 10, height: 10, byteLength: 999999, emojis: [] }),
    );
    expect(rulesOf(findings).sort()).toEqual([
      "sticker.dimensions",
      "sticker.noEmoji",
      "sticker.tooBig",
    ]);
  });
});

describe("checkPack", () => {
  test("passes a pack that breaks no rule", () => {
    expect(checkPack(goodPack())).toEqual([]);
  });

  test("rejects a pack with fewer than three stickers", () => {
    const findings = checkPack(goodPack({ stickers: [goodSticker(), goodSticker()] }));
    expect(rulesOf(findings)).toContain("pack.tooFewStickers");
    expect(findings[0].params).toMatchObject({ count: 2, min: MIN_STICKERS });
  });

  test("rejects a pack with more than thirty stickers", () => {
    const many = Array.from({ length: 31 }, () => goodSticker());
    expect(rulesOf(checkPack(goodPack({ stickers: many })))).toContain("pack.tooManyStickers");
  });

  test("rejects a pack that mixes still and animated stickers", () => {
    // "Sticker packs must contain either static or animated stickers, never a
    // mix of both."
    const mixed = [goodSticker(), goodSticker(), goodAnimated()];
    expect(rulesOf(checkPack(goodPack({ stickers: mixed })))).toContain("pack.mixed");
  });

  test("accepts a pack where every sticker is animated", () => {
    const animated = [goodAnimated(), goodAnimated(), goodAnimated()];
    expect(checkPack(goodPack({ stickers: animated }))).toEqual([]);
  });

  test("requires a name, a publisher and an identifier", () => {
    expect(rulesOf(checkPack(goodPack({ name: "" })))).toContain("pack.nameMissing");
    expect(rulesOf(checkPack(goodPack({ name: "   " })))).toContain("pack.nameMissing");
    expect(rulesOf(checkPack(goodPack({ publisher: "" })))).toContain("pack.publisherMissing");
    expect(rulesOf(checkPack(goodPack({ identifier: "" })))).toContain("pack.identifierMissing");
  });

  test("limits the name, the publisher and the identifier to 128 characters", () => {
    const long = "a".repeat(129);
    expect(rulesOf(checkPack(goodPack({ name: long })))).toContain("pack.nameTooLong");
    expect(rulesOf(checkPack(goodPack({ publisher: long })))).toContain("pack.publisherTooLong");
    expect(rulesOf(checkPack(goodPack({ identifier: long })))).toContain(
      "pack.identifierTooLong",
    );
    expect(checkPack(goodPack({ name: "a".repeat(128) }))).toEqual([]);
  });

  test("rejects an identifier holding a character WhatsApp does not allow", () => {
    for (const identifier of ["my/pack", "pack#1", "año", "a:b", "😀"]) {
      expect(rulesOf(checkPack(goodPack({ identifier })))).toContain("pack.identifierChars");
    }
  });

  test("rejects whitespace in an identifier that is not a plain space", () => {
    // Java's \s matches a tab, so WhatsApp's own validator would let this
    // through. It is not in the written guide's list and nobody means to type
    // it, so this tool refuses it rather than write a strange identifier.
    for (const identifier of ["a\tb", "a\nb"]) {
      expect(rulesOf(checkPack(goodPack({ identifier })))).toContain("pack.identifierChars");
    }
  });

  test("accepts every character WhatsApp's validator allows in an identifier", () => {
    // The validator's pattern is [\w-.,'\s]+, so a comma and an apostrophe
    // are legal even though the written guide does not list them.
    for (const identifier of ["my-pack", "my_pack", "my.pack", "My Pack 2", "a,b", "O'Brien"]) {
      expect(rulesOf(checkPack(goodPack({ identifier })))).not.toContain("pack.identifierChars");
    }
  });

  test("rejects an identifier holding two dots in a row", () => {
    // A separate check in the validator, because ".." walks up a folder.
    expect(rulesOf(checkPack(goodPack({ identifier: "my..pack" })))).toContain(
      "pack.identifierChars",
    );
  });

  test("requires a tray icon", () => {
    expect(rulesOf(checkPack(goodPack({ tray: null })))).toContain("pack.trayMissing");
  });

  test("requires the tray icon to be a PNG", () => {
    // The tray icon is the one file in a pack that is not WebP.
    expect(
      rulesOf(checkPack(goodPack({ tray: { byteLength: 100, width: 96, height: 96, isPng: false } }))),
    ).toContain("pack.trayNotPng");
  });

  test("rejects a tray icon outside the 24 to 512 pixel range", () => {
    const tray = (width, height) => ({ byteLength: 100, width, height, isPng: true });
    expect(rulesOf(checkPack(goodPack({ tray: tray(23, 96) })))).toContain("pack.trayDimensions");
    expect(rulesOf(checkPack(goodPack({ tray: tray(96, 513) })))).toContain("pack.trayDimensions");
    expect(rulesOf(checkPack(goodPack({ tray: tray(24, 24) })))).not.toContain(
      "pack.trayDimensions",
    );
  });

  test("warns when the tray icon is legal but not the recommended 96 by 96", () => {
    const findings = checkPack(
      goodPack({ tray: { byteLength: 100, width: 128, height: 128, isPng: true } }),
    );
    expect(rulesOf(findings)).toEqual(["pack.trayNotRecommended"]);
    expect(findings[0].severity).toBe("warning");
  });

  test("rejects a tray icon over 50KB", () => {
    expect(
      rulesOf(
        checkPack(
          goodPack({ tray: { byteLength: MAX_TRAY_BYTES + 1, width: 96, height: 96, isPng: true } }),
        ),
      ),
    ).toContain("pack.trayTooBig");
  });

  test("checks each sticker too, and says which one failed", () => {
    const stickers = [goodSticker(), goodSticker({ width: 100 }), goodSticker()];
    const findings = checkPack(goodPack({ stickers }));
    expect(rulesOf(findings)).toEqual(["sticker.dimensions"]);
    // Without the index the person cannot tell which sticker to fix.
    expect(findings[0].stickerIndex).toBe(1);
  });

  test("leaves pack-level findings without a sticker index", () => {
    const findings = checkPack(goodPack({ name: "" }));
    expect(findings[0].stickerIndex).toBeUndefined();
  });

  test("rejects a publisher email that is not an email", () => {
    expect(rulesOf(checkPack(goodPack({ publisherEmail: "not an email" })))).toContain(
      "pack.emailInvalid",
    );
    expect(checkPack(goodPack({ publisherEmail: "a@b.com" }))).toEqual([]);
    // The field is optional, so empty is fine.
    expect(checkPack(goodPack({ publisherEmail: "" }))).toEqual([]);
  });

  test("requires a website to start with http or https", () => {
    expect(rulesOf(checkPack(goodPack({ publisherWebsite: "example.com" })))).toContain(
      "pack.websiteInvalid",
    );
    expect(checkPack(goodPack({ publisherWebsite: "https://example.com" }))).toEqual([]);
  });
});

describe("sanitizeIdentifier", () => {
  test("keeps a name that is already legal", () => {
    expect(sanitizeIdentifier("my-stickers")).toBe("my-stickers");
  });

  test("turns a name with spaces and accents into a legal identifier", () => {
    expect(sanitizeIdentifier("Mis Pegatinas Año")).toBe("mis-pegatinas-ano");
  });

  test("drops a character no identifier may hold", () => {
    expect(sanitizeIdentifier("cat/dog #1 (50%)")).toBe("cat-dog-1-50");
  });

  test("never returns two dots in a row", () => {
    expect(sanitizeIdentifier("a..b")).not.toContain("..");
  });

  test("cuts an over-long name to the 128 character limit", () => {
    expect(sanitizeIdentifier("a".repeat(300)).length).toBe(128);
  });

  test("falls back to a usable identifier when nothing legal is left", () => {
    // An empty identifier is refused by WhatsApp, so a name written entirely
    // in a script this rule strips still has to produce something.
    for (const name of ["", "###", "你好"]) {
      const identifier = sanitizeIdentifier(name);
      expect(identifier.length).toBeGreaterThan(0);
      expect(rulesOf(checkPack(goodPack({ identifier })))).not.toContain("pack.identifierChars");
    }
  });

  test("always returns something the pack check accepts", () => {
    for (const name of ["My Pack!", "  spaced  ", "a".repeat(400), "émoji 😀 pack"]) {
      const findings = rulesOf(checkPack(goodPack({ identifier: sanitizeIdentifier(name) })));
      expect(findings).toEqual([]);
    }
  });
});

describe("splitEmojis and countEmojis", () => {
  test("counts a plain emoji as one", () => {
    expect(countEmojis("😀")).toBe(1);
    expect(splitEmojis("😀🎉")).toEqual(["😀", "🎉"]);
  });

  test("counts an emoji built from several code points as one", () => {
    // A family emoji is several people joined by zero-width joiners. Counting
    // code points would call this five emoji and refuse a legal tag.
    expect(countEmojis("👨‍👩‍👧")).toBe(1);
    // A flag is two regional indicator letters.
    expect(countEmojis("🇪🇸")).toBe(1);
    // A skin tone is a modifier on the hand.
    expect(countEmojis("👍🏽")).toBe(1);
  });

  test("splits a run of joined emoji into the right pieces", () => {
    expect(splitEmojis("👍🏽🇪🇸")).toEqual(["👍🏽", "🇪🇸"]);
  });

  test("ignores spaces between emoji", () => {
    expect(splitEmojis(" 😀  🎉 ")).toEqual(["😀", "🎉"]);
  });

  test("counts nothing in an empty string", () => {
    expect(countEmojis("")).toBe(0);
    expect(splitEmojis("")).toEqual([]);
  });
});

describe("isBlocking", () => {
  test("is true when any finding is an error", () => {
    expect(isBlocking([{ severity: "warning" }, { severity: "error" }])).toBe(true);
  });

  test("is false for warnings alone, and for nothing at all", () => {
    expect(isBlocking([{ severity: "warning" }])).toBe(false);
    expect(isBlocking([])).toBe(false);
  });
});
