// --- Color Conversion: Forward Chain (Hex → OKLCH) ---

/** @param {string} hex - 6-char hex string (no #)
 *  @returns {{ r: number, g: number, b: number }} 0–255 */
function hexToRgb(hex) {
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}

/** Inverse sRGB companding: sRGB 0–1 → linear 0–1
 *  @param {number} c - sRGB channel 0–1
 *  @returns {number} linear channel */
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linear RGB → OKLAB via LMS intermediate
 *  @param {number} r - linear 0–1
 *  @param {number} g - linear 0–1
 *  @param {number} b - linear 0–1
 *  @returns {{ L: number, a: number, b: number }} */
function linearRgbToOklab(r, g, b) {
  const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);

  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

/** OKLAB → OKLCH (polar form)
 *  @param {number} L
 *  @param {number} a
 *  @param {number} b
 *  @returns {{ L: number, C: number, H: number }} H in degrees 0–360 */
function oklabToOklch(L, a, b) {
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

/** Convenience: hex string → OKLCH
 *  @param {string} hex - 6-char hex (no #)
 *  @returns {{ L: number, C: number, H: number }} */
function hexToOklch(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);
  const lab = linearRgbToOklab(lr, lg, lb);
  return oklabToOklch(lab.L, lab.a, lab.b);
}

// --- Color Conversion: Reverse Chain (OKLCH → Hex) ---

/** OKLCH → OKLAB (cartesian)
 *  @param {number} L
 *  @param {number} C
 *  @param {number} H - degrees
 *  @returns {{ L: number, a: number, b: number }} */
function oklchToOklab(L, C, H) {
  const hRad = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(hRad), b: C * Math.sin(hRad) };
}

/** OKLAB → linear RGB
 *  @param {number} L
 *  @param {number} a
 *  @param {number} b
 *  @returns {{ r: number, g: number, b: number }} linear 0–1 (may be out of gamut) */
function oklabToLinearRgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

/** Linear → sRGB companding
 *  @param {number} c - linear 0–1
 *  @returns {number} sRGB 0–1 */
function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** OKLCH → hex string, or null if out of sRGB gamut
 *  @param {number} L
 *  @param {number} C
 *  @param {number} H
 *  @returns {string | null} e.g. "#FF6B35" */
function oklchToHex(L, C, H) {
  const lab = oklchToOklab(L, C, H);
  const lin = oklabToLinearRgb(lab.L, lab.a, lab.b);
  const sr = linearToSrgb(lin.r);
  const sg = linearToSrgb(lin.g);
  const sb = linearToSrgb(lin.b);

  if (sr < -0.001 || sr > 1.001 || sg < -0.001 || sg > 1.001 || sb < -0.001 || sb > 1.001) {
    return null;
  }

  const r = Math.round(Math.min(1, Math.max(0, sr)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, sg)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, sb)) * 255);

  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
}

// --- Soft Scoring System ---

/** Smooth sigmoid transition
 *  @param {number} x - input value
 *  @param {number} center - midpoint of transition
 *  @param {number} width - controls steepness (smaller = sharper)
 *  @returns {number} 0–1 */
function sigmoid(x, center, width) {
  return 1 / (1 + Math.exp(-(x - center) / width));
}

/** Warmth score from OKLCH hue (circular).
 *  Warm center ≈ 65°, cool center ≈ 255°.
 *  @param {number} H - hue in degrees
 *  @param {number} C - chroma (for achromatic detection)
 *  @returns {number} 0–1, higher = warmer */
function computeWarmth(H, C) {
  if (C < 0.01) return 0.5;
  const warmCenter = 65;
  const distFromWarm = Math.min(
    Math.abs(H - warmCenter),
    360 - Math.abs(H - warmCenter)
  );
  return 1 - sigmoid(distFromWarm, 90, 25);
}

/** Lightness score (0 = dark, 1 = light)
 *  @param {number} L - OKLCH lightness 0–1
 *  @returns {number} 0–1 */
function computeLightness(L) {
  return sigmoid(L, 0.55, 0.08);
}

/** Brightness/chroma score (0 = muted, 1 = bright/saturated)
 *  @param {number} C - OKLCH chroma
 *  @returns {number} 0–1 */
function computeBrightness(C) {
  return sigmoid(C, 0.10, 0.03);
}

/** Classify a hex color into seasonal scores.
 *  @param {string} hex - 6-char hex (no #)
 *  @returns {{ oklch: { L: number, C: number, H: number }, scores: Record<string, number>, primarySeason: string }} */
