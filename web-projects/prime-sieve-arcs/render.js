// Canvas, timing and DOM glue. All sieve and geometry maths lives in sieve.js.
//
// The whole picture is a function of one number: the seconds elapsed. From that come the
// scanner, every pen, every chip state and the zoom, so the frame is redrawn from scratch
// each time and any moment can be reached directly (see the `at` parameter). The camera
// zooms out to keep 1 on the left and the leading pen near the right edge, which is why
// nothing can be cached: at a new zoom, every arc lands on new pixels.

import {
  primesUpTo,
  hopAt,
  hopInProgress,
  completedHopCount,
  hopArc,
  hopSweep,
  hopWobble,
  pixelsPerUnit,
  projectUnit,
  scannerAt,
  leadAt,
  penAt,
  numberStateAt,
  createTimeline,
  seekTimeline,
  advanceTimeline,
  fadeAlpha,
} from "./sieve.js";

// ---------------------------------------------------------------- settings

const params = new URLSearchParams(location.search);

const readNumber = (name, fallback, min, max) => {
  if (!params.has(name)) return fallback;
  const raw = Number(params.get(name));
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(raw, min), max);
};

const PADDING = (width) => Math.min(Math.max(width * 0.045, 14), 90);

// The camera fits a little less than the leading pen, so the picture is a crop with arcs
// running off the right edge. Early on it holds a minimum span, so the opening shows a
// row of numbers waiting rather than a huge close-up of the first three.
const CAMERA_FILL = 0.92;
const MIN_SPAN = 20;

const SPEED = readNumber("speed", 4, 0.2, 40); // numbers per second for the scanner
const PACE = {
  scanSpeed: SPEED,
  penRatio: readNumber("ratio", 2, 1.05, 6), // pens run this much faster than the scanner
  introSeconds: 0.7, // 2 draws on its own for this long
};

// A sweep to `limit` ends with the leading pen near 2 * limit, so aim for about 26 pixels
// a number by then: the density of the last reference frame, where the digits on the
// primes are still readable. Fixed at load, so a resize rescales the same sweep instead
// of starting a different one.
const autoLimit = () => {
  const width = window.innerWidth;
  const usable = Math.max(width - 2 * PADDING(width), 240);
  return Math.min(Math.max(Math.round(usable / (26 * 2 * CAMERA_FILL)), 18), 400);
};

const LIMIT = Math.round(readNumber("limit", autoLimit(), 8, 1200));
const START_AT = params.has("at") ? readNumber("at", 2, 0, LIMIT) : null; // deep link to one frame
const LOOP = params.get("loop") !== "0";
const HOLD_SECONDS = 3;
const FADE_SECONDS = 0.9; // the fade out at the end of a sweep
const CHIP_FADE = 0.45; // how long a chip takes to change look
// How much flatter than a half circle a hop is drawn. It keeps both ends exactly on their
// numbers while the ends tilt off vertical, so two hops meet at a small corner instead of
// a step. The reference frames show that corner; hopWobble varies it hop by hop.
const BULGE = 0.004;

// Sampled from the reference frames: warm lines, white chips for numbers still in play,
// amber for a prime that has started hopping, a bare ring for one that is crossed out.
const COLORS = {
  space: "#050505",
  axis: "rgba(190, 196, 214, 0.1)",
  halo: "rgba(190, 74, 16, 0.06)",
  strand: "rgba(216, 106, 24, 0.62)",
  core: "rgba(246, 210, 128, 1)",
  tip: "rgba(255, 244, 196, 1)",
  chipInk: "#12161d",
  chipFace: "#f3f5f9",
  primeFace: "#eeb04a",
  primeInk: "#2a1605",
  ring: "rgba(226, 233, 246, 0.5)",
};

// ---------------------------------------------------------------- state

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const background = document.createElement("canvas");

