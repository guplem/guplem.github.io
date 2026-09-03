// The editor: what the person sees, and what happens when they touch it.
//
// This is the one file that owns the DOM. It has no tests, by the rule the
// repository sets for every web-project: anything worth testing belongs in a
// pure module, and everything here is either reading an input, drawing to a
// canvas, or calling one of those modules. If a piece of arithmetic ever grows
// in this file, that is the signal it belongs somewhere else.
//
// What lives where:
//
//   spec.js         WhatsApp's rules, and the checks against them
//   segment.js      finding the background
//   mask.js         shaping the cut-out
//   compose.js      mask into picture, defringe, the white outline
//   filters.js      colour
//   geometry.js     where the picture sits on the 512 pixel canvas
//   textLayout.js   where each line of a caption goes
//   frames.js       the animation's frame list and its timing
//   pack.js         the pack, and the two archive layouts
//   webp/           writing an animated WebP
//   zip.js          writing an archive
//   encode.js       hitting the file size WhatsApp allows
//   render.js       the canvas calls themselves
//   save.js         the shape a pack is stored in
//   store.js        the browser's own storage
//   i18n.js         every word on the page
//
// The state is one object. Each frame of an animation carries its own picture,
// cut-out, colour and framing, so a frame can be fixed on its own; the
// captions belong to the sticker and appear on every frame, which is what a
// caption on an animation almost always wants.

import { CANVAS_SIZE, DEFAULT_PADDING, fitToCanvas, growBox, placeOnCanvas, toSourcePoint } from "./geometry.js";
import { FILTER_PRESETS, buildMatrix, composeMatrices, presetMatrix } from "./filters.js";
import { QUALITY_LADDER, encodeWithinBudget, estimateFrameBudget } from "./encode.js";
import { TEXT_STYLES, styleById } from "./textLayout.js";
import { DROP, KEEP, combineMask, contentBounds, createMask, paintCircle, touchesEdge } from "./mask.js";
import {
  MAX_ACCESSIBILITY_ANIMATED,
  MAX_ACCESSIBILITY_STATIC,
  MAX_EMOJIS,
  MAX_STICKERS,
  MIN_STICKERS,
  RECOMMENDED_TRAY_SIZE,
  checkPack,
  checkSticker,
  isAnimated,
  isBlocking,
  maxBytesFor,
  sanitizeIdentifier,
  splitEmojis,
} from "./spec.js";
import { MAX_FRAMES, addFrame, playbackOrder, removeFrame, scaleDurations, setAllDurations, setFrameDuration, totalDurationMs } from "./frames.js";
import { addSticker, contentsZipFiles, createPack, moveSticker, packFacts, removeSticker, updateSticker, wastickersFiles } from "./pack.js";
import { hasTransparency, readAlphaMask } from "./compose.js";
import { autoBackgroundMask, magicWandMask, refineEdgeAlpha } from "./segment.js";
import { LANGUAGES, pickLanguage, sayFinding, sayIn } from "./i18n.js";
import { buildAnimatedWebp } from "./webp/animate.js";
import { buildZip } from "./zip.js";
import { deserialisePack, serialisePack } from "./save.js";
import { flipX, rotateQuarter } from "./orient.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import {
  createSurface,
  developFrame,
  downloadFile,
  drawSticker,
  encodeCanvas,
  loadPicture,
  makeTrayIcon,
  supportsWebp,
  surfaceFromPixels,
  textLayerBounds,
} from "./render.js";
import { clearPack, openStore, readLanguage, readPack, writeLanguage, writePack } from "./store.js";

const PROJECT_PATH = "web-projects/whatsapp-sticker-creator";

/** The same query `style.css` uses, so the two cannot disagree. */
const WIDE_LAYOUT = "(min-width: 60rem)";

const TOOLS = [
  { id: "cutout", labelKey: "tool.cutout" },
  { id: "crop", labelKey: "tool.crop" },
  { id: "colour", labelKey: "tool.colour" },
  { id: "text", labelKey: "tool.text" },
  { id: "frames", labelKey: "tool.frames" },
  { id: "finish", labelKey: "tool.finish" },
];

const BRUSH_MODES = [
  { id: "erase", labelKey: "cutout.erase" },
  { id: "restore", labelKey: "cutout.restore" },
  { id: "wand", labelKey: "cutout.wand" },
];

/**
 * A few emoji to tap, because a desktop browser has no emoji keyboard and
 * WhatsApp requires at least one tag per sticker.
 */
const EMOJI_SUGGESTIONS = [
  "😀", "😂", "🥹", "😍", "😎", "🤔", "😭", "😱", "🙃", "😴",
  "👍", "👏", "🙏", "💪", "🔥", "💕", "🎉", "✨", "☕", "🍕",
];

/** How many mask steps to keep for undo. Each one is a copy of the mask. */
const HISTORY_LIMIT = 12;

const dom = {};
for (const id of [
  "title", "tagline", "lang-picker", "banner",
  "pick-panel", "pick-heading", "dropzone", "pick-drop", "pick-button", "pick-hint", "file-input",
  "editor-panel", "edit-heading", "canvas-wrap", "preview", "overlay", "status", "pick-another",
  "tool-tabs",
  // One panel per entry in TOOLS. `selectTool` shows one and hides the rest.
  "tool-cutout", "tool-crop", "tool-colour", "tool-text", "tool-frames", "tool-finish",
  "cutout-auto", "cutout-auto-hint", "cutout-tolerance", "cutout-tolerance-label",
  "cutout-tolerance-out", "cutout-tolerance-hint", "cutout-edge", "cutout-edge-label",
  "cutout-edge-out", "cutout-edge-hint", "cutout-feather", "cutout-feather-label",
  "cutout-feather-out", "cutout-refine", "cutout-refine-hint", "cutout-modes",
  "cutout-brush", "cutout-brush-label", "cutout-brush-out", "cutout-softness",
  "cutout-softness-label", "cutout-softness-out", "cutout-mode-hint",
  "cutout-undo", "cutout-redo", "cutout-reset",
  "crop-fit-content", "crop-fit-whole", "crop-fill", "crop-fit-hint", "crop-padding",
  "crop-padding-label", "crop-padding-out", "crop-padding-hint", "crop-zoom",
  "crop-zoom-label", "crop-zoom-out", "crop-flip", "crop-rotate",
  "colour-presets", "colour-brightness", "colour-brightness-label", "colour-brightness-out",
  "colour-contrast", "colour-contrast-label", "colour-contrast-out",
  "colour-saturation", "colour-saturation-label", "colour-saturation-out",
  "colour-temperature", "colour-temperature-label", "colour-temperature-out", "colour-reset",
  "text-add", "text-drag-hint", "text-empty", "text-list",
  "frames-add", "frames-add-hint", "frames-file", "frames-count", "frames-strip",
  "frames-first-hint", "frames-duration", "frames-duration-label", "frames-duration-out",
  "frames-same-all", "frames-speed", "frames-speed-label", "frames-speed-out",
  "frames-play", "frames-pingpong", "frames-pingpong-label", "frames-total", "frames-single",
  "finish-outline", "finish-outline-label", "finish-outline-hint", "finish-outline-width",
  "finish-width-label", "finish-width-out", "finish-outline-colour", "finish-colour-label",
  "finish-size",
  "details-panel", "details-heading", "emoji-label", "emoji-count", "emoji-input", "emoji-hint",
  "emoji-suggest", "a11y-label", "a11y-count", "a11y-input", "a11y-hint",
  "check-panel", "check-heading", "check-summary", "check-list", "rules-summary", "rules-list",
  "pack-panel", "pack-heading", "pack-add", "pack-name", "pack-name-label",
  "pack-publisher", "pack-publisher-label", "pack-identifier", "pack-identifier-label",
  "pack-identifier-hint", "pack-count", "pack-kind", "pack-empty", "pack-grid",
  "export-sticker", "export-wastickers", "export-contents",
  "export-wastickers-hint", "export-contents-hint", "howto-summary", "howto-body", "pack-clear",
  "privacy", "deploy-line", "back-link",
]) {
  dom[id] = document.getElementById(id);
}

