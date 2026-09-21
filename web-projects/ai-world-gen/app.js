// The page. It listens, calls the modules, and builds elements. It holds no
// logic worth a test: anything that could be wrong belongs in a pure module.
//
// Two rules hold here and `invariants.test.js` guards both:
//   - Nothing reaches the screen through `innerHTML` except the deploy line,
//     which carries its own escaper. Every label comes from a model.
//   - Storage is only ever touched through `settings.js`, and the network only
//     through `openRouterClient.js`.

import { CAMERA_LIMITS, cellAtPoint, fitCamera, panBy, zoomAt } from "./camera.js";
import { planStructures } from "./blueprint.js";
import { buildCellDecision, chooseType } from "./cellDecision.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { escapeHtml, say } from "./deployText.js";
import { createDecider, runGeneration } from "./generation.js";
import { countByType, createGrid, getCell, gridFromJSON, gridToJSON, setCell } from "./grid.js";
import { formatPricePerMillion, readCatalogue, transportFor } from "./models.js";
import { describeFailure } from "./openRouterErrors.js";
import * as client from "./openRouterClient.js";
import { ORDER_STRATEGIES, createOrder, readOrderId } from "./orderStrategies.js";
import { presetVocabularyFor } from "./presetVocabularies.js";
import {
  GRID_LIMITS,
  GRID_SIZES,
  SETTING_PRESETS,
  cleanSetting,
  isSettingComplete,
  presetMatching,
  readGridSize,
} from "./presets.js";
import { mulberry32, seedFromText } from "./random.js";
import { analyseReachability } from "./reachability.js";
import { createRenderer, loadTilesheet, renderMapImage, tileThumbnail } from "./render.js";
import {
  browserStorage,
  forgetApiKey,
  readApiKey,
  readModelChoices,
  readStoredStyle,
  readStoredSpriteVariation,
  saveApiKey,
  saveModelChoices,
  saveStoredStyle,
  saveStoredSpriteVariation,
} from "./settings.js";
import { TILE_SIZE, visualTagNames } from "./tileset.js";
import { VISUAL_STYLES, readStyleId } from "./tileStyles.js";
import { buildSearch, readStateFromSearch } from "./urlState.js";
import { runWholeMapGeneration } from "./wholeMap.js";
import {
  describeVocabularyText,
  formatVocabulary,
  generateVocabulary,
  normaliseVocabulary,
  typeById,
} from "./vocabulary.js";

const PROJECT_PATH = "web-projects/ai-world-gen";
const CUSTOM_SIZE_ID = "custom";

const storage = browserStorage();
const element = (id) => document.getElementById(id);

