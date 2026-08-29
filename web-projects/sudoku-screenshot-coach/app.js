// DOM controller. It owns the page and nothing else: every decision about
// sudoku or about pixels lives in a tested module next to this file.
//
// Flow: an image comes in (drop, paste or file picker) -> `recognize.js` turns
// it into 81 digits -> the player checks the grid -> `coach.js` picks the move
// and `explain.js` writes the reason -> this file paints it.

import { CELL_COUNT, HOUSES, cellName, computeCandidates, digitsOf, findConflicts, formatBoard, parseBoard } from "./board.js";
import { applyMoveToState, nextHint, reduceCandidates, solvePath } from "./coach.js";
import { redrawDeployLine, startDeployLine } from "./deployFooter.js";
import { LANGUAGES, pickLanguage, t } from "./i18n.js";
import { readPuzzleFromImage } from "./recognize.js";
import { techniqueCatalogue, techniqueInfo } from "./techniques.js";
import { DEFAULT_MODE, parseUrlState, serializeUrlState } from "./urlState.js";
import { buildDigitTemplates } from "./vision/fonts.js";

const EXAMPLE_PUZZLE = "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

const dom = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("file-input"),
  exampleButton: document.getElementById("example-button"),
  clearButton: document.getElementById("clear-button"),
  readStatus: document.getElementById("read-status"),
  readerDetails: document.getElementById("reader-details"),
  sourceCanvas: document.getElementById("source-canvas"),
  warpCanvas: document.getElementById("warp-canvas"),
  board: document.getElementById("board"),
  showCandidates: document.getElementById("show-candidates"),
  reduceButton: document.getElementById("reduce-candidates"),
  copyLink: document.getElementById("copy-link"),
  shareStatus: document.getElementById("share-status"),
  modeHint: document.getElementById("mode-hint"),
  modeSolution: document.getElementById("mode-solution"),
  coachOutput: document.getElementById("coach-output"),
  glossary: document.getElementById("glossary"),
  languageSelect: document.getElementById("language-select"),
  digitPad: document.getElementById("digit-pad"),
  deployLine: document.getElementById("deploy-line"),
};

/** The folder this project lives in, used to ask when it was last deployed. */
const PROJECT_PATH = "web-projects/sudoku-screenshot-coach";

/** Everything the page shows is derived from this. */
const state = {
  board: new Int8Array(CELL_COUNT),
  givens: new Uint8Array(CELL_COUNT), // 1 where the digit came from the image or the link
  uncertain: new Set(), // cells the reader was unsure about
  selected: 0,
  // The candidates in play. They start as the plain ones, from the rules alone,
  // and shrink as the player applies the eliminations the coach proves. The
  // coach reads the same set, so the grid and the advice never disagree.
  cands: null,
  mode: DEFAULT_MODE,
  lang: "en",
  highlight: null, // {focus, support, houses, eliminations, placements}
  templates: null,
};

/** Shorthand for a message in the language the page is set to. */
const say = (key, params) => t(state.lang, key, params);

const cellButtons = [];

// --- helpers ---------------------------------------------------------------

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function setStatus(element, message, kind = "") {
  element.textContent = message;
  element.className = kind ? `status is-${kind}` : "status";
}

/** Templates are built once, lazily: it costs a few canvas draws. */
function templates() {
  if (!state.templates) state.templates = buildDigitTemplates();
  return state.templates;
}

// --- board ----------------------------------------------------------------

function buildBoard() {
  const fragment = document.createDocumentFragment();
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.cell = String(cell);
    button.dataset.row = String(Math.floor(cell / 9));
    button.dataset.col = String(cell % 9);
    button.setAttribute("role", "gridcell");
    button.addEventListener("click", () => selectCell(cell));
    cellButtons.push(button);
    fragment.append(button);
  }
  dom.board.append(fragment);
}

/**
 * The digit buttons under the grid. A phone has no keyboard to type into a
 * cell, so without these the grid could not be corrected on a touch screen.
 */