let lang = "en";
let say = sayIn(lang);

const state = {
  frames: [],
  activeFrame: 0,
  texts: [],
  selectedText: null,
  pingPong: false,
  tool: "cutout",
  brushMode: "erase",
  outline: { on: false, width: 8, colour: "#ffffff" },
  emojis: [],
  accessibilityText: "",
  pack: createPack({ name: "", publisher: "" }),
  trayStickerId: null,
  editingStickerId: null,
  built: null,
  webpSupported: true,
  database: null,
  storageWorks: true,
};

const preview = dom.preview.getContext("2d", { willReadFrequently: true });
const overlay = dom.overlay.getContext("2d");
/** One offscreen canvas, reused, for building each frame at sticker size. */
const scratch = createSurface(CANVAS_SIZE, CANVAS_SIZE);

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );

let renderQueued = false;
let buildTimer = 0;
let playTimer = 0;
let playIndex = 0;

/* ------------------------------------------------------------------ frames */

const activeFrame = () => state.frames[state.activeFrame] ?? null;

/** A frame's own edit state, alongside its pixels. */
function makeFrame({ rgba, width, height }) {
  return {
    id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    rgba,
    width,
    height,
    // No mask means nothing is cut yet: the whole picture shows.
    mask: null,
    history: [],
    future: [],
    adjustments: { brightness: 0, contrast: 1, saturation: 1, temperature: 0 },
    preset: "none",
    fit: "content",
    padding: DEFAULT_PADDING,
    zoom: 1,
    panX: 0,
    panY: 0,
    // No duration on purpose. `addFrame` fills it in from the frame before,
    // so a person who chose 400 ms does not set it again for every frame.
  };
}

/**
 * Bring pictures in.
 *
 * The two ways in mean different things, and mixing them up is a surprise
 * nobody would want. "Choose a picture" starts a new sticker, so it replaces
 * whatever was open. "Add a frame" builds an animation, so it appends. A
 * single input that always appended would quietly turn a second sticker into
 * a two frame animation of the first.
 *
 * @param {FileList | File[]} files
 * @param {object} [options]
 * @param {boolean} [options.replace] True to start again from these pictures.
 */
async function addPictures(files, { replace = false } = {}) {
  const pictures = [...files].filter((file) => file.type.startsWith("image/"));
  if (pictures.length === 0) {
    showBanner(say("error.notImage"));
    return;
  }
  hideBanner();
  if (replace) {
    state.frames = [];
    state.texts = [];
    state.editingStickerId = null;
    state.built = null;
  }

  for (const file of pictures) {
    if (state.frames.length >= MAX_FRAMES) break;
    try {
      const picture = await loadPicture(file);
      state.frames = addFrame(state.frames, makeFrame(picture));
    } catch {
      showBanner(say("error.decodeFailed"));
      return;
    }
  }
  state.activeFrame = state.frames.length - 1;
  dom["pick-panel"].hidden = true;
  for (const id of ["editor-panel", "details-panel", "check-panel", "pack-panel"]) {
    dom[id].hidden = false;
  }
  // A new picture is a good moment to guess the background, because that is
  // what almost every person wants next.
  runAutoCutout();
  renderAll();
}

/* --------------------------------------------------------------- placement */

/** Where a frame's picture sits on the sticker canvas. */
function placementFor(frame) {
  const base = basePlacement(frame);
  const centre = CANVAS_SIZE / 2;
  return {
    scale: base.scale * frame.zoom,
    // Zoom about the middle of the canvas, then shift by the pan.
    dx: centre + (base.dx - centre) * frame.zoom + frame.panX,
    dy: centre + (base.dy - centre) * frame.zoom + frame.panY,
  };
}

function basePlacement(frame) {
  if (frame.fit === "fill") {
    return fitToCanvas(frame.width, frame.height, { mode: "cover" });
  }
  if (frame.fit === "whole") {
    return fitToCanvas(frame.width, frame.height, {
      mode: "contain",
      padding: frame.padding,
    });
  }
  // "content": fit what survived the cut-out, which is the whole point of
  // cutting first. A little growth keeps a soft edge from being clipped.
  const bounds = frame.mask ? contentBounds(frame.mask, frame.width, frame.height) : null;
  const box = bounds
    ? growBox(bounds, 2, frame.width, frame.height)
    : { x: 0, y: 0, width: frame.width, height: frame.height };
  return placeOnCanvas(box, { padding: frame.padding });
}

/* --------------------------------------------------------------- rendering */

function renderAll() {
  syncControlsToFrame();
  renderFrame();
  renderFramesTool();
  renderTextList();
  renderPackPanel();
  updateControls();
  scheduleBuild();
}

/**
 * Move every control to match the frame now being edited.
 *
 * Each frame carries its own colour, framing and timing, so the sliders belong
 * to the frame and not to the editor. Without this, choosing a second frame
 * leaves the sliders showing the first frame's numbers, and the next touch of
 * any one of them writes those numbers onto the frame that did not have them.
 */
function syncControlsToFrame() {
  const frame = activeFrame();
  if (!frame) return;
  const set = (id, value, format = String) => {
    dom[id].value = String(value);
    if (dom[`${id}-out`]) dom[`${id}-out`].textContent = format(value);
  };

  set("colour-brightness", Math.round(frame.adjustments.brightness * 100));
  set("colour-contrast", Math.round(frame.adjustments.contrast * 100), (v) => `${v}%`);
  set("colour-saturation", Math.round(frame.adjustments.saturation * 100), (v) => `${v}%`);
  set("colour-temperature", Math.round(frame.adjustments.temperature * 100));
  set("crop-padding", frame.padding);
  set("crop-zoom", Math.round(frame.zoom * 100), (v) => `${v}%`);
  dom["frames-duration"].value = String(frame.durationMs);
  dom["frames-duration-out"].textContent = say("frames.durationValue", { ms: frame.durationMs });
  buildColourPresets();
}

/** Draw the active frame into the preview, on the next animation frame. */
function renderFrame() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const frame = activeFrame();
    if (!frame) return;
    drawFrameTo(preview, frame);
    drawOverlay();
  });
}

/** Colour, cut-out and edge for one frame, then place it and add the extras. */
function drawFrameTo(ctx, frame) {
  const pixels = developFrame({
    rgba: frame.rgba,
    width: frame.width,
    height: frame.height,
    mask: frame.mask,
    matrix: matrixFor(frame),
  });
  drawSticker(ctx, {
    picture: developedSurface(frame, pixels),
    placement: placementFor(frame),
    outlineWidth: state.outline.on ? state.outline.width : 0,
    outlineColour: state.outline.colour,
    texts: state.texts,
  });
}

/**
 * The canvas a frame's developed pixels are put on, kept with the frame.
 *
 * A new canvas per render would allocate one the size of the source picture
 * on every slider move, and a drag is dozens of renders a second.
 */
function developedSurface(frame, pixels) {
  if (!frame.surface || frame.surface.width !== frame.width || frame.surface.height !== frame.height) {
    frame.surface = surfaceFromPixels(pixels, frame.width, frame.height);
    return frame.surface;
  }
  frame.surface
    .getContext("2d")
    .putImageData(new ImageData(pixels, frame.width, frame.height), 0, 0);
  return frame.surface;
}

/** A preset and the hand sliders stack, so both can be used at once. */
function matrixFor(frame) {
  return composeMatrices(presetMatrix(frame.preset), buildMatrix(frame.adjustments));
}

/** The brush ring, drawn over the sticker so a stroke lands where it looks. */
let pointer = { x: -1, y: -1, inside: false };

function drawOverlay() {
  overlay.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (state.tool !== "cutout" || state.brushMode === "wand" || !pointer.inside) return;
  const radius = Number(dom["cutout-brush"].value) / 2;
  overlay.save();
  overlay.strokeStyle = "rgba(255, 255, 255, 0.9)";
  overlay.lineWidth = 2;
  overlay.beginPath();
  overlay.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2);
  overlay.stroke();
  overlay.strokeStyle = "rgba(0, 0, 0, 0.6)";
  overlay.lineWidth = 1;
  overlay.stroke();
  overlay.restore();
}

