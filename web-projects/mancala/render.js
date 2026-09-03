// The board on the screen, and the animation that moves seeds around it.
//
// The board is plain elements in a CSS grid, not a canvas, so a pit is a real
// button: it can be reached with the keyboard, read by a screen reader and
// styled by a media query. The layout is CSS only. This file never decides
// where a pit sits, which is why the same code draws the tall phone board, the
// wide desktop board and the small board in the rules cards.
//
// The animation asks the browser where two pits are, drops a seed element on a
// layer above the board and lets one CSS transition carry it across. It then
// paints the pit from the snapshot, so the numbers on screen are never guessed
// from the animation: they always come from playback.js.
//
// A move that ends is always painted in full from the final snapshot. So if an
// animation is cut short, by an impatient player or a browser tab going to
// sleep, the board still ends up correct.

import { PIT_COUNT, ROW } from "./board.js";
import { applyEvent, applyEvents, sowingLaps } from "./playback.js";
import { mulberry32 } from "./rng.js";

/** The most seed dots drawn in one pit. Above this the number does the work. */
export const MAX_DOTS = 12;

/** The most seeds drawn flying out of one capture. */
const MAX_FLYING = 6;

/**
 * Where the dots sit inside a pit.
 *
 * Two things matter here. The dots must spread evenly, or a full pit looks
 * like a clump with bald patches, and the places must be FIXED per pit, so
 * that adding a seed adds a dot without moving the dots already there.
 *
 * The spread comes from the golden angle, the same trick a sunflower uses: a
 * turn of about 137.5 degrees between one seed and the next never repeats, so
 * no two dots line up however many there are. The square root spaces the rings
 * out so the middle does not get crowded. Each pit gets its own starting angle
 * so the twelve pits do not look like twelve copies.
 *
 * @param {number} pit the pit index, used as the seed of the pattern
 * @returns {Array<{x: number, y: number}>} percentages inside the bowl
 */
function dotPattern(pit) {
  const phase = mulberry32(1000 + pit * 37)() * Math.PI * 2;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spots = [];
  for (let index = 0; index < MAX_DOTS; index += 1) {
    // Two rings of six. A pit usually holds four or five seeds, and putting
    // those on one ring spreads them across the bowl instead of piling them
    // in the middle, which is what a single spiral from the centre did.
    const radius = index < 6 ? 14 : 25;
    const angle = phase + index * golden;
    spots.push({
      // The middle sits above the pit's centre, because the seed count sits
      // in a pill along the bottom of the bowl.
      x: 50 + Math.cos(angle) * radius,
      y: 40 + Math.sin(angle) * radius * 0.85,
    });
  }
  return spots;
}

const PATTERNS = Array.from({ length: PIT_COUNT }, (_, pit) => dotPattern(pit));

/**
 * Build the board's elements inside a container, replacing whatever was there.
 * @param {HTMLElement} container the element to build in
 * @param {{stores: boolean, mini?: boolean}} options whether the rule set has
 *   stores, and whether this is a small board for a rules card
 * @returns {Object} the elements the other functions need
 */
export function buildBoard(container, options = {}) {
  const stores = options.stores !== false;
  container.textContent = "";
  container.classList.toggle("board--stores", stores);
  container.classList.toggle("board--mini", Boolean(options.mini));

  const refs = { container, pits: [], counts: [], bowls: [], stores: [], storeCounts: [], stores_on: stores };

  for (const player of [1, 0]) {
    const store = document.createElement(options.mini ? "div" : "div");
    store.className = `store store--${player === 0 ? "blue" : "red"}`;
    store.dataset.store = String(player);
    const count = document.createElement("span");
    count.className = "store__count";
    const seeds = document.createElement("span");
    seeds.className = "store__seeds";
    store.append(seeds, count);
    if (!stores) store.hidden = true;
    container.append(store);
    refs.stores[player] = store;
    refs.storeCounts[player] = count;
  }

  for (let pit = 0; pit < PIT_COUNT; pit += 1) {
    const button = document.createElement(options.mini ? "div" : "button");
    if (!options.mini) button.type = "button";
    button.className = "pit";
    button.dataset.pit = String(pit);

    const bowl = document.createElement("span");
    bowl.className = "pit__bowl";
    const seeds = document.createElement("span");
    seeds.className = "pit__seeds";
    bowl.append(seeds);

    const count = document.createElement("span");
    count.className = "pit__count";

    button.append(bowl, count);
    container.append(button);
    refs.pits[pit] = button;
    refs.bowls[pit] = seeds;
    refs.counts[pit] = count;
  }

  return refs;
}

/**
 * Draw a snapshot onto a board.
 * @param {Object} refs the elements from buildBoard
 * @param {Object} shown a snapshot from playback.js
 * @param {{playable?: number[], highlight?: number[], names?: string[]}} [options]
 *   which pits the player may click, which pits to point out, and the two
 *   player names for the labels a screen reader reads
 */
