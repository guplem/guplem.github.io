// Turns a WebRTC session description into a short code, and back.
//
// Two browsers must swap one description each before a data channel can
// open (the "signalling" step). There is no server here to carry them, so a
// person carries them: as a link, a QR code, or pasted text. A raw
// description is about 900 characters; a person can carry about 150. So the
// code keeps only the fields that decide whether the two peers can reach
// each other, and unpackSignal writes a fresh description around them:
//
//   ICE username and password   who is allowed to talk on this connection
//   DTLS fingerprint and role   which certificate the encryption must see
//   media id                    the one data-channel section, named by the offer
//   UDP candidates              the addresses and ports to try
//
// Everything else in a data-channel description is the same in every
// browser, so it is written back from a template. The layout is binary,
// then base64url, so it survives a URL fragment, a QR code and a chat app.

const FORMAT = 1;
const KINDS = ["offer", "answer"];
const SETUPS = ["actpass", "active", "passive"];
const HASHES = [
  ["sha-256", 32],
  ["sha-1", 20],
  ["sha-384", 48],
  ["sha-512", 64],
];
const CANDIDATE_TYPES = ["host", "srflx", "prflx", "relay"];
const ADDRESS_IPV4 = 0;
const ADDRESS_IPV6 = 1;
const ADDRESS_MDNS = 2;
const ADDRESS_NAME = 3;
const MAX_CANDIDATES = 8;

/**
 * Packs a description and its envelope into a short, URL-safe code.
 *
 * @param {{ kind: "offer" | "answer", app: string, room: string, ticket: string, sdp: string }} signal
 *   `app` keeps one game's invite out of another; `room` names the table;
 *   `ticket` pairs an answer with the invite it answers.
 * @returns {string} Base64url text, about 110 to 170 characters.
 * @throws {Error} When the description lacks the credentials or the fingerprint.
 */
export function packSignal({ kind, app, room, ticket, sdp }) {
  const parsed = parseDescription(sdp);
  const out = new Writer();
  out.u8(FORMAT);
  out.u8(KINDS.indexOf(kind) | (SETUPS.indexOf(parsed.setup) << 1));
  out.text(app);
  out.text(room);
  out.text(ticket);
  out.text(parsed.mid);
  out.text(parsed.ufrag);
  out.text(parsed.pwd);
  out.u8(parsed.hashIndex);
  out.bytes(parsed.fingerprint);
  out.u8(parsed.candidates.length);
  parsed.candidates.forEach((c) => {
    out.u8(CANDIDATE_TYPES.indexOf(c.type) | (c.address.kind << 4));
    if (c.address.kind === ADDRESS_NAME) out.text(c.address.value);
    else out.bytes(c.address.value);
    out.u16(c.port);
  });
  return toBase64Url(out.finish());
}

/**
 * Reads a code made by packSignal and writes a full description around it.
 *
 * @param {string} code - The code, exactly as packSignal wrote it.
 * @returns {{ kind: "offer" | "answer", app: string, room: string, ticket: string, sdp: string }}
 * @throws {Error} With a message a page can show: the code is not an invite,
 *   or it is incomplete (cut short while copying).
 */
export function unpackSignal(code) {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{8,}$/.test(code)) {
    throw new Error("This is not an invite code.");
  }
  const input = new Reader(fromBase64Url(code));
  if (input.u8() !== FORMAT) throw new Error("This is not an invite code.");
  const flags = input.u8();
  const kind = KINDS[flags & 1];
  const setup = SETUPS[(flags >> 1) & 3];
  const app = input.text();
  const room = input.text();
  const ticket = input.text();
  const mid = input.text();
  const ufrag = input.text();
  const pwd = input.text();
  const hash = HASHES[input.u8()];
  if (!hash || !setup) throw new Error("This is not an invite code.");
  const fingerprint = input.bytes(hash[1]);
  const count = input.u8();
  const candidates = [];
  for (let i = 0; i < count; i++) {
    const head = input.u8();
    const type = CANDIDATE_TYPES[head & 15];
    const kindOfAddress = head >> 4;
    let address;
    if (kindOfAddress === ADDRESS_IPV4) address = formatIpv4(input.bytes(4));
    else if (kindOfAddress === ADDRESS_IPV6) address = formatIpv6(input.bytes(16));
    else if (kindOfAddress === ADDRESS_MDNS) address = `${formatUuid(input.bytes(16))}.local`;
    else address = input.text();
    candidates.push({ type, address, port: input.u16() });
  }

  const sdp = writeDescription({ setup, mid, ufrag, pwd, hash: hash[0], fingerprint, candidates });
  return { kind, app, room, ticket, sdp };
}

