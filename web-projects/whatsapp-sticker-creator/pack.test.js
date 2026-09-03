import { describe, expect, test } from "bun:test";
import { checkPack } from "./spec.js";
import {
  COVER_NAME,
  CONTENTS_NAME,
  TRAY_NAME,
  addSticker,
  contentsJson,
  contentsZipFiles,
  createPack,
  moveSticker,
  packFacts,
  removeSticker,
  stickerFileName,
  updateSticker,
  wastickersFiles,
} from "./pack.js";

const bytes = (length, fill = 1) => new Uint8Array(length).fill(fill);

/** A finished sticker, the shape the editor hands the pack. */
const sticker = (overrides = {}) => ({
  id: overrides.id ?? "s1",
  webp: bytes(2048),
  width: 512,
  height: 512,
  frameDurationsMs: [],
  emojis: ["😀"],
  accessibilityText: "",
  hasTransparency: true,
  touchesEdge: false,
  ...overrides,
});

/** A pack with three stickers and a tray icon: the smallest legal pack. */
const fullPack = () => {
  let pack = createPack({ name: "My Stickers", publisher: "Guillem" });
  pack = { ...pack, tray: { png: bytes(900), width: 96, height: 96 } };
  for (const id of ["a", "b", "c"]) pack = addSticker(pack, sticker({ id }));
  return pack;
};

const namesOf = (files) => files.map((file) => file.name);

describe("createPack", () => {
  test("starts empty, with the name and publisher it was given", () => {
    const pack = createPack({ name: "My Stickers", publisher: "Guillem" });
    expect(pack.name).toBe("My Stickers");
    expect(pack.publisher).toBe("Guillem");
    expect(pack.stickers).toEqual([]);
  });

  test("derives an identifier WhatsApp accepts from the name", () => {
    // The identifier has a narrower character set than the name, so a
    // Spanish or emoji pack name cannot be used as one directly.
    expect(createPack({ name: "Mis Pegatinas Año", publisher: "G" }).identifier).toBe(
      "mis-pegatinas-ano",
    );
  });

  test("keeps an identifier it was handed", () => {
    expect(createPack({ name: "A", publisher: "B", identifier: "kept" }).identifier).toBe("kept");
  });

  test("starts at image data version 1", () => {
    // WhatsApp re-reads a pack only when this changes, so it has to exist
    // from the start and move when the stickers do.
    expect(createPack({ name: "A", publisher: "B" }).imageDataVersion).toBe("1");
  });
});

