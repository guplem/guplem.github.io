// A QR code encoder, byte mode only, error correction L or M.
//
// Why the module carries its own: an invite travels as a link, and on a
// phone the fastest way to hand a link to the person across the table is a
// picture their camera can read. A library would be one more script from
// another host; this file is the whole of it, and the tests pin its output
// to an established encoder (the Python `qrcode` library) module for module.
//
// The steps follow ISO/IEC 18004: pick the smallest version the text fits,
// add Reed-Solomon error correction per block, interleave the blocks, draw
// the fixed patterns, lay the bits in the zigzag, then pick the mask with
// the lowest penalty.

const LEVELS = {
  // formatBits is the two-bit code the format information carries.
  L: {
    formatBits: 1,
    eccPerBlock: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    blocks: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  },
  M: {
    formatBits: 0,
    eccPerBlock: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    blocks: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  },
};

const MAX_VERSION = 40;

/**
 * Encodes text as a QR code.
 *
 * @param {string} text - Any text; it is encoded as UTF-8 bytes.
 * @param {{ ecc?: "L" | "M", mask?: number }} [options] - The error
 *   correction level (default "M") and, for tests, a fixed mask (0-7).
 *   Without a mask the encoder picks the one with the lowest penalty.
 * @returns {{ version: number, size: number, mask: number, modules: boolean[][] }}
 *   `modules[y][x]` is true for a dark module. There is no quiet zone: the
 *   caller draws the four-module margin around it.
 */
export function encodeQr(text, options = {}) {
  const level = LEVELS[options.ecc ?? "M"];
  if (!level) throw new Error(`Unknown error correction level: ${options.ecc}`);

  const bytes = [...new TextEncoder().encode(text)];
  const version = smallestVersion(bytes.length, level);
  const data = dataCodewords(bytes, version, level);
  const codewords = withErrorCorrection(data, version, level);

  const size = version * 4 + 17;
  const grid = makeGrid(size);
  drawFunctionPatterns(grid, version);
  drawCodewords(grid, codewords);

  let mask = options.mask;
  if (mask === undefined) {
    let best = Infinity;
    for (let candidate = 0; candidate < 8; candidate++) {
      applyMask(grid, candidate);
      drawFormatBits(grid, level, candidate);
      const score = penalty(grid.modules);
      if (score < best) {
        best = score;
        mask = candidate;
      }
      applyMask(grid, candidate); // XOR again undoes it
    }
  }
  applyMask(grid, mask);
  drawFormatBits(grid, level, mask);

  return { version, size, mask, modules: grid.modules };
}

/**
 * Draws a QR code as one SVG path, one square per dark module, so a page
 * can scale it to any size without blurring.
 *
 * @param {{ size: number, modules: boolean[][] }} qr - An `encodeQr` result.
 * @param {number} [margin] - The quiet zone in modules (the standard asks for 4).
 * @returns {string} An SVG element as a string, with `viewBox` in modules.
 */
export function qrToSvg(qr, margin = 4) {
  const side = qr.size + margin * 2;
  let path = "";
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) path += `M${x + margin} ${y + margin}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges">` +
    `<rect width="${side}" height="${side}" fill="#fff"/>` +
    `<path d="${path}" fill="#000"/></svg>`
  );
}

// ---------- Capacity ----------

/** Modules left for data and error correction once the patterns are drawn. */
function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCapacity(version, level) {
  return Math.floor(rawDataModules(version) / 8) - level.eccPerBlock[version] * level.blocks[version];
}

/** Byte mode: a 4-bit mode, the length (8 bits up to version 9, then 16), the bytes. */
function bitsNeeded(byteCount, version) {
  return 4 + (version <= 9 ? 8 : 16) + byteCount * 8;
}

function smallestVersion(byteCount, level) {
  for (let version = 1; version <= MAX_VERSION; version++) {
    if (bitsNeeded(byteCount, version) <= dataCapacity(version, level) * 8) return version;
  }
  throw new Error("Text too long for a QR code");
}

function dataCodewords(bytes, version, level) {
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));

  const capacityBits = dataCapacity(version, level) * 8;
  push(0, Math.min(4, capacityBits - bits.length)); // terminator
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);

  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    out.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  return out;
}