/** Everything the page holds between events. */
const state = {
  view: "setup",
  setting: { location: "", era: "", notes: "" },
  size: "12x12",
  order: "spiral",
  apiKey: "",
  rememberKey: true,
  models: readModelChoices(storage),
  catalogue: readCatalogue(null),
  catalogueLoaded: false,
  styleId: readStoredStyle(storage),
  varySprites: readStoredSpriteVariation(storage),
  sheet: null,
  renderer: null,
  vocabulary: null,
  plan: null,
  grid: null,
  camera: null,
  selected: null,
  latest: null,
  running: false,
  cancelRequested: false,
  logLines: 0,
};

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function setStatus(id, text, tone = "") {
  const node = element(id);
  node.textContent = text;
  if (tone) node.dataset.tone = tone;
  else delete node.dataset.tone;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function make(tag, { className = "", text = "", attrs = {} } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

function option(value, text, disabled = false) {
  const node = make("option", { text });
  node.value = value;
  if (disabled) node.disabled = true;
  return node;
}

function log(text, tone = "") {
  const list = element("log");
  const item = make("li", { text });
  if (tone) item.dataset.tone = tone;
  list.prepend(item);
  state.logLines += 1;
  if (state.logLines > 200) list.lastChild?.remove();
}

function rememberUrl() {
  const search = buildSearch(state);
  history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
}

function hasKey() {
  return state.apiKey.trim() !== "";
}

/* -------------------------------------------------------------------------- */
/* Views                                                                      */
/* -------------------------------------------------------------------------- */

function showView(view) {
  const wanted = view === "map" && !state.grid ? "setup" : view;
  state.view = wanted;
  for (const tab of document.querySelectorAll(".view-tab")) {
    const active = tab.dataset.view === wanted;
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
    if (tab.dataset.view === "map") tab.disabled = !state.grid;
  }
  element("view-setup").hidden = wanted !== "setup";
  element("view-ai").hidden = wanted !== "ai";
  element("view-map").hidden = wanted !== "map";
  if (wanted === "ai" && !state.catalogueLoaded) loadCatalogue();
  if (wanted === "map") requestAnimationFrame(() => redraw());
  if (wanted === "setup") renderSetupStatus();
  rememberUrl();
}

/* -------------------------------------------------------------------------- */
/* Screen 1: the world                                                        */
/* -------------------------------------------------------------------------- */

function renderPresets() {
  const container = element("presets");
  clear(container);
  for (const preset of SETTING_PRESETS) {
    const chip = make("button", { className: "chip", text: preset.label, attrs: { type: "button", "aria-pressed": "false" } });
    chip.addEventListener("click", () => {
      state.setting = cleanSetting(preset);
      renderSettingFields();
      // A suggestion brings its vocabulary, so this world costs no creative call (ADR 0004).
      setVocabularyText(formatVocabulary(presetVocabularyFor(preset.id)));
      rememberUrl();
      renderPresets();
      renderSetupStatus();
    });
    const matches = state.setting.location === preset.location && state.setting.era === preset.era && state.setting.notes === preset.notes;
    chip.setAttribute("aria-pressed", matches ? "true" : "false");
    container.append(chip);
  }
}

function renderSettingFields() {
  element("location").value = state.setting.location;
  element("era").value = state.setting.era;
  element("notes").value = state.setting.notes;
}

function readSettingFields() {
  state.setting = cleanSetting({
    location: element("location").value,
    era: element("era").value,
    notes: element("notes").value,
  });
}

function renderSizeSelect() {
  const select = element("size");
  clear(select);
  for (const size of GRID_SIZES) select.append(option(size.id, size.label));
  select.append(option(CUSTOM_SIZE_ID, "Custom…"));
  const known = GRID_SIZES.some((one) => one.id === state.size);
  select.value = known ? state.size : CUSTOM_SIZE_ID;
  element("custom-size").hidden = known;
  const { width, height } = readGridSize(state.size);
  element("custom-width").value = String(width);
  element("custom-height").value = String(height);
}

function readSizeFields() {
  const chosen = element("size").value;
  if (chosen === CUSTOM_SIZE_ID) {
    const clamp = (value) => Math.min(GRID_LIMITS.max, Math.max(GRID_LIMITS.min, Number(value) || GRID_LIMITS.min));
    const width = clamp(element("custom-width").value);
    const height = clamp(element("custom-height").value);
    state.size = `${width}x${height}`;
    element("custom-size").hidden = false;
  } else {
    state.size = chosen;
    element("custom-size").hidden = true;
  }
  rememberUrl();
}

function renderOrderSelect() {
  const select = element("order");
  clear(select);
  for (const strategy of ORDER_STRATEGIES) select.append(option(strategy.id, strategy.label));
  select.value = state.order;
  renderOrderHelp();
}

function renderOrderHelp() {
  const strategy = ORDER_STRATEGIES.find((one) => one.id === state.order);
  element("order-help").textContent = strategy?.description ?? "";
}

function modelName(id) {
  return state.catalogue.find((one) => one.id === id)?.name ?? id;
}

function renderSetupStatus() {
  if (!hasKey()) {
    setStatus("setup-status", "No OpenRouter key yet. Add one in AI Setup before you generate.", "warn");
    return;
  }
  const transport = transportFor(state.models.decisionModel, state.catalogue);
  const note = transport === "chat" ? " (a text model standing in for Jev: slower)" : "";
  const box = readVocabularyBox();
  const vocabularyLine =
    box.state === "valid"
      ? `The vocabulary comes from the box: no creative call.`
      : `${modelName(state.models.narrativeModel)} writes the vocabulary.`;
  const fillLine =
    state.models.generation === "whole-map"
      ? `${modelName(state.models.narrativeModel)} draws the whole map in one call.`
      : `${modelName(state.models.decisionModel)} decides each cell${note}.`;
  setStatus("setup-status", `${fillLine} ${vocabularyLine}`);
}

/* The vocabulary box: a preset fills it, a person may edit it, and an empty box
 * means the model writes it (ADR 0004). */

function readVocabularyBox() {
  return describeVocabularyText(element("vocabulary-json").value, visualTagNames());
}

function setVocabularyText(text) {
  element("vocabulary-json").value = text;
  renderVocabularyStatus();
}

function renderVocabularyStatus() {
  const box = readVocabularyBox();
  const tone = box.state === "valid" ? "ok" : box.state === "invalid" ? "error" : "";
  setStatus("vocabulary-status", box.summary, tone);
  element("vocabulary-summary").textContent = box.summary;
  const errors = element("vocabulary-errors");
  clear(errors);
  for (const problem of box.errors.slice(0, 8)) errors.append(make("li", { text: problem }));
  if (box.errors.length > 8) errors.append(make("li", { text: `…and ${box.errors.length - 8} more.` }));
  element("vocabulary-format").disabled = box.state !== "valid";
  element("vocabulary-clear").disabled = box.state === "empty";
}

/* -------------------------------------------------------------------------- */
/* Screen 2: the AI connection                                                */
/* -------------------------------------------------------------------------- */

function renderKeyField() {
  element("api-key").value = state.apiKey;
  element("remember-key").checked = state.rememberKey;
}

function readKeyField() {
  state.apiKey = element("api-key").value.trim();
  state.rememberKey = element("remember-key").checked;
  if (state.rememberKey) saveApiKey(storage, state.apiKey);
  else forgetApiKey(storage);
  if (state.apiKey === "") forgetApiKey(storage);
}

async function testKey() {
  readKeyField();
  if (!hasKey()) {
    setStatus("key-status", "Paste a key first.", "warn");
    return;
  }
  setStatus("key-status", "Asking OpenRouter about this key…");
  const result = await client.checkKey(state.apiKey);
  if (!result.ok) {
    setStatus("key-status", describeFailure(result), "error");
    return;
  }
  const info = result.data?.data ?? {};
  const parts = [`Connected${info.label ? ` as "${info.label}"` : ""}.`];
  if (Number.isFinite(info.usage)) parts.push(`Spent so far: $${Number(info.usage).toFixed(2)}.`);
  if (info.limit === null || info.limit === undefined) parts.push("No spending limit on this key.");
  else if (Number.isFinite(info.limit)) parts.push(`Limit: $${Number(info.limit).toFixed(2)}.`);
  if (info.is_free_tier === true) parts.push("Free tier: only free models will answer.");
  parts.push(`The browser reached openrouter.ai directly in ${result.elapsedMs} ms, so the CORS path works.`);
  setStatus("key-status", parts.join(" "), "ok");
}

function forgetKey() {
  state.apiKey = "";
  forgetApiKey(storage);
  renderKeyField();
  setStatus("key-status", "The key is gone from this browser.", "ok");
}

function renderModelSelects() {
  const decisionModels = state.catalogue.filter((one) => one.decisions);
  const textModels = state.catalogue.filter((one) => one.text);
  const label = (model) => {
    const price = formatPricePerMillion(model.promptPerMillion);
    return price ? `${model.name} · ${price} in` : model.name;
  };

  const decision = element("decision-model");
  clear(decision);
  const decisionGroup = make("optgroup", { attrs: { label: "Decision models (typed answers, fast)" } });
  for (const model of decisionModels) decisionGroup.append(option(model.id, label(model)));
  const standInGroup = make("optgroup", { attrs: { label: "Text models standing in (slower, one JSON answer per cell)" } });
  for (const model of textModels.filter((one) => one.jsonOutput)) standInGroup.append(option(model.id, label(model)));
  decision.append(decisionGroup, standInGroup);
  if (!state.catalogue.some((one) => one.id === state.models.decisionModel)) {
    decision.append(option(state.models.decisionModel, `${state.models.decisionModel} (not in the list)`));
  }
  decision.value = state.models.decisionModel;

  const narrative = element("narrative-model");
  clear(narrative);
  const jsonGroup = make("optgroup", { attrs: { label: "Text models with JSON output" } });
  for (const model of textModels.filter((one) => one.jsonOutput)) jsonGroup.append(option(model.id, label(model)));
  const otherGroup = make("optgroup", { attrs: { label: "Other text models (JSON not guaranteed)" } });
  for (const model of textModels.filter((one) => !one.jsonOutput)) otherGroup.append(option(model.id, label(model)));
  narrative.append(jsonGroup);
  if (otherGroup.childElementCount > 0) narrative.append(otherGroup);
  if (!state.catalogue.some((one) => one.id === state.models.narrativeModel)) {
    narrative.append(option(state.models.narrativeModel, `${state.models.narrativeModel} (not in the list)`));
  }
  narrative.value = state.models.narrativeModel;
  element("generation-mode").value = state.models.generation;
}

function readModelSelects() {
  state.models = {
    decisionModel: element("decision-model").value || state.models.decisionModel,
    narrativeModel: element("narrative-model").value || state.models.narrativeModel,
    generation: element("generation-mode").value || state.models.generation,
  };
  saveModelChoices(storage, state.models);
}

async function loadCatalogue() {
  setStatus("models-status", "Loading the model list from OpenRouter…");
  const result = await client.listModels();
  if (!result.ok) {
    setStatus("models-status", `${describeFailure(result)} A short built-in list is shown instead.`, "warn");
    return;
  }
  state.catalogue = readCatalogue(result.data);
  state.catalogueLoaded = true;
  renderModelSelects();
  const decisions = state.catalogue.filter((one) => one.decisions).length;
  setStatus("models-status", `${state.catalogue.length} models listed, ${decisions} of them decision models.`, "ok");
}

/* -------------------------------------------------------------------------- */
/* Screen 3: the map                                                          */
/* -------------------------------------------------------------------------- */

function canvasViewport() {
  const canvas = element("map");
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

function fitMap() {
  if (!state.grid) return;
  state.camera = fitCamera(state.grid, TILE_SIZE, canvasViewport());
  redraw();
}

function redraw() {
  if (!state.renderer) return;
  // A hidden canvas measures 0 by 0, and a camera fitted to that is a dot in a
  // corner. Fit only once the canvas has a size; until then there is nothing to see.
  if (state.grid && !state.camera) {
    const viewport = canvasViewport();
    if (viewport.width === 0 || viewport.height === 0) {
      requestAnimationFrame(redraw);
      return;
    }
    state.camera = fitCamera(state.grid, TILE_SIZE, viewport);
  }
  state.renderer.draw({
    grid: state.grid,
    vocabulary: state.vocabulary,
    camera: state.camera,
    selected: state.selected,
    latest: state.latest,
    styleId: state.styleId,
    varySprites: state.varySprites,
  });
}

/** The toggle only means something in the pixel style; the code styles have one drawing per tag. */
function renderSpriteVariationControl() {
  element("vary-sprites").checked = state.varySprites;
  element("vary-sprites-control").hidden = state.styleId !== "urizen";
}

function renderStyleSelect() {
  const select = element("style");
  clear(select);
  for (const style of VISUAL_STYLES) {
    const item = option(style.id, style.label);
    item.title = style.description;
    select.append(item);
  }
  select.value = state.styleId;
}

/** A style change is a redraw of the same grid, and the legend and inspector follow (ADR 0003). */
function changeStyle(styleId) {
  state.styleId = readStyleId(styleId);
  saveStoredStyle(storage, state.styleId);
  renderSpriteVariationControl();
  renderLegend();
  renderInspector();
  redraw();
}

function renderProgress(done, total) {
  element("progress-bar").style.width = total > 0 ? `${(100 * done) / total}%` : "0%";
}

function typeFlags(type) {
  return [type.walkable ? "walkable" : "blocked", type.isBarrier ? "barrier" : null, type.interactable ? "interactable" : null].filter(Boolean).join(" · ");
}

function renderLegend() {
  const list = element("legend");
  clear(list);
  if (!state.vocabulary) return;
  const counts = state.grid ? countByType(state.grid) : {};
  for (const type of state.vocabulary.elements) {
    const item = make("li");
    item.title = `${type.description} Placement: ${type.placementRules}`;
    item.append(tileThumbnail(state.sheet, type.visualTag, 0, 2, state.styleId));
    const text = make("div");
    text.append(make("div", { text: type.label }), make("div", { className: "legend-flags", text: typeFlags(type) }));
    item.append(text, make("span", { className: "legend-count", text: String(counts[type.id] ?? 0) }));
    list.append(item);
  }
}

function renderWorldHeader() {
  element("map-heading").textContent = state.vocabulary?.name ?? "World";
  element("world-summary").textContent = state.vocabulary?.summary ?? "";
}

function renderInspector() {
  const empty = element("inspector-empty");
  const panel = element("inspector");
  const cell = state.selected && state.grid ? getCell(state.grid, state.selected.x, state.selected.y) : null;
  if (!state.selected || !state.vocabulary) {
    empty.hidden = false;
    panel.hidden = true;
    return;
  }
  empty.hidden = true;
  panel.hidden = false;
  const type = cell ? typeById(state.vocabulary, cell.typeId) : null;

  const tile = element("inspector-tile");
  clear(tile);
  tile.append(tileThumbnail(state.sheet, type?.visualTag ?? "unknown", 0, 4, state.styleId));
  element("inspector-label").textContent = type?.label ?? (cell ? cell.typeId : "Not decided yet");
  element("inspector-coords").textContent = `x ${state.selected.x}, y ${state.selected.y}`;
  element("inspector-description").textContent = type?.description ?? "";

  const properties = element("inspector-properties");
  clear(properties);
  const row = (name, value) => {
    properties.append(make("dt", { text: name }), make("dd", { text: value }));
  };
  if (type) {
    row("Type id", type.id);
    row("Visual tag", type.visualTag);
    row("Flags", typeFlags(type));
    row("Placement", type.placementRules);
    row("Instance fields", type.instanceFields.length > 0 ? type.instanceFields.join(", ") : "none (plain terrain)");
  }
  if (cell) {
    row("Decided by", cell.source === "model" ? "the model" : cell.source === "fallback" ? "a fallback (the model failed)" : "you, by hand");
    if (cell.source === "model") {
      row("Confidence", `${Math.round((cell.confidence ?? 0) * 100)}%`);
      if (cell.modelChoice && cell.modelChoice !== cell.typeId) {
        row("Model's first pick", `${typeById(state.vocabulary, cell.modelChoice)?.label ?? cell.modelChoice} (sampled another option)`);
      }
      const top = Object.entries(cell.probabilities ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id, p]) => `${typeById(state.vocabulary, id)?.label ?? id} ${Math.round(p * 100)}%`)
        .join(", ");
      if (top) row("Top options", top);
      row("Answered in", `${cell.elapsedMs} ms${cell.attempts > 1 ? ` after ${cell.attempts} tries` : ""}`);
    }
    if (cell.error) row("Error", cell.error);
  }

  const select = element("inspector-type");
  clear(select);
  select.append(option("", cell ? "Pick another type…" : "Pick a type…", true));
  for (const one of state.vocabulary.elements) select.append(option(one.id, one.label));
  select.value = cell?.typeId ?? "";
  element("regenerate-cell").disabled = state.running || !hasKey();
}

function renderReachability() {
  const summary = element("check-summary");
  const list = element("check-list");
  clear(list);
  if (!state.grid || !state.vocabulary) {
    summary.textContent = "Runs when the map is complete.";
    return;
  }
  if (state.grid.cells.some((cell) => cell === null)) {
    summary.textContent = "Runs when the map is complete.";
    return;
  }
  const report = analyseReachability(state.grid, state.vocabulary);
  if (report.walkableCount === 0) {
    summary.textContent = "No walkable cell at all: nobody could stand anywhere on this map.";
    summary.dataset.tone = "error";
    return;
  }
  if (report.ok) {
    summary.textContent = `All ${report.walkableCount} walkable cells connect. One open region, nothing sealed off.`;
    summary.dataset.tone = "ok";
    return;
  }
  summary.textContent = `${report.regions.length} separate regions. ${report.sealedCells.length} walkable cells cannot be reached from the largest one (${report.largestRegion} cells).`;
  summary.dataset.tone = "warn";
  for (const region of report.regions.slice(1, 6)) {
    const first = region.cells[0];
    const item = make("li", { text: `Sealed region of ${region.size} cell${region.size === 1 ? "" : "s"}, starting at x ${first.x}, y ${first.y}` });
    item.addEventListener("click", () => selectCell(first));
    item.style.cursor = "pointer";
    list.append(item);
  }
  if (report.regions.length > 6) list.append(make("li", { text: `…and ${report.regions.length - 6} more.` }));
}

function selectCell(coordinate) {
  state.selected = coordinate;
  renderInspector();
  redraw();
}

function afterGridChange() {
  renderLegend();
  renderReachability();
  renderInspector();
  redraw();
  element("download").hidden = !state.grid;
  element("download-png").hidden = !state.grid;
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                 */
/* -------------------------------------------------------------------------- */

function makeGenerate() {
  return ({ messages, jsonSchema, ...options }) =>
    client.generate({ apiKey: state.apiKey, model: state.models.narrativeModel, messages, jsonSchema, maxTokens: 6000, ...options });
}

function makeDecider() {
  return createDecider({
    client,
    transport: transportFor(state.models.decisionModel, state.catalogue),
    apiKey: state.apiKey,
    model: state.models.decisionModel,
    vocabulary: state.vocabulary,
  });
}

async function generateWorld() {
  readSettingFields();
  readSizeFields();
  if (!hasKey()) {
    setStatus("setup-status", "Add an OpenRouter key in AI Setup first.", "error");
    showView("ai");
    return;
  }
  if (!isSettingComplete(state.setting)) {
    setStatus("setup-status", "Write at least a location.", "error");
    element("location").focus();
    return;
  }
  if (state.running) return;
  const box = readVocabularyBox();
  if (box.state === "invalid") {
    setStatus("setup-status", "The vocabulary box has problems. Fix them or clear it.", "error");
    element("vocabulary-details").open = true;
    element("vocabulary-json").focus();
    return;
  }

  const { width, height } = readGridSize(state.size);
  state.vocabulary = null;
  state.grid = createGrid(width, height);
  state.camera = null;
  state.selected = null;
  state.latest = null;
  state.running = true;
  state.cancelRequested = false;
  clear(element("log"));
  state.logLines = 0;
  renderWorldHeader();
  renderProgress(0, 1);
  element("stop").hidden = false;
  showView("map");
  afterGridChange();

  if (box.state === "valid") {
    // The box already holds a checked vocabulary: no creative call (ADR 0004).
    state.vocabulary = box.vocabulary;
    log(`Vocabulary: "${box.vocabulary.name}", ${box.vocabulary.elements.length} types from the setup screen, no model call`);
  } else {
    setStatus("map-status", `Asking ${modelName(state.models.narrativeModel)} what this world is made of…`);
    log(`Vocabulary: asking ${state.models.narrativeModel}`);
    const started = performance.now();
    const result = await generateVocabulary({
      generate: makeGenerate(),
      setting: state.setting,
      visualTags: visualTagNames(),
      attempts: 3,
      onAttempt: ({ attempt, errors }) => {
        if (attempt > 1) {
          setStatus("map-status", `The vocabulary had ${errors.length} problem${errors.length === 1 ? "" : "s"}; asking again (attempt ${attempt} of 3)…`, "warn");
          log(`Vocabulary attempt ${attempt}: ${errors.slice(0, 3).join(" | ")}`, "warn");
        }
      },
    });
    if (!result.ok) {
      state.running = false;
      element("stop").hidden = true;
      const reason = result.failure ? describeFailure(result.failure) : `The model could not produce a valid vocabulary in ${result.attempts} attempts. Last problems: ${result.errors.slice(0, 3).join(" ")}`;
      setStatus("map-status", reason, "error");
      log(reason, "error");
      return;
    }
    state.vocabulary = result.vocabulary;
    const vocabularyMs = Math.round(performance.now() - started);
    log(`Vocabulary: ${result.vocabulary.elements.length} types in ${vocabularyMs} ms (${result.attempts} attempt${result.attempts === 1 ? "" : "s"})`);
    // Put the paid answer in the box, so the next run of this world is free and editable.
    setVocabularyText(formatVocabulary(result.vocabulary));
  }
  renderWorldHeader();
  renderLegend();

  const runSeed = seedFromText(JSON.stringify(state.setting)) ^ Date.now();
  // The blueprint first: where the structures stand, before any cell is asked about (blueprint.js).
  state.plan = planStructures({ vocabulary: state.vocabulary, width, height, random: mulberry32(runSeed ^ 0x51ed270b) });
  if (state.plan.rooms.length > 0) log(`Plan: ${state.plan.rooms.map((room) => `${room.label} ${room.width}×${room.height} at (${room.x}, ${room.y})`).join(", ")}`);
  const summary = state.models.generation === "whole-map" ? await generateWholeMap(width, height) : await generateCellByCell(width, height, runSeed);

  state.running = false;
  state.latest = null;
  element("stop").hidden = true;
  afterGridChange();
  const average = Math.round(summary.averageMs);
  if (summary.status === "done" && summary.mode === "whole-map") {
    const tokens = summary.usage.promptTokens + summary.usage.completionTokens;
    setStatus("map-status", `Done: ${summary.placedCount} cells in one answer, ${(summary.elapsedMs / 1000).toFixed(1)} s, ${summary.modelCalls} call${summary.modelCalls === 1 ? "" : "s"}, ${tokens.toLocaleString()} tokens.`, "ok");
  } else if (summary.status === "done") {
    setStatus("map-status", `Done: ${summary.placedCount} cells in ${(summary.elapsedMs / 1000).toFixed(1)} s, ${average} ms per decision${summary.fallbackCount > 0 ? `, ${summary.fallbackCount} fallback${summary.fallbackCount === 1 ? "" : "s"}` : ""}.`, summary.fallbackCount > 0 ? "warn" : "ok");
  } else if (summary.status === "cancelled") {
    setStatus("map-status", `Stopped after ${summary.placedCount} cells. Click a cell to inspect it, or generate again.`, "warn");
  } else {
    setStatus("map-status", `Stopped: ${describeFailure(summary.failure)}`, "error");
    log(describeFailure(summary.failure), "error");
  }
}

/** The whole map in one call to the narrative model (wholeMap.js). The grid is drawn when the answer lands. */
async function generateWholeMap(width, height) {
  setStatus("map-status", `${modelName(state.models.narrativeModel)} is drawing the whole ${width} × ${height} map in one call…`);
  log(`Whole map: asking ${state.models.narrativeModel} for ${width * height} cells in one answer`);
  const summary = await runWholeMapGeneration({
    grid: state.grid,
    vocabulary: state.vocabulary,
    setting: state.setting,
    plan: state.plan,
    generate: makeGenerate(),
    onAttempt: ({ attempt, errors }) => {
      if (attempt > 1) {
        setStatus("map-status", `The map had ${errors.length} problem${errors.length === 1 ? "" : "s"}; asking again (attempt ${attempt} of 3)…`, "warn");
        log(`Whole map attempt ${attempt}: ${errors.slice(0, 3).join(" | ")}`, "warn");
      }
    },
  });
  if (summary.status === "done") {
    log(`Whole map: ${summary.placedCount} cells in ${summary.elapsedMs} ms, ${summary.usage.promptTokens} prompt tokens, ${summary.usage.completionTokens} answer tokens`);
    renderProgress(summary.placedCount, summary.placedCount);
    redraw();
    renderLegend();
  }
  return summary;
}

/** One decision per cell, in the chosen order, drawn live (generation.js). */
async function generateCellByCell(width, height, runSeed) {
  const transport = transportFor(state.models.decisionModel, state.catalogue);
  setStatus("map-status", `${modelName(state.models.decisionModel)} is deciding ${width * height} cells${transport === "chat" ? " (text model standing in)" : ""}…`);
  const order = createOrder(readOrderId(state.order), { width, height, random: mulberry32(runSeed) });
  return runGeneration({
    grid: state.grid,
    vocabulary: state.vocabulary,
    setting: state.setting,
    order,
    decide: makeDecider(),
    plan: state.plan,
    isCancelled: () => state.cancelRequested,
    onCell: ({ x, y, cell, index, total }) => {
      state.latest = { x, y };
      renderProgress(index + 1, total);
      const type = typeById(state.vocabulary, cell.typeId);
      if (cell.source === "fallback") log(`(${x}, ${y}) fallback → ${type?.label ?? cell.typeId}: ${cell.error}`, "warn");
      else log(`(${x}, ${y}) ${type?.label ?? cell.typeId} · ${Math.round((cell.confidence ?? 0) * 100)}% · ${cell.elapsedMs} ms`);
      setStatus("map-status", `Cell ${index + 1} of ${total} · ${type?.label ?? cell.typeId} · ${cell.elapsedMs} ms`);
      redraw();
      if ((index + 1) % 8 === 0) renderLegend();
    },
  });
}

async function regenerateCell() {
  if (!state.selected || !state.grid || !state.vocabulary || state.running || !hasKey()) return;
  const { x, y } = state.selected;
  const previous = getCell(state.grid, x, y);
  setCell(state.grid, x, y, null);
  element("regenerate-cell").disabled = true;
  setStatus("map-status", `Asking the model again about x ${x}, y ${y}…`);
  const request = buildCellDecision({ vocabulary: state.vocabulary, setting: state.setting, grid: state.grid, x, y, plan: state.plan });
  const result = await makeDecider()(request);
  element("regenerate-cell").disabled = false;
  if (!result.ok || !result.answer) {
    setCell(state.grid, x, y, previous);
    setStatus("map-status", result.ok ? "The model gave an answer that names no type." : describeFailure(result), "error");
    afterGridChange();
    return;
  }
  const typeId = chooseType({ choice: result.answer.choice, probabilities: result.answer.probabilities, spread: 1 });
  setCell(state.grid, x, y, {
    typeId,
    confidence: result.answer.probabilities[typeId] ?? result.answer.confidence,
    modelChoice: result.answer.choice,
    probabilities: result.answer.probabilities,
    source: "model",
    elapsedMs: result.elapsedMs,
    attempts: 1,
  });
  setStatus("map-status", `x ${x}, y ${y} is now ${typeById(state.vocabulary, typeId)?.label ?? typeId} (${result.elapsedMs} ms).`, "ok");
  afterGridChange();
}

function changeCellType(typeId) {
  if (!state.selected || !state.grid || !typeById(state.vocabulary, typeId)) return;
  const { x, y } = state.selected;
  setCell(state.grid, x, y, { typeId, confidence: 1, modelChoice: null, probabilities: {}, source: "hand", elapsedMs: 0, attempts: 0 });
  afterGridChange();
}

/* -------------------------------------------------------------------------- */
/* Saving and loading                                                         */
/* -------------------------------------------------------------------------- */

/** The file name both downloads use: the world's name, with one extension. */
function mapFileName(extension) {
  const slug = (state.vocabulary.name || "world").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `${slug}.${extension}`;
}

/** Hand a blob to the browser as a download. The link never reaches the screen. */
function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = make("a", { attrs: { href: url, download: fileName } });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadMap() {
  if (!state.grid || !state.vocabulary) return;
  const document_ = {
    format: "ai-world-gen/map",
    version: 1,
    createdAt: new Date().toISOString(),
    setting: state.setting,
    order: state.order,
    vocabulary: state.vocabulary,
    plan: state.plan,
    grid: gridToJSON(state.grid),
  };
  saveBlob(new Blob([JSON.stringify(document_, null, 2)], { type: "application/json" }), mapFileName("json"));
}

/**
 * The picture, not the data: the whole grid at a fixed size, in the style and
 * the sprite setting on screen. The camera, the frames and the corner marks
 * stay out of it, so the file is the map and not a screenshot.
 */
async function downloadMapImage() {
  if (!state.grid || !state.vocabulary || !state.sheet) return;
  try {
    const blob = await renderMapImage(state.sheet, {
      grid: state.grid,
      vocabulary: state.vocabulary,
      styleId: state.styleId,
      varySprites: state.varySprites,
    });
    saveBlob(blob, mapFileName("png"));
  } catch (error) {
    setStatus("map-status", error.message, "error");
  }
}

async function loadMapFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    setStatus("setup-status", "That file is not JSON.", "error");
    return;
  }
  const vocabulary = normaliseVocabulary(data?.vocabulary, visualTagNames());
  const grid = gridFromJSON(data?.grid);
  if (!vocabulary.ok || !grid) {
    setStatus("setup-status", "That file does not hold a map from this page.", "error");
    return;
  }
  state.vocabulary = vocabulary.vocabulary;
  state.grid = grid;
  state.plan = Array.isArray(data.plan?.rooms) ? data.plan : null;
  state.setting = cleanSetting(data.setting);
  state.order = readOrderId(data.order);
  state.camera = null;
  state.selected = null;
  state.latest = null;
  renderSettingFields();
  renderOrderSelect();
  renderPresets();
  setVocabularyText(formatVocabulary(state.vocabulary));
  renderWorldHeader();
  renderProgress(1, 1);
  showView("map");
  afterGridChange();
  setStatus("map-status", `Loaded ${state.vocabulary.name}: ${grid.width} × ${grid.height} cells.`, "ok");
}

