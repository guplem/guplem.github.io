// Pure sieve and arc geometry. No DOM access -- safe to import from tests.
//
// The animation is the Sieve of Eratosthenes drawn as hops. Each prime p walks its
// multiples: p -> 2p -> 3p -> ... Each hop is a half circle whose diameter is p, and
// the hops alternate above and below the number line, starting above. A number is
// composite exactly when some hop lands on it. See AGENTS.md for the measurements
// that fix these rules.

const TAU = Math.PI * 2;

/** Primes from 2 up to and including `limit`. */
export function primesUpTo(limit) {
  if (!Number.isFinite(limit) || limit < 2) return [];
  const top = Math.floor(limit);
  const composite = new Uint8Array(top + 1);
  const primes = [];
  for (let n = 2; n <= top; n++) {
    if (composite[n]) continue;
    primes.push(n);
    for (let m = n * n; m <= top; m += n) composite[m] = 1;
  }
  return primes;
}

/** True when `n` is a prime integer. */
export function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
}

/** Side of hop `index` in a chain: hops alternate, and the first hop goes above. */
export function hopSide(index) {
  return index % 2 === 0 ? "above" : "below";
}

/** Hop `index` (0 based) of prime `p`: it leaves (index+1)*p and lands on (index+2)*p. */
export function hopAt(p, index) {
  if (!Number.isInteger(index) || index < 0) throw new Error(`hop index must be a non-negative integer, got ${index}`);
  return { from: (index + 1) * p, to: (index + 2) * p, side: hopSide(index) };
}

/** How many hops of prime `p` already landed at or before `frontier`. */
export function completedHopCount(p, frontier) {
  return Math.max(0, Math.floor(frontier / p) - 1);
}

/** The hop of prime `p` that the frontier is halfway through, or null when there is none. */
export function hopInProgress(p, frontier) {
  if (frontier <= p) return null;
  const index = Math.floor(frontier / p) - 1;
  const hop = hopAt(p, index);
  return frontier > hop.from && frontier < hop.to ? hop : null;
}

/** The circle a hop rides on: centre and radius, in number-line units. */
export function hopArc({ from, to }) {
  return { center: (from + to) / 2, radius: (to - from) / 2 };
}

/**
 * Canvas angles for the part of a hop drawn so far, given the frontier at `clipTo`.
 * Returns null while the hop has not started. Canvas y grows downwards, so an "above"
 * hop sweeps from PI to TAU (through 3*PI/2, the top) and a "below" hop from PI to 0.
 */
export function hopSweep(hop, clipTo) {
  const { from, to, side } = hop;
  if (clipTo <= from) return null;
  const { center, radius } = hopArc(hop);
  const reach = Math.min(Math.max((Math.min(clipTo, to) - center) / radius, -1), 1);
  const swept = Math.acos(reach); // PI at the left end, 0 at the right end
  return side === "above"
    ? { start: Math.PI, end: TAU - swept, anticlockwise: false }
    : { start: Math.PI, end: swept, anticlockwise: true };
}

/** Pixels per number-line unit so that `visibleUnits` fit inside a padded width. */
export function pixelsPerUnit(viewWidth, visibleUnits, padding) {
  const usable = Math.max(viewWidth - 2 * padding, 1);
  return usable / Math.max(visibleUnits, 1);
}

/** Screen x of a number-line position. */
export function projectUnit(unit, ppu, padding) {
  return padding + unit * ppu;
}

// ---------------------------------------------------------------- pace
//
// Two things move. A **scanner** walks the number line at `scanSpeed`, and it decides:
// the number it lands on is prime when nothing has crossed it out, so a new chain leaves
// from there. Every **pen** draws its chain at `penRatio` times the scanner speed.
//
// The pens being faster is what makes the sieve honest. A composite is crossed by the
// chain of its smallest prime factor, which left earlier and moves faster, so it is
// always already crossed when the scanner arrives. `crossTime` and the tests prove it
// for any ratio above 1.
//
// 2 is the one exception: it has nothing to wait for, so it leaves at time 0 while the
// scanner waits out `introSeconds` on 2. That is the opening of the animation, one line
// growing on its own.

export const DEFAULT_PACE = { scanSpeed: 4, penRatio: 2, introSeconds: 0.7 };

const FIRST_PRIME = 2;

/** Where the scanner stands after `elapsed` seconds. */
export function scannerAt(elapsed, pace = DEFAULT_PACE) {
  const moving = Math.max(0, elapsed - pace.introSeconds);
  return FIRST_PRIME + moving * pace.scanSpeed;
}

/** When the scanner stands on `unit`. The inverse of `scannerAt`. */
export function timeForScanner(unit, pace = DEFAULT_PACE) {
  return pace.introSeconds + Math.max(0, unit - FIRST_PRIME) / pace.scanSpeed;
}