// ---------- Reed-Solomon over GF(256), polynomial 0x11D ----------

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

/** Splits the data into blocks, adds each block's error correction, interleaves. */
function withErrorCorrection(data, version, level) {
  const blockCount = level.blocks[version];
  const eccLength = level.eccPerBlock[version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blockCount - (rawCodewords % blockCount);
  const shortLength = Math.floor(rawCodewords / blockCount);
  const divisor = rsDivisor(eccLength);

  const blocks = [];
  for (let i = 0, k = 0; i < blockCount; i++) {
    const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
    const chunk = data.slice(k, k + length);
    k += length;
    const ecc = rsRemainder(chunk, divisor);
    if (i < shortBlocks) chunk.push(0); // placeholder so every block is the same length
    blocks.push(chunk.concat(ecc));
  }

  const out = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLength - eccLength || j >= shortBlocks) out.push(block[i]);
    });
  }
  return out;
}

// ---------- Drawing ----------

function makeGrid(size) {
  const rows = () => Array.from({ length: size }, () => new Array(size).fill(false));
  return { size, modules: rows(), reserved: rows() };
}

function setFixed(grid, x, y, dark) {
  grid.modules[y][x] = dark;
  grid.reserved[y][x] = true;
}

function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const result = [6];
  for (let pos = version * 4 + 17 - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

function drawFunctionPatterns(grid, version) {
  const { size } = grid;
  for (let i = 0; i < size; i++) {
    setFixed(grid, 6, i, i % 2 === 0);
    setFixed(grid, i, 6, i % 2 === 0);
  }

  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        setFixed(grid, x, y, ring !== 2 && ring !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  positions.forEach((py, i) => {
    positions.forEach((px, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFixed(grid, px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    });
  });

  // Reserve the format areas now; the real bits go in once the mask is known.
  drawFormatBits(grid, LEVELS.M, 0);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFixed(grid, a, b, dark);
      setFixed(grid, b, a, dark);
    }
  }
}

function drawFormatBits(grid, level, mask) {
  const { size } = grid;
  const data = (level.formatBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) === 1;

  for (let i = 0; i <= 5; i++) setFixed(grid, 8, i, bit(i));
  setFixed(grid, 8, 7, bit(6));
  setFixed(grid, 8, 8, bit(7));
  setFixed(grid, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFixed(grid, 14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) setFixed(grid, size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFixed(grid, 8, size - 15 + i, bit(i));
  setFixed(grid, 8, size - 8, true); // the one module that is always dark
}

/** Lays the bits in two-column strips, right to left, alternating up and down. */
function drawCodewords(grid, codewords) {
  const { size } = grid;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing pattern takes column 6
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (grid.reserved[y][x] || i >= codewords.length * 8) continue;
        grid.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(grid, mask) {
  const flip = MASKS[mask];
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.reserved[y][x] && flip(x, y)) grid.modules[y][x] = !grid.modules[y][x];
    }
  }
}

/**
 * The four penalty rules of the standard. Any mask gives a valid code; the
 * lowest penalty only makes it easier for a camera to read.
 */
function penalty(modules) {
  const size = modules.length;
  let score = 0;
  const lines = [];
  for (let i = 0; i < size; i++) {
    lines.push(modules[i]);
    lines.push(modules.map((row) => row[i]));
  }

  // N1: five or more of the same colour in a row.
  lines.forEach((line) => {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) {
        run++;
      } else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
  });

  // N2: 2x2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
    }
  }

  // N3: a pattern that looks like a finder (1:1:3:1:1 with four light on one side).
  const finderA = [true, false, true, true, true, false, true, false, false, false, false];
  const finderB = [...finderA].reverse();
  lines.forEach((line) => {
    for (let i = 0; i + 11 <= size; i++) {
      const matches = (pattern) => pattern.every((v, k) => line[i + k] === v);
      if (matches(finderA)) score += 40;
      if (matches(finderB)) score += 40;
    }
  });

  // N4: how far the share of dark modules is from half.
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}
