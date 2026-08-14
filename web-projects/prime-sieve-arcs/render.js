// Canvas, timing and DOM glue. All sieve and geometry maths lives in sieve.js.
//
// Three layers stack up every frame:
//   background (repainted on resize)  -> dust and vignette
//   glow       (light painting)       -> the violet halo under every prime
//   trail      (light painting)       -> every hop that already landed
// The live layer draws straight on the visible canvas: the hops still growing, their
// pen tips, and the number chips. Light painting keeps the cost per frame flat: a
// finished hop is stroked once and never again.

import {
  primesUpTo,
  hopAt,
  hopInProgress,
  completedHopCount,
  hopArc,
  hopSweep,
  pixelsPerUnit,
  projectUnit,
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

// The camera fits a little less than the whole sweep, so the sieve front runs off the
// right edge before the end and the finished picture is a crop, like the reference frame.
const CAMERA_FILL = 0.93;

const PADDING = (width) => Math.min(Math.max(width * 0.045, 14), 90);

// The reference frame gives a number about 22 pixels of room. Keep that scale on every
// screen and let the sweep length follow the window, so the picture always looks the
// same and only runs shorter on a small screen. The sweep length is fixed at load: a
// resize rescales the same sweep instead of starting a different one.
const autoLimit = () => {
  const width = window.innerWidth;
  const usable = Math.max(width - 2 * PADDING(width), 240);
  return Math.min(Math.max(Math.round(usable / 22 / CAMERA_FILL), 24), 400);
};

const LIMIT = Math.round(readNumber("limit", autoLimit(), 12, 1200));
const START_AT = params.has("at") ? readNumber("at", 0, 0, LIMIT) : null; // deep link to one frame
const SPEED = readNumber("speed", 4, 0.2, 60); // numbers per second
const LOOP = params.get("loop") !== "0";
const HOLD_SECONDS = 3; // pause on the finished picture before looping
const FADE_SECONDS = 0.9;

// Sampled from the reference frame, pixel by pixel: a pale yellow-green core with a
// red-orange strand beside it, over a violet halo on the number line.
const COLORS = {
  space: "#050505",
  axis: "rgba(150, 120, 150, 0.16)",
  haloWide: "rgba(190, 58, 14, 0.07)",
  strand: "rgba(214, 88, 22, 0.5)",
  core: "rgba(226, 228, 132, 0.72)",
  tip: "rgba(246, 246, 190, 1)",
  chipFill: "#e69b29",
  chipRing: "rgba(236, 201, 77, 0.95)",
  chipText: "#2a1605",
  oneFill: "#f2f5fb",
  oneRing: "rgba(159, 180, 208, 0.95)",
  oneText: "#17202b",
};

// ---------------------------------------------------------------- state

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const background = document.createElement("canvas");
const glow = document.createElement("canvas");
const trail = document.createElement("canvas");

const TIMELINE = {
  speed: SPEED,
  limit: LIMIT,
  loop: LOOP,
  holdSeconds: HOLD_SECONDS,
  fadeSeconds: FADE_SECONDS,
};

const primes = primesUpTo(LIMIT);
const drawnHops = new Map(); // prime -> hops already stamped on the trail layer
let sparks = []; // brief flashes where a hop lands on a composite
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
  view.ppu = pixelsPerUnit(view.width, LIMIT * CAMERA_FILL, view.padding);
  view.axisY = Math.round(view.height * 0.53);

  sizeLayer(canvas);
  sizeLayer(glow);
  sizeLayer(trail);
  paintBackground(sizeLayer(background));
  replay();
}

const x = (unit) => projectUnit(unit, view.ppu, view.padding);

// ---------------------------------------------------------------- background

function dustPattern(c) {
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
  return c.createPattern(tile, "repeat");
}