const TIMELINE = {
  limit: LIMIT,
  loop: LOOP,
  holdSeconds: HOLD_SECONDS,
  fadeSeconds: FADE_SECONDS,
  pace: PACE,
};

const primes = primesUpTo(LIMIT);
let timeline = createTimeline();
let paused = false;
let lastTimestamp = null;

const view = { width: 0, height: 0, dpr: 1, ppu: 1, padding: 0, axisY: 0 };

// ---------------------------------------------------------------- layout

function sizeLayer(layer) {
  layer.width = Math.round(view.width * view.dpr);
  layer.height = Math.round(view.height * view.dpr);
  const c = layer.getContext("2d");
  c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  return c;
}

function layout() {
  view.width = window.innerWidth;
  view.height = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  view.padding = PADDING(view.width);
  view.axisY = Math.round(view.height * 0.52);

  sizeLayer(canvas);
  paintBackground(sizeLayer(background));
}

/** Set the zoom for this frame: 1 stays put on the left, the lead sits near the edge. */
function aimCamera(lead) {
  const span = Math.max(MIN_SPAN, lead * CAMERA_FILL);
  view.ppu = pixelsPerUnit(view.width, span, view.padding);
}

const x = (unit) => projectUnit(unit, view.ppu, view.padding);
const lastVisibleNumber = () => Math.ceil((view.width - view.padding) / view.ppu) + 1;

// ---------------------------------------------------------------- background

function paintBackground(c) {
  c.fillStyle = COLORS.space;
  c.fillRect(0, 0, view.width, view.height);

  // dust, so the black is not flat
  const tile = document.createElement("canvas");
  tile.width = tile.height = 220;
  const tc = tile.getContext("2d");
  const image = tc.createImageData(tile.width, tile.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const speck = Math.random() < 0.05 ? 10 + Math.random() * 26 : 0;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = speck;
    image.data[i + 3] = speck > 0 ? 255 : 0;
  }
  tc.putImageData(image, 0, 0);
  c.globalAlpha = 0.5;
  c.fillStyle = c.createPattern(tile, "repeat");
  c.fillRect(0, 0, view.width, view.height);
  c.globalAlpha = 1;

  for (let i = 0; i < 26; i++) {
    const mx = Math.random() * view.width;
    const my = Math.random() * view.height;
    const r = 30 + Math.random() * 90;
    const mote = c.createRadialGradient(mx, my, 0, mx, my, r);
    mote.addColorStop(0, "rgba(255, 255, 255, 0.022)");
    mote.addColorStop(1, "rgba(255, 255, 255, 0)");
    c.fillStyle = mote;
    c.fillRect(mx - r, my - r, r * 2, r * 2);
  }

  const vignette = c.createRadialGradient(
    view.width / 2, view.axisY, Math.min(view.width, view.height) * 0.22,
    view.width / 2, view.axisY, Math.max(view.width, view.height) * 0.78,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, view.width, view.height);

  c.fillStyle = COLORS.axis;
  c.fillRect(0, view.axisY, view.width, 1);
}

/** A soft round glow, drawn once and then stretched to whatever size a chip needs. */
function glowSprite(inner) {
  const size = 128;
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = size;
  const c = sprite.getContext("2d");
  const halo = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  halo.addColorStop(0, inner);
  halo.addColorStop(0.32, inner);
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.fillStyle = halo;
  c.fillRect(0, 0, size, size);
  return sprite;
}

const GLOW = {
  unknown: glowSprite("rgba(206, 220, 248, 0.16)"),
  prime: glowSprite("rgba(240, 176, 74, 0.18)"),
  crossed: glowSprite("rgba(198, 214, 246, 0.1)"),
};

// ---------------------------------------------------------------- painting