describe("addSticker, removeSticker, moveSticker and updateSticker", () => {
  test("adds a sticker at the end", () => {
    const pack = addSticker(createPack({ name: "A", publisher: "B" }), sticker());
    expect(pack.stickers.length).toBe(1);
  });

  test("leaves the pack it was given alone", () => {
    const before = createPack({ name: "A", publisher: "B" });
    addSticker(before, sticker());
    expect(before.stickers.length).toBe(0);
  });

  test("refuses more than the thirty WhatsApp allows", () => {
    let pack = createPack({ name: "A", publisher: "B" });
    for (let index = 0; index < 30; index += 1) {
      pack = addSticker(pack, sticker({ id: `s${index}` }));
    }
    expect(() => addSticker(pack, sticker({ id: "s30" }))).toThrow(/30|most/i);
  });

  test("removes a sticker by its id", () => {
    const pack = removeSticker(fullPack(), "b");
    expect(pack.stickers.map((entry) => entry.id)).toEqual(["a", "c"]);
  });

  test("ignores an id that is not in the pack", () => {
    expect(removeSticker(fullPack(), "nope").stickers.length).toBe(3);
  });

  test("reorders the stickers, because the order is the order in WhatsApp", () => {
    // "The ordering of the files in the JSON will dictate the ordering of
    // your stickers in your pack."
    const pack = moveSticker(fullPack(), 0, 2);
    expect(pack.stickers.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  });

  test("changes one sticker's own fields", () => {
    const pack = updateSticker(fullPack(), "b", { emojis: ["🎉", "🔥"] });
    expect(pack.stickers[1].emojis).toEqual(["🎉", "🔥"]);
    expect(pack.stickers[0].emojis).toEqual(["😀"]);
  });

  test("moves the image data version whenever a sticker changes", () => {
    // WhatsApp caches a pack and only re-reads it when this string moves, so
    // an edit that left it alone would never reach the phone.
    const before = fullPack();
    expect(addSticker(before, sticker({ id: "d" })).imageDataVersion).not.toBe(
      before.imageDataVersion,
    );
    expect(removeSticker(before, "a").imageDataVersion).not.toBe(before.imageDataVersion);
    expect(updateSticker(before, "a", { emojis: ["🔥"] }).imageDataVersion).not.toBe(
      before.imageDataVersion,
    );
  });
});

describe("packFacts", () => {
  test("describes the pack in the shape the rule checker reads", () => {
    const facts = packFacts(fullPack());
    expect(facts.name).toBe("My Stickers");
    expect(facts.stickers.length).toBe(3);
    expect(facts.tray).toMatchObject({ width: 96, height: 96, isPng: true });
  });

  test("measures each sticker by its encoded size", () => {
    // The rule is about the file, so the number has to come from the bytes
    // and not from anything the editor believes about them.
    const facts = packFacts(fullPack());
    expect(facts.stickers[0].byteLength).toBe(2048);
  });

  test("passes the rule checker for a legal pack", () => {
    expect(checkPack(packFacts(fullPack()))).toEqual([]);
  });

  test("fails the rule checker when the pack is too small", () => {
    const small = removeSticker(fullPack(), "c");
    expect(checkPack(packFacts(small)).map((finding) => finding.rule)).toContain(
      "pack.tooFewStickers",
    );
  });

  test("reports no tray when none was made yet", () => {
    const pack = createPack({ name: "A", publisher: "B" });
    expect(packFacts(pack).tray).toBeNull();
  });
});

describe("stickerFileName", () => {
  test("numbers the files from one, padded so they sort correctly", () => {
    // A plain "1.webp" and "10.webp" sort as 1, 10, 2 in a phone app that
    // reads the folder, which would shuffle the pack.
    expect(stickerFileName(0)).toBe("01.webp");
    expect(stickerFileName(9)).toBe("10.webp");
    expect(stickerFileName(29)).toBe("30.webp");
  });
});

describe("wastickersFiles", () => {
  test("holds the four things a phone app looks for", () => {
    const files = wastickersFiles(fullPack());
    expect(namesOf(files)).toEqual(["title.txt", "author.txt", COVER_NAME, "01.webp", "02.webp", "03.webp"]);
  });

  test("writes the name and the publisher as plain text", () => {
    const files = wastickersFiles(fullPack());
    const read = (name) =>
      new TextDecoder().decode(files.find((file) => file.name === name).bytes);
    expect(read("title.txt")).toBe("My Stickers");
    expect(read("author.txt")).toBe("Guillem");
  });

  test("writes the text as UTF-8, so an accent survives", () => {
    const pack = { ...fullPack(), name: "Mis Pegatinas Año", publisher: "Guillem Poy" };
    const files = wastickersFiles(pack);
    const title = files.find((file) => file.name === "title.txt");
    expect(new TextDecoder().decode(title.bytes)).toBe("Mis Pegatinas Año");
  });

  test("carries each sticker's bytes untouched", () => {
    const files = wastickersFiles(fullPack());
    expect(files.find((file) => file.name === "01.webp").bytes.length).toBe(2048);
  });

  test("keeps the sticker order the pack has", () => {
    const pack = moveSticker(fullPack(), 2, 0);
    const files = wastickersFiles(pack);
    expect(files.find((file) => file.name === "01.webp").bytes).toBe(pack.stickers[0].webp);
  });

  test("uses the tray icon as the cover", () => {
    const files = wastickersFiles(fullPack());
    expect(files.find((file) => file.name === COVER_NAME).bytes.length).toBe(900);
  });

  test("leaves the cover out when there is no tray icon", () => {
    // The reference tool builds one from the first sticker when it is
    // missing, so an archive without it still imports.
    const pack = { ...fullPack(), tray: null };
    expect(namesOf(wastickersFiles(pack))).not.toContain(COVER_NAME);
  });

  test("refuses to build an archive from an empty pack", () => {
    expect(() => wastickersFiles(createPack({ name: "A", publisher: "B" }))).toThrow(
      /no stickers/i,
    );
  });
});

describe("contentsJson", () => {
  test("wraps one pack in the sticker_packs list WhatsApp's app reads", () => {
    const json = contentsJson(fullPack());
    expect(json.sticker_packs.length).toBe(1);
    expect(json.sticker_packs[0].name).toBe("My Stickers");
  });

  test("names the tray image file", () => {
    expect(contentsJson(fullPack()).sticker_packs[0].tray_image_file).toBe(TRAY_NAME);
  });

  test("lists every sticker with its file name and emoji", () => {
    const entries = contentsJson(fullPack()).sticker_packs[0].stickers;
    expect(entries.length).toBe(3);
    expect(entries[0]).toMatchObject({ image_file: "01.webp", emojis: ["😀"] });
  });

  test("says a still pack is not animated", () => {
    expect(contentsJson(fullPack()).sticker_packs[0].animated_sticker_pack).toBe(false);
  });

  test("says an animated pack is animated", () => {
    // Required for an animated pack, and the whole pack is refused without
    // it even when every sticker really does animate.
    let pack = createPack({ name: "A", publisher: "B" });
    pack = { ...pack, tray: { png: bytes(900), width: 96, height: 96 } };
    for (const id of ["a", "b", "c"]) {
      pack = addSticker(pack, sticker({ id, frameDurationsMs: [100, 100] }));
    }
    expect(contentsJson(pack).sticker_packs[0].animated_sticker_pack).toBe(true);
  });

  test("leaves out an accessibility text nobody wrote", () => {
    // An empty string is not a description, and WhatsApp reads the field as
    // optional, so writing "" would claim a description that is not there.
    expect(contentsJson(fullPack()).sticker_packs[0].stickers[0]).not.toHaveProperty(
      "accessibility_text",
    );
  });

  test("includes an accessibility text somebody wrote", () => {
    const pack = updateSticker(fullPack(), "a", { accessibilityText: "A smiling cup." });
    expect(contentsJson(pack).sticker_packs[0].stickers[0].accessibility_text).toBe(
      "A smiling cup.",
    );
  });

  test("carries the optional contact fields when they are filled in", () => {
    const pack = { ...fullPack(), publisherEmail: "a@b.com", publisherWebsite: "https://b.com" };
    const entry = contentsJson(pack).sticker_packs[0];
    expect(entry.publisher_email).toBe("a@b.com");
    expect(entry.publisher_website).toBe("https://b.com");
  });

  test("writes empty strings, not missing keys, for the pack's own optional fields", () => {
    // WhatsApp's sample contents.json carries these as empty strings, and
    // its reader expects the keys to exist.
    const entry = contentsJson(fullPack()).sticker_packs[0];
    for (const key of [
      "publisher_email",
      "publisher_website",
      "privacy_policy_website",
      "license_agreement_website",
    ]) {
      expect(`${key}: ${typeof entry[key]}`).toBe(`${key}: string`);
    }
  });

  test("survives a round trip through JSON", () => {
    // The file is written as JSON, so anything that cannot be serialised
    // would be silently lost.
    const json = contentsJson(fullPack());
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
  });
});

describe("contentsZipFiles", () => {
  test("holds the manifest, the tray icon and every sticker", () => {
    expect(namesOf(contentsZipFiles(fullPack()))).toEqual([
      CONTENTS_NAME,
      TRAY_NAME,
      "01.webp",
      "02.webp",
      "03.webp",
    ]);
  });

  test("writes the manifest as readable JSON", () => {
    const files = contentsZipFiles(fullPack());
    const text = new TextDecoder().decode(
      files.find((file) => file.name === CONTENTS_NAME).bytes,
    );
    // A developer opens this file by hand, so it is indented rather than
    // squeezed onto one line.
    expect(text).toContain("\n");
    expect(JSON.parse(text).sticker_packs[0].name).toBe("My Stickers");
  });

  test("refuses to build an archive with no tray icon", () => {
    // The manifest names a tray file, so an archive without one describes a
    // pack that cannot load.
    const pack = { ...fullPack(), tray: null };
    expect(() => contentsZipFiles(pack)).toThrow(/tray/i);
  });

  test("refuses to build an archive from an empty pack", () => {
    expect(() => contentsZipFiles(createPack({ name: "A", publisher: "B" }))).toThrow(
      /no stickers/i,
    );
  });
});