/** When the chain of prime `p` starts drawing. */
export function launchTime(p, pace = DEFAULT_PACE) {
  return p === FIRST_PRIME ? 0 : timeForScanner(p, pace);
}

/** Where the pen of prime `p` has reached, or null before its chain leaves. */
export function penAt(p, elapsed, pace = DEFAULT_PACE) {
  const started = launchTime(p, pace);
  if (elapsed < started) return null;
  return p + (elapsed - started) * pace.scanSpeed * pace.penRatio;
}

/** The rightmost pen, which is always the pen of 2. The camera has to fit this. */
export function leadAt(elapsed, pace = DEFAULT_PACE) {
  return penAt(FIRST_PRIME, elapsed, pace);
}

/** The smallest prime that divides `n`, or null when `n` is 1 or prime. */
function smallestPrimeFactor(n) {
  if (!Number.isInteger(n) || n < 4) return null;
  if (n % 2 === 0) return 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return d;
  return null;
}

/** When a hop lands on `n` and crosses it out, or null when `n` is 1 or prime. */
export function crossTime(n, pace = DEFAULT_PACE) {
  const factor = smallestPrimeFactor(n);
  if (factor === null) return null;
  return launchTime(factor, pace) + (n - factor) / (pace.scanSpeed * pace.penRatio);
}

/**
 * What the chip for `n` shows: "unknown" (white, still a candidate), "prime" (its chain
 * has left) or "crossed" (a hop landed on it). `fade` runs 0 to 1 over `fadeSeconds`,
 * for the change between looks.
 */
export function numberStateAt(n, elapsed, pace = DEFAULT_PACE, fadeSeconds = 0.5) {
  const ramp = (since) => (fadeSeconds > 0 ? Math.min(Math.max((elapsed - since) / fadeSeconds, 0), 1) : 1);

  const crossed = crossTime(n, pace);
  if (crossed !== null && elapsed >= crossed) return { state: "crossed", fade: ramp(crossed) };

  if (isPrime(n)) {
    const left = launchTime(n, pace);
    if (elapsed >= left) return { state: "prime", fade: ramp(left) };
  }
  return { state: "unknown", fade: 1 };
}

/**
 * A tiny offset, -1 to 1, for one hop. The lines in the reference frames do not meet
 * cleanly where they cross the number line, so each hop sits a hair off its neighbour.
 * Deterministic, because the picture is redrawn from scratch every frame.
 */
export function hopWobble(prime, index) {
  const spun = Math.sin(prime * 12.9898 + index * 78.233) * 43758.5453;
  return (spun - Math.floor(spun)) * 2 - 1;
}

// ---------------------------------------------------------------- timeline
//
// One sweep runs through four phases: "sweeping" moves the scanner, "holding" rests on
// the finished picture, "fading" dims it, and "done" freezes it when looping is off.

/** A timeline parked at the start of a sweep, with the scanner still on 2. */
export function createTimeline() {
  return { elapsed: 0, frontier: FIRST_PRIME, phase: "sweeping", phaseLeft: 0 };
}

/** A timeline frozen with the scanner on one number, for a deep link to a single frame. */
export function seekTimeline(unit, { limit, holdSeconds = 0, pace = DEFAULT_PACE }) {
  const frontier = Math.min(Math.max(unit, FIRST_PRIME), limit);
  const atEnd = frontier >= limit;
  return {
    elapsed: timeForScanner(frontier, pace),
    frontier,
    phase: atEnd ? "holding" : "sweeping",
    phaseLeft: atEnd ? holdSeconds : 0,
  };
}

/** The timeline `dt` seconds later. Never mutates the state it is given. */
export function advanceTimeline(state, dt, { limit, loop, holdSeconds, fadeSeconds, pace = DEFAULT_PACE }) {
  if (state.phase === "done") return state;

  if (state.phase === "holding") {
    const phaseLeft = state.phaseLeft - dt;
    if (phaseLeft > 0) return { ...state, phaseLeft };
    return loop
      ? { ...state, phase: "fading", phaseLeft: fadeSeconds }
      : { ...state, phase: "done", phaseLeft: 0 };
  }

  if (state.phase === "fading") {
    const phaseLeft = state.phaseLeft - dt;
    return phaseLeft > 0 ? { ...state, phaseLeft } : createTimeline();
  }

  const elapsed = state.elapsed + dt;
  const frontier = Math.min(scannerAt(elapsed, pace), limit);
  return frontier >= limit
    ? { elapsed, frontier, phase: "holding", phaseLeft: holdSeconds }
    : { elapsed, frontier, phase: "sweeping", phaseLeft: 0 };
}

/** How much black to lay over the picture: 0 while playing, 1 when the fade ends. */
export function fadeAlpha(state, fadeSeconds) {
  if (state.phase !== "fading" || fadeSeconds <= 0) return 0;
  return Math.min(Math.max(1 - state.phaseLeft / fadeSeconds, 0), 1);
}