function buildDigitPad() {
  const buttons = [];
  for (let digit = 1; digit <= 9; digit += 1) {
    buttons.push(`<button type="button" class="pad-button" data-digit="${digit}">${digit}</button>`);
  }
  buttons.push('<button type="button" class="pad-button is-erase" data-digit="0" aria-label="Erase">&#9003;</button>');
  dom.digitPad.innerHTML = buttons.join("");
  for (const button of dom.digitPad.querySelectorAll(".pad-button")) {
    button.addEventListener("click", () => {
      setDigit(state.selected, Number(button.dataset.digit));
      cellButtons[state.selected].focus();
    });
  }
}

function selectCell(cell) {
  state.selected = cell;
  renderBoard();
  cellButtons[cell].focus();
}

/** Paint the grid: digits, candidates, hint highlights and rule conflicts. */
function renderBoard() {
  const conflictCells = new Set();
  for (const conflict of findConflicts(state.board)) for (const cell of conflict.cells) conflictCells.add(cell);
  const candidates = dom.showCandidates.checked ? state.cands : null;
  const highlight = state.highlight;
  const focus = new Set(highlight?.focus ?? []);
  const support = new Set(highlight?.support ?? []);
  const houseCells = new Set();
  for (const houseId of highlight?.houses ?? []) for (const cell of HOUSES[houseId].cells) houseCells.add(cell);
  const cutDigits = new Map();
  for (const elimination of highlight?.eliminations ?? []) {
    if (!cutDigits.has(elimination.cell)) cutDigits.set(elimination.cell, new Set());
    cutDigits.get(elimination.cell).add(elimination.digit);
  }
  const placedDigits = new Map((highlight?.placements ?? []).map((placement) => [placement.cell, placement.digit]));

  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    const button = cellButtons[cell];
    const digit = state.board[cell];
    const classes = ["cell"];
    if (digit !== 0) classes.push(state.givens[cell] ? "is-given" : "is-derived");
    if (cell === state.selected) classes.push("is-selected");
    if (houseCells.has(cell)) classes.push("is-house");
    if (support.has(cell)) classes.push("is-support");
    if (focus.has(cell)) classes.push("is-focus");
    if (state.uncertain.has(cell) && digit !== 0) classes.push("is-uncertain");
    if (conflictCells.has(cell)) classes.push("is-conflict");
    button.className = classes.join(" ");
    button.setAttribute(
      "aria-label",
      digit ? say("ui.cellLabel", { cell: cellName(cell), digit }) : say("ui.cellEmpty", { cell: cellName(cell) })
    );

    if (digit !== 0) {
      button.textContent = String(digit);
    } else if (candidates) {
      const cut = cutDigits.get(cell);
      const placed = placedDigits.get(cell);
      const marks = digitsOf(candidates[cell])
        .map((value) => {
          const mark = value === placed ? " class='is-move'" : cut?.has(value) ? " class='is-cut'" : "";
          return `<span${mark}>${value}</span>`;
        })
        .join("");
      button.innerHTML = `<span class="candidates">${marks}</span>`;
    } else {
      button.textContent = "";
    }
  }
}

/**
 * Change one cell and refresh everything that depends on the grid.
 *
 * A digit the coach proved keeps the eliminations already applied, because they
 * were proved from the same grid and still hold. A digit the player typed throws
 * them away: they may have been reasoned from a misread clue that is now fixed.
 */
function setDigit(cell, digit, { proved = false } = {}) {
  state.board[cell] = digit;
  state.givens[cell] = 0;
  state.uncertain.delete(cell);
  state.highlight = null;
  const fresh = computeCandidates(state.board);
  if (proved && state.cands) for (let index = 0; index < CELL_COUNT; index += 1) fresh[index] &= state.cands[index];
  state.cands = fresh;
  syncUrl();
  renderBoard();
  renderCoach();
}

function loadPuzzleText(text, { asGivens = true, uncertain = [] } = {}) {
  state.board = parseBoard(text);
  state.givens = new Uint8Array(CELL_COUNT);
  if (asGivens) for (let cell = 0; cell < CELL_COUNT; cell += 1) state.givens[cell] = state.board[cell] !== 0 ? 1 : 0;
  state.uncertain = new Set(uncertain);
  state.highlight = null;
  state.cands = computeCandidates(state.board);
  syncUrl();
  renderBoard();
  renderCoach();
}

// --- keyboard -------------------------------------------------------------

