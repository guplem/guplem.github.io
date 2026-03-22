// ---------------------------------------------------------------------------
//  Gravity Sandbox – N-body gravitational simulation
// ---------------------------------------------------------------------------

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// ── State ──────────────────────────────────────────────────────────────────
let bodies = [];
let particles = [];       // merge/spawn explosion particles
let paused = false;
let showTrails = true;
let starCanvas, starCtx;  // pre-rendered starfield
const G = 800;
const MERGE_OVERLAP = 0.6;
const DT = 1 / 60;
const MAX_BODIES = 300;
const MAX_PARTICLES = 600;

// ── Color palette (HSL-based for richer blending) ──────────────────────────
const PALETTE = [
  { h: 0,   s: 100, l: 72 },  // red
  { h: 25,  s: 100, l: 72 },  // orange
  { h: 45,  s: 100, l: 72 },  // gold
  { h: 150, s: 100, l: 72 },  // mint
  { h: 195, s: 100, l: 72 },  // cyan
  { h: 225, s: 100, l: 72 },  // blue
  { h: 270, s: 80,  l: 72 },  // purple
  { h: 330, s: 100, l: 72 },  // pink
];

function randomPalette() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function hsl(h, s, l, a) {
  return a !== undefined
    ? `hsla(${h}, ${s}%, ${l}%, ${a})`
    : `hsl(${h}, ${s}%, ${l}%)`;
}

// ── Body factory ───────────────────────────────────────────────────────────
function createBody(x, y, vx, vy, mass, skipSpawnEffect) {
  const col = randomPalette();
  const body = {
    x, y, vx, vy,
    mass,
    radius: massToRadius(mass),
    col,                            // HSL object
    trail: [],
    spawnTime: performance.now(),   // for spawn pulse
  };
  if (!skipSpawnEffect) {
    emitParticles(x, y, col, 8, 80, 1.5);
  }
  return body;
}

function massToRadius(m) {
  return Math.max(3, Math.pow(m, 0.45) * 2.2);
}