/* -------------------------------------------------------------------------- */
/* Canvas interaction: pan, zoom, pick                                        */
/* -------------------------------------------------------------------------- */

function wireCanvas() {
  const canvas = element("map");
  let dragging = null;
  let pinch = null;

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.grid) return;
    canvas.setPointerCapture(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId };
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    if (!dragging.moved && Math.hypot(dx, dy) < 4) return;
    dragging.moved = true;
    canvas.classList.add("is-dragging");
    state.camera = panBy(state.camera, dx, dy);
    dragging.x = event.clientX;
    dragging.y = event.clientY;
    redraw();
  });
  const endDrag = (event) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    canvas.classList.remove("is-dragging");
    if (!dragging.moved && state.grid) {
      const box = canvas.getBoundingClientRect();
      const hit = cellAtPoint(state.camera, TILE_SIZE, state.grid, event.clientX - box.left, event.clientY - box.top);
      if (hit) selectCell(hit);
    }
    dragging = null;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!state.grid) return;
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      state.camera = zoomAt(state.camera, event.clientX - box.left, event.clientY - box.top, factor);
      redraw();
    },
    { passive: false },
  );

  canvas.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      const [a, b] = event.touches;
      pinch = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
    }
  });
  canvas.addEventListener(
    "touchmove",
    (event) => {
      if (!pinch || event.touches.length !== 2 || !state.grid) return;
      event.preventDefault();
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const box = canvas.getBoundingClientRect();
      const centreX = (a.clientX + b.clientX) / 2 - box.left;
      const centreY = (a.clientY + b.clientY) / 2 - box.top;
      state.camera = zoomAt(state.camera, centreX, centreY, distance / pinch.distance);
      pinch.distance = distance;
      redraw();
    },
    { passive: false },
  );
  canvas.addEventListener("touchend", () => {
    pinch = null;
  });

  const zoomCentre = (factor) => {
    if (!state.grid) return;
    const { width, height } = canvasViewport();
    state.camera = zoomAt(state.camera, width / 2, height / 2, factor);
    redraw();
  };
  element("zoom-in").addEventListener("click", () => zoomCentre(1.3));
  element("zoom-out").addEventListener("click", () => zoomCentre(1 / 1.3));
  element("zoom-fit").addEventListener("click", fitMap);
  window.addEventListener("resize", () => {
    if (state.view === "map") redraw();
  });
  window.addEventListener("keydown", (event) => {
    if (state.view !== "map" || !state.camera) return;
    if (event.key === "+" || event.key === "=") zoomCentre(1.3);
    if (event.key === "-") zoomCentre(1 / 1.3);
    if (event.key === "0") fitMap();
  });
  void CAMERA_LIMITS;
}