function handleKeydown(event) {
  const active = document.activeElement;
  if (!active?.dataset?.cell) return;
  const cell = Number(active.dataset.cell);
  const row = Math.floor(cell / 9);
  const col = cell % 9;

  if (event.key >= "1" && event.key <= "9") {
    setDigit(cell, Number(event.key));
    event.preventDefault();
    return;
  }
  if (["Backspace", "Delete", "0", " "].includes(event.key)) {
    setDigit(cell, 0);
    event.preventDefault();
    return;
  }
  const moves = {
    ArrowUp: [row - 1, col],
    ArrowDown: [row + 1, col],
    ArrowLeft: [row, col - 1],
    ArrowRight: [row, col + 1],
  };
  const target = moves[event.key];
  if (!target) return;
  const [nextRow, nextCol] = target;
  if (nextRow < 0 || nextRow > 8 || nextCol < 0 || nextCol > 8) return;
  selectCell(nextRow * 9 + nextCol);
  event.preventDefault();
}

// --- image input ----------------------------------------------------------

/** Draw an image source onto a canvas and hand back its raw pixels. */
async function toImageData(source) {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  const data = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close?.();
  return data;
}

async function handleImage(blob) {
  setStatus(dom.readStatus, say("read.working"));
  try {
    const image = await toImageData(blob);
    const result = readPuzzleFromImage(image.data, image.width, image.height, templates(), state.lang);
    if (!result.ok) {
      setStatus(dom.readStatus, result.reason, "error");
      dom.readerDetails.hidden = true;
      return;
    }

    drawSourcePreview(image, result.quad);
    drawWarpPreview(result);
    dom.readerDetails.hidden = false;

    loadPuzzleText(result.text, { uncertain: result.uncertainCells });

    const parts = [say(result.filled === 1 ? "read.count.one" : "read.count", { count: result.filled })];
    if (result.repairs.length > 0) {
      const fixes = result.repairs
        .map((repair) =>
          say("read.repair.item", {
            cell: cellName(repair.cell),
            from: repair.from,
            to: repair.to === 0 ? say("read.repair.empty") : repair.to,
          })
        )
        .join(", ");
      parts.push(say(result.repairs.length === 1 ? "read.repaired.one" : "read.repaired", { list: fixes }));
    }
    if (result.uncertainCells.length > 0) {
      parts.push(
        say(result.uncertainCells.length === 1 ? "read.uncertain.one" : "read.uncertain", {
          count: result.uncertainCells.length,
        })
      );
    }
    const kind = result.uncertainCells.length > 0 || result.repairs.length > 0 ? "warn" : "good";
    setStatus(dom.readStatus, parts.join(" "), kind);
  } catch (error) {
    setStatus(dom.readStatus, say("read.failed", { message: error.message }), "error");
  }
}

