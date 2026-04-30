import {
  pickOptions,
  splitOptionsText,
  optionsToText,
  parseUrlState,
  serializeUrlState,
  generateRandomSeed,
} from "./picker.js";

const REEL_ITEM_HEIGHT = 72;
const STRIP_LENGTH_BEFORE_TARGET = 14;
const SPIN_BASE_MS = 1700;
const SPIN_STAGGER_MS = 220;

const dom = {
  reels: document.getElementById("reels"),
  pickButton: document.getElementById("pick-button"),
  seedDisplay: document.getElementById("seed-display"),
  optionsInput: document.getElementById("options-input"),
  countInput: document.getElementById("count-input"),
  seedInput: document.getElementById("seed-input"),
  seedRandom: document.getElementById("seed-random"),
  seedClear: document.getElementById("seed-clear"),
  copyLink: document.getElementById("copy-link"),
  shareStatus: document.getElementById("share-status"),
};

let isSpinning = false;

function readState() {
  const options = splitOptionsText(dom.optionsInput.value);
  const parsedCount = parseInt(dom.countInput.value, 10);
  const count = Number.isInteger(parsedCount) && parsedCount > 0 ? parsedCount : 1;
  const rawSeed = dom.seedInput.value.trim();
  const seed = rawSeed.length > 0 ? rawSeed : null;
  return { options, count, seed };
}

function syncUrl() {
  const state = readState();
  const qs = serializeUrlState(state);
  const newUrl = qs ? `${location.pathname}?${qs}` : location.pathname;
  history.replaceState(null, "", newUrl);
}

function loadFromUrl() {
  const state = parseUrlState(location.search);
  if (state.options.length > 0) {
    dom.optionsInput.value = optionsToText(state.options);
  }
  dom.countInput.value = String(state.count);
  if (state.seed) {
    dom.seedInput.value = state.seed;
  }
}

function buildPlaceholderReels(count, options) {
  dom.reels.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const reel = document.createElement("div");
    reel.className = "reel";
    const track = document.createElement("div");
    track.className = "reel-track";
    const cell = document.createElement("div");
    cell.className = "reel-cell placeholder";
    cell.textContent = options.length > 0 ? options[i % options.length] : "—";
    track.appendChild(cell);
    reel.appendChild(track);
    dom.reels.appendChild(reel);
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateReelToTarget(reelElement, options, target, durationMs) {
  return new Promise((resolve) => {
    const track = reelElement.querySelector(".reel-track");
    track.innerHTML = "";

    const strip = [];
    for (let i = 0; i < STRIP_LENGTH_BEFORE_TARGET; i++) {
      strip.push(options[Math.floor(Math.random() * options.length)]);
    }
    strip.push(target);

    for (const item of strip) {
      const cell = document.createElement("div");
      cell.className = "reel-cell";
      cell.textContent = item;
      track.appendChild(cell);
    }

    const totalDistance = (strip.length - 1) * REEL_ITEM_HEIGHT;
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const y = easeOutCubic(t) * totalDistance;
      track.style.transform = `translateY(-${y}px)`;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        track.innerHTML = "";
        const winnerCell = document.createElement("div");
        winnerCell.className = "reel-cell winner";
        winnerCell.textContent = target;
        track.appendChild(winnerCell);
        track.style.transform = "translateY(0)";
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

async function spin() {
  if (isSpinning) return;
  const { options, count, seed } = readState();
  if (options.length === 0) {
    dom.shareStatus.textContent = "Add at least one option.";
    return;
  }

  const result = pickOptions({ options, count, seed });

  if (!seed) {
    dom.seedInput.value = result.seed;
    syncUrl();
  }

  isSpinning = true;
  dom.pickButton.disabled = true;
  dom.seedDisplay.textContent = `Seed: ${result.seed}`;

  buildPlaceholderReels(count, options);
  const reelElements = dom.reels.querySelectorAll(".reel");
  const tasks = [];
  for (let i = 0; i < reelElements.length; i++) {
    const duration = SPIN_BASE_MS + i * SPIN_STAGGER_MS;
    tasks.push(animateReelToTarget(reelElements[i], options, result.picks[i], duration));
  }
  await Promise.all(tasks);

  isSpinning = false;
  dom.pickButton.disabled = false;
}

function refreshPlaceholderReels() {
  if (isSpinning) return;
  const { options, count } = readState();
  buildPlaceholderReels(count, options);
}

function flashShareStatus(message) {
  dom.shareStatus.textContent = message;
  setTimeout(() => {
    dom.shareStatus.textContent = "";
  }, 2000);
}

function init() {
  loadFromUrl();
  refreshPlaceholderReels();

  dom.optionsInput.addEventListener("input", () => {
    refreshPlaceholderReels();
    syncUrl();
  });
  dom.countInput.addEventListener("input", () => {
    refreshPlaceholderReels();
    syncUrl();
  });
  dom.seedInput.addEventListener("input", syncUrl);

  dom.seedRandom.addEventListener("click", () => {
    dom.seedInput.value = generateRandomSeed();
    syncUrl();
  });

  dom.seedClear.addEventListener("click", () => {
    dom.seedInput.value = "";
    syncUrl();
  });

  dom.pickButton.addEventListener("click", spin);

  dom.copyLink.addEventListener("click", async () => {
    syncUrl();
    try {
      await navigator.clipboard.writeText(location.href);
      flashShareStatus("Link copied!");
    } catch {
      flashShareStatus("Couldn't copy. Use the URL bar.");
    }
  });
}

init();
