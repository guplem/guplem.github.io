import { describe, expect, test } from "bun:test";
import { SAVE_VERSION, deserialisePack, migrate, serialisePack } from "./save.js";
import { addSticker, createPack } from "./pack.js";

const bytes = (length, fill = 7) => new Uint8Array(length).fill(fill);

const sticker = (id) => ({
  id,
  webp: bytes(64),
  width: 512,
  height: 512,
  frameDurationsMs: [],
  emojis: ["😀"],
  accessibilityText: "",
  hasTransparency: true,
  touchesEdge: false,
});

const fullPack = () => {
  let pack = createPack({ name: "Mis Pegatinas", publisher: "Guillem" });
  pack = { ...pack, tray: { png: bytes(32), width: 96, height: 96 } };
  return addSticker(addSticker(pack, sticker("a")), sticker("b"));
};

describe("serialisePack", () => {
  test("stamps the version it was written by", () => {
    expect(serialisePack(fullPack()).version).toBe(SAVE_VERSION);
  });

  test("keeps the pack's own details", () => {
    const saved = serialisePack(fullPack());
    expect(saved.name).toBe("Mis Pegatinas");
    expect(saved.publisher).toBe("Guillem");
    expect(saved.identifier).toBe("mis-pegatinas");
  });

  test("keeps every sticker, in order", () => {
    expect(serialisePack(fullPack()).stickers.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  test("keeps the encoded bytes as bytes", () => {
    // The browser's own storage carries a byte array, so turning it into
    // text would make every saved pack a third larger for nothing.
    const saved = serialisePack(fullPack());
    expect(saved.stickers[0].webp).toBeInstanceOf(Uint8Array);
    expect(saved.stickers[0].webp.length).toBe(64);
  });

  test("keeps the pack icon", () => {
    expect(serialisePack(fullPack()).tray.png.length).toBe(32);
  });

  test("copes with a pack that has no icon yet", () => {
    const pack = createPack({ name: "A", publisher: "B" });
    expect(serialisePack(pack).tray).toBeNull();
  });

  test("records when it was saved", () => {
    expect(typeof serialisePack(fullPack()).savedAt).toBe("string");
  });
});

describe("deserialisePack", () => {
  test("brings a saved pack back whole", () => {
    const before = fullPack();
    const after = deserialisePack(serialisePack(before));
    expect(after.name).toBe(before.name);
    expect(after.stickers.length).toBe(2);
    expect([...after.stickers[0].webp]).toEqual([...before.stickers[0].webp]);
    expect(after.tray.width).toBe(96);
  });

  test("refuses anything that is not a saved pack", () => {
    for (const rubbish of [null, undefined, 42, "pack", [], { nothing: true }]) {
      expect(deserialisePack(rubbish)).toBeNull();
    }
  });

  test("refuses a document from a version it does not know", () => {
    // Opening a newer save with older code would drop the fields it does not
    // know about and then write them away. Refusing keeps the file intact.
    const saved = { ...serialisePack(fullPack()), version: SAVE_VERSION + 1 };
    expect(deserialisePack(saved)).toBeNull();
  });

  test("drops a sticker whose picture is missing, and keeps the rest", () => {
    // Storage can come back short. Losing one sticker is much better than
    // losing the pack, and a sticker with no picture cannot be shown at all.
    const saved = serialisePack(fullPack());
    saved.stickers[0] = { ...saved.stickers[0], webp: null };
    const pack = deserialisePack(saved);
    expect(pack.stickers.map((entry) => entry.id)).toEqual(["b"]);
  });

  test("gives a sticker with no emoji an empty list rather than nothing", () => {
    // The rule checker counts this list, so a missing one would throw
    // instead of reporting the rule it breaks.
    const saved = serialisePack(fullPack());
    delete saved.stickers[0].emojis;
    expect(deserialisePack(saved).stickers[0].emojis).toEqual([]);
  });

  test("returns a pack the rest of the code can use straight away", () => {
    const pack = deserialisePack(serialisePack(fullPack()));
    expect(typeof pack.imageDataVersion).toBe("string");
    expect(Array.isArray(pack.stickers)).toBe(true);
    expect(typeof pack.identifier).toBe("string");
  });
});

describe("migrate", () => {
  test("leaves a current document alone", () => {
    const saved = serialisePack(fullPack());
    expect(migrate(saved).version).toBe(SAVE_VERSION);
    expect(migrate(saved).name).toBe("Mis Pegatinas");
  });

  test("fills in a field an older document never had", () => {
    // Only ever add fields, and always give a new field a default here. A
    // pack saved by an older version has to keep opening.
    const old = { version: 1, name: "A", publisher: "B", stickers: [] };
    const migrated = migrate(old);
    expect(migrated.identifier).toBeTruthy();
    expect(migrated.imageDataVersion).toBe("1");
    expect(migrated.tray).toBeNull();
    expect(migrated.publisherEmail).toBe("");
  });

  test("gives a sticker every field the editor expects", () => {
    const old = {
      version: 1,
      name: "A",
      publisher: "B",
      stickers: [{ id: "x", webp: bytes(8) }],
    };
    const sticker = migrate(old).stickers[0];
    expect(sticker.width).toBe(512);
    expect(sticker.height).toBe(512);
    expect(sticker.frameDurationsMs).toEqual([]);
    expect(sticker.emojis).toEqual([]);
    expect(sticker.accessibilityText).toBe("");
  });

  test("builds an identifier when an old document held none", () => {
    expect(migrate({ version: 1, name: "Mis Pegatinas", publisher: "B", stickers: [] }).identifier)
      .toBe("mis-pegatinas");
  });
});