/* ----------------------------------------------------------------- cut out */

function pushHistory(frame) {
  frame.history.push(frame.mask ? Uint8Array.from(frame.mask) : null);
  if (frame.history.length > HISTORY_LIMIT) frame.history.shift();
  frame.future = [];
}

function ensureMask(frame) {
  if (!frame.mask) frame.mask = createMask(frame.width, frame.height, KEEP);
  return frame.mask;
}

function runAutoCutout() {
  const frame = activeFrame();
  if (!frame) return;
  pushHistory(frame);
  frame.mask = autoBackgroundMask(frame.rgba, frame.width, frame.height, {
    tolerance: Number(dom["cutout-tolerance"].value),
    edgeTolerance: Number(dom["cutout-edge"].value),
    feather: Number(dom["cutout-feather"].value),
  });
  renderAll();
}

function runRefineEdge() {
  const frame = activeFrame();
  if (!frame?.mask) return;
  pushHistory(frame);
  frame.mask = refineEdgeAlpha(frame.rgba, frame.mask, frame.width, frame.height, { radius: 2 });
  renderAll();
}

function undoMask() {
  const frame = activeFrame();
  if (!frame || frame.history.length === 0) return;
  frame.future.push(frame.mask ? Uint8Array.from(frame.mask) : null);
  frame.mask = frame.history.pop();
  renderAll();
}

function redoMask() {
  const frame = activeFrame();
  if (!frame || frame.future.length === 0) return;
  frame.history.push(frame.mask ? Uint8Array.from(frame.mask) : null);
  frame.mask = frame.future.pop();
  renderAll();
}

function resetMask() {
  const frame = activeFrame();
  if (!frame) return;
  pushHistory(frame);
  frame.mask = null;
  renderAll();
}

/* -------------------------------------------------------- pointer on stage */

let dragging = null;

function stagePoint(event) {
  const box = dom["canvas-wrap"].getBoundingClientRect();
  // The canvas is 512 wide and shown at whatever width fits, so every touch
  // has to be scaled back. Without this a stroke lands in the wrong place,
  // and only on small screens.
  const scale = CANVAS_SIZE / box.width;
  return { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale };
}

function onStageDown(event) {
  const frame = activeFrame();
  if (!frame) return;
  const point = stagePoint(event);
  dom["canvas-wrap"].setPointerCapture(event.pointerId);

  if (state.tool === "text") {
    const hit = topTextAt(point);
    if (hit) {
      state.selectedText = hit.id;
      dragging = { kind: "text", id: hit.id, from: point };
      renderTextList();
      return;
    }
  }
  if (state.tool === "crop") {
    dragging = { kind: "pan", from: point, panX: frame.panX, panY: frame.panY };
    return;
  }
  if (state.tool !== "cutout") return;

  const source = toSourcePoint(point.x, point.y, placementFor(frame));
  if (state.brushMode === "wand") {
    pushHistory(frame);
    const selection = magicWandMask(frame.rgba, frame.width, frame.height, {
      x: source.x,
      y: source.y,
      tolerance: Number(dom["cutout-tolerance"].value),
    });
    frame.mask = combineMask(ensureMask(frame), selection, "subtract");
    renderAll();
    return;
  }

  pushHistory(frame);
  dragging = { kind: "brush" };
  paintAt(frame, source);
}

function onStageMove(event) {
  const frame = activeFrame();
  const point = stagePoint(event);
  pointer = { x: point.x, y: point.y, inside: true };

  if (!dragging) {
    drawOverlay();
    return;
  }
  if (dragging.kind === "brush" && frame) {
    paintAt(frame, toSourcePoint(point.x, point.y, placementFor(frame)));
    return;
  }
  if (dragging.kind === "pan" && frame) {
    frame.panX = dragging.panX + (point.x - dragging.from.x);
    frame.panY = dragging.panY + (point.y - dragging.from.y);
    renderFrame();
    scheduleBuild();
    return;
  }
  if (dragging.kind === "text") {
    const layer = state.texts.find((entry) => entry.id === dragging.id);
    if (!layer) return;
    layer.x += (point.x - dragging.from.x) / CANVAS_SIZE;
    layer.y += (point.y - dragging.from.y) / CANVAS_SIZE;
    dragging.from = point;
    renderFrame();
    scheduleBuild();
  }
}

function onStageUp(event) {
  if (dragging) scheduleBuild();
  dragging = null;
  try {
    dom["canvas-wrap"].releasePointerCapture(event.pointerId);
  } catch {
    // The pointer may already be gone, which is not a problem.
  }
}

function paintAt(frame, source) {
  const placement = placementFor(frame);
  // The brush is set in sticker pixels, so its size on the source depends on
  // how far the picture is scaled. Otherwise a zoomed-in brush paints a
  // giant patch.
  const radius = Number(dom["cutout-brush"].value) / 2 / placement.scale;
  paintCircle(ensureMask(frame), frame.width, frame.height, {
    x: source.x,
    y: source.y,
    radius,
    value: state.brushMode === "restore" ? KEEP : DROP,
    hardness: 1 - Number(dom["cutout-softness"].value) / 100,
  });
  renderFrame();
}

/** The topmost caption under a point, so the last one added is grabbed first. */
function topTextAt(point) {
  for (const layer of [...state.texts].reverse()) {
    const box = textLayerBounds(preview, layer, CANVAS_SIZE);
    if (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    ) {
      return layer;
    }
  }
  return null;
}

/* ------------------------------------------------------------------- crop */

function setFit(fit) {
  const frame = activeFrame();
  if (!frame) return;
  frame.fit = fit;
  // A new fit starts from a clean view, or the old zoom and pan would move
  // the picture somewhere the chosen fit never meant to put it.
  frame.zoom = 1;
  frame.panX = 0;
  frame.panY = 0;
  renderAll();
}

function flipFrame() {
  const frame = activeFrame();
  if (!frame) return;
  frame.rgba = flipX(frame.rgba, frame.width, frame.height, 4);
  // The mask has to move with the picture, or the cut-out slides off.
  if (frame.mask) frame.mask = flipX(frame.mask, frame.width, frame.height, 1);
  frame.history = [];
  frame.future = [];
  renderAll();
}

function rotateFrame() {
  const frame = activeFrame();
  if (!frame) return;
  const turned = rotateQuarter(frame.rgba, frame.width, frame.height, 4);
  if (frame.mask) {
    frame.mask = rotateQuarter(frame.mask, frame.width, frame.height, 1).data;
  }
  frame.rgba = turned.data;
  frame.width = turned.width;
  frame.height = turned.height;
  frame.history = [];
  frame.future = [];
  renderAll();
}

/* ------------------------------------------------------------------- text */

function addTextLayer() {
  state.texts.push({
    id: `t${Date.now().toString(36)}`,
    text: "",
    style: "highlight",
    fontSize: 64,
    align: "centre",
    rotation: 0,
    // In canvas fractions, so a caption keeps its place at any size.
    x: 0.5,
    y: 0.78,
    colour: null,
    backgroundColour: null,
  });
  state.selectedText = state.texts.at(-1).id;
  renderTextList();
  renderFrame();
  scheduleBuild();
}