/**
 * Builds the link a person sends: the page, then the code in the fragment.
 * The fragment never reaches a server, so the code stays between the two
 * browsers and the chat app that carried it.
 *
 * @param {string} pageUrl - The page's own address; any fragment is replaced.
 * @param {"offer" | "answer"} kind
 * @param {string} code
 * @returns {string}
 */
export function linkFor(pageUrl, kind, code) {
  const withoutHash = pageUrl.split("#")[0];
  return `${withoutHash}#${kind === "offer" ? "join" : "answer"}=${code}`;
}

/**
 * Finds a code in whatever a person pasted: a whole link, a message with a
 * link inside, a bare `#join=` fragment, or the code on its own.
 *
 * @param {string} text
 * @returns {{ kind: "offer" | "answer" | null, code: string } | null}
 *   `kind` is null for a bare code, which says nothing about its kind until
 *   it is unpacked.
 */
export function readLink(text) {
  const value = String(text ?? "");
  const tagged = value.match(/#(join|answer)=([A-Za-z0-9_-]+)/);
  if (tagged) return { kind: tagged[1] === "join" ? "offer" : "answer", code: tagged[2] };
  const bare = value.trim();
  if (/^[A-Za-z0-9_-]+$/.test(bare)) return { kind: null, code: bare };
  return null;
}

// ---------- Reading a description ----------

function parseDescription(sdp) {
  const lines = String(sdp).split(/\r?\n/);
  const value = (prefix) => {
    const found = lines.find((l) => l.startsWith(prefix));
    return found === undefined ? null : found.slice(prefix.length).trim();
  };

  const ufrag = value("a=ice-ufrag:");
  const pwd = value("a=ice-pwd:");
  const fingerprintLine = value("a=fingerprint:");
  if (!ufrag || !pwd) throw new Error("The description has no ICE credentials.");
  if (!fingerprintLine) throw new Error("The description has no DTLS fingerprint.");

  const [hashName, hex] = fingerprintLine.split(/\s+/);
  const hashIndex = HASHES.findIndex(([name]) => name === hashName.toLowerCase());
  if (hashIndex < 0) throw new Error(`Unsupported fingerprint hash: ${hashName}`);
  const fingerprint = hex.split(":").map((pair) => parseInt(pair, 16));

  const seen = new Set();
  const candidates = [];
  lines
    .filter((l) => l.startsWith("a=candidate:"))
    .forEach((l) => {
      const f = l.slice("a=candidate:".length).split(/\s+/);
      // foundation, component, transport, priority, address, port, "typ", type
      if (f.length < 8 || f[1] !== "1" || f[2].toLowerCase() !== "udp" || f[6] !== "typ") return;
      if (!CANDIDATE_TYPES.includes(f[7])) return;
      const key = `${f[4].toLowerCase()} ${f[5]} ${f[7]}`;
      if (seen.has(key) || candidates.length >= MAX_CANDIDATES) return;
      seen.add(key);
      candidates.push({ type: f[7], address: encodeAddress(f[4]), port: Number(f[5]) });
    });

  return {
    ufrag,
    pwd,
    hashIndex,
    fingerprint,
    setup: SETUPS.includes(value("a=setup:")) ? value("a=setup:") : "actpass",
    mid: value("a=mid:") ?? "0",
    candidates,
  };
}

function encodeAddress(address) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) {
    return { kind: ADDRESS_IPV4, value: address.split(".").map(Number) };
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.local$/i.test(address)) {
    return { kind: ADDRESS_MDNS, value: parseHex(address.slice(0, 36).replace(/-/g, "")) };
  }
  if (address.includes(":")) {
    const bytes = parseIpv6(address);
    if (bytes) return { kind: ADDRESS_IPV6, value: bytes };
  }
  return { kind: ADDRESS_NAME, value: address };
}