function classifyColor(hex) {
  const oklch = hexToOklch(hex);
  const warmth = computeWarmth(oklch.H, oklch.C);
  const coolness = 1 - warmth;
  const lightness = computeLightness(oklch.L);
  const darkness = 1 - lightness;
  const brightness = computeBrightness(oklch.C);
  const mutedness = 1 - brightness;

  const rawScores = {
    spring: warmth * lightness * brightness,
    summer: coolness * lightness * mutedness,
    autumn: warmth * darkness * mutedness,
    winter: coolness * darkness * brightness,
  };

  const total = rawScores.spring + rawScores.summer + rawScores.autumn + rawScores.winter;

  /** @type {Record<string, number>} */
  const scores = {};
  for (const [season, raw] of Object.entries(rawScores)) {
    scores[season] = total > 0 ? Math.round((raw / total) * 1000) / 10 : 25;
  }

  // Fix rounding to ensure exactly 100%
  const summed = Object.values(scores).reduce((a, b) => a + b, 0);
  const diff = Math.round((100 - summed) * 10) / 10;
  if (diff !== 0) {
    const maxSeason = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    scores[maxSeason] = Math.round((scores[maxSeason] + diff) * 10) / 10;
  }

  const primarySeason = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];

  return { oklch, scores, primarySeason };
}

// --- Canvas-Based Season Territory Maps ---

const MAP_HUE_STEPS = 180;
const MAP_L_STEPS = 80;
const MAP_L_MAX = 0.95;
const MAP_L_MIN = 0.15;
const CHROMA_LEVELS = [0.32, 0.26, 0.21, 0.17, 0.13, 0.09, 0.06, 0.03, 0.01];

/** Fast primary-season lookup without full score normalization.
 *  @param {number} L
 *  @param {number} C
 *  @param {number} H
 *  @returns {string} */
function getPrimarySeason(L, C, H) {
  const w = computeWarmth(H, C);
  const l = computeLightness(L);
  const b = computeBrightness(C);
  const scores = {
    spring: w * l * b,
    summer: (1 - w) * l * (1 - b),
    autumn: w * (1 - l) * (1 - b),
    winter: (1 - w) * (1 - l) * b,
  };
  let best = "spring";
  let bestVal = 0;
  for (const [s, v] of Object.entries(scores)) {
    if (v > bestVal) { best = s; bestVal = v; }
  }
  return best;
}

/** Inline OKLCH → sRGB [r,g,b] 0–255, or null if out of gamut.
 *  Avoids string allocation of oklchToHex for canvas painting.
 *  @param {number} L
 *  @param {number} C
 *  @param {number} H
 *  @returns {number[] | null} */
function oklchToRgb255(L, C, H) {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const lc = l_ * l_ * l_;
  const mc = m_ * m_ * m_;
  const sc = s_ * s_ * s_;

  const lr = +4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const lg = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const lb = -0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc;

  const sr = lr <= 0.0031308 ? 12.92 * lr : 1.055 * Math.pow(lr, 1 / 2.4) - 0.055;
  const sg = lg <= 0.0031308 ? 12.92 * lg : 1.055 * Math.pow(lg, 1 / 2.4) - 0.055;
  const sb = lb <= 0.0031308 ? 12.92 * lb : 1.055 * Math.pow(lb, 1 / 2.4) - 0.055;

  if (sr < -0.002 || sr > 1.002 || sg < -0.002 || sg > 1.002 || sb < -0.002 || sb > 1.002) {
    return null;
  }
  return [
    Math.round(Math.min(1, Math.max(0, sr)) * 255),
    Math.round(Math.min(1, Math.max(0, sg)) * 255),
    Math.round(Math.min(1, Math.max(0, sb)) * 255),
  ];
}

/** @type {Record<string, ImageData>} */
const CANVAS_IMAGE_DATA = {};

/** Paint a season's full color territory onto a canvas.
 *  X = Hue (0–360°), Y = Lightness (light at top, dark at bottom).
 *  For each pixel, tries chroma levels high→low and picks the first
 *  that is both in-gamut and classified as this season.
 *  @param {string} season
 *  @param {HTMLCanvasElement} canvas */
