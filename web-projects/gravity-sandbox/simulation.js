// ---------------------------------------------------------------------------
//  Gravity Sandbox – N-body gravitational simulation
// ---------------------------------------------------------------------------

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// ── State ──────────────────────────────────────────────────────────────────
let bodies = [];
let paused = false;
let showTrails = true;
let trailCanvas, trailCtx;
const G = 800;                 // gravitational constant (tuned for feel)
const MERGE_OVERLAP = 0.6;     // merge when overlap exceeds this fraction
const DT = 1 / 60;
const MAX_BODIES = 300;

// ── Color palette ──────────────────────────────────────────────────────────
const COLORS = [
  "#ff6b6b", "#ffa06b", "#ffd96b", "#6bffa0",
  "#6bd9ff", "#6b8aff", "#c06bff", "#ff6bc0",
  "#ff9e9e", "#9ed5ff", "#b0ffcf", "#ffe09e",
];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// ── Body factory ───────────────────────────────────────────────────────────
function createBody(x, y, vx, vy, mass) {
  return {
    x, y, vx, vy,
    mass,
    radius: massToRadius(mass),
    color: randomColor(),
    trail: [],
  };
}

function massToRadius(m) {
  return Math.max(3, Math.pow(m, 0.45) * 2.2);
}

// ── Canvas sizing ──────────────────────────────────────────────────────────
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Recreate trail canvas on resize
  trailCanvas = document.createElement("canvas");
  trailCanvas.width = canvas.width;
  trailCanvas.height = canvas.height;
  trailCtx = trailCanvas.getContext("2d");
  trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
resize();

// ── Physics step ───────────────────────────────────────────────────────────
function step(dt) {
  if (paused) return;

  // Gravitational acceleration
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    let ax = 0, ay = 0;
    for (let j = 0; j < bodies.length; j++) {
      if (i === j) continue;
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      const softened = distSq + 100; // softening to prevent singularity
      const dist = Math.sqrt(softened);
      const force = G * b.mass / softened;
      ax += force * dx / dist;
      ay += force * dy / dist;
    }
    a.vx += ax * dt;
    a.vy += ay * dt;
  }

  // Integrate positions
  for (const b of bodies) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }

  // Merge overlapping bodies
  mergePass();

  // Record trails
  if (showTrails) {
    for (const b of bodies) {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 120) b.trail.shift();
    }
  }
}