/* -------------------------------------------------------------------------- */
/* Start-up                                                                   */
/* -------------------------------------------------------------------------- */

function wireEvents() {
  for (const tab of document.querySelectorAll(".view-tab")) {
    tab.addEventListener("click", () => showView(tab.dataset.view));
  }

  for (const id of ["location", "era", "notes"]) {
    element(id).addEventListener("input", () => {
      readSettingFields();
      renderPresets();
      rememberUrl();
    });
  }
  element("size").addEventListener("change", readSizeFields);
  element("custom-width").addEventListener("change", readSizeFields);
  element("custom-height").addEventListener("change", readSizeFields);
  element("order").addEventListener("change", () => {
    state.order = readOrderId(element("order").value);
    renderOrderHelp();
    rememberUrl();
  });
  element("generate").addEventListener("click", generateWorld);
  element("vocabulary-json").addEventListener("input", () => {
    renderVocabularyStatus();
    renderSetupStatus();
  });
  element("vocabulary-format").addEventListener("click", () => {
    const box = readVocabularyBox();
    if (box.state === "valid") setVocabularyText(formatVocabulary(box.vocabulary));
  });
  element("vocabulary-clear").addEventListener("click", () => {
    setVocabularyText("");
    renderSetupStatus();
  });
  element("style").addEventListener("change", (event) => changeStyle(event.target.value));
  element("vary-sprites").addEventListener("change", (event) => {
    state.varySprites = event.target.checked;
    saveStoredSpriteVariation(storage, state.varySprites);
    redraw();
  });
  element("load-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadMapFile(file);
    event.target.value = "";
  });

  element("api-key").addEventListener("change", () => {
    readKeyField();
    renderSetupStatus();
  });
  element("remember-key").addEventListener("change", readKeyField);
  element("toggle-key").addEventListener("click", () => {
    const input = element("api-key");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    element("toggle-key").textContent = show ? "Hide" : "Show";
    element("toggle-key").setAttribute("aria-pressed", show ? "true" : "false");
  });
  element("test-key").addEventListener("click", testKey);
  element("forget-key").addEventListener("click", forgetKey);
  element("decision-model").addEventListener("change", readModelSelects);
  element("narrative-model").addEventListener("change", readModelSelects);
  element("generation-mode").addEventListener("change", () => {
    readModelSelects();
    renderSetupStatus();
  });
  element("ai-done").addEventListener("click", () => {
    readKeyField();
    showView("setup");
  });

  element("stop").addEventListener("click", () => {
    state.cancelRequested = true;
    element("stop").disabled = true;
    setTimeout(() => {
      element("stop").disabled = false;
    }, 500);
  });
  element("download").addEventListener("click", downloadMap);
  element("download-png").addEventListener("click", downloadMapImage);
  element("regenerate-cell").addEventListener("click", regenerateCell);
  element("inspector-type").addEventListener("change", (event) => changeCellType(event.target.value));

  wireCanvas();
}

async function start() {
  const fromUrl = readStateFromSearch(location.search);
  state.setting = fromUrl.setting;
  state.size = fromUrl.size;
  state.order = fromUrl.order;
  state.apiKey = readApiKey(storage);
  state.rememberKey = true;

  renderPresets();
  renderSettingFields();
  renderSizeSelect();
  renderOrderSelect();
  renderStyleSelect();
  renderSpriteVariationControl();
  renderKeyField();
  renderModelSelects();
  // A shared link to a preset world is free too: its vocabulary is shipped (ADR 0004).
  const preset = presetMatching(state.setting);
  setVocabularyText(preset ? formatVocabulary(presetVocabularyFor(preset.id)) : "");
  renderDeployLine(element("deploy-line"), readStamp(document), "en", say, escapeHtml, PROJECT_PATH);
  wireEvents();

  try {
    state.sheet = await loadTilesheet();
    state.renderer = createRenderer(element("map"), state.sheet);
  } catch (error) {
    setStatus("setup-status", error.message, "error");
  }

  showView(fromUrl.view);
  if (fromUrl.view === "setup" || !state.grid) renderSetupStatus();
  loadCatalogue().then(renderSetupStatus);
}

start();
