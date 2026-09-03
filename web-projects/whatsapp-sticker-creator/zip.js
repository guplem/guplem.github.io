// Writing a ZIP archive, with the files stored rather than compressed.
//
// A sticker pack leaves this page as one file that holds many. Both export
// formats are ZIP archives:
//
//   .wastickers   what the phone apps that install packs into WhatsApp read
//   .zip          the folder layout WhatsApp's own sample app expects
//
// No library is used. The repository has no build step and no package manager
// (root ADR 0002), and a compressor would be the larger half of the work here
// for no gain: a sticker is a WebP file and a tray icon is a PNG file, and both
// are already compressed. Deflating them again saves nothing.
//
// So every entry uses method 0, "stored": the bytes go in as they are. That is
// a plain, valid ZIP file that every unzip tool and every phone app reads.
//
// The layout this file writes:
//
//   local header + file bytes      once per file
//   central directory record       once per file, repeating the same details
//   end of central directory       once, saying where the directory starts
//
// The two halves must agree. A reader trusts the central directory, so an
// offset that is one byte out makes the whole archive unreadable even though
// the file bytes are all present and correct.

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;

const LOCAL_HEADER_LENGTH = 30;
const CENTRAL_HEADER_LENGTH = 46;
const END_LENGTH = 22;

/** Method 0: the bytes are stored as they are. */
const STORED = 0;

/** 2.0, the version that first defined this layout. */
const VERSION_NEEDED = 20;

/** Bit 11 of the flags: the file name is UTF-8. */
const FLAG_UTF8_NAME = 0x0800;

/** MS-DOS counts years from 1980 and cannot hold anything earlier. */
const DOS_EPOCH_YEAR = 1980;

const CRC_TABLE = buildCrcTable();

/**
 * The CRC-32 checksum every ZIP entry carries. An unzip tool compares it with
 * what it read and refuses the file when they differ, so this has to be exact.
 *
 * @param {Uint8Array} bytes
 * @returns {number} An unsigned 32 bit checksum.
 */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  // `>>> 0` turns the result back into an unsigned number. Without it a
  // checksum with the top bit set is written as a negative value.
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @typedef {object} ZipEntry
 * @property {string} name The file name. Keep it flat: no folders.
 * @property {Uint8Array} bytes The file contents.
 */

/**
 * Build a ZIP archive.
 *
 * @param {ZipEntry[]} entries The files, in the order they should appear.
 * @param {object} [options]
 * @param {Date} [options.date] The timestamp to give every entry.
 * @returns {Uint8Array} A complete ZIP archive.
 * @throws When there are no entries, or a name is used twice.
 */
export function buildZip(entries, { date = new Date() } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("A ZIP archive needs at least one file.");
  }
  const seen = new Set();
  for (const entry of entries) {
    // Both export formats are read as a flat list. A name with a folder in it
    // would install nothing on a phone, and would quietly do so.
    if (!entry.name || /[/\\]/.test(entry.name)) {
      throw new Error(`"${entry.name}" is not a flat file name.`);
    }
    if (seen.has(entry.name)) throw new Error(`The name "${entry.name}" is used twice.`);
    seen.add(entry.name);
  }

  const stamp = dosStamp(date);
  const prepared = entries.map((entry) => {
    const name = new TextEncoder().encode(entry.name);
    return {
      name,
      bytes: entry.bytes,
      checksum: crc32(entry.bytes),
      // Only mark the name as UTF-8 when it needs it. A reader that meets the
      // flag on a plain ASCII name is fine, but staying quiet is closer to
      // what other writers do, so it surprises fewer readers.
      flags: name.length === entry.name.length ? 0 : FLAG_UTF8_NAME,
    };
  });

  const bodyLength = prepared.reduce(
    (total, entry) => total + LOCAL_HEADER_LENGTH + entry.name.length + entry.bytes.length,
    0,
  );
  const directoryLength = prepared.reduce(
    (total, entry) => total + CENTRAL_HEADER_LENGTH + entry.name.length,
    0,
  );

  const zip = new Uint8Array(bodyLength + directoryLength + END_LENGTH);
  const view = new DataView(zip.buffer);
  const offsets = [];
  let at = 0;

  for (const entry of prepared) {
    // Remember where this entry starts. The central directory points here,
    // and that pointer is how a reader finds the file at all.
    offsets.push(at);
    view.setUint32(at, LOCAL_HEADER_SIGNATURE, true);
    view.setUint16(at + 4, VERSION_NEEDED, true);
    view.setUint16(at + 6, entry.flags, true);
    view.setUint16(at + 8, STORED, true);
    view.setUint16(at + 10, stamp.time, true);
    view.setUint16(at + 12, stamp.date, true);
    view.setUint32(at + 14, entry.checksum, true);
    // Stored, so the compressed and uncompressed sizes are the same number.
    view.setUint32(at + 18, entry.bytes.length, true);
    view.setUint32(at + 22, entry.bytes.length, true);
    view.setUint16(at + 26, entry.name.length, true);
    view.setUint16(at + 28, 0, true);
    at += LOCAL_HEADER_LENGTH;

    zip.set(entry.name, at);
    at += entry.name.length;
    zip.set(entry.bytes, at);
    at += entry.bytes.length;
  }

  const directoryStart = at;
  prepared.forEach((entry, index) => {
    view.setUint32(at, CENTRAL_HEADER_SIGNATURE, true);
    // The version that wrote this, then the version needed to read it.
    view.setUint16(at + 4, VERSION_NEEDED, true);
    view.setUint16(at + 6, VERSION_NEEDED, true);
    view.setUint16(at + 8, entry.flags, true);
    view.setUint16(at + 10, STORED, true);
    view.setUint16(at + 12, stamp.time, true);
    view.setUint16(at + 14, stamp.date, true);
    view.setUint32(at + 16, entry.checksum, true);
    view.setUint32(at + 20, entry.bytes.length, true);
    view.setUint32(at + 24, entry.bytes.length, true);
    view.setUint16(at + 28, entry.name.length, true);
    // No extra field, no comment, no disk number, no attributes.
    view.setUint32(at + 42, offsets[index], true);
    at += CENTRAL_HEADER_LENGTH;
    zip.set(entry.name, at);
    at += entry.name.length;
  });

  view.setUint32(at, END_SIGNATURE, true);
  // The count is written twice: once for this disk, once for the archive.
  // A single-file archive is still one disk, so both are the same.
  view.setUint16(at + 8, prepared.length, true);
  view.setUint16(at + 10, prepared.length, true);
  view.setUint32(at + 12, directoryLength, true);
  view.setUint32(at + 16, directoryStart, true);

  return zip;
}

/**
 * Pack a date into the two 16 bit fields MS-DOS used, which ZIP kept. Seconds
 * are stored in two second steps, so odd seconds are lost.
 */
function dosStamp(date) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  // A date before 1980 has no representation, so pin it to the first moment
  // the format can hold rather than write a negative year.
  const year = Math.max(0, when.getUTCFullYear() - DOS_EPOCH_YEAR);
  return {
    date: (year << 9) | ((when.getUTCMonth() + 1) << 5) | when.getUTCDate(),
    time:
      (when.getUTCHours() << 11) |
      (when.getUTCMinutes() << 5) |
      Math.floor(when.getUTCSeconds() / 2),
  };
}

/** The standard CRC-32 table, built once from the reversed polynomial. */
function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
}
