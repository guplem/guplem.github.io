// The download files. A slicer is strict about these formats, so the tests
// read the bytes back the way a slicer would.
import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import { crc32, fileSlug, threeMfFiles, threeMfModel, toStl, zip } from "./exporters.js";

const tetra = {
  positions: Float32Array.from([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
  indices: Uint32Array.from([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};

describe("toStl", () => {
  test("writes the header, the count and 50 bytes per triangle", () => {
    const bytes = toStl(tetra, "tetra");
    expect(bytes.length).toBe(84 + 4 * 50);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(80, true)).toBe(4);
    // First triangle (0, 2, 1) faces down: normal (0, 0, -1).
    expect(view.getFloat32(84 + 8, true)).toBeCloseTo(-1, 6);
    // Its second vertex is (0, 10, 0).
    expect(view.getFloat32(84 + 12 + 12 + 4, true)).toBe(10);
  });
  test("never writes a header that starts with 'solid' (that marks an ASCII STL)", () => {
    const bytes = toStl(tetra, "solid thing");
    expect(String.fromCharCode(...bytes.subarray(0, 5))).not.toBe("solid");
  });
});

describe("3MF", () => {
  test("lists one coloured object per part, in millimetres", () => {
    const xml = threeMfModel(
      [
        { name: "Piece 1", mesh: tetra, colour: "#aabbcc" },
        { name: "Frame", mesh: tetra, colour: "#112233", offset: [5, -2.5] },
      ],
      "Tycho",
    ).join("");
    expect(xml).toContain('unit="millimeter"');
    expect(xml).toContain('<base name="#AABBCC" displaycolor="#AABBCCFF"/>');
    expect(xml).toContain('<object id="3" type="model" name="Frame" pid="1" pindex="1">');
    expect(xml).toContain('<vertex x="10" y="0" z="0"/>');
    expect(xml).toContain('<triangle v1="0" v2="2" v3="1"/>');
    expect(xml).toContain('<item objectid="3" transform="1 0 0 0 1 0 0 0 1 5 -2.5 0"/>');
  });
  test("escapes names", () => {
    expect(threeMfModel([{ name: 'A & "B"', mesh: tetra, colour: "#000000" }]).join("")).toContain('name="A &amp; &quot;B&quot;"');
  });
  test("holds the three files a 3MF package needs", () => {
    expect(threeMfFiles([{ name: "x", mesh: tetra, colour: "#000000" }]).map((f) => f.name)).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "3D/3dmodel.model",
    ]);
  });
});

function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const files = [];
  let o = 0;
  while (view.getUint32(o, true) === 0x04034b50) {
    const method = view.getUint16(o + 8, true);
    const crc = view.getUint32(o + 14, true);
    const size = view.getUint32(o + 18, true);
    const nameLen = view.getUint16(o + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(o + 30, o + 30 + nameLen));
    const body = bytes.subarray(o + 30 + nameLen, o + 30 + nameLen + size);
    const data = method === 8 ? new Uint8Array(inflateRawSync(body)) : body;
    files.push({ name, data, crc, method });
    o += 30 + nameLen + size;
  }
  return files;
}

describe("zip", () => {
  test("stores files with their CRC", async () => {
    const data = new TextEncoder().encode("hello terrain");
    const out = readZip(await zip([{ name: "a.txt", data }]));
    expect(out.length).toBe(1);
    expect(new TextDecoder().decode(out[0].data)).toBe("hello terrain");
    expect(out[0].crc).toBe(crc32(data));
  });
  test("deflates when given a compressor, and the result reads back", async () => {
    const data = new TextEncoder().encode("abc".repeat(1000));
    const deflate = async (d) => {
      const stream = new Blob([d]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    };
    const out = readZip(await zip([{ name: "b.txt", data }], deflate));
    expect(out[0].method).toBe(8);
    expect(new TextDecoder().decode(out[0].data)).toBe("abc".repeat(1000));
  });
  test("the CRC matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("fileSlug", () => {
  test("turns a place name into a safe file name", () => {
    expect(fileSlug("Chang'e 4 – Von Kármán crater")).toBe("chang-e-4-von-karman-crater");
    expect(fileSlug("!!!")).toBe("terrain");
  });
});