function renderTextList() {
  dom["text-list"].replaceChildren();
  dom["text-empty"].hidden = state.texts.length > 0;

  state.texts.forEach((layer, index) => {
    const style = styleById(layer.style);
    const card = document.createElement("div");
    card.className = `layer${layer.id === state.selectedText ? " selected" : ""}`;

    const head = document.createElement("div");
    head.className = "layer-head";
    const title = document.createElement("span");
    title.className = "layer-title";
    title.textContent = say("text.layer", { number: index + 1 });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button ghost small danger";
    remove.textContent = say("text.remove");
    remove.addEventListener("click", () => {
      state.texts = state.texts.filter((entry) => entry.id !== layer.id);
      renderTextList();
      renderFrame();
      scheduleBuild();
    });
    head.append(title, remove);

    const input = document.createElement("textarea");
    input.rows = 2;
    input.value = layer.text;
    input.placeholder = say("text.placeholder");
    input.addEventListener("input", () => {
      layer.text = input.value;
      renderFrame();
      scheduleBuild();
    });
    input.addEventListener("focus", () => {
      state.selectedText = layer.id;
    });

    const grid = document.createElement("div");
    grid.className = "layer-grid";
    grid.append(
      selectField(say("text.style"), TEXT_STYLES.map((entry) => ({ value: entry.id, label: say(entry.labelKey) })), layer.style, (value) => {
        layer.style = value;
        // The colours belong to the style until the person overrides them.
        layer.colour = null;
        layer.backgroundColour = null;
        renderTextList();
        renderFrame();
        scheduleBuild();
      }),
      selectField(
        say("text.align"),
        [
          { value: "left", label: say("text.alignLeft") },
          { value: "centre", label: say("text.alignCentre") },
          { value: "right", label: say("text.alignRight") },
        ],
        layer.align,
        (value) => {
          layer.align = value;
          renderFrame();
          scheduleBuild();
        },
      ),
      rangeField(say("text.size"), 24, 160, 2, layer.fontSize, (value) => {
        layer.fontSize = value;
        renderFrame();
        scheduleBuild();
      }),
      rangeField(say("text.rotation"), -30, 30, 1, layer.rotation, (value) => {
        layer.rotation = value;
        renderFrame();
        scheduleBuild();
      }),
      colourField(say("text.colour"), layer.colour ?? style.colour ?? "#ffffff", (value) => {
        layer.colour = value;
        renderFrame();
        scheduleBuild();
      }),
    );
    if (style.background !== "none") {
      grid.append(
        colourField(
          say("text.backgroundColour"),
          layer.backgroundColour ?? style.backgroundColour ?? "#ffffff",
          (value) => {
            layer.backgroundColour = value;
            renderFrame();
            scheduleBuild();
          },
        ),
      );
    }

    card.append(head, input, grid);
    dom["text-list"].append(card);
  });
}

/* -------------------------------------------------------------- animation */

function renderFramesTool() {
  dom["frames-count"].textContent = say("frames.count", {
    count: state.frames.length,
    max: MAX_FRAMES,
  });
  dom["frames-single"].hidden = state.frames.length !== 1;
  dom["frames-total"].textContent = say("frames.total", {
    seconds: (totalDurationMs(state.frames, { pingPong: state.pingPong }) / 1000).toFixed(1),
  });

  dom["frames-strip"].replaceChildren();
  state.frames.forEach((frame, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "frame";
    button.setAttribute("aria-current", index === state.activeFrame ? "true" : "false");
    button.title = say("frames.frame", { number: index + 1 });

    // A small canvas per frame, so the strip shows the real thing.
    const thumb = createSurface(96, 96);
    thumb.ctx.save();
    thumb.ctx.scale(96 / CANVAS_SIZE, 96 / CANVAS_SIZE);
    drawFrameTo(thumb.ctx, frame);
    thumb.ctx.restore();
    thumb.canvas.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "frame-label";
    label.textContent = say("frames.durationValue", { ms: frame.durationMs });

    const actions = document.createElement("span");
    actions.className = "frame-actions";
    actions.append(
      iconButton("×", say("frames.remove"), (event) => {
        event.stopPropagation();
        state.frames = removeFrame(state.frames, index);
        state.activeFrame = Math.max(0, Math.min(state.activeFrame, state.frames.length - 1));
        if (state.frames.length === 0) resetToPick();
        else renderAll();
      }),
      iconButton("⧉", say("frames.duplicate"), (event) => {
        event.stopPropagation();
        if (state.frames.length >= MAX_FRAMES) return;
        const copy = {
          ...frame,
          id: `${frame.id}c${state.frames.length}`,
          rgba: Uint8ClampedArray.from(frame.rgba),
          mask: frame.mask ? Uint8Array.from(frame.mask) : null,
          history: [],
          future: [],
        };
        state.frames = [...state.frames.slice(0, index + 1), copy, ...state.frames.slice(index + 1)];
        state.activeFrame = index + 1;
        renderAll();
      }),
    );

    button.append(thumb.canvas, label, actions);
    button.addEventListener("click", () => {
      state.activeFrame = index;
      renderAll();
    });
    dom["frames-strip"].append(button);
  });
}

function togglePlay() {
  if (playTimer) {
    stopPlay();
    return;
  }
  if (state.frames.length < 2) return;
  const order = playbackOrder(state.frames, { pingPong: state.pingPong });
  playIndex = 0;
  dom["frames-play"].textContent = say("frames.pause");

  const step = () => {
    const frame = order[playIndex % order.length];
    drawFrameTo(preview, frame);
    playIndex += 1;
    playTimer = window.setTimeout(step, frame.durationMs);
  };
  step();
}

function stopPlay() {
  if (playTimer) window.clearTimeout(playTimer);
  playTimer = 0;
  dom["frames-play"].textContent = say("frames.play");
  renderFrame();
}

/* ---------------------------------------------------- building the sticker */

function scheduleBuild() {
  if (buildTimer) window.clearTimeout(buildTimer);
  // Encoding is the expensive step, so it waits until the sliders stop.
  buildTimer = window.setTimeout(() => {
    buildTimer = 0;
    buildSticker();
  }, 280);
}

/** Draw one frame onto the offscreen sticker canvas. */
function frameToScratch(frame) {
  drawFrameTo(scratch.ctx, frame);
  return scratch.canvas;
}

async function buildSticker() {
  if (state.frames.length === 0 || !state.webpSupported) return;
  dom.status.textContent = say("finish.encoding");

  const animated = state.frames.length > 1;
  const order = playbackOrder(state.frames, { pingPong: state.pingPong });
  const maxBytes = maxBytesFor(animated);

  try {
    let built;
    if (!animated) {
      frameToScratch(state.frames[0]);
      built = await encodeWithinBudget((quality) => encodeCanvas(scratch.canvas, quality), {
        maxBytes,
      });
    } else {
      // Two stages. First find a quality where one frame fits its share of
      // the budget, which costs a handful of single encodes. Then check the
      // whole animation from that rung down, which is the expensive part and
      // now starts close to the answer.
      const share = estimateFrameBudget(maxBytes, order.length);
      frameToScratch(order[0]);
      const probe = await encodeWithinBudget(
        (quality) => encodeCanvas(scratch.canvas, quality),
        { maxBytes: share },
      ).catch(() => ({ quality: QUALITY_LADDER.at(-1) }));

      const from = Math.max(0, QUALITY_LADDER.indexOf(probe.quality));
      built = await encodeWithinBudget(
        async (quality) => {
          const frames = [];
          for (const frame of order) {
            frameToScratch(frame);
            frames.push({
              webp: await encodeCanvas(scratch.canvas, quality),
              durationMs: frame.durationMs,
            });
          }
          return buildAnimatedWebp({ frames, width: CANVAS_SIZE, height: CANVAS_SIZE });
        },
        { maxBytes, ladder: QUALITY_LADDER.slice(from) },
      );
    }

    // Measure the finished sticker rather than trusting the editor's idea of
    // it: the rules are about the file. The first frame is the one WhatsApp
    // leaves on screen, so it is the one measured.
    frameToScratch(order[0]);
    const pixels = scratch.ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;

    state.built = {
      webp: built.bytes,
      quality: built.quality,
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      frameDurationsMs: animated ? order.map((frame) => frame.durationMs) : [],
      hasTransparency: hasTransparency(pixels),
      // WhatsApp recommends room for an 8 pixel outline, so the question is
      // whether there is space for one, not whether a pixel sits on the edge.
      touchesEdge: touchesEdge(readAlphaMask(pixels, CANVAS_SIZE, CANVAS_SIZE), CANVAS_SIZE, CANVAS_SIZE, {
        margin: 8,
      }),
    };
    hideBanner();
  } catch (failure) {
    state.built = null;
    showBanner(
      failure?.smallestBytes
        ? say("error.tooBigToFit", { max: Math.round(maxBytes / 1024) })
        : say("error.decodeFailed"),
    );
  }

  updateStatus();
  renderCheck();
  updateControls();
}