// ---------- Writing a description ----------

function writeDescription({ setup, mid, ufrag, pwd, hash, fingerprint, candidates }) {
  // Any stable number will do for the session id; the fingerprint gives one.
  const sessionId = fingerprint.slice(0, 6).reduce((acc, b) => acc * 256 + b, 0);
  const priorities = { host: 126, prflx: 110, srflx: 100, relay: 0 };
  const lines = [
    "v=0",
    `o=- ${sessionId} 2 IN IP4 127.0.0.1`,
    "s=-",
    "t=0 0",
    `a=group:BUNDLE ${mid}`,
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
  ];
  candidates.forEach((c, i) => {
    // RFC 8445 priority: type preference, then order within the type.
    const priority = priorities[c.type] * 2 ** 24 + (65535 - i) * 2 ** 8 + 255;
    const related = c.type === "host" ? "" : " raddr 0.0.0.0 rport 0";
    lines.push(`a=candidate:${i + 1} 1 udp ${priority} ${c.address} ${c.port} typ ${c.type}${related}`);
  });
  lines.push(
    "a=end-of-candidates",
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    `a=fingerprint:${hash} ${fingerprint.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(":")}`,
    `a=setup:${setup}`,
    `a=mid:${mid}`,
    "a=sctp-port:5000",
    "a=max-message-size:262144",
  );
  return `${lines.join("\r\n")}\r\n`;
}

// ---------- Addresses ----------

function parseHex(hex) {
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

function formatIpv4(bytes) {
  return bytes.join(".");
}

function parseIpv6(address) {
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const groups = (part) => (part ? part.split(":") : []);
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const all = [...head, ...new Array(missing).fill("0"), ...tail];
  if (!all.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  return all.flatMap((g) => {
    const n = parseInt(g, 16);
    return [n >> 8, n & 255];
  });
}

function formatIpv6(bytes) {
  const groups = [];
  for (let i = 0; i < 16; i += 2) groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
  return groups.join(":");
}

function formatUuid(bytes) {
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------- Bytes ----------

class Writer {
  constructor() {
    this.parts = [];
  }
  u8(n) {
    this.parts.push(n & 255);
  }
  u16(n) {
    this.parts.push((n >> 8) & 255, n & 255);
  }
  bytes(list) {
    list.forEach((b) => this.parts.push(b & 255));
  }
  text(value) {
    const encoded = [...new TextEncoder().encode(String(value))];
    if (encoded.length > 255) throw new Error("A field is too long for an invite code.");
    this.u8(encoded.length);
    this.bytes(encoded);
  }
  finish() {
    return Uint8Array.from(this.parts);
  }
}

class Reader {
  constructor(bytes) {
    this.bytes_ = bytes;
    this.at = 0;
  }
  take(n) {
    if (this.at + n > this.bytes_.length) {
      throw new Error("This invite code is incomplete. Copy the whole code and try again.");
    }
    const slice = this.bytes_.slice(this.at, this.at + n);
    this.at += n;
    return [...slice];
  }
  u8() {
    return this.take(1)[0];
  }
  u16() {
    const [hi, lo] = this.take(2);
    return (hi << 8) | lo;
  }
  bytes(n) {
    return this.take(n);
  }
  text() {
    return new TextDecoder().decode(Uint8Array.from(this.take(this.u8())));
  }
}

function toBase64Url(bytes) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code) {
  const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
  let binary;
  try {
    binary = atob(base64 + "===".slice((base64.length + 3) % 4));
  } catch {
    throw new Error("This is not an invite code.");
  }
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}