/** Draw one hop, up to `clipTo`. Returns the pen point, or null if it has not started. */
function strokeHop(c, hop, clipTo, prime, index) {
  const bulge = BULGE * (0.6 + 0.4 * hopWobble(prime, index));
  const sweep = hopSweep(hop, clipTo, bulge);
  if (!sweep) return null;
  const { center, radius, offset } = hopArc(hop, bulge);
  const cx = x(center);
  const r = radius * view.ppu;
  // the centre sits on the far side of the line, which tilts the ends and makes the kink
  const cy = view.axisY + (hop.side === "above" ? offset : -offset) * view.ppu;

  c.save();
  c.globalCompositeOperation = "lighter";
  c.lineCap = "round";
  // [colour, line width, sideways shift]: the shift splits the strand from the core, the
  // way the reference frames show two tones side by side. It has to be a shift across the
  // screen, not along the radius, or the strand would jump sides where a hop crosses the
  // number line and break the join.
  const passes = [
    [COLORS.halo, 8, 0, 0],
    [COLORS.strand, 1.5, 1.9, 1.2],
    [COLORS.core, 1.4, 0, 0],
  ];
  for (const [color, width, dx, dy] of passes) {
    c.beginPath();
    c.arc(cx + dx, cy + dy, Math.max(r, 0.5), sweep.start, sweep.end, sweep.anticlockwise);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  c.restore();
  return { px: cx + (r + 1) * Math.cos(sweep.end), py: cy + (r + 1) * Math.sin(sweep.end) };
}

function drawTip(c, point) {
  c.save();
  c.globalCompositeOperation = "lighter";
  const halo = c.createRadialGradient(point.px, point.py, 0, point.px, point.py, 9);
  halo.addColorStop(0, "rgba(255, 244, 196, 0.6)");
  halo.addColorStop(1, "rgba(255, 244, 196, 0)");
  c.fillStyle = halo;
  c.fillRect(point.px - 9, point.py - 9, 18, 18);
  c.beginPath();
  c.arc(point.px, point.py, 1.5, 0, Math.PI * 2);
  c.fillStyle = COLORS.tip;
  c.fill();
  c.restore();
}

function chipRadius() {
  return Math.min(Math.max(view.ppu * 0.4, 2.5), 44);
}

function drawGlow(c, sprite, px, r, alpha) {
  if (alpha <= 0.01) return;
  const reach = r * 2.1;
  c.save();
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = alpha;
  c.drawImage(sprite, px - reach, view.axisY - reach, reach * 2, reach * 2);
  c.restore();
}

function drawFace(c, px, r, fill, alpha) {
  if (alpha <= 0.01) return;
  c.save();
  c.globalAlpha = alpha;
  c.beginPath();
  c.arc(px, view.axisY, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  c.restore();
}

function drawDigits(c, n, px, r, ink, alpha) {
  if (alpha <= 0.01) return;
  const digits = String(n).length;
  const size = (r * 1.85) / (digits + 0.65);
  if (size < 5.5) return;
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = ink;
  c.font = `${Math.round(size)}px Georgia, "Times New Roman", serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(String(n), px, view.axisY + size * 0.06);
  c.restore();
}

/**
 * Every number carries a chip. It starts white with its digits on, turns amber when its
 * own chain leaves, and empties out to a bare ring once a hop lands on it.
 */
function drawChip(c, n, look) {
  const r = chipRadius();
  const px = x(n);
  const fade = look.fade;

  if (look.state === "crossed") {
    drawGlow(c, GLOW.crossed, px, r, 1);
    drawFace(c, px, r, COLORS.chipFace, 1 - fade);
    drawDigits(c, n, px, r, COLORS.chipInk, 1 - fade);
    c.save();
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = 0.35 + 0.65 * fade;
    c.beginPath();
    c.arc(px, view.axisY, r, 0, Math.PI * 2);
    c.strokeStyle = COLORS.ring;
    c.lineWidth = Math.max(r * 0.1, 1);
    c.stroke();
    c.restore();
    return;
  }

  if (look.state === "prime") {
    drawGlow(c, GLOW.unknown, px, r, 1 - fade);
    drawGlow(c, GLOW.prime, px, r, fade);
    drawFace(c, px, r, COLORS.chipFace, 1 - fade);
    drawFace(c, px, r, COLORS.primeFace, fade);
    drawDigits(c, n, px, r, COLORS.chipInk, 1 - fade);
    drawDigits(c, n, px, r, COLORS.primeInk, fade);
    return;
  }

  drawGlow(c, GLOW.unknown, px, r, 1);
  drawFace(c, px, r, COLORS.chipFace, 1);
  drawDigits(c, n, px, r, COLORS.chipInk, 1);
}

// ---------------------------------------------------------------- frame

function draw() {
  const t = timeline.elapsed;
  const scanner = timeline.frontier;
  aimCamera(leadAt(t, PACE));

  ctx.clearRect(0, 0, view.width, view.height);
  ctx.drawImage(background, 0, 0, view.width, view.height);

  const edge = lastVisibleNumber();

  for (const p of primes) {
    if (p > scanner) break;
    const pen = penAt(p, t, PACE);
    if (pen === null) continue;

    const done = completedHopCount(p, pen);
    for (let k = 0; k < done; k++) {
      const hop = hopAt(p, k);
      if (hop.from > edge) break;
      strokeHop(ctx, hop, hop.to, p, k);
    }

    const growing = hopInProgress(p, pen);
    if (growing && growing.from <= edge) {
      const tip = strokeHop(ctx, growing, pen, p, done);
      if (tip) drawTip(ctx, tip);
    }
  }

  for (let n = 1; n <= edge; n++) drawChip(ctx, n, numberStateAt(n, t, PACE, CHIP_FADE));

  const fade = fadeAlpha(timeline, FADE_SECONDS);
  if (fade > 0) {
    ctx.fillStyle = `rgba(5, 5, 5, ${fade})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
}

function frame(timestamp) {
  const dt = lastTimestamp === null ? 0 : Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;
  // real elapsed time, not a fixed step: this is a clock-driven animation
  if (!paused) timeline = advanceTimeline(timeline, dt, TIMELINE);
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- controls

const hud = {
  number: document.getElementById("hud-number"),
  count: document.getElementById("hud-count"),
  latest: document.getElementById("hud-latest"),
};
const playButton = document.getElementById("play");
const restartButton = document.getElementById("restart");
const hudShown = { number: -1, count: -1 };

function updateHud() {
  const reached = Math.floor(timeline.frontier);
  if (reached === hudShown.number) return;
  hudShown.number = reached;
  hud.number.textContent = String(reached);
  const found = primes.filter((p) => p <= timeline.frontier);
  if (found.length !== hudShown.count) {
    hudShown.count = found.length;
    hud.count.textContent = String(found.length);
    hud.latest.textContent = found.length ? String(found.at(-1)) : "--";
  }
}

function setPaused(value) {
  paused = value;
  playButton.textContent = paused ? "Play" : "Pause";
  playButton.setAttribute("aria-label", paused ? "Play the animation" : "Pause the animation");
  document.body.classList.toggle("is-paused", paused);
}

playButton.addEventListener("click", () => setPaused(!paused));
restartButton.addEventListener("click", () => {
  timeline = createTimeline();
  setPaused(false);
});
canvas.addEventListener("pointerdown", () => setPaused(!paused));
window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === " ") {
    event.preventDefault();
    setPaused(!paused);
  }
  if (event.key.toLowerCase() === "r") {
    timeline = createTimeline();
    setPaused(false);
  }
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layout, 120);
});

// ---------------------------------------------------------------- start

layout();
setPaused(false);

if (START_AT !== null) {
  timeline = seekTimeline(START_AT, TIMELINE);
  setPaused(true);
} else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // Show the finished picture instead of animating towards it.
  timeline = seekTimeline(LIMIT, TIMELINE);
  setPaused(true);
}

requestAnimationFrame(frame);