function updateStatus() {
  if (!state.built) {
    dom.status.textContent = "";
    dom["finish-size"].textContent = "";
    return;
  }
  const kb = Math.round(state.built.webp.length / 1024);
  const max = Math.round(maxBytesFor(state.frames.length > 1) / 1024);
  const line = say("finish.qualityValue", { kb, max });
  dom.status.textContent = line;
  dom["finish-size"].textContent = line;
}

/* -------------------------------------------------------------- the rules */

function stickerFacts() {
  if (!state.built) return null;
  return {
    byteLength: state.built.webp.length,
    width: state.built.width,
    height: state.built.height,
    frameDurationsMs: state.built.frameDurationsMs,
    emojis: state.emojis,
    accessibilityText: state.accessibilityText,
    hasTransparency: state.built.hasTransparency,
    touchesEdge: state.built.touchesEdge,
  };
}

function renderCheck() {
  const facts = stickerFacts();
  const findings = facts ? checkSticker(facts) : [];
  const packFindings = state.pack.stickers.length > 0 ? checkPack(packFacts(state.pack)) : [];
  const all = [...findings, ...packFindings];

  const errors = all.filter((finding) => finding.severity === "error").length;
  const warnings = all.length - errors;

  dom["check-summary"].classList.toggle("pass", all.length === 0 && Boolean(facts));
  if (!facts) dom["check-summary"].textContent = "";
  else if (all.length === 0) dom["check-summary"].textContent = say("check.pass");
  else {
    const parts = [];
    if (errors > 0) {
      parts.push(say(errors === 1 ? "check.errors" : "check.errorsPlural", { count: errors }));
    }
    if (warnings > 0) {
      parts.push(
        say(warnings === 1 ? "check.warnings" : "check.warningsPlural", { count: warnings }),
      );
    }
    dom["check-summary"].textContent = parts.join(" · ");
  }

  dom["check-list"].replaceChildren();
  for (const finding of all) {
    const item = document.createElement("li");
    item.className = finding.severity;
    const sentence = sayFinding(finding, lang);
    item.textContent =
      finding.stickerIndex === undefined
        ? sentence
        : say("check.forSticker", { number: finding.stickerIndex + 1, message: sentence });
    dom["check-list"].append(item);
  }
}

/**
 * WhatsApp's rules, listed plainly, so a person can see what they are aiming
 * at rather than only hearing when they miss.
 *
 * These lines are numbers and units, not sentences, so they read the same in
 * both languages and need no entry in the catalogue.
 */
function renderRules() {
  dom["rules-list"].replaceChildren();
  const animated = state.frames.length > 1;
  const lines = [
    "512 × 512 px · WebP",
    `≤ ${Math.round(maxBytesFor(animated) / 1024)} KB`,
    animated ? "≥ 8 ms / frame · ≤ 10 s" : "1 frame",
    `${MIN_STICKERS}–${MAX_STICKERS} × ${say("step.pack").replace(/^\d+\.\s*/, "")}`,
    `1–${MAX_EMOJIS} emoji`,
    `${RECOMMENDED_TRAY_SIZE} × ${RECOMMENDED_TRAY_SIZE} px PNG · ≤ 50 KB`,
    `≤ ${animated ? MAX_ACCESSIBILITY_ANIMATED : MAX_ACCESSIBILITY_STATIC} × ${say("details.accessibility")}`,
  ];
  for (const line of lines) {
    const item = document.createElement("li");
    item.textContent = line;
    dom["rules-list"].append(item);
  }
}

/* -------------------------------------------------------------- the pack */

function addToPack() {
  if (!state.built) return;
  const existing = state.pack.stickers.find((entry) => entry.id === state.editingStickerId);
  const sticker = {
    id: state.editingStickerId ?? `s${Date.now().toString(36)}`,
    webp: state.built.webp,
    width: state.built.width,
    height: state.built.height,
    frameDurationsMs: state.built.frameDurationsMs,
    emojis: [...state.emojis],
    accessibilityText: state.accessibilityText,
    hasTransparency: state.built.hasTransparency,
    touchesEdge: state.built.touchesEdge,
    // The thumbnail and the pack icon both come from the sticker's own bytes,
    // so nothing has to be encoded a second time to show it.
    url: blobUrlFor(state.built.webp),
  };

  if (existing) {
    URL.revokeObjectURL(existing.url);
    state.pack = updateSticker(state.pack, sticker.id, sticker);
  } else {
    if (state.pack.stickers.length >= MAX_STICKERS) return;
    state.pack = addSticker(state.pack, sticker);
  }
  state.editingStickerId = null;
  // The first sticker becomes the pack icon unless the person picks another.
  if (!state.trayStickerId) state.trayStickerId = sticker.id;
  refreshTray().then(savePack);
  renderPackPanel();
  renderCheck();
}

/**
 * Rebuild the 96 by 96 PNG WhatsApp shows for the pack.
 *
 * An animated sticker is drawn from its own file, which gives its first frame.
 * That is what a tray icon has to be: WhatsApp requires a still picture here.
 */