function paintBackground(c) {
  c.fillStyle = COLORS.space;
  c.fillRect(0, 0, view.width, view.height);

  c.globalAlpha = 0.5;
  c.fillStyle = dustPattern(c);
  c.fillRect(0, 0, view.width, view.height);
  c.globalAlpha = 1;

  // a few soft motes, like specks of dust caught in the light
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

// ---------------------------------------------------------------- painting

function strokeHop(c, hop, clipTo) {
  const sweep = hopSweep(hop, clipTo);
  if (!sweep) return null;
  const { center, radius } = hopArc(hop);
  const cx = x(center);
  const r = radius * view.ppu;

  c.save();
  c.globalCompositeOperation = "lighter";
  c.lineCap = "round";
  // [colour, line width, radius offset]: the offset splits the strand from the core,
  // which is what gives the reference frame its two-tone look.
  const passes = [
    [COLORS.haloWide, 9, 0],
    [COLORS.strand, 1.5, 2.2],
    [COLORS.core, 1.35, 0],
  ];
  for (const [color, width, dr] of passes) {
    c.beginPath();
    c.arc(cx, view.axisY, Math.max(r + dr, 0.5), sweep.start, sweep.end, sweep.anticlockwise);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  c.restore();
  return { cx, r, endAngle: sweep.end };
}

// Stops traced from the reference frame: the violet halo keeps a long, slow tail
// instead of fading straight to black, which is what welds the halos into one band.
const PRIME_GLOW_STOPS = [
  [0, "rgba(236, 190, 246, 0.72)"],
  [0.13, "rgba(230, 148, 230, 0.44)"],
  [0.19, "rgba(222, 142, 226, 0.31)"],
  [0.25, "rgba(214, 136, 220, 0.24)"],
  [0.33, "rgba(200, 128, 208, 0.16)"],
  [0.6, "rgba(180, 116, 190, 0.095)"],
  [0.8, "rgba(160, 104, 172, 0.05)"],
  [1, "rgba(140, 92, 156, 0)"],
];

function stampPrimeGlow(c, unit) {
  const r = Math.max(view.ppu * 4, 44);
  const px = x(unit);
  const halo = c.createRadialGradient(px, view.axisY, 0, px, view.axisY, r);
  for (const [stop, color] of PRIME_GLOW_STOPS) halo.addColorStop(stop, color);
  c.save();
  c.globalCompositeOperation = "lighter";
  c.fillStyle = halo;
  c.fillRect(px - r, view.axisY - r, r * 2, r * 2);
  c.restore();
}

function chipRadius() {
  return Math.min(Math.max(view.ppu * 0.44, 6), 13);
}

function drawChip(c, n, first) {
  const r = chipRadius();
  const px = x(n);
  c.save();
  c.beginPath();
  c.arc(px, view.axisY, r, 0, Math.PI * 2);
  c.fillStyle = first ? COLORS.oneFill : COLORS.chipFill;
  c.fill();
  c.lineWidth = 1.2;
  c.strokeStyle = first ? COLORS.oneRing : COLORS.chipRing;
  c.stroke();
  if (r >= 6) {
    // Keep long labels inside the chip: the more digits, the smaller the type.
    const digits = String(n).length;
    const size = Math.max(Math.round((r * 1.9) / (digits + 0.8)), 7);
    c.fillStyle = first ? COLORS.oneText : COLORS.chipText;
    c.font = `700 ${size}px ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(String(n), px, view.axisY + 0.5);
  }
  c.restore();
}

function drawTip(c, cx, r, angle) {
  const px = cx + r * Math.cos(angle);
  const py = view.axisY + r * Math.sin(angle);
  c.save();
  c.globalCompositeOperation = "lighter";
  const halo = c.createRadialGradient(px, py, 0, px, py, 8);
  halo.addColorStop(0, "rgba(246, 246, 190, 0.6)");
  halo.addColorStop(1, "rgba(246, 246, 190, 0)");
  c.fillStyle = halo;
  c.fillRect(px - 8, py - 8, 16, 16);
  c.beginPath();
  c.arc(px, py, 1.4, 0, Math.PI * 2);
  c.fillStyle = COLORS.tip;
  c.fill();
  c.restore();
}

function drawSparks(c) {
  c.save();
  c.globalCompositeOperation = "lighter";
  for (const spark of sparks) {
    const r = 4 + 16 * (1 - spark.life);
    const px = x(spark.unit);
    const halo = c.createRadialGradient(px, view.axisY, 0, px, view.axisY, r);
    halo.addColorStop(0, `rgba(255, 214, 132, ${0.5 * spark.life})`);
    halo.addColorStop(1, "rgba(255, 214, 132, 0)");
    c.fillStyle = halo;
    c.fillRect(px - r, view.axisY - r, r * 2, r * 2);
  }
  c.restore();
}

// ---------------------------------------------------------------- sieve progress

/** Stamp every hop and prime halo that the frontier has already passed. */
function catchUp(withSparks) {
  const frontier = timeline.frontier;
  for (const p of primes) {
    if (p > frontier) break;
    let drawn = drawnHops.get(p);
    if (drawn === undefined) {
      drawn = 0;
      drawnHops.set(p, 0);
      stampPrimeGlow(glow.getContext("2d"), p);
    }
    const done = completedHopCount(p, frontier);
    const trailCtx = trail.getContext("2d");
    for (; drawn < done; drawn++) {
      const hop = hopAt(p, drawn);
      strokeHop(trailCtx, hop, hop.to);
      if (withSparks) sparks.push({ unit: hop.to, life: 1 });
    }
    drawnHops.set(p, drawn);
  }
}

/** Rebuild both light-painting layers from scratch, for a resize or a restart. */
function replay() {
  glow.getContext("2d").clearRect(0, 0, view.width, view.height);
  trail.getContext("2d").clearRect(0, 0, view.width, view.height);
  drawnHops.clear();
  stampPrimeGlow(glow.getContext("2d"), 1);
  catchUp(false);
}

/** Jump the sieve straight to a number, with no flashes left over from the way there. */
function seek(unit) {
  timeline = seekTimeline(unit, TIMELINE);
  sparks = [];
  replay();
}

function restart() {
  seek(0);
}

// ---------------------------------------------------------------- frame

function update(dt) {
  if (paused) return;

  for (const spark of sparks) spark.life -= dt / 0.55;
  if (sparks.length) sparks = sparks.filter((s) => s.life > 0);

  const before = timeline;
  timeline = advanceTimeline(timeline, dt, TIMELINE);
  if (timeline.frontier < before.frontier) {
    // the loop came round again
    sparks = [];
    replay();
    return;
  }
  if (timeline.phase === "sweeping" || timeline.frontier > before.frontier) catchUp(true);
}

function draw() {
  const frontier = timeline.frontier;
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.drawImage(background, 0, 0, view.width, view.height);
  ctx.drawImage(glow, 0, 0, view.width, view.height);
  ctx.drawImage(trail, 0, 0, view.width, view.height);

  drawSparks(ctx);

  for (const p of primes) {
    if (p > frontier) break;
    const hop = hopInProgress(p, frontier);
    if (!hop) continue;
    const drawn = strokeHop(ctx, hop, frontier);
    if (drawn) drawTip(ctx, drawn.cx, drawn.r, drawn.endAngle);
  }

  drawChip(ctx, 1, true);
  for (const p of primes) {
    if (p > frontier) break;
    drawChip(ctx, p, false);
  }

  const fade = fadeAlpha(timeline, FADE_SECONDS);
  if (fade > 0) {
    ctx.fillStyle = `rgba(5, 5, 5, ${fade})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
}

function frame(timestamp) {
  const dt = lastTimestamp === null ? 0 : Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;
  update(dt); // real elapsed time, not a fixed step: this is a clock-driven animation
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
let hudShown = { number: -1, count: -1 };

function updateHud() {
  const frontier = timeline.frontier;
  const reached = Math.floor(frontier);
  if (reached === hudShown.number) return;
  hudShown.number = reached;
  hud.number.textContent = String(reached);
  const found = primes.filter((p) => p <= frontier);
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
  restart();
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
    restart();
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
  seek(START_AT);
  setPaused(true);
} else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // Show the finished picture instead of animating towards it.
  seek(LIMIT);
  setPaused(true);
}

requestAnimationFrame(frame);