export function paintBoard(refs, shown, options = {}) {
  const playable = new Set(options.playable ?? []);
  const highlight = new Set(options.highlight ?? []);
  const names = options.names ?? ["Blue", "Red"];

  for (let pit = 0; pit < PIT_COUNT; pit += 1) {
    const seeds = shown.pits[pit];
    const button = refs.pits[pit];
    const owner = shown.owner[pit];
    button.classList.toggle("pit--blue", owner === 0);
    button.classList.toggle("pit--red", owner === 1);
    button.classList.toggle("pit--empty", seeds === 0);
    // A pit whose owner is not the player whose row it sits in was won in an
    // earlier Ba-awa round. It is drawn in its new owner's colour, so it needs
    // a mark to say the row it stands in is not theirs.
    button.classList.toggle("pit--conquered", owner !== (pit < ROW ? 0 : 1));
    button.classList.toggle("pit--playable", playable.has(pit));
    button.classList.toggle("pit--marked", highlight.has(pit));
    if (button.tagName === "BUTTON") {
      button.disabled = !playable.has(pit);
      button.setAttribute(
        "aria-label",
        `${names[owner]} pit ${pit + 1}: ${seeds} ${seeds === 1 ? "seed" : "seeds"}` +
          (playable.has(pit) ? ", your move" : "")
      );
    }
    refs.counts[pit].textContent = String(seeds);
    drawSeeds(refs.bowls[pit], seeds, PATTERNS[pit]);
  }

  for (const player of [0, 1]) {
    if (!refs.stores[player]) continue;
    refs.storeCounts[player].textContent = String(shown.scores[player]);
    refs.stores[player].classList.toggle("store--turn", !shown.over && shown.turn === player);
    refs.stores[player].setAttribute(
      "aria-label",
      `${names[player]} store: ${shown.scores[player]} seeds`
    );
  }
}

/**
 * Put the right number of dots in a bowl.
 * @param {HTMLElement} bowl the element the dots live in
 * @param {number} seeds how many seeds the pit holds
 * @param {Array<{x: number, y: number}>} pattern where the dots go
 */
function drawSeeds(bowl, seeds, pattern) {
  const wanted = Math.min(seeds, MAX_DOTS);
  while (bowl.childElementCount > wanted) bowl.lastElementChild.remove();
  while (bowl.childElementCount < wanted) {
    const dot = document.createElement("i");
    const spot = pattern[bowl.childElementCount];
    dot.className = "seed";
    dot.style.left = `${spot.x}%`;
    dot.style.top = `${spot.y}%`;
    bowl.append(dot);
  }
  bowl.classList.toggle("pit__seeds--crowded", seeds > MAX_DOTS);
}

/** Wait, as a promise. */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait for the browser to have painted. */
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Play one move onto the board.
 *
 * The seeds of one lift all leave the pit together and fly as a stream. The
 * first drops into the next pit, the second carries on to the pit after it,
 * and the last one crosses the whole distance, so several seeds are in the air
 * at once and each one visibly travels. That is how the game this copies moves
 * its seeds, and it is what the earlier version got wrong: it flew one seed at
 * a time and waited for each to land, so a seed crossed one pit in a tenth of
 * a second and the board looked like it was jumping rather than sowing.
 *
 * A Ba-awa relay lifts again and again, so a move is a run of laps. Each lap
 * waits for the one before it.
 *
 * @param {Object} refs the elements from buildBoard
 * @param {Object} before the snapshot the move starts from
 * @param {Object[]} events the events of the move
 * @param {Object} view what the board needs to keep drawing correctly:
 *   `pace` milliseconds for one seed to cross one pit, `flyLayer` the element
 *   flying seeds go on, `names`, `onShown` called with each snapshot,
 *   `cancelled` a function that can stop the animation early, and `chip` a
 *   function giving the element a captured seed should fly to.
 * @returns {Promise<Object>} the snapshot after the last event
 */
export async function animateMove(refs, before, events, view) {
  const pace = view.pace ?? 300;
  let shown = before;

  /** Draw a snapshot and tell the caller about it. */
  const show = (next) => {
    shown = next;
    paintBoard(refs, shown, { playable: [], names: view.names });
    view.onShown?.(shown);
  };

  /** Has the player asked to see the rest at once? */
  const stopped = () => (view.cancelled?.() ?? false) || pace === 0;

  const { laps, tail } = sowingLaps(events);

  for (const lap of laps) {
    if (stopped()) {
      shown = applyEvents(shown, [lap.lift, ...lap.steps.flatMap((step) => [step.event, ...step.extras])]);
      show(shown);
      continue;
    }
    shown = await playLap(refs, shown, lap, pace, view, show);
  }

  for (const event of tail) {
    shown = applyEvent(shown, event);
    if (!stopped() && event.type === "sweep") {
      await sweepSeeds(refs, event, pace, view);
    }
    show(shown);
  }

  return shown;
}