async function refreshTray() {
  const source =
    state.pack.stickers.find((entry) => entry.id === state.trayStickerId) ??
    state.pack.stickers[0];
  if (!source?.url) {
    state.pack = { ...state.pack, tray: null };
    return;
  }
  try {
    const image = await loadImageFromUrl(source.url);
    const { canvas, ctx } = createSurface(CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    state.pack = { ...state.pack, tray: await makeTrayIcon(canvas, RECOMMENDED_TRAY_SIZE) };
  } catch {
    // A browser that cannot decode its own WebP leaves the pack without an
    // icon, and the rule check then says so rather than the export failing.
    state.pack = { ...state.pack, tray: null };
  }
}

/**
 * Put a sticker from the pack back in the editor.
 *
 * What comes back is the finished picture, not the steps that made it: the
 * cut-out, the colour sliders and the captions were all baked into the file
 * when it was encoded. So the sticker returns as a single flat picture, ready
 * to be cut again or captioned again, and saving replaces the one in the pack
 * rather than adding a second copy.
 *
 * An animated sticker comes back as its first frame only, because reopening
 * every frame would mean decoding an animation this page never learned to
 * read. The pack keeps the animation until it is replaced.
 */
async function openInEditor(sticker) {
  try {
    const blob = new Blob([sticker.webp], { type: "image/webp" });
    const picture = await loadPicture(blob);
    // Through `addFrame`, so the frame gets its default timing the same way
    // every other frame does.
    state.frames = addFrame([], makeFrame(picture));
    state.activeFrame = 0;
    state.texts = [];
    state.editingStickerId = sticker.id;
    state.emojis = [...sticker.emojis];
    state.accessibilityText = sticker.accessibilityText ?? "";
    dom["emoji-input"].value = state.emojis.join("");
    dom["a11y-input"].value = state.accessibilityText;
    dom["pick-panel"].hidden = true;
    for (const id of ["editor-panel", "details-panel", "check-panel"]) dom[id].hidden = false;
    renderAll();
    dom["editor-panel"].scrollIntoView({ block: "start" });
  } catch {
    showBanner(say("error.decodeFailed"));
  }
}

function renderPackPanel() {
  const count = state.pack.stickers.length;
  dom["pack-count"].textContent = say("packUi.count", { count, max: MAX_STICKERS });
  dom["pack-empty"].hidden = count > 0;

  const animatedCount = state.pack.stickers.filter((sticker) => isAnimated(sticker)).length;
  dom["pack-kind"].hidden = count === 0;
  dom["pack-kind"].textContent =
    animatedCount === 0
      ? say("packUi.still")
      : animatedCount === count
        ? say("packUi.animated")
        : say("packUi.mixedWarning");

  dom["pack-grid"].replaceChildren();
  state.pack.stickers.forEach((sticker, index) => {
    const item = document.createElement("div");
    item.className = `pack-item${sticker.id === state.trayStickerId ? " tray" : ""}`;

    const image = document.createElement("img");
    image.alt = sticker.accessibilityText || sticker.emojis.join(" ");
    image.src = sticker.url;
    image.loading = "lazy";

    const meta = document.createElement("span");
    meta.className = "pack-item-meta";
    meta.textContent = `${Math.round(sticker.webp.length / 1024)} KB${
      isAnimated(sticker) ? ` · ${sticker.frameDurationsMs.length}f` : ""
    }`;

    const actions = document.createElement("span");
    actions.className = "pack-item-actions";
    actions.append(
      iconButton("←", say("packUi.moveLeft"), () => {
        state.pack = moveSticker(state.pack, index, index - 1);
        renderPackPanel();
        savePack();
      }),
      iconButton("→", say("packUi.moveRight"), () => {
        state.pack = moveSticker(state.pack, index, index + 1);
        renderPackPanel();
        savePack();
      }),
      iconButton("✎", say("packUi.edit"), () => openInEditor(sticker)),
      iconButton("★", say("packUi.trayFrom"), () => {
        state.trayStickerId = sticker.id;
        refreshTray().then(() => {
          renderPackPanel();
          renderCheck();
          savePack();
        });
      }),
      iconButton("×", say("packUi.remove"), () => {
        URL.revokeObjectURL(sticker.url);
        state.pack = removeSticker(state.pack, sticker.id);
        if (state.trayStickerId === sticker.id) state.trayStickerId = state.pack.stickers[0]?.id ?? null;
        refreshTray().then(() => {
          renderPackPanel();
          renderCheck();
          savePack();
        });
      }),
    );

    item.append(image, meta, actions);
    dom["pack-grid"].append(item);
  });

  updateControls();
}

/* ------------------------------------------------------------ saving files */

function safeFileName(text, fallback) {
  const clean = sanitizeIdentifier(text || fallback);
  return clean || fallback;
}

function exportSticker() {
  if (!state.built) return;
  const animated = state.frames.length > 1;
  downloadFile(
    state.built.webp,
    `${safeFileName(state.pack.name, "sticker")}${animated ? "-animated" : ""}.webp`,
    "image/webp",
  );
}

function exportWastickers() {
  try {
    const files = wastickersFiles(state.pack);
    downloadFile(
      buildZip(files),
      `${safeFileName(state.pack.name, "stickers")}.wastickers`,
      "application/octet-stream",
    );
  } catch (failure) {
    showBanner(failure.message);
  }
}

function exportContents() {
  try {
    const files = contentsZipFiles(state.pack);
    downloadFile(buildZip(files), `${safeFileName(state.pack.name, "stickers")}.zip`, "application/zip");
  } catch (failure) {
    showBanner(failure.message);
  }
}

/* ------------------------------------------------------------ persistence */

let saveTimer = 0;

function savePack() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    saveTimer = 0;
    const stored = await writePack(state.database, serialisePack(state.pack));
    if (!stored && state.storageWorks) {
      state.storageWorks = false;
      showBanner(say("error.saveFailed"));
    }
  }, 400);
}

async function loadSavedPack() {
  state.database = await openStore();
  const raw = await readPack(state.database);
  const pack = deserialisePack(raw);
  if (!pack) return;
  state.pack = pack;
  state.trayStickerId = pack.stickers[0]?.id ?? null;
  if (pack.stickers.length > 0) {
    // A saved pack is worth showing even before a picture is picked, so the
    // person can carry on where they stopped.
    dom["pack-panel"].hidden = false;
    for (const sticker of pack.stickers) sticker.url = blobUrlFor(sticker.webp);
  }
  dom["pack-name"].value = pack.name;
  dom["pack-publisher"].value = pack.publisher;
  dom["pack-identifier"].value = pack.identifier;
  renderPackPanel();
}

/* ------------------------------------------------------- small DOM helpers */