function mergePass() {
  const merged = new Set();
  for (let i = 0; i < bodies.length; i++) {
    if (merged.has(i)) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      if (merged.has(j)) continue;
      const a = bodies[i];
      const b = bodies[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = (a.radius + b.radius) * MERGE_OVERLAP;
      if (dist < minDist) {
        // Conservation of momentum
        const totalMass = a.mass + b.mass;
        a.vx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
        a.vy = (a.vy * a.mass + b.vy * b.mass) / totalMass;
        // Weighted position
        a.x = (a.x * a.mass + b.x * b.mass) / totalMass;
        a.y = (a.y * a.mass + b.y * b.mass) / totalMass;
        a.mass = totalMass;
        a.radius = massToRadius(a.mass);
        // Keep color of the heavier body (already a)
        merged.add(j);
      }
    }
  }
  if (merged.size > 0) {
    bodies = bodies.filter((_, i) => !merged.has(i));
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────
function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Fade background
  ctx.fillStyle = "rgba(10, 10, 26, 0.35)";
  ctx.fillRect(0, 0, w, h);

  // Trails
  if (showTrails) {
    for (const b of bodies) {
      const trail = b.trail;
      if (trail.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = Math.max(1, b.radius * 0.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Bodies
  for (const b of bodies) {
    // Glow
    const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 3);
    gradient.addColorStop(0, b.color + "40");
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Drag arrow
  if (dragging && dragStart && dragCurrent) {
    const dx = dragStart.x - dragCurrent.x;
    const dy = dragStart.y - dragCurrent.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 5) {
      ctx.beginPath();
      ctx.moveTo(dragStart.x, dragStart.y);
      ctx.lineTo(dragStart.x + dx, dragStart.y + dy);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Preview body
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(dragStart.x, dragStart.y, massToRadius(currentMass), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Body count
  bodyCountEl.textContent = bodies.length > 0 ? `${bodies.length} bod${bodies.length === 1 ? "y" : "ies"}` : "";
}

// ── Input handling ─────────────────────────────────────────────────────────
let dragging = false;
let dragStart = null;
let dragCurrent = null;
let currentMass = 20;

const massSlider = document.getElementById("mass-slider");
const massValue = document.getElementById("mass-value");
const bodyCountEl = document.getElementById("body-count");
const hintEl = document.getElementById("hint");

massSlider.addEventListener("input", () => {
  currentMass = parseInt(massSlider.value, 10);
  massValue.textContent = currentMass;
});

function getPointerPos(e) {
  if (e.touches) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function isUIElement(e) {
  const target = e.target;
  return target.closest("#top-bar") || target.closest("#mass-slider-container");
}

function onPointerDown(e) {
  if (isUIElement(e)) return;
  e.preventDefault();
  dragging = true;
  dragStart = getPointerPos(e);
  dragCurrent = { ...dragStart };
  // Hide hint after first interaction
  hintEl.style.opacity = "0";
}

function onPointerMove(e) {
  if (!dragging) return;
  e.preventDefault();
  dragCurrent = getPointerPos(e);
}

function onPointerUp(e) {
  if (!dragging) return;
  e.preventDefault();
  dragging = false;

  if (bodies.length >= MAX_BODIES) return;

  const end = e.changedTouches
    ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    : { x: e.clientX, y: e.clientY };

  // Velocity from drag direction (launch opposite to drag, like a slingshot)
  const vx = (dragStart.x - end.x) * 2.5;
  const vy = (dragStart.y - end.y) * 2.5;

  bodies.push(createBody(dragStart.x, dragStart.y, vx, vy, currentMass));
  dragStart = null;
  dragCurrent = null;
}

canvas.addEventListener("mousedown", onPointerDown);
canvas.addEventListener("mousemove", onPointerMove);
canvas.addEventListener("mouseup", onPointerUp);
canvas.addEventListener("touchstart", onPointerDown, { passive: false });
canvas.addEventListener("touchmove", onPointerMove, { passive: false });
canvas.addEventListener("touchend", onPointerUp, { passive: false });

// ── UI Buttons ─────────────────────────────────────────────────────────────
document.getElementById("btn-clear").addEventListener("click", () => {
  bodies = [];
  // Clear trail canvas
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
});

const btnPause = document.getElementById("btn-pause");
btnPause.addEventListener("click", () => {
  paused = !paused;
  btnPause.textContent = paused ? "Play" : "Pause";
});

const btnTrails = document.getElementById("btn-trails");
btnTrails.addEventListener("click", () => {
  showTrails = !showTrails;
  btnTrails.textContent = showTrails ? "Trails: On" : "Trails: Off";
  if (!showTrails) {
    for (const b of bodies) b.trail = [];
  }
});

document.getElementById("btn-preset").addEventListener("click", loadPreset);

// ── Presets ────────────────────────────────────────────────────────────────
const presets = [orbitalSystem, binaryStars, asteroidField, figureEight];
let presetIndex = 0;

function loadPreset() {
  bodies = [];
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  presets[presetIndex]();
  presetIndex = (presetIndex + 1) % presets.length;
  if (paused) {
    paused = false;
    btnPause.textContent = "Pause";
  }
}

function orbitalSystem() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  bodies.push(createBody(cx, cy, 0, 0, 100));

  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i;
    const r = 100 + i * 40;
    const speed = Math.sqrt(G * 100 / r) * 0.75;
    bodies.push(createBody(
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
      -Math.sin(angle) * speed,
      Math.cos(angle) * speed,
      3 + Math.random() * 6
    ));
  }
}

function binaryStars() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const sep = 80;
  const speed = Math.sqrt(G * 60 / (sep * 2)) * 0.6;
  bodies.push(createBody(cx - sep, cy, 0, -speed, 60));
  bodies.push(createBody(cx + sep, cy, 0, speed, 60));

  // A few orbiting particles
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 200 + Math.random() * 100;
    const orbitSpeed = Math.sqrt(G * 120 / r) * 0.5;
    bodies.push(createBody(
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
      -Math.sin(angle) * orbitSpeed,
      Math.cos(angle) * orbitSpeed,
      1 + Math.random() * 3
    ));
  }
}

function asteroidField() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const count = 40;
  for (let i = 0; i < count; i++) {
    const x = cx + (Math.random() - 0.5) * 500;
    const y = cy + (Math.random() - 0.5) * 400;
    const vx = (Math.random() - 0.5) * 40;
    const vy = (Math.random() - 0.5) * 40;
    bodies.push(createBody(x, y, vx, vy, 3 + Math.random() * 12));
  }
}

function figureEight() {
  // Three-body figure-eight solution (approximate)
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const mass = 40;
  const scale = 100;
  const vScale = 180;

  bodies.push(createBody(cx - scale, cy, 0.347 * vScale, 0.533 * vScale, mass));
  bodies.push(createBody(cx + scale, cy, 0.347 * vScale, 0.533 * vScale, mass));
  bodies.push(createBody(cx, cy, -0.694 * vScale, -1.066 * vScale, mass));
}

// ── Game loop ──────────────────────────────────────────────────────────────
function loop() {
  step(DT);
  draw();
  requestAnimationFrame(loop);
}

// Start with a preset so the canvas isn't empty
orbitalSystem();
loop();
