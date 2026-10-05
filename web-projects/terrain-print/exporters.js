// Files a slicer can open: binary STL, 3MF, and the ZIP container 3MF is
// built on (also used to hand over several STL files at once).
//
// 3MF is the better download: one file holds every piece as its own object,
// with its name and a display colour, in millimetres. STL is the fallback
// every slicer reads.

/** Binary STL of one mesh. */
export function toStl(mesh, name = "terrain") {
  const { positions: p, indices: ix } = mesh;
  const count = ix.length / 3;
  const buf = new ArrayBuffer(84 + 50 * count);
  const view = new DataView(buf);
  const header = `binary STL: ${name}`.slice(0, 79);
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i) & 127);
  view.setUint32(80, count, true);
  let o = 84;
  for (let t = 0; t < ix.length; t += 3) {
    const a = 3 * ix[t];
    const b = 3 * ix[t + 1];
    const c = 3 * ix[t + 2];
    const ux = p[b] - p[a];
    const uy = p[b + 1] - p[a + 1];
    const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a];
    const vy = p[c + 1] - p[a + 1];
    const vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const v of [nx, ny, nz, p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]]) {
      view.setFloat32(o, v, true);
      o += 4;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return new Uint8Array(buf);
}

function num(v) {
  // Three decimals is a micrometre, finer than any printer.
  const s = v.toFixed(3);
  return s.replace(/\.?0+$/, "") || "0";
}

function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The 3D model part of a 3MF file.
 * @param {{name:string, mesh:object, colour:string, offset?:[number,number]}[]} parts
 *   `colour` is "#rrggbb"; `offset` moves the part on the plate (mm)
 * @returns {string[]} XML in chunks (a big model is too long for one string)
 */
export function threeMfModel(parts, title = "Terrain") {
  const colours = [...new Set(parts.map((p) => p.colour.toUpperCase()))];
  const chunks = [];
  chunks.push(
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n',
    `<metadata name="Title">${escapeXml(title)}</metadata>\n`,
    "<resources>\n",
    '<basematerials id="1">\n',
    ...colours.map((c) => `<base name="${escapeXml(c)}" displaycolor="${c}FF"/>\n`),
    "</basematerials>\n",
  );
  parts.forEach((part, n) => {
    const id = n + 2;
    const pindex = colours.indexOf(part.colour.toUpperCase());
    chunks.push(`<object id="${id}" type="model" name="${escapeXml(part.name)}" pid="1" pindex="${pindex}">\n<mesh>\n<vertices>\n`);
    const p = part.mesh.positions;
    let s = "";
    for (let k = 0; k < p.length; k += 3) {
      s += `<vertex x="${num(p[k])}" y="${num(p[k + 1])}" z="${num(p[k + 2])}"/>\n`;
      if (s.length > 1 << 20) {
        chunks.push(s);
        s = "";
      }
    }
    chunks.push(s, "</vertices>\n<triangles>\n");
    s = "";
    const ix = part.mesh.indices;
    for (let t = 0; t < ix.length; t += 3) {
      s += `<triangle v1="${ix[t]}" v2="${ix[t + 1]}" v3="${ix[t + 2]}"/>\n`;
      if (s.length > 1 << 20) {
        chunks.push(s);
        s = "";
      }
    }
    chunks.push(s, "</triangles>\n</mesh>\n</object>\n");
  });
  chunks.push("</resources>\n<build>\n");
  parts.forEach((part, n) => {
    const [dx, dy] = part.offset ?? [0, 0];
    chunks.push(`<item objectid="${n + 2}" transform="1 0 0 0 1 0 0 0 1 ${num(dx)} ${num(dy)} 0"/>\n`);
  });
  chunks.push("</build>\n</model>\n");
  return chunks;
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
  "</Types>\n";

const RELS =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
  "</Relationships>\n";

/** The files of a 3MF package, ready for zip(). */
export function threeMfFiles(parts, title) {
  const enc = new TextEncoder();
  return [
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(RELS) },
    { name: "3D/3dmodel.model", data: concat(threeMfModel(parts, title).map((c) => enc.encode(c))) },
  ];
}

export function concat(arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// ZIP

let crcTable = null;
/** CRC-32 (the ZIP and PNG checksum). */
export function crc32(data) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Build a ZIP archive.
 * @param {{name:string, data:Uint8Array}[]} files
 * @param {(data:Uint8Array) => Promise<Uint8Array>} [deflateRaw] compresses
 *   with raw DEFLATE; without it the files are stored as they are
 * @returns {Promise<Uint8Array>}
 */
export async function zip(files, deflateRaw = null) {
  const enc = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    let body = f.data;
    let method = 0;
    if (deflateRaw && f.data.length > 64) {
      const packed = await deflateRaw(f.data);
      if (packed.length < f.data.length) {
        body = packed;
        method = 8;
      }
    }
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, method, true);
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true); // 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    locals.push(new Uint8Array(local.buffer), name, body);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, method, true);
    c.setUint16(12, 0, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, body.length, true);
    c.setUint32(24, f.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const centralBytes = concat(central);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralBytes.length, true);
  end.setUint32(16, offset, true);
  return concat([...locals, centralBytes, new Uint8Array(end.buffer)]);
}

/** Raw DEFLATE with the browser's CompressionStream, or null where it is missing. */
export function browserDeflate() {
  if (typeof CompressionStream === "undefined") return null;
  return async (data) => {
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
}

/** A file name from a place name: "Tycho crater" -> "tycho-crater". */
export function fileSlug(text) {
  const s = String(text)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "terrain";
}
