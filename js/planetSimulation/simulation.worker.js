/**
 * Web Worker that runs the planet simulation off the main thread.
 * Receives an OffscreenCanvas and handles all physics + drawing.
 */

// --- Inline vector math ---
function vecAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function vecScale(v, k) { return { x: k * v.x, y: k * v.y }; }
function vecSubtract(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function vecMagnitude(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }

// --- Simulation state ---
const spaceSize = { x: 10, y: 10 };
const planetsQuantityTarget = 120;
let attractionPoints = [{ x: 0, y: 0 }];

/** @type {{ mass: number, radius: number, color: string, gradient: boolean, position: {x: number, y: number}, velocity: {x: number, y: number} }[]} */
const planets = [];

/** @type {OffscreenCanvas | null} */
let canvas = null;
/** @type {OffscreenCanvasRenderingContext2D | null} */
let ctx = null;

// Coordinate mapping (mirrors Space class logic)
let xScal = 0;
let yScal = 0;
let xOrig = 0;
let yOrig = 0;
let canvasWidth = 0;
let canvasHeight = 0;

/** @type {number} */
let intervalId = 0;

function setupCoordinates() {
  const xmin = -spaceSize.x / 2;
  const xmax = spaceSize.x / 2;
  const ymin = -spaceSize.y / 2;
  const ymax = spaceSize.y / 2;
  xScal = (xmax - xmin) / canvasWidth;
  yScal = (ymax - ymin) / canvasHeight;
  xOrig = -xmin / xScal;
  yOrig = canvasHeight + ymin / yScal;
}

function toPixelX(x) { return xOrig + x / xScal; }
function toPixelY(y) { return yOrig - y / yScal; }
function toPixelRadius(r) { return r / yScal; }

// --- Planet creation (mirrors createPlanets) ---
function createPlanets(count) {
  if (count <= 0) {
    planets.length = 0;
    count = planetsQuantityTarget;
  }
  count = Math.min(count, planetsQuantityTarget - planets.length);

  for (let i = 0; i < count; i++) {
    const radius = Math.random() / 5;
    const orbitRadius = Math.random() * 3.5 + 0.5;
    const variation = 0.4;
    let verticalSpeed = Math.sqrt(1 / orbitRadius) + Math.random() * variation - variation / 2;

    let posX = orbitRadius;
    if (Math.random() >= 0.5) {
      posX = -orbitRadius;
      verticalSpeed = -verticalSpeed;
    }

    planets.push({
      mass: 1,
      radius,
      color: "#c2dde6",
      gradient: true,
      position: { x: posX, y: 0 },
      velocity: { x: 0, y: verticalSpeed },
    });
  }
}

// --- Physics step ---
function stepPhysics(dt) {
  for (let p = 0; p < planets.length; p++) {
    let totalForce = { x: 0, y: 0 };
    for (let a = 0; a < attractionPoints.length; a++) {
      const dir = vecSubtract(planets[p].position, attractionPoints[a]);
      const dist = vecMagnitude(dir);
      if (dist === 0) continue;
      const force = vecScale(dir, -planets[p].mass / (dist * dist * dist));
      totalForce = vecAdd(totalForce, force);
    }
    // Euler integration
    planets[p].velocity.x += (totalForce.x * dt) / planets[p].mass;
    planets[p].velocity.y += (totalForce.y * dt) / planets[p].mass;
    planets[p].position.x += planets[p].velocity.x * dt;
    planets[p].position.y += planets[p].velocity.y * dt;
  }
}

// --- Drawing ---
function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (let p = 0; p < planets.length; p++) {
    const planet = planets[p];
    const px = toPixelX(planet.position.x);
    const py = toPixelY(planet.position.y);
    const pr = toPixelRadius(planet.radius);

    if (planet.gradient) {
      // Use simulation coordinates for gradient (not pixel), matching the
      // original Space.createRadialGradient which passes values as-is
      const grad = ctx.createRadialGradient(
        planet.position.x, planet.position.y, 0,
        planet.position.x, planet.position.y, planet.radius
      );
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, planet.color);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = planet.color;
    }

    ctx.beginPath();
    ctx.arc(px, py, pr, 0, 2 * Math.PI, true);
    ctx.closePath();
    ctx.fill();
  }
}

// --- Main loop ---
function onEachStep() {
  createPlanets(3);
  stepPhysics(1 / 60);
  draw();
}

function startSimulation() {
  clearInterval(intervalId);
  planets.length = 0;
  setupCoordinates();
  intervalId = setInterval(onEachStep, 1000 / 60);
}

// --- Message handling ---
self.onmessage = function (e) {
  const msg = e.data;

  if (msg.type === "init") {
    canvas = msg.canvas;
    ctx = canvas.getContext("2d");
    canvasWidth = msg.width;
    canvasHeight = msg.height;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    startSimulation();
  } else if (msg.type === "resize") {
    canvasWidth = msg.width;
    canvasHeight = msg.height;
    if (canvas) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }
    startSimulation();
  } else if (msg.type === "updateCentralPoint") {
    const newX = Math.min(1, Math.max(-1, msg.x));
    const newY = Math.min(1, Math.max(-1, msg.y));
    attractionPoints[msg.index] = {
      x: (newX * spaceSize.x) / 2,
      y: (newY * spaceSize.y) / 2,
    };
  }
};
