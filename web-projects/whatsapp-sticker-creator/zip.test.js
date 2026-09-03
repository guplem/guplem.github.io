import { describe, expect, test } from "bun:test";
import { buildZip, crc32 } from "./zip.js";

const utf8 = (text) => new TextEncoder().encode(text);
const readUint32 = (bytes, offset) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true);
const readUint16 = (bytes, offset) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint16(offset, true);

describe("crc32", () => {
  test("matches the published check value for \"123456789\"", () => {
    // The CRC-32 standard fixes this one: 0xCBF43926. Any table or shift
    // mistake changes it, and a wrong checksum makes every unzip tool refuse
    // the archive.
    expect(crc32(utf8("123456789"))).toBe(0xcbf43926);
  });

  test("matches the published check value for \"The quick brown fox...\"", () => {
    expect(crc32(utf8("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });

  test("gives an empty input a zero checksum", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  test("stays inside 32 unsigned bits", () => {
    // A signed result is the classic bug here: it writes 0xFFFFFFFF as -1.
    const checksum = crc32(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    expect(checksum).toBeGreaterThanOrEqual(0);
    expect(checksum).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("buildZip", () => {
  const entries = () => [
    { name: "title.txt", bytes: utf8("My Stickers") },
    { name: "author.txt", bytes: utf8("Guillem") },
    { name: "01.webp", bytes: new Uint8Array([1, 2, 3, 4, 5]) },
  ];

  test("starts with a local file header", () => {
    expect(readUint32(buildZip(entries()), 0)).toBe(0x04034b50);
  });

  test("ends with an end-of-central-directory record", () => {
    const zip = buildZip(entries());
    expect(readUint32(zip, zip.length - 22)).toBe(0x06054b50);
  });

  test("counts every entry in the end record, twice", () => {
    const zip = buildZip(entries());
    const end = zip.length - 22;
    // The count appears once for this disk and once for the whole archive.
    expect(readUint16(zip, end + 8)).toBe(3);
    expect(readUint16(zip, end + 10)).toBe(3);
  });

  test("stores the bytes instead of compressing them", () => {
    // Method 0 is "stored". WebP and PNG are already compressed, so deflating
    // them again would only cost code and time for no smaller file.
    const zip = buildZip(entries());
    expect(readUint16(zip, 8)).toBe(0);
    // With no compression the two sizes must agree.
    expect(readUint32(zip, 18)).toBe(readUint32(zip, 22));
  });

  test("writes each entry's real checksum and length", () => {
    const payload = new Uint8Array([9, 8, 7]);
    const zip = buildZip([{ name: "a.bin", bytes: payload }]);
    expect(readUint32(zip, 14)).toBe(crc32(payload));
    expect(readUint32(zip, 22)).toBe(3);
  });

  test("points the central directory at the byte where it starts", () => {
    const zip = buildZip(entries());
    const end = zip.length - 22;
    const size = readUint32(zip, end + 12);
    const offset = readUint32(zip, end + 16);
    expect(offset + size).toBe(end);
    expect(readUint32(zip, offset)).toBe(0x02014b50);
  });

  test("gives every entry a central directory record", () => {
    const zip = buildZip(entries());
    let found = 0;
    for (let i = 0; i + 4 <= zip.length; i += 1) {
      if (readUint32(zip, i) === 0x02014b50) found += 1;
    }
    expect(found).toBe(3);
  });

  test("writes each name where a reader looks for it", () => {
    const zip = buildZip(entries());
    const name = new TextDecoder().decode(zip.subarray(30, 30 + readUint16(zip, 26)));
    expect(name).toBe("title.txt");
  });

  test("rejects a name that holds a folder", () => {
    // Both export formats are read as a flat list of files. A phone app that
    // installs a pack looks for "01.webp" at the top level and finds nothing
    // when it sits in a folder, so refuse the name rather than ship an
    // archive that quietly installs nothing.
    expect(() => buildZip([{ name: "pack/01.webp", bytes: utf8("a") }])).toThrow(/flat/i);
    expect(() => buildZip([{ name: "..\\01.webp", bytes: utf8("a") }])).toThrow(/flat/i);
    expect(() => buildZip([{ name: "/01.webp", bytes: utf8("a") }])).toThrow(/flat/i);
  });

  test("rejects an empty name", () => {
    expect(() => buildZip([{ name: "", bytes: utf8("a") }])).toThrow(/flat/i);
  });

  test("marks a name with non-ASCII characters as UTF-8", () => {
    // Bit 11 of the flags tells the reader the name is UTF-8. Without it a
    // reader may fall back to a legacy code page and mangle the name.
    const plain = buildZip([{ name: "plain.txt", bytes: utf8("x") }]);
    const accented = buildZip([{ name: "año.txt", bytes: utf8("x") }]);
    expect(readUint16(plain, 6) & 0x0800).toBe(0);
    expect(readUint16(accented, 6) & 0x0800).toBe(0x0800);
  });

  test("writes the name length in bytes, not in characters", () => {
    // "ñ" is one character but two bytes in UTF-8. A length in characters
    // truncates the name and shifts every following field.
    const zip = buildZip([{ name: "ñ.txt", bytes: utf8("x") }]);
    expect(readUint16(zip, 26)).toBe(utf8("ñ.txt").length);
  });

  test("writes a date that a zip reader accepts", () => {
    // MS-DOS packs the date into 16 bits and counts years from 1980, so a
    // date before then cannot be written at all.
    const zip = buildZip([{ name: "a.txt", bytes: utf8("x") }], {
      date: new Date("2026-09-03T14:30:20Z"),
    });
    const time = readUint16(zip, 10);
    const date = readUint16(zip, 12);
    expect((date >> 9) + 1980).toBe(2026);
    expect((date >> 5) & 0x0f).toBe(9);
    expect(date & 0x1f).toBe(3);
    expect(time >> 11).toBe(14);
    expect((time >> 5) & 0x3f).toBe(30);
    // Seconds are stored in two second steps, so 20 becomes 10.
    expect(time & 0x1f).toBe(10);
  });

  test("clamps a date before 1980 to the oldest one the format holds", () => {
    const zip = buildZip([{ name: "a.txt", bytes: utf8("x") }], {
      date: new Date("1970-01-01T00:00:00Z"),
    });
    expect(readUint16(zip, 12) >> 9).toBe(0);
  });

  test("accepts an empty entry", () => {
    const zip = buildZip([{ name: "empty.txt", bytes: new Uint8Array(0) }]);
    expect(readUint32(zip, 14)).toBe(0);
    expect(readUint32(zip, 18)).toBe(0);
  });

  test("rejects an archive with no entries", () => {
    expect(() => buildZip([])).toThrow(/at least one file/i);
  });

  test("rejects two entries with the same name", () => {
    expect(() =>
      buildZip([
        { name: "01.webp", bytes: utf8("a") },
        { name: "01.webp", bytes: utf8("b") },
      ]),
    ).toThrow(/twice/i);
  });

  test("holds the file data right after each local header", () => {
    const payload = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const zip = buildZip([{ name: "a.bin", bytes: payload }]);
    const start = 30 + readUint16(zip, 26);
    expect([...zip.subarray(start, start + 3)]).toEqual([0xaa, 0xbb, 0xcc]);
  });
});