// ── Particle system (explosions, spawns) ───────────────────────────────────
function emitParticles(x, y, col, count, speed, life) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life,
      maxLife: life,
      col,
      size: 1.5 + Math.random() * 2.5,
    });
  }
  // Cap particles
  if (particles.length > MAX_PARTICLES) {
    particles.splice(0, particles.length - MAX_PARTICLES);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// ── Starfield ──────────────────────────────────────────────────────────────
function generateStarfield() {
  const dpr = window.devicePixelRatio || 1;
  starCanvas = document.createElement("canvas");
  starCanvas.width = window.innerWidth * dpr;
  starCanvas.height = window.innerHeight * dpr;
  starCtx = starCanvas.getContext("2d");
  starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = window.innerWidth;
  const h = window.innerHeight;

  // Deep space background
  starCtx.fillStyle = "#06060f";
  starCtx.fillRect(0, 0, w, h);

  // Subtle nebula clouds
  for (let i = 0; i < 4; i++) {
    const nx = Math.random() * w;
    const ny = Math.random() * h;
    const nr = 150 + Math.random() * 250;
    const nebHue = [220, 280, 200, 340][i];
    const grad = starCtx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    grad.addColorStop(0, `hsla(${nebHue}, 60%, 20%, 0.08)`);
    grad.addColorStop(0.5, `hsla(${nebHue}, 50%, 15%, 0.04)`);
    grad.addColorStop(1, "transparent");
    starCtx.fillStyle = grad;
    starCtx.fillRect(0, 0, w, h);
  }

  // Stars in layers
  const starLayers = [
    { count: 200, maxSize: 0.8, maxAlpha: 0.3 },  // distant
    { count: 100, maxSize: 1.2, maxAlpha: 0.5 },   // mid
    { count: 40,  maxSize: 2.0, maxAlpha: 0.9 },   // close
  ];

  for (const layer of starLayers) {
    for (let i = 0; i < layer.count; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h;
      const sr = Math.random() * layer.maxSize + 0.3;
      const alpha = Math.random() * layer.maxAlpha + 0.1;

      // Some bright stars get a subtle color tint
      const tinted = Math.random() > 0.7;
      const starHue = tinted ? [200, 220, 40, 10][Math.floor(Math.random() * 4)] : 0;
      const starSat = tinted ? 40 : 0;

      starCtx.globalAlpha = alpha;
      starCtx.fillStyle = hsl(starHue, starSat, 95);
      starCtx.beginPath();
      starCtx.arc(sx, sy, sr, 0, Math.PI * 2);
      starCtx.fill();

      // Bright stars get a cross-shaped diffraction spike
      if (sr > 1.4 && alpha > 0.6) {
        starCtx.globalAlpha = alpha * 0.3;
        starCtx.strokeStyle = hsl(starHue, starSat, 90);
        starCtx.lineWidth = 0.5;
        const spikeLen = sr * 4;
        starCtx.beginPath();
        starCtx.moveTo(sx - spikeLen, sy);
        starCtx.lineTo(sx + spikeLen, sy);
        starCtx.moveTo(sx, sy - spikeLen);
        starCtx.lineTo(sx, sy + spikeLen);
        starCtx.stroke();
      }
    }
  }
  starCtx.globalAlpha = 1;
}

// ── Canvas sizing ──────────────────────────────────────────────────────────
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  generateStarfield();
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
      const softened = distSq + 100;
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
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      b.trail.push({ x: b.x, y: b.y, speed });
      if (b.trail.length > 180) b.trail.shift();
    }
  }

  // Update particles
  updateParticles(dt);
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
        const totalMass = a.mass + b.mass;
        // Merge position & velocity
        const mx = (a.x * a.mass + b.x * b.mass) / totalMass;
        const my = (a.y * a.mass + b.y * b.mass) / totalMass;
        a.vx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
        a.vy = (a.vy * a.mass + b.vy * b.mass) / totalMass;
        a.x = mx;
        a.y = my;

        // Merge explosion — bigger for bigger merges
        const mergeEnergy = Math.min(totalMass, 100);
        const pCount = Math.floor(8 + mergeEnergy * 0.4);
        emitParticles(mx, my, a.col, pCount, 60 + mergeEnergy, 1.2);
        emitParticles(mx, my, b.col, pCount, 60 + mergeEnergy, 1.2);

        a.mass = totalMass;
        a.radius = massToRadius(a.mass);
        a.spawnTime = performance.now(); // re-trigger pulse
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
  const now = performance.now();

  // Draw starfield background (with slight fade for trail persistence)
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(starCanvas, 0, 0, w, h);

  // Semi-transparent overlay to fade old frames (creates trail persistence)
  ctx.fillStyle = "rgba(6, 6, 15, 0.25)";
  ctx.fillRect(0, 0, w, h);

  // ── Gravitational connection lines ───────────────────────────────────
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 200;
      if (dist < maxDist) {
        const strength = 1 - dist / maxDist;
        const massInfluence = Math.min((a.mass + b.mass) / 80, 1);
        const alpha = strength * strength * massInfluence * 0.12;
        if (alpha > 0.005) {
          const midH = (a.col.h + b.col.h) / 2;
          ctx.strokeStyle = hsl(midH, 50, 60, alpha);
          ctx.lineWidth = strength * 2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  }

  // ── Trails ───────────────────────────────────────────────────────────
  if (showTrails) {
    for (const b of bodies) {
      const trail = b.trail;
      if (trail.length < 3) continue;
      const { h: bh, s: bs } = b.col;

      for (let i = 1; i < trail.length; i++) {
        const t = i / trail.length;                // 0 = old, 1 = new
        const prev = trail[i - 1];
        const curr = trail[i];

        // Trail width tapers from thin (old) to thick (new)
        const lineW = Math.max(0.5, b.radius * 0.5 * t);
        // Trail brightness increases toward head
        const alpha = t * t * 0.45;
        // Slight lightness shift based on speed
        const speedBoost = Math.min(curr.speed / 400, 1) * 15;

        ctx.strokeStyle = hsl(bh, bs, 55 + speedBoost, alpha);
        ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
    }
  }

  // ── Particles ────────────────────────────────────────────────────────
  for (const p of particles) {
    const t = p.life / p.maxLife;   // 1 = fresh, 0 = dead
    const alpha = t * 0.9;
    const size = p.size * (0.3 + t * 0.7);
    ctx.fillStyle = hsl(p.col.h, p.col.s, p.col.l + 15, alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Bodies ───────────────────────────────────────────────────────────
  for (const b of bodies) {
    const { h: bh, s: bs, l: bl } = b.col;
    const r = b.radius;
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);

    // Spawn/merge pulse
    const age = (now - b.spawnTime) / 1000;
    const pulse = age < 0.6 ? Math.max(0, 1 - age / 0.6) : 0;
    const pulseRadius = r + pulse * r * 3;

    // Layer 1: Outer atmospheric glow (large, very soft)
    const outerR = r * 5 + pulseRadius * 0.5;
    const grad1 = ctx.createRadialGradient(b.x, b.y, r * 0.5, b.x, b.y, outerR);
    grad1.addColorStop(0, hsl(bh, bs, bl, 0.15 + pulse * 0.2));
    grad1.addColorStop(0.4, hsl(bh, bs, bl - 10, 0.06));
    grad1.addColorStop(1, "transparent");
    ctx.fillStyle = grad1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, outerR, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: Inner corona
    const coronaR = r * 2.2;
    const grad2 = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, coronaR);
    grad2.addColorStop(0, hsl(bh, bs - 10, bl + 20, 0.6));
    grad2.addColorStop(0.5, hsl(bh, bs, bl, 0.3));
    grad2.addColorStop(1, "transparent");
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, coronaR, 0, Math.PI * 2);
    ctx.fill();

    // Layer 3: Core body
    ctx.globalCompositeOperation = "source-over";
    const grad3 = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    grad3.addColorStop(0, hsl(bh, Math.max(bs - 30, 0), Math.min(bl + 35, 98), 1));
    grad3.addColorStop(0.4, hsl(bh, bs, bl, 0.95));
    grad3.addColorStop(1, hsl(bh, bs + 10, bl - 15, 0.8));
    ctx.fillStyle = grad3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Layer 4: Specular highlight (gives 3D-ish look)
    const hlX = b.x - r * 0.3;
    const hlY = b.y - r * 0.3;
    const hlR = r * 0.6;
    const grad4 = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
    grad4.addColorStop(0, `rgba(255, 255, 255, ${0.35 + pulse * 0.3})`);
    grad4.addColorStop(1, "transparent");
    ctx.fillStyle = grad4;
    ctx.beginPath();
    ctx.arc(hlX, hlY, hlR, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";

    // Spawn/merge shockwave ring
    if (pulse > 0.05) {
      const ringR = r + (1 - pulse) * r * 6;
      ctx.strokeStyle = hsl(bh, bs, bl + 20, pulse * 0.5);
      ctx.lineWidth = 1.5 * pulse;
      ctx.beginPath();
      ctx.arc(b.x, b.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ── Drag preview ─────────────────────────────────────────────────────
  ctx.globalCompositeOperation = "source-over";
  if (dragging && dragStart && dragCurrent) {
    const dx = dragStart.x - dragCurrent.x;
    const dy = dragStart.y - dragCurrent.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 5) {
      const previewR = massToRadius(currentMass);

      // Trajectory prediction dots
      const vx = dx * 2.5;
      const vy = dy * 2.5;
      const predSteps = 40;
      let px = dragStart.x, py = dragStart.y;
      let pvx = vx, pvy = vy;
      ctx.globalAlpha = 1;
      for (let s = 0; s < predSteps; s++) {
        // Simple gravity from existing bodies
        let ax = 0, ay = 0;
        for (const b of bodies) {
          const ddx = b.x - px;
          const ddy = b.y - py;
          const dSq = ddx * ddx + ddy * ddy + 100;
          const d = Math.sqrt(dSq);
          const f = G * b.mass / dSq;
          ax += f * ddx / d;
          ay += f * ddy / d;
        }
        pvx += ax * DT;
        pvy += ay * DT;
        px += pvx * DT;
        py += pvy * DT;

        const t = 1 - s / predSteps;
        ctx.fillStyle = `rgba(255, 255, 255, ${t * 0.4})`;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, previewR * 0.15 * t), 0, Math.PI * 2);
        ctx.fill();
      }

      // Velocity arrow line
      const grad = ctx.createLinearGradient(
        dragStart.x, dragStart.y,
        dragStart.x + dx, dragStart.y + dy
      );
      grad.addColorStop(0, "rgba(255, 255, 255, 0.6)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0.1)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(dragStart.x, dragStart.y);
      ctx.lineTo(dragStart.x + dx, dragStart.y + dy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Preview body with glow
      const previewGrad = ctx.createRadialGradient(
        dragStart.x, dragStart.y, 0,
        dragStart.x, dragStart.y, previewR * 3
      );
      previewGrad.addColorStop(0, "rgba(180, 200, 255, 0.5)");
      previewGrad.addColorStop(0.4, "rgba(180, 200, 255, 0.15)");
      previewGrad.addColorStop(1, "transparent");
      ctx.fillStyle = previewGrad;
      ctx.beginPath();
      ctx.arc(dragStart.x, dragStart.y, previewR * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(200, 220, 255, 0.7)";
      ctx.beginPath();
      ctx.arc(dragStart.x, dragStart.y, previewR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Body count
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  bodyCountEl.textContent = bodies.length > 0
    ? `${bodies.length} bod${bodies.length === 1 ? "y" : "ies"}`
    : "";
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
  particles = [];
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
const presets = [orbitalSystem, binaryStars, asteroidField, figureEight, galaxyCollision];
let presetIndex = 0;

function loadPreset() {
  bodies = [];
  particles = [];
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
  bodies.push(createBody(cx, cy, 0, 0, 100, true));

  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
    const r = 80 + i * 35;
    const speed = Math.sqrt(G * 100 / r) * 0.75;
    bodies.push(createBody(
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
      -Math.sin(angle) * speed,
      Math.cos(angle) * speed,
      2 + Math.random() * 8,
      true
    ));
  }
}

function binaryStars() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const sep = 80;
  const speed = Math.sqrt(G * 60 / (sep * 2)) * 0.6;
  bodies.push(createBody(cx - sep, cy, 0, -speed, 60, true));
  bodies.push(createBody(cx + sep, cy, 0, speed, 60, true));

  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 180 + Math.random() * 120;
    const orbitSpeed = Math.sqrt(G * 120 / r) * 0.5;
    bodies.push(createBody(
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
      -Math.sin(angle) * orbitSpeed,
      Math.cos(angle) * orbitSpeed,
      1 + Math.random() * 3,
      true
    ));
  }
}

function asteroidField() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < 50; i++) {
    const x = cx + (Math.random() - 0.5) * 600;
    const y = cy + (Math.random() - 0.5) * 500;
    const vx = (Math.random() - 0.5) * 40;
    const vy = (Math.random() - 0.5) * 40;
    bodies.push(createBody(x, y, vx, vy, 2 + Math.random() * 14, true));
  }
}

function figureEight() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const mass = 40;
  const scale = 100;
  const vScale = 180;
  bodies.push(createBody(cx - scale, cy, 0.347 * vScale, 0.533 * vScale, mass, true));
  bodies.push(createBody(cx + scale, cy, 0.347 * vScale, 0.533 * vScale, mass, true));
  bodies.push(createBody(cx, cy, -0.694 * vScale, -1.066 * vScale, mass, true));
}

function galaxyCollision() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const offset = Math.min(cx, cy) * 0.5;

  // Galaxy 1
  bodies.push(createBody(cx - offset, cy - offset * 0.3, 30, 20, 80, true));
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 100;
    const speed = Math.sqrt(G * 80 / r) * 0.6;
    bodies.push(createBody(
      cx - offset + Math.cos(angle) * r,
      cy - offset * 0.3 + Math.sin(angle) * r,
      30 - Math.sin(angle) * speed,
      20 + Math.cos(angle) * speed,
      1 + Math.random() * 4,
      true
    ));
  }

  // Galaxy 2
  bodies.push(createBody(cx + offset, cy + offset * 0.3, -30, -20, 80, true));
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 100;
    const speed = Math.sqrt(G * 80 / r) * 0.6;
    bodies.push(createBody(
      cx + offset + Math.cos(angle) * r,
      cy + offset * 0.3 + Math.sin(angle) * r,
      -30 - Math.sin(angle) * speed,
      -20 + Math.cos(angle) * speed,
      1 + Math.random() * 4,
      true
    ));
  }
}

// ── Game loop ──────────────────────────────────────────────────────────────
function loop() {
  step(DT);
  draw();
  requestAnimationFrame(loop);
}

orbitalSystem();
loop();