/**
 * Fly one lift: every seed leaves at once and each stops at its own pit.
 * @param {Object} refs the elements from buildBoard
 * @param {Object} start the snapshot before the lift
 * @param {Object} lap one entry from `sowingLaps`
 * @param {number} pace milliseconds for one seed to cross one pit
 * @param {Object} view the drawing helpers from animateMove
 * @param {(shown: Object) => void} show paints a snapshot
 * @returns {Promise<Object>} the snapshot after the lap
 */
async function playLap(refs, start, lap, pace, view, show) {
  const source = refs.pits[lap.lift.pit];
  pulse(source, "pit--lifting", pace);

  // The pit empties as the hand picks the seeds up, before any of them move.
  show(applyEvent(start, lap.lift));
  await wait(Math.min(180, pace * 0.45));

  const stops = lap.steps.map((step) =>
    step.event.type === "store" ? refs.stores[step.event.player] : refs.pits[step.event.pit]
  );
  const centres = [source, ...stops].map((element) => centreOf(element ?? source, view.flyLayer));
  const middle = centreOf(refs.container, view.flyLayer);

  // Every seed of the lift is in the air from the same moment. Seed k flies
  // through the first k stops, so it lands one pace later than seed k-1. Only
  // its own first and last points sit on a pit; the ones it merely passes are
  // pulled into the wood between the pits, so the stream flows down the board
  // instead of across the pits it is not landing in.
  const flights = lap.steps.map((_, index) => {
    const legs = centres.slice(0, index + 2);
    const route = legs.map((point, at) =>
      at === 0 || at === legs.length - 1 ? point : towards(point, middle, CHANNEL_PULL)
    );
    return sowSeed(view.flyLayer, route, pace * (index + 1), index);
  });

  let shown = applyEvent(start, lap.lift);
  for (let index = 0; index < lap.steps.length; index += 1) {
    // A player who has seen enough taps the board. The rest of the lap then
    // lands at once rather than after the seeds still in the air.
    if (view.cancelled?.()) {
      for (const flight of flights) flight.land();
      for (const rest of lap.steps.slice(index)) {
        shown = applyEvent(shown, rest.event);
        for (const extra of rest.extras) shown = applyEvent(shown, extra);
      }
      show(shown);
      break;
    }

    await wait(pace);
    const step = lap.steps[index];
    shown = applyEvent(shown, step.event);
    show(shown);
    pulse(stops[index], step.event.type === "store" ? "store--hit" : "pit--hit", pace * 0.6);

    for (const extra of step.extras) {
      shown = applyEvent(shown, extra);
      if (extra.type === "capture") await captureSeeds(refs, extra, pace, view);
      show(shown);
    }
  }

  await Promise.all(flights.map((flight) => flight.done));
  return shown;
}

/**
 * Send the seeds of a capture to the player's score.
 * @param {Object} refs the elements from buildBoard
 * @param {Object} event the capture event
 * @param {number} pace milliseconds for one seed to cross one pit
 * @param {Object} view the drawing helpers from animateMove
 */
async function captureSeeds(refs, event, pace, view) {
  const target = view.chip?.(event.player) ?? refs.stores[event.player] ?? refs.pits[event.pit];
  const sources = [refs.pits[event.pit]];
  if (typeof event.facing === "number") sources.push(refs.pits[event.facing]);
  for (const element of sources) pulse(element, "pit--taken", pace);
  const flights = Math.min(event.count, MAX_FLYING);
  await Promise.all(
    Array.from({ length: flights }, (_, index) =>
      wait(index * 45).then(() =>
        flySeed(view.flyLayer, sources[index % sources.length], target, pace * 0.9, "seed--taken")
      )
    )
  );
  pulse(target, "chip--hit", pace);
}

/**
 * Send every seed left on the board to the player who takes them.
 * @param {Object} refs the elements from buildBoard
 * @param {Object} event the sweep event
 * @param {number} pace milliseconds for one seed to cross one pit
 * @param {Object} view the drawing helpers from animateMove
 */
async function sweepSeeds(refs, event, pace, view) {
  const target = view.chip?.(event.player) ?? refs.stores[event.player];
  const sources = (event.pits ?? []).map((pit) => refs.pits[pit]).filter(Boolean);
  for (const element of sources) pulse(element, "pit--taken", pace);
  await Promise.all(
    sources
      .slice(0, MAX_FLYING)
      .map((element, index) =>
        wait(index * 60).then(() => flySeed(view.flyLayer, element, target, pace * 0.9, "seed--taken"))
      )
  );
  pulse(target, "chip--hit", pace);
}