function iconButton(glyph, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = glyph;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function selectField(label, options, value, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "field";
  const name = document.createElement("span");
  name.className = "field-label";
  name.textContent = label;
  const select = document.createElement("select");
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  wrap.append(name, select);
  return wrap;
}

function rangeField(label, min, max, step, value, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "field";
  const name = document.createElement("span");
  name.className = "field-label";
  const text = document.createElement("span");
  text.textContent = label;
  const out = document.createElement("output");
  out.textContent = String(value);
  name.append(text, out);
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("input", () => {
    out.textContent = input.value;
    onChange(Number(input.value));
  });
  wrap.append(name, input);
  return wrap;
}

function colourField(label, value, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "field inline";
  const name = document.createElement("span");
  name.className = "field-label";
  name.textContent = label;
  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.addEventListener("input", () => onChange(input.value));
  wrap.append(name, input);
  return wrap;
}

function blobUrlFor(bytes) {
  return URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function showBanner(message) {
  dom.banner.textContent = message;
  dom.banner.hidden = false;
}

function hideBanner() {
  dom.banner.hidden = true;
}

function resetToPick() {
  state.frames = [];
  state.built = null;
  dom["pick-panel"].hidden = false;
  for (const id of ["editor-panel", "details-panel", "check-panel"]) dom[id].hidden = true;
  updateStatus();
}

/* -------------------------------------------------------------- the shell */

function selectTool(id) {
  state.tool = id;
  for (const tool of TOOLS) {
    dom[`tool-${tool.id}`].hidden = tool.id !== id;
  }
  for (const button of dom["tool-tabs"].children) {
    button.setAttribute("aria-selected", button.dataset.tool === id ? "true" : "false");
  }
  dom["canvas-wrap"].classList.toggle("painting", id === "cutout");
  drawOverlay();
}

function updateControls() {
  const frame = activeFrame();
  const ready = Boolean(state.built);
  const facts = stickerFacts();
  const clean = facts ? !isBlocking(checkSticker(facts)) : false;

  dom["cutout-undo"].disabled = !frame || frame.history.length === 0;
  dom["cutout-redo"].disabled = !frame || frame.future.length === 0;
  dom["cutout-refine"].disabled = !frame?.mask;
  dom["frames-play"].disabled = state.frames.length < 2;
  dom["pack-add"].disabled = !ready || !clean || state.pack.stickers.length >= MAX_STICKERS;
  dom["export-sticker"].disabled = !ready;

  const packReady = state.pack.stickers.length >= MIN_STICKERS && !isBlocking(checkPack(packFacts(state.pack)));
  dom["export-wastickers"].disabled = !packReady;
  dom["export-contents"].disabled = !packReady || !state.pack.tray;
  dom["pack-clear"].disabled = state.pack.stickers.length === 0;

  dom["emoji-count"].textContent = say("details.emojiCount", {
    count: state.emojis.length,
    max: MAX_EMOJIS,
  });
  const maxText = state.frames.length > 1 ? MAX_ACCESSIBILITY_ANIMATED : MAX_ACCESSIBILITY_STATIC;
  dom["a11y-input"].maxLength = maxText;
  dom["a11y-count"].textContent = say("details.accessibilityCount", {
    count: state.accessibilityText.length,
    max: maxText,
  });
}

/** Every fixed label on the page, in the language now chosen. */
function applyLanguage() {
  say = sayIn(lang);
  document.documentElement.lang = lang;

  const text = {
    title: "ui.title",
    tagline: "ui.tagline",
    "pick-heading": "step.pick",
    "pick-drop": "pick.drop",
    "pick-button": "pick.button",
    "pick-hint": "pick.hint",
    "edit-heading": "step.edit",
    "pick-another": "pick.another",
    "cutout-auto": "cutout.auto",
    "cutout-auto-hint": "cutout.autoHint",
    "cutout-tolerance-label": "cutout.tolerance",
    "cutout-tolerance-hint": "cutout.toleranceHint",
    "cutout-edge-label": "cutout.edgeTolerance",
    "cutout-edge-hint": "cutout.edgeToleranceHint",
    "cutout-feather-label": "cutout.feather",
    "cutout-refine": "cutout.refine",
    "cutout-refine-hint": "cutout.refineHint",
    "cutout-brush-label": "cutout.brushSize",
    "cutout-softness-label": "cutout.softness",
    "cutout-undo": "cutout.undo",
    "cutout-redo": "cutout.redo",
    "cutout-reset": "cutout.reset",
    "crop-fit-content": "crop.fitContent",
    "crop-fit-whole": "crop.fitWhole",
    "crop-fill": "crop.fillSquare",
    "crop-fit-hint": "crop.fitContentHint",
    "crop-padding-label": "crop.padding",
    "crop-padding-hint": "crop.paddingHint",
    "crop-zoom-label": "crop.zoom",
    "crop-flip": "crop.flip",
    "crop-rotate": "crop.rotate",
    "colour-brightness-label": "colour.brightness",
    "colour-contrast-label": "colour.contrast",
    "colour-saturation-label": "colour.saturation",
    "colour-temperature-label": "colour.temperature",
    "colour-reset": "colour.reset",
    "text-add": "text.add",
    "text-drag-hint": "text.dragHint",
    "text-empty": "text.none",
    "frames-add": "frames.add",
    "frames-add-hint": "frames.addHint",
    "frames-first-hint": "frames.firstFrameHint",
    "frames-duration-label": "frames.duration",
    "frames-same-all": "frames.sameForAll",
    "frames-speed-label": "frames.speed",
    "frames-pingpong-label": "frames.pingPong",
    "frames-single": "frames.single",
    "finish-outline-label": "finish.outline",
    "finish-outline-hint": "finish.outlineHint",
    "finish-width-label": "finish.outlineWidth",
    "finish-colour-label": "finish.outlineColour",
    "details-heading": "step.details",
    "emoji-label": "details.emoji",
    "emoji-hint": "details.emojiHint",
    "a11y-label": "details.accessibility",
    "a11y-hint": "details.accessibilityHint",
    "check-heading": "step.check",
    "rules-summary": "check.rules",
    "pack-heading": "step.pack",
    "pack-add": "packUi.add",
    "pack-name-label": "packUi.name",
    "pack-publisher-label": "packUi.publisher",
    "pack-identifier-label": "packUi.identifier",
    "pack-identifier-hint": "packUi.identifierHint",
    "pack-empty": "packUi.empty",
    "export-sticker": "export.sticker",
    "export-wastickers": "export.wastickers",
    "export-contents": "export.contents",
    "export-wastickers-hint": "export.wastickersHint",
    "export-contents-hint": "export.contentsHint",
    "howto-summary": "export.howTo",
    "howto-body": "export.howToBody",
    "pack-clear": "packUi.clear",
    privacy: "ui.privacy",
    "back-link": "ui.back",
  };
  for (const [id, key] of Object.entries(text)) {
    if (dom[id]) dom[id].textContent = say(key);
  }
  dom["frames-play"].textContent = say(playTimer ? "frames.pause" : "frames.play");
  document.title = `${say("ui.title")} · Guillem Poy`;

  // The lists that are built rather than written.
  buildLanguagePicker();
  buildToolTabs();
  buildBrushModes();
  buildColourPresets();
  buildEmojiSuggestions();
  renderRules();
  renderTextList();
  renderFramesTool();
  renderPackPanel();
  renderCheck();
  updateStatus();
  renderDeployLine(dom["deploy-line"], readStamp(document), lang, say, escapeHtml, PROJECT_PATH);
}

function buildLanguagePicker() {
  dom["lang-picker"].replaceChildren();
  for (const language of LANGUAGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = language.label;
    button.setAttribute("aria-pressed", language.code === lang ? "true" : "false");
    button.addEventListener("click", () => {
      lang = language.code;
      writeLanguage(lang);
      applyLanguage();
    });
    dom["lang-picker"].append(button);
  }
}

function buildToolTabs() {
  dom["tool-tabs"].replaceChildren();
  for (const tool of TOOLS) {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "tab";
    button.dataset.tool = tool.id;
    button.textContent = say(tool.labelKey);
    button.setAttribute("aria-selected", tool.id === state.tool ? "true" : "false");
    button.addEventListener("click", () => selectTool(tool.id));
    dom["tool-tabs"].append(button);
  }
}

function buildBrushModes() {
  dom["cutout-modes"].replaceChildren();
  for (const mode of BRUSH_MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = say(mode.labelKey);
    button.setAttribute("aria-pressed", mode.id === state.brushMode ? "true" : "false");
    button.addEventListener("click", () => {
      state.brushMode = mode.id;
      buildBrushModes();
      dom["cutout-mode-hint"].textContent = say(
        mode.id === "wand" ? "cutout.wandHint" : "cutout.brushHint",
      );
      drawOverlay();
    });
    dom["cutout-modes"].append(button);
  }
  dom["cutout-mode-hint"].textContent = say(
    state.brushMode === "wand" ? "cutout.wandHint" : "cutout.brushHint",
  );
}

function buildColourPresets() {
  dom["colour-presets"].replaceChildren();
  const frame = activeFrame();
  for (const preset of FILTER_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = say(preset.labelKey);
    button.setAttribute("aria-pressed", frame?.preset === preset.id ? "true" : "false");
    button.addEventListener("click", () => {
      const current = activeFrame();
      if (!current) return;
      current.preset = preset.id;
      buildColourPresets();
      renderFrame();
      scheduleBuild();
    });
    dom["colour-presets"].append(button);
  }
}

function buildEmojiSuggestions() {
  dom["emoji-suggest"].className = "chips emoji";
  dom["emoji-suggest"].replaceChildren();
  for (const emoji of EMOJI_SUGGESTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = emoji;
    button.setAttribute("aria-label", emoji);
    button.addEventListener("click", () => {
      // The same emoji twice is a wasted tag out of only three, so a repeat
      // is dropped rather than counted.
      if (state.emojis.length >= MAX_EMOJIS || state.emojis.includes(emoji)) return;
      state.emojis = [...state.emojis, emoji];
      dom["emoji-input"].value = state.emojis.join("");
      updateControls();
      renderCheck();
    });
    dom["emoji-suggest"].append(button);
  }
}

/* ------------------------------------------------------------------- start */

function wireEvents() {
  dom["pick-button"].addEventListener("click", () => dom["file-input"].click());
  dom["pick-another"].addEventListener("click", () => {
    resetToPick();
    dom["pick-panel"].scrollIntoView({ block: "start" });
  });
  dom["file-input"].addEventListener("change", () => {
    // Step one starts a new sticker, so it replaces what was open.
    addPictures(dom["file-input"].files, { replace: true });
    dom["file-input"].value = "";
  });
  dom["frames-add"].addEventListener("click", () => dom["frames-file"].click());
  dom["frames-file"].addEventListener("change", () => {
    // The animate tool adds to the sticker being built.
    addPictures(dom["frames-file"].files);
    dom["frames-file"].value = "";
  });

  for (const type of ["dragenter", "dragover"]) {
    dom.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dom.dropzone.classList.add("over");
    });
  }
  for (const type of ["dragleave", "drop"]) {
    dom.dropzone.addEventListener(type, () => dom.dropzone.classList.remove("over"));
  }
  dom.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    if (event.dataTransfer?.files?.length) addPictures(event.dataTransfer.files);
  });
  // Pasting a picture is the fastest way in on a desktop.
  window.addEventListener("paste", (event) => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length > 0) addPictures(files);
  });

  dom["canvas-wrap"].addEventListener("pointerdown", onStageDown);
  dom["canvas-wrap"].addEventListener("pointermove", onStageMove);
  dom["canvas-wrap"].addEventListener("pointerup", onStageUp);
  dom["canvas-wrap"].addEventListener("pointercancel", onStageUp);
  dom["canvas-wrap"].addEventListener("pointerleave", () => {
    pointer.inside = false;
    drawOverlay();
  });

  dom["cutout-auto"].addEventListener("click", () => runAutoCutout());
  dom["cutout-refine"].addEventListener("click", runRefineEdge);
  dom["cutout-undo"].addEventListener("click", undoMask);
  dom["cutout-redo"].addEventListener("click", redoMask);
  dom["cutout-reset"].addEventListener("click", resetMask);

  // The three detection sliders re-run the search, because they change what
  // it would have found rather than how the result looks.
  for (const id of ["cutout-tolerance", "cutout-edge", "cutout-feather"]) {
    dom[id].addEventListener("input", () => {
      dom[`${id}-out`].textContent = dom[id].value;
    });
    dom[id].addEventListener("change", () => {
      if (activeFrame()?.mask) runAutoCutout();
    });
  }
  for (const id of ["cutout-brush", "cutout-softness"]) {
    dom[id].addEventListener("input", () => {
      dom[`${id}-out`].textContent = dom[id].value;
      drawOverlay();
    });
  }

  dom["crop-fit-content"].addEventListener("click", () => setFit("content"));
  dom["crop-fit-whole"].addEventListener("click", () => setFit("whole"));
  dom["crop-fill"].addEventListener("click", () => setFit("fill"));
  dom["crop-flip"].addEventListener("click", flipFrame);
  dom["crop-rotate"].addEventListener("click", rotateFrame);
  dom["crop-padding"].addEventListener("input", () => {
    dom["crop-padding-out"].textContent = dom["crop-padding"].value;
    const frame = activeFrame();
    if (!frame) return;
    frame.padding = Number(dom["crop-padding"].value);
    renderFrame();
    scheduleBuild();
  });
  dom["crop-zoom"].addEventListener("input", () => {
    dom["crop-zoom-out"].textContent = `${dom["crop-zoom"].value}%`;
    const frame = activeFrame();
    if (!frame) return;
    frame.zoom = Number(dom["crop-zoom"].value) / 100;
    renderFrame();
    scheduleBuild();
  });

  const colourSliders = [
    ["colour-brightness", (value) => value / 100, (value) => `${value}`],
    ["colour-contrast", (value) => value / 100, (value) => `${value}%`],
    ["colour-saturation", (value) => value / 100, (value) => `${value}%`],
    ["colour-temperature", (value) => value / 100, (value) => `${value}`],
  ];
  for (const [id, toValue, format] of colourSliders) {
    dom[id].addEventListener("input", () => {
      const raw = Number(dom[id].value);
      dom[`${id}-out`].textContent = format(raw);
      const frame = activeFrame();
      if (!frame) return;
      frame.adjustments[id.replace("colour-", "")] = toValue(raw);
      renderFrame();
      scheduleBuild();
    });
  }
  dom["colour-reset"].addEventListener("click", () => {
    const frame = activeFrame();
    if (!frame) return;
    frame.adjustments = { brightness: 0, contrast: 1, saturation: 1, temperature: 0 };
    frame.preset = "none";
    // The sliders belong to the frame, so moving them back is the same job as
    // catching them up after choosing another frame.
    syncControlsToFrame();
    renderFrame();
    scheduleBuild();
  });

  dom["text-add"].addEventListener("click", addTextLayer);

  dom["frames-duration"].addEventListener("input", () => {
    dom["frames-duration-out"].textContent = say("frames.durationValue", {
      ms: dom["frames-duration"].value,
    });
    state.frames = setFrameDuration(
      state.frames,
      state.activeFrame,
      Number(dom["frames-duration"].value),
    );
    renderFramesTool();
    scheduleBuild();
  });
  dom["frames-same-all"].addEventListener("click", () => {
    state.frames = setAllDurations(state.frames, Number(dom["frames-duration"].value));
    renderFramesTool();
    scheduleBuild();
  });
  dom["frames-speed"].addEventListener("input", () => {
    dom["frames-speed-out"].textContent = `${dom["frames-speed"].value}%`;
  });
  dom["frames-speed"].addEventListener("change", () => {
    // 200% on the slider means twice as fast, so the frame times halve.
    state.frames = scaleDurations(state.frames, 100 / Number(dom["frames-speed"].value));
    dom["frames-speed"].value = "100";
    dom["frames-speed-out"].textContent = "100%";
    renderFramesTool();
    scheduleBuild();
  });
  dom["frames-play"].addEventListener("click", togglePlay);
  dom["frames-pingpong"].addEventListener("change", () => {
    state.pingPong = dom["frames-pingpong"].checked;
    renderFramesTool();
    scheduleBuild();
  });

  dom["finish-outline"].addEventListener("change", () => {
    state.outline.on = dom["finish-outline"].checked;
    renderFrame();
    scheduleBuild();
  });
  dom["finish-outline-width"].addEventListener("input", () => {
    dom["finish-width-out"].textContent = dom["finish-outline-width"].value;
    state.outline.width = Number(dom["finish-outline-width"].value);
    if (state.outline.on) {
      renderFrame();
      scheduleBuild();
    }
  });
  dom["finish-outline-colour"].addEventListener("input", () => {
    state.outline.colour = dom["finish-outline-colour"].value;
    if (state.outline.on) {
      renderFrame();
      scheduleBuild();
    }
  });

  dom["emoji-input"].addEventListener("input", () => {
    // Counted as a reader sees them: a family or a flag is one emoji made of
    // several code points, and counting the pieces would refuse a legal tag.
    // A repeat is dropped, because it wastes one of only three tags.
    state.emojis = [...new Set(splitEmojis(dom["emoji-input"].value))].slice(0, MAX_EMOJIS);
    updateControls();
    renderCheck();
  });
  dom["a11y-input"].addEventListener("input", () => {
    state.accessibilityText = dom["a11y-input"].value;
    updateControls();
    renderCheck();
  });

  dom["pack-add"].addEventListener("click", addToPack);
  for (const [id, field] of [
    ["pack-name", "name"],
    ["pack-publisher", "publisher"],
    ["pack-identifier", "identifier"],
  ]) {
    dom[id].addEventListener("input", () => {
      state.pack = { ...state.pack, [field]: dom[id].value };
      // The identifier follows the name until the person edits it directly.
      if (field === "name" && !dom["pack-identifier"].dataset.edited) {
        state.pack = { ...state.pack, identifier: sanitizeIdentifier(dom[id].value) };
        dom["pack-identifier"].value = state.pack.identifier;
      }
      if (field === "identifier") dom["pack-identifier"].dataset.edited = "yes";
      renderCheck();
      updateControls();
      savePack();
    });
  }
  dom["pack-clear"].addEventListener("click", async () => {
    for (const sticker of state.pack.stickers) URL.revokeObjectURL(sticker.url);
    state.pack = createPack({ name: state.pack.name, publisher: state.pack.publisher });
    state.trayStickerId = null;
    await clearPack(state.database);
    renderPackPanel();
    renderCheck();
  });

  dom["export-sticker"].addEventListener("click", exportSticker);
  dom["export-wastickers"].addEventListener("click", exportWastickers);
  dom["export-contents"].addEventListener("click", exportContents);

  // Repaint the frame strip when the layout changes, since its thumbnails
  // are canvases and not CSS.
  window.matchMedia(WIDE_LAYOUT).addEventListener("change", () => renderFramesTool());
}

async function start() {
  const asked = new URLSearchParams(location.search).get("lang");
  lang = pickLanguage(asked ?? readLanguage(), navigator.languages ?? [navigator.language]);
  applyLanguage();
  selectTool("cutout");
  wireEvents();

  // Every WhatsApp sticker is WebP. A browser that cannot write it cannot
  // make one, and saying so plainly beats failing at the last step.
  state.webpSupported = await supportsWebp();
  if (!state.webpSupported) {
    showBanner(say("error.noWebp"));
    dom["pick-button"].disabled = true;
  }

  await loadSavedPack();
  updateControls();
}

start();