function paintSeasonCanvas(season, canvas) {
  canvas.width = MAP_HUE_STEPS;
  canvas.height = MAP_L_STEPS;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(MAP_HUE_STEPS, MAP_L_STEPS);
  const data = imageData.data;

  for (let y = 0; y < MAP_L_STEPS; y++) {
    const L = MAP_L_MAX - (y / (MAP_L_STEPS - 1)) * (MAP_L_MAX - MAP_L_MIN);
    for (let x = 0; x < MAP_HUE_STEPS; x++) {
      const H = (x / (MAP_HUE_STEPS - 1)) * 360;
      const idx = (y * MAP_HUE_STEPS + x) * 4;

      for (const C of CHROMA_LEVELS) {
        if (getPrimarySeason(L, C, H) !== season) continue;
        const rgb = oklchToRgb255(L, C, H);
        if (!rgb) continue;
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = 255;
        break;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  CANVAS_IMAGE_DATA[season] = imageData;
}

/** Read the hex color at a mouse position on a season canvas.
 *  @param {string} season
 *  @param {HTMLCanvasElement} canvas
 *  @param {MouseEvent} event
 *  @returns {string | null} hex string or null if transparent */
function readCanvasPixelHex(season, canvas, event) {
  const imageData = CANVAS_IMAGE_DATA[season];
  if (!imageData) return null;

  const rect = canvas.getBoundingClientRect();
  const px = Math.floor(((event.clientX - rect.left) / rect.width) * MAP_HUE_STEPS);
  const py = Math.floor(((event.clientY - rect.top) / rect.height) * MAP_L_STEPS);

  if (px < 0 || px >= MAP_HUE_STEPS || py < 0 || py >= MAP_L_STEPS) return null;

  const idx = (py * MAP_HUE_STEPS + px) * 4;
  if (imageData.data[idx + 3] === 0) return null;

  const r = imageData.data[idx];
  const g = imageData.data[idx + 1];
  const b = imageData.data[idx + 2];
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
}

// --- DOM Helpers ---

const hexInput = document.getElementById("hex-input");
const colorPicker = document.getElementById("color-picker");
const colorSwatch = document.getElementById("color-swatch");
const resultText = document.getElementById("result-text");
const oklchBreakdown = document.getElementById("oklch-breakdown");
const affinityBarsContainer = document.getElementById("affinity-bars");
const seasonGrids = document.querySelectorAll(".season-grid");

/** Create a shared tooltip element for canvas hover. */
const canvasTooltip = document.createElement("div");
canvasTooltip.className = "canvas-tooltip";
canvasTooltip.hidden = true;
document.body.appendChild(canvasTooltip);

/** Populate all four palette grids with canvas territory maps. */
function renderPalettes() {
  const seasons = ["spring", "summer", "autumn", "winter"];
  for (const season of seasons) {
    const container = document.getElementById(`${season}-chips`);
    container.innerHTML = "";

    const canvas = document.createElement("canvas");
    canvas.className = "color-canvas";
    paintSeasonCanvas(season, canvas);

    canvas.addEventListener("mousemove", (event) => {
      const hex = readCanvasPixelHex(season, canvas, event);
      if (hex) {
        canvasTooltip.hidden = false;
        canvasTooltip.style.left = `${event.pageX + 12}px`;
        canvasTooltip.style.top = `${event.pageY - 28}px`;
        canvasTooltip.textContent = hex;
        canvasTooltip.style.setProperty("--tooltip-color", hex);
      } else {
        canvasTooltip.hidden = true;
      }
    });

    canvas.addEventListener("mouseleave", () => {
      canvasTooltip.hidden = true;
    });

    canvas.addEventListener("click", (event) => {
      const hex = readCanvasPixelHex(season, canvas, event);
      if (hex) {
        const clean = hex.replace("#", "");
        hexInput.value = clean;
        colorPicker.value = hex;
        updateClassification(clean);
        // Scroll back to input area so user sees the result
        document.querySelector(".input-section").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    container.appendChild(canvas);
  }
}

/** Render the four horizontal affinity bars.
 *  @param {Record<string, number>} scores */
function renderAffinityBars(scores) {
  affinityBarsContainer.innerHTML = "";
  const seasonOrder = ["spring", "summer", "autumn", "winter"];
  for (const season of seasonOrder) {
    const pct = scores[season];
    const row = document.createElement("div");
    row.className = "affinity-row";

    const label = document.createElement("span");
    label.className = "affinity-label";
    label.textContent = season.charAt(0).toUpperCase() + season.slice(1);

    const track = document.createElement("div");
    track.className = "affinity-track";

    const fill = document.createElement("div");
    fill.className = "affinity-fill";
    fill.dataset.season = season;
    fill.style.width = `${pct}%`;

    const pctLabel = document.createElement("span");
    pctLabel.className = "affinity-pct";
    pctLabel.textContent = `${pct}%`;

    track.appendChild(fill);
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(pctLabel);
    affinityBarsContainer.appendChild(row);
  }
}

function sanitizeHex(raw) {
  return raw.replace(/[^0-9a-fA-F]/g, "").substring(0, 6);
}

function isValidHex(hex) {
  return /^[0-9a-fA-F]{6}$/.test(hex);
}

const SEASON_LABELS = {
  spring: "Spring",
  summer: "Summer",
  autumn: "Autumn",
  winter: "Winter",
};

/** @param {string} hex - 6-char hex (no #) */
function updateClassification(hex) {
  if (!isValidHex(hex)) {
    resultText.innerHTML = '<span style="color: var(--color-text-muted);">Enter a valid 6-digit hex color</span>';
    oklchBreakdown.textContent = "";
    affinityBarsContainer.innerHTML = "";
    seasonGrids.forEach((grid) => grid.classList.remove("highlighted"));
    return;
  }

  const { oklch, scores, primarySeason } = classifyColor(hex);

  // Update swatch
  colorSwatch.style.background = `#${hex}`;
  const isLight = oklch.L > 0.85;
  colorSwatch.style.borderColor = isLight ? "var(--color-border)" : "transparent";

  // Update result text
  resultText.innerHTML = `This color belongs to the <span class="season-name" data-season="${primarySeason}">${SEASON_LABELS[primarySeason]}</span> palette`;

  // Update OKLCH breakdown
  oklchBreakdown.textContent = `L ${(oklch.L * 100).toFixed(1)}%  C ${oklch.C.toFixed(3)}  H ${oklch.H.toFixed(1)}°`;

  // Render affinity bars
  renderAffinityBars(scores);

  // Highlight matching season grid
  seasonGrids.forEach((grid) => {
    grid.classList.toggle("highlighted", grid.dataset.season === primarySeason);
  });
}

// --- Diagnostic Wizard ---

const WIZARD_QUESTIONS = [
  {
    id: "sun",
    factor: "temperature",
    question: "How does your skin react to the sun?",
    options: [
      {
        label: "Burns easily or turns pink",
        trait: "cool",
        swatches: ["#F4C2C2", "#E8A0BF"],
        reason: "your skin burns or turns pink in the sun, which indicates a Cool undertone",
      },
      {
        label: "Tans easily or turns golden",
        trait: "warm",
        swatches: ["#D4A76A", "#C4944A"],
        reason: "your skin tans easily, which indicates a Warm undertone",
      },
    ],
  },
  {
    id: "jewelry",
    factor: "temperature",
    question: "Which jewelry looks better on you?",
    options: [
      {
        label: "Silver or platinum",
        trait: "cool",
        swatches: ["#C0C0C0", "#A8A9AD"],
        reason: "silver jewelry flatters you, reinforcing a Cool undertone",
      },
      {
        label: "Gold or brass",
        trait: "warm",
        swatches: ["#FFD700", "#DAA520"],
        reason: "gold jewelry flatters you, reinforcing a Warm undertone",
      },
    ],
  },
  {
    id: "contrast",
    factor: "value",
    question: "What is the contrast between your hair color and skin tone?",
    options: [
      {
        label: "High contrast (e.g. dark hair, light skin)",
        trait: "dark",
        swatches: ["#2C1810", "#F5DEB3"],
        reason: "you have high contrast between hair and skin, which maps to a Dark value",
      },
      {
        label: "Low contrast (similar tones)",
        trait: "light",
        swatches: ["#C4A882", "#F5DEB3"],
        reason: "you have low contrast between hair and skin, which maps to a Light value",
      },
    ],
  },
  {
    id: "eyes",
    factor: "chroma",
    question: "How would you describe your eye color?",
    options: [
      {
        label: "Clear and sparkling",
        trait: "bright",
        swatches: ["#4169E1", "#50C878"],
        reason: "your eyes are clear and vivid, indicating a Bright chroma",
      },
      {
        label: "Soft, greyish, or muted",
        trait: "muted",
        swatches: ["#708090", "#8B8B7A"],
        reason: "your eyes have a soft, muted quality, indicating a Muted chroma",
      },
    ],
  },
];

/** Maps every trait combination to a season.
 *  Canonical matches first; non-canonical combos resolved by giving
 *  temperature (2 questions) more weight than value/chroma (1 each).
 *  @type {Record<string, string>} */
const TRAIT_TO_SEASON = {
  "warm-light-bright": "spring",
  "warm-light-muted": "spring",
  "warm-dark-bright": "autumn",
  "warm-dark-muted": "autumn",
  "cool-light-bright": "winter",
  "cool-light-muted": "summer",
  "cool-dark-bright": "winter",
  "cool-dark-muted": "winter",
};

const wizardSection = document.getElementById("wizard-section");

/** @type {{ step: number, answers: (number | null)[] }} */
const wizardState = { step: 0, answers: [null, null, null, null] };

/** Determine the season from accumulated answers.
 *  @returns {{ season: string, temperature: string, value: string, chroma: string, reasons: string[] }} */
function computeWizardResult() {
  const tallies = { warm: 0, cool: 0, light: 0, dark: 0, bright: 0, muted: 0 };
  /** @type {string[]} */
  const reasons = [];

  for (let i = 0; i < WIZARD_QUESTIONS.length; i++) {
    const answerIdx = wizardState.answers[i];
    if (answerIdx === null) continue;
    const option = WIZARD_QUESTIONS[i].options[answerIdx];
    tallies[option.trait] += 2;
    reasons.push(option.reason);
  }

  const temperature = tallies.warm >= tallies.cool ? "warm" : "cool";
  const value = tallies.dark > tallies.light ? "dark" : "light";
  const chroma = tallies.bright >= tallies.muted ? "bright" : "muted";

  const key = `${temperature}-${value}-${chroma}`;
  const season = TRAIT_TO_SEASON[key] || "spring";

  return { season, temperature, value, chroma, reasons };
}

/** Render the wizard's current state into the wizard section. */
function renderWizard() {
  wizardSection.innerHTML = "";

  if (wizardState.step === 0) {
    renderWizardCta();
  } else if (wizardState.step <= WIZARD_QUESTIONS.length) {
    renderWizardQuestion(wizardState.step - 1);
  } else {
    renderWizardResult();
  }
}

/** Render the initial call-to-action card. */
function renderWizardCta() {
  const card = document.createElement("div");
  card.className = "wizard-card";

  const heading = document.createElement("h2");
  heading.textContent = "Find My Season";

  const description = document.createElement("p");
  description.className = "wizard-description";
  description.textContent = "Not sure which seasonal palette suits you? Take this quick 4-question diagnostic to find out.";

  const startBtn = document.createElement("button");
  startBtn.className = "wizard-btn wizard-btn-primary";
  startBtn.textContent = "Start the Quiz";
  startBtn.addEventListener("click", () => {
    wizardState.step = 1;
    renderWizard();
  });

  card.appendChild(heading);
  card.appendChild(description);
  card.appendChild(startBtn);
  wizardSection.appendChild(card);
}

/** Render a single question step.
 *  @param {number} questionIdx - 0-based index into WIZARD_QUESTIONS */
function renderWizardQuestion(questionIdx) {
  const question = WIZARD_QUESTIONS[questionIdx];
  const card = document.createElement("div");
  card.className = "wizard-card";

  // Progress indicator
  const progress = document.createElement("div");
  progress.className = "wizard-progress";
  for (let i = 0; i < WIZARD_QUESTIONS.length; i++) {
    const dot = document.createElement("div");
    dot.className = "wizard-dot";
    if (i < questionIdx) dot.classList.add("completed");
    if (i === questionIdx) dot.classList.add("active");
    progress.appendChild(dot);
  }
  card.appendChild(progress);

  // Step label
  const stepLabel = document.createElement("div");
  stepLabel.className = "wizard-step-label";
  stepLabel.textContent = `Question ${questionIdx + 1} of ${WIZARD_QUESTIONS.length}`;
  card.appendChild(stepLabel);

  // Question text
  const questionText = document.createElement("h3");
  questionText.className = "wizard-question";
  questionText.textContent = question.question;
  card.appendChild(questionText);

  // Options
  const optionsContainer = document.createElement("div");
  optionsContainer.className = "wizard-options";

  for (let optIdx = 0; optIdx < question.options.length; optIdx++) {
    const opt = question.options[optIdx];
    const optionCard = document.createElement("button");
    optionCard.className = "wizard-option";
    if (wizardState.answers[questionIdx] === optIdx) {
      optionCard.classList.add("selected");
    }

    // Swatches
    const swatchRow = document.createElement("div");
    swatchRow.className = "wizard-swatches";
    for (const color of opt.swatches) {
      const swatch = document.createElement("div");
      swatch.className = "wizard-swatch";
      swatch.style.backgroundColor = color;
      swatchRow.appendChild(swatch);
    }
    optionCard.appendChild(swatchRow);

    // Label
    const labelEl = document.createElement("span");
    labelEl.className = "wizard-option-label";
    labelEl.textContent = opt.label;
    optionCard.appendChild(labelEl);

    optionCard.addEventListener("click", () => {
      wizardState.answers[questionIdx] = optIdx;
      // Auto-advance after brief delay
      setTimeout(() => {
        wizardState.step = questionIdx + 2;
        renderWizard();
      }, 250);
    });

    optionsContainer.appendChild(optionCard);
  }
  card.appendChild(optionsContainer);

  // Navigation
  const nav = document.createElement("div");
  nav.className = "wizard-nav";

  if (questionIdx > 0) {
    const backBtn = document.createElement("button");
    backBtn.className = "wizard-btn wizard-btn-secondary";
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", () => {
      wizardState.step = questionIdx;
      renderWizard();
    });
    nav.appendChild(backBtn);
  }

  card.appendChild(nav);
  wizardSection.appendChild(card);
}

/** Render the result screen with explanation and auto-scroll. */
function renderWizardResult() {
  const { season, temperature, value, chroma, reasons } = computeWizardResult();

  const card = document.createElement("div");
  card.className = "wizard-card wizard-result";

  // Season badge
  const badge = document.createElement("div");
  badge.className = "wizard-season-badge";
  badge.dataset.season = season;
  badge.textContent = SEASON_LABELS[season];
  card.appendChild(badge);

  const subtitle = document.createElement("p");
  subtitle.className = "wizard-result-subtitle";
  const tempLabel = temperature.charAt(0).toUpperCase() + temperature.slice(1);
  const valLabel = value.charAt(0).toUpperCase() + value.slice(1);
  const chromaLabel = chroma.charAt(0).toUpperCase() + chroma.slice(1);
  subtitle.textContent = `${tempLabel} \u00B7 ${valLabel} \u00B7 ${chromaLabel}`;
  card.appendChild(subtitle);

  // "Why this result?" section
  const whyHeading = document.createElement("h4");
  whyHeading.className = "wizard-why-heading";
  whyHeading.textContent = "Why this result?";
  card.appendChild(whyHeading);

  const reasonsList = document.createElement("ul");
  reasonsList.className = "wizard-reasons";
  for (const reason of reasons) {
    const li = document.createElement("li");
    li.textContent = reason.charAt(0).toUpperCase() + reason.slice(1);
    reasonsList.appendChild(li);
  }
  card.appendChild(reasonsList);

  // Action buttons
  const actions = document.createElement("div");
  actions.className = "wizard-actions";

  const scrollBtn = document.createElement("button");
  scrollBtn.className = "wizard-btn wizard-btn-primary";
  scrollBtn.textContent = "View My Palette";
  scrollBtn.addEventListener("click", () => {
    const targetGrid = document.getElementById(`${season}-grid`);
    if (targetGrid) {
      seasonGrids.forEach((grid) => {
        grid.classList.toggle("highlighted", grid.dataset.season === season);
      });
      targetGrid.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  const resetBtn = document.createElement("button");
  resetBtn.className = "wizard-btn wizard-btn-secondary";
  resetBtn.textContent = "Retake Quiz";
  resetBtn.addEventListener("click", () => {
    wizardState.step = 1;
    wizardState.answers = [null, null, null, null];
    renderWizard();
  });

  actions.appendChild(scrollBtn);
  actions.appendChild(resetBtn);
  card.appendChild(actions);

  wizardSection.appendChild(card);

  // Auto-scroll to the matching palette
  const targetGrid = document.getElementById(`${season}-grid`);
  if (targetGrid) {
    seasonGrids.forEach((grid) => {
      grid.classList.toggle("highlighted", grid.dataset.season === season);
    });
    setTimeout(() => {
      targetGrid.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
  }
}

// --- Event Listeners ---

hexInput.addEventListener("input", () => {
  const clean = sanitizeHex(hexInput.value);
  hexInput.value = clean;
  if (isValidHex(clean)) {
    colorPicker.value = `#${clean}`;
  }
  updateClassification(clean);
});

colorPicker.addEventListener("input", () => {
  const hex = colorPicker.value.replace("#", "").toUpperCase();
  hexInput.value = hex;
  updateClassification(hex);
});

// --- Init ---

renderPalettes();
renderWizard();
updateClassification("FF6B35");