/** How far a passed-over pit pulls the flight path towards the board's middle. */
const CHANNEL_PULL = 0.5;

/**
 * A point moved part of the way towards another point.
 * @param {{x: number, y: number}} point where it starts
 * @param {{x: number, y: number}} target what it moves towards
 * @param {number} part 0 leaves it alone, 1 moves it all the way
 * @returns {{x: number, y: number}}
 */
function towards(point, target, part) {
  return { x: point.x + (target.x - point.x) * part, y: point.y + (target.y - point.y) * part };
}

/**
 * Send one seed along a path of pit centres at a steady speed.
 *
 * The browser animates it, not a chain of transitions, so one seed can cross
 * several pits in one movement and the whole stream stays in step.
 *
 * @param {HTMLElement} layer the element flying seeds are added to
 * @param {Array<{x: number, y: number}>} path the centres to fly through
 * @param {number} ms how long the whole flight takes
 * @param {number} index which seed of the lift this is, used to spread the
 *   stream out so it reads as several seeds and not as one
 * @returns {Promise<void>} resolved when the seed has landed
 */
function sowSeed(layer, path, ms, index) {
  if (!layer || path.length < 2) return { done: Promise.resolve(), land: () => {} };
  const seed = document.createElement("i");
  seed.className = "seed seed--fly";
  layer.append(seed);

  // A small fixed offset per seed, so seeds travelling together do not sit
  // exactly on top of each other.
  const spread = 3.5;
  const shift = {
    x: ((index % 3) - 1) * spread,
    y: ((Math.floor(index / 3) % 3) - 1) * spread,
  };

  const frames = path.map((point, at) => ({
    transform: `translate(${point.x + shift.x}px, ${point.y + shift.y}px)`,
    offset: at / (path.length - 1),
  }));

  if (typeof seed.animate !== "function") {
    seed.style.transform = frames[frames.length - 1].transform;
    return { done: wait(ms).then(() => seed.remove()), land: () => seed.remove() };
  }

  const flight = seed.animate(frames, { duration: ms, easing: "linear", fill: "forwards" });
  return {
    done: flight.finished.catch(() => {}).then(() => seed.remove()),
    land: () => flight.finish(),
  };
}

/**
 * Send one seed from one element to another.
 * @param {HTMLElement} layer the element flying seeds are added to
 * @param {HTMLElement} fromEl where the seed starts
 * @param {HTMLElement} toEl where the seed lands
 * @param {number} ms how long the flight takes
 * @param {string} [extra] an extra class for the seed
 * @returns {Promise<void>} resolved when the seed has landed
 */
export function flySeed(layer, fromEl, toEl, ms, extra = "") {
  if (!layer || !fromEl || !toEl) return Promise.resolve();
  const start = centreOf(fromEl, layer);
  const end = centreOf(toEl, layer);
  const seed = document.createElement("i");
  seed.className = `seed seed--fly ${extra}`.trim();
  seed.style.transform = `translate(${start.x}px, ${start.y}px)`;
  layer.append(seed);

  return nextFrame()
    .then(() => {
      seed.style.transition = `transform ${ms}ms cubic-bezier(0.33, 1.2, 0.55, 1)`;
      seed.style.transform = `translate(${end.x}px, ${end.y}px)`;
      return wait(ms);
    })
    .then(() => {
      seed.remove();
    });
}

/**
 * Where an element's middle is, relative to the layer the seeds fly on.
 * @param {HTMLElement} element the element to measure
 * @param {HTMLElement} layer the flying layer
 * @returns {{x: number, y: number}} pixels
 */
function centreOf(element, layer) {
  const box = element.getBoundingClientRect();
  const frame = layer.getBoundingClientRect();
  return {
    x: box.left - frame.left + box.width / 2,
    y: box.top - frame.top + box.height / 2,
  };
}

/**
 * Add a class for a moment, to flash something.
 * @param {HTMLElement} element the element to flash
 * @param {string} className the class to add
 * @param {number} ms how long to keep it
 */
export function pulse(element, className, ms) {
  if (!element) return;
  element.classList.add(className);
  setTimeout(() => element.classList.remove(className), Math.max(120, ms));
}

/**
 * Put a short badge over an element, the way the "+1 Turn" tag appears over a
 * store. It removes itself.
 * @param {HTMLElement} element what the badge points at
 * @param {string} text the badge text
 * @param {number} ms how long it stays
 */
export function flashBadge(element, text, ms = 1100) {
  if (!element) return;
  const badge = document.createElement("span");
  badge.className = "pop-badge";
  badge.textContent = text;
  element.append(badge);
  setTimeout(() => badge.remove(), ms);
}