function drawSourcePreview(image, quad) {
  const canvas = dom.sourceCanvas;
  const maxWidth = 520;
  const scale = Math.min(1, maxWidth / image.width);
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");

  const buffer = document.createElement("canvas");
  buffer.width = image.width;
  buffer.height = image.height;
  buffer.getContext("2d").putImageData(image, 0, 0);
  context.drawImage(buffer, 0, 0, canvas.width, canvas.height);

  context.strokeStyle = "#7ee0c2";
  context.lineWidth = Math.max(2, 3 * scale);
  context.beginPath();
  quad.forEach((corner, index) => {
    const x = corner.x * scale;
    const y = corner.y * scale;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.stroke();
}

function drawWarpPreview(result) {
  const canvas = dom.warpCanvas;
  canvas.width = result.warpSize;
  canvas.height = result.warpSize;
  const context = canvas.getContext("2d");
  const image = context.createImageData(result.warpSize, result.warpSize);
  for (let i = 0; i < result.warped.length; i += 1) {
    const value = result.warped[i];
    image.data[i * 4] = value;
    image.data[i * 4 + 1] = value;
    image.data[i * 4 + 2] = value;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

// --- coaching output -------------------------------------------------------

function techniqueNote(technique) {
  return `<div class="technique-note"><strong>${escapeHtml(technique.name)}.</strong> ${escapeHtml(technique.howItWorks)}</div>`;
}

function moveCard(explanation, { badge = "", extra = "" } = {}) {
  const reasons = explanation.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("");
  return `
    <article class="move-card">
      <div class="move-head">
        <span class="move-title">${escapeHtml(explanation.title)}</span>
        <span class="badge">${escapeHtml(badge || explanation.technique.name)}</span>
      </div>
      <p class="move-action">${escapeHtml(explanation.action)}</p>
      <p class="reason-heading">${escapeHtml(say("ui.whyForced"))}</p>
      <ul class="reason-list">${reasons}</ul>
      ${techniqueNote(explanation.technique)}
      ${extra}
    </article>`;
}

function renderCoach() {
  if (state.mode === "solution") renderSolution();
  else renderHint();
}

function renderHint() {
  const hint = nextHint(state.board, state.lang, state.cands);
  state.highlight = null;

  if (hint.status === "conflict" || hint.status === "unsolvable") {
    dom.coachOutput.innerHTML = `<div class="notice is-error">${escapeHtml(hint.message)}</div>`;
    renderBoard();
    return;
  }
  if (hint.status === "solved") {
    dom.coachOutput.innerHTML = `<div class="notice is-good">${escapeHtml(hint.message)}</div>`;
    renderBoard();
    return;
  }
  if (!hint.explanation) {
    const notice = `<div class="notice is-warn">${escapeHtml(hint.message)}</div>`;
    const apply = hint.fallback
      ? `<p class="row"><button class="primary-button" id="apply-move" type="button">Place ${hint.fallback.digit} in ${cellName(hint.fallback.cell)}</button></p>`
      : "";
    dom.coachOutput.innerHTML = notice + apply;
    if (hint.fallback) {
      state.highlight = { focus: [hint.fallback.cell], support: [], houses: [], placements: [hint.fallback], eliminations: [] };
      document.getElementById("apply-move").addEventListener("click", () => {
        setDigit(hint.fallback.cell, hint.fallback.digit, { proved: true });
      });
    }
    renderBoard();
    return;
  }

  const explanation = hint.explanation;
  const move = explanation.move;
  state.highlight = {
    focus: explanation.highlight.focus,
    support: explanation.highlight.support,
    houses: explanation.highlight.houses,
    placements: move.placements,
    eliminations: move.eliminations,
  };

  const unlocks = hint.unlocks
    ? `<div class="unlocks"><strong>${escapeHtml(say("ui.unlocks"))}</strong> ${escapeHtml(
        say("ui.unlocksBody", { title: hint.unlocks.title, technique: hint.unlocks.technique.name })
      )}</div>`
    : "";

  const warning = hint.status === "multiple" ? `<div class="notice is-warn">${escapeHtml(hint.message)}</div>` : "";
  const buttonLabel = say(move.placements.length > 0 ? "ui.apply.place" : "ui.apply.eliminate");

  dom.coachOutput.innerHTML = `
    ${warning}
    ${moveCard(explanation, { extra: unlocks })}
    <p class="row">
      <button class="primary-button" id="apply-move" type="button">${escapeHtml(buttonLabel)}</button>
      <span class="share-status">${escapeHtml(hint.status === "multiple" ? "" : hint.message)}</span>
    </p>`;

  document.getElementById("apply-move").addEventListener("click", () => applyHintMove(move));
  renderBoard();
}

/**
 * Carry out the move on the grid.
 *
 * A placement writes its digit. An elimination writes no digit: it rules
 * candidates out, and those stay ruled out, so the player watches them leave the
 * grid and the coach moves on to the next step instead of repeating itself.
 */
function applyHintMove(move) {
  if (move.placements.length > 0) {
    const { cell, digit } = move.placements[0];
    setDigit(cell, digit, { proved: true });
    return;
  }
  state.cands = applyMoveToState({ board: state.board, cands: state.cands }, move).cands;
  state.highlight = null;
  // Turn the candidates on, or the player sees nothing happen.
  dom.showCandidates.checked = true;
  renderBoard();
  renderCoach();
}

function renderSolution() {
  const path = solvePath(state.board, state.lang);
  state.highlight = null;

  if (!path.solved) {
    dom.coachOutput.innerHTML = `<div class="notice is-error">${escapeHtml(path.message)}</div>`;
    renderBoard();
    return;
  }

  const placements = path.steps.filter((step) => step.move.placements.length > 0).length;
  const techniquesUsed = [...new Set(path.steps.map((step) => step.explanation.technique.name))];
  const steps = path.steps
    .map(
      (step) => `
      <button class="step" type="button" data-step="${step.index}">
        <span class="step-index">${step.index}</span>
        <span><span class="step-technique">${escapeHtml(step.explanation.technique.name)}</span> — ${escapeHtml(
          step.summary.replace(`${step.explanation.technique.name}: `, "")
        )}</span>
      </button>`
    )
    .join("");

  dom.coachOutput.innerHTML = `
    <article class="move-card">
      <div class="move-head">
        <span class="move-title">${escapeHtml(say("ui.solvedTitle"))}</span>
        <span class="badge is-difficulty">${escapeHtml(path.difficulty.label)}</span>
      </div>
      <p class="move-action">${escapeHtml(path.difficulty.blurb)}</p>
      <dl class="summary-grid">
        <div class="summary-item"><dt>${escapeHtml(say("ui.steps"))}</dt><dd>${path.steps.length}</dd></div>
        <div class="summary-item"><dt>${escapeHtml(say("ui.digitsPlaced"))}</dt><dd>${placements}</dd></div>
        <div class="summary-item"><dt>${escapeHtml(say("ui.hardest"))}</dt><dd>${escapeHtml(
          path.hardestTechnique?.name ?? say("ui.noneNeeded")
        )}</dd></div>
      </dl>
      <p class="reason-heading">${escapeHtml(say("ui.techniquesUsed"))}</p>
      <p>${escapeHtml(techniquesUsed.join(", ") || "None")}</p>
      ${path.usedSearch ? `<div class="notice is-warn" style="margin-top:1rem">${escapeHtml(path.message)}</div>` : ""}
      <p class="reason-heading">${escapeHtml(say("ui.everyStep"))}</p>
      <div class="step-list">${steps}</div>
      <p class="row">
        <button class="primary-button" id="fill-solution" type="button">${escapeHtml(say("ui.fillSolution"))}</button>
      </p>
    </article>
    <div id="step-detail"></div>`;

  for (const button of dom.coachOutput.querySelectorAll(".step")) {
    button.addEventListener("click", () => showStep(path, Number(button.dataset.step)));
  }
  document.getElementById("fill-solution").addEventListener("click", () => {
    loadPuzzleText(formatBoard(path.finalBoard), { asGivens: false });
  });
  renderBoard();
}

/** Show one step of the full solution, with the grid as it stood at that moment. */
function showStep(path, index) {
  const step = path.steps.find((candidate) => candidate.index === index);
  if (!step) return;
  for (const button of dom.coachOutput.querySelectorAll(".step")) {
    button.classList.toggle("is-active", Number(button.dataset.step) === index);
  }
  document.getElementById("step-detail").innerHTML = moveCard(step.explanation, {
    badge: `${say("ui.step", { n: index })} · ${step.explanation.technique.name}`,
  });
  state.highlight = {
    focus: step.explanation.highlight.focus,
    support: step.explanation.highlight.support,
    houses: step.explanation.highlight.houses,
    placements: step.move.placements,
    eliminations: step.move.eliminations,
  };
  renderBoard();
}

function renderGlossary() {
  dom.glossary.innerHTML = techniqueCatalogue(state.lang).map(
    (technique) => `
      <details class="glossary-item">
        <summary>
          ${escapeHtml(technique.name)}
          <span class="badge">${escapeHtml(technique.category)}</span>
          <span class="glossary-summary-text">${escapeHtml(technique.summary)}</span>
        </summary>
        <p class="glossary-body">${escapeHtml(technique.howItWorks)}</p>
      </details>`
  ).join("");
}

// --- url ------------------------------------------------------------------

function syncUrl() {
  const query = serializeUrlState({ puzzle: formatBoard(state.board), mode: state.mode, lang: state.lang });
  history.replaceState(null, "", `${location.pathname}${query}${location.hash}`);
}

/**
 * Switch language. Everything on the page is rebuilt from the message
 * catalogue: the fixed text, the technique list, the coaching, and the labels
 * the screen reader announces.
 */
function setLanguage(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  document.title = `${say("ui.title")} · ${say("ui.mode.hint")}`;
  dom.languageSelect.value = lang;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = say(element.dataset.i18n);
  }
  dom.board.setAttribute("aria-label", say("ui.boardLabel"));
  dom.languageSelect.setAttribute("aria-label", say("ui.language"));
  renderGlossary();
  redrawDeployLine(dom.deployLine, lang, say, escapeHtml);
  syncUrl();
  renderBoard();
  renderCoach();
}

function setMode(mode) {
  state.mode = mode;
  dom.modeHint.classList.toggle("is-active", mode === "hint");
  dom.modeSolution.classList.toggle("is-active", mode === "solution");
  dom.modeHint.setAttribute("aria-selected", String(mode === "hint"));
  dom.modeSolution.setAttribute("aria-selected", String(mode === "solution"));
  syncUrl();
  renderCoach();
}

// --- wiring ---------------------------------------------------------------

function wire() {
  dom.dropzone.addEventListener("click", () => dom.fileInput.click());
  dom.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dom.fileInput.click();
    }
  });
  dom.fileInput.addEventListener("change", () => {
    const file = dom.fileInput.files?.[0];
    if (file) handleImage(file);
    dom.fileInput.value = "";
  });

  for (const type of ["dragenter", "dragover"]) {
    dom.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dom.dropzone.classList.add("is-over");
    });
  }
  for (const type of ["dragleave", "drop"]) {
    dom.dropzone.addEventListener(type, () => dom.dropzone.classList.remove("is-over"));
  }
  dom.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = [...(event.dataTransfer?.files ?? [])].find((candidate) => candidate.type.startsWith("image/"));
    if (file) handleImage(file);
    else setStatus(dom.readStatus, say("ui.notAnImage"), "error");
  });

  document.addEventListener("paste", (event) => {
    const item = [...(event.clipboardData?.items ?? [])].find((candidate) => candidate.type.startsWith("image/"));
    if (!item) return;
    const file = item.getAsFile();
    if (file) {
      event.preventDefault();
      handleImage(file);
    }
  });

  dom.exampleButton.addEventListener("click", () => {
    loadPuzzleText(EXAMPLE_PUZZLE);
    setStatus(dom.readStatus, say("ui.exampleLoaded"), "good");
  });
  dom.clearButton.addEventListener("click", () => {
    loadPuzzleText(".".repeat(81));
    setStatus(dom.readStatus, say("ui.cleared"));
  });

  dom.showCandidates.addEventListener("change", renderBoard);
  dom.reduceButton.addEventListener("click", () => {
    const reduced = reduceCandidates(state.board, state.cands);
    state.cands = reduced.cands;
    state.highlight = null;
    dom.showCandidates.checked = true;
    renderBoard();
    renderCoach();
    const names = reduced.techniques.map((id) => techniqueInfo(id, state.lang).name);
    setStatus(
      dom.readStatus,
      reduced.removed === 0
        ? say("ui.reduce.none")
        : say(reduced.removed === 1 ? "ui.reduce.done.one" : "ui.reduce.done", {
            count: reduced.removed,
            techniques: names.join(", "),
          }),
      "good"
    );
  });
  dom.languageSelect.addEventListener("change", () => setLanguage(dom.languageSelect.value));
  dom.modeHint.addEventListener("click", () => setMode("hint"));
  dom.modeSolution.addEventListener("click", () => setMode("solution"));
  document.addEventListener("keydown", handleKeydown);

  dom.copyLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      dom.shareStatus.textContent = say("ui.copied");
    } catch {
      dom.shareStatus.textContent = say("ui.copyFailed");
    }
    setTimeout(() => {
      dom.shareStatus.textContent = "";
    }, 2500);
  });
}

function start() {
  buildBoard();
  buildDigitPad();
  dom.languageSelect.innerHTML = LANGUAGES.map(
    (language) => `<option value="${language.code}">${escapeHtml(language.label)}</option>`
  ).join("");
  wire();

  const fromUrl = parseUrlState(location.search);
  state.mode = fromUrl.mode;
  // A link that names a language wins; otherwise follow the browser.
  setLanguage(pickLanguage(fromUrl.lang, navigator.languages ?? [navigator.language]));
  setMode(fromUrl.mode);
  if (fromUrl.puzzle) {
    loadPuzzleText(fromUrl.puzzle);
    setStatus(dom.readStatus, say("ui.fromLink"), "good");
  }

  // The footer line is the last thing to arrive and the least important, so it
  // is never awaited and never allowed to interrupt the page.
  startDeployLine(dom.deployLine, PROJECT_PATH, state.lang, say, escapeHtml);
}

start();
