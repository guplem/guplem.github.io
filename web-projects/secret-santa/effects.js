// Visual effects: falling snow behind the page and confetti bursts on top.
//
// Both draw on a fixed canvas and touch no layout. Both stay off when the
// reader asks for reduced motion, and the snow stops while the tab is hidden.

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fitCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

/** Start the snow on `canvas`. */
export function startSnow(canvas) {
  if (!canvas || reducedMotion()) return;
  let ctx = fitCanvas(canvas);
  const count = Math.min(90, Math.round((innerWidth * innerHeight) / 14000));
  const flakes = Array.from({ length: count }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: 0.8 + Math.random() * 2.4,
    speed: 0.3 + Math.random() * 0.9,
    sway: Math.random() * Math.PI * 2,
  }));
  addEventListener("resize", () => { ctx = fitCanvas(canvas); });

  let last = performance.now();
  const frame = (now) => {
    const step = Math.min((now - last) / 16.7, 3);
    last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    for (const f of flakes) {
      f.y += f.speed * step;
      f.sway += 0.01 * step;
      f.x += Math.sin(f.sway) * 0.3 * step;
      if (f.y > innerHeight + 4) { f.y = -4; f.x = Math.random() * innerWidth; }
      ctx.globalAlpha = 0.3 + f.r / 4;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!document.hidden) requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
}

const CONFETTI_COLOURS = ["#ff4d6d", "#ffc94d", "#34d399", "#60a5fa", "#f472b6", "#ffffff"];
let confettiParts = [];
let confettiRunning = false;

/**
 * Fire a confetti burst on `canvas` from a point on screen (defaults to the
 * upper middle of the screen).
 */
export function burstConfetti(canvas, origin, amount = 140) {
  if (!canvas || reducedMotion()) return;
  const ctx = fitCanvas(canvas);
  const x = origin?.x ?? innerWidth / 2;
  const y = origin?.y ?? innerHeight / 3;
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    confettiParts.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      spin: Math.random() * Math.PI,
      vspin: (Math.random() - 0.5) * 0.4,
      colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
      life: 1,
    });
  }
  if (confettiRunning) return;
  confettiRunning = true;
  const frame = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of confettiParts) {
      p.vy += 0.25;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.vspin;
      p.life -= 0.006;
      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.cos(p.spin * 2), p.w, p.h * Math.cos(p.spin * 2));
      ctx.restore();
    }
    confettiParts = confettiParts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
    if (confettiParts.length) requestAnimationFrame(frame);
    else { confettiRunning = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  };
  requestAnimationFrame(frame);
}

/** A short buzz on phones that support it. */
export function buzz(pattern = 12) {
  if (!reducedMotion()) navigator.vibrate?.(pattern);
}
