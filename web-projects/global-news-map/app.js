// The page: the canvas, the pointer, and the wiring between them.
//
// Everything worth testing lives in a pure module next door. This file owns only
// what needs a browser: the canvas, the events, and the elements. It holds no
// projection maths, no parsing and no ranking.
//
// The map is redrawn from scratch on every frame that changes. That is cheap
// here, because the whole world is 109 outlines and about 5,000 points, and it
// removes the whole class of bugs where the screen and the state disagree.
//
// Text reaches the screen through `textContent`, never `innerHTML`. Story text
// comes from Wikipedia, which anyone can edit, so there is nothing to escape and
// no way for an edit to become markup. The one exception is the deploy line,
// which needs a link inside a sentence and carries its own escaper.

import { addDays, defaultDay, fromIsoDay, isSelectableDay, portalPageUrl, toIsoDay, todayUtc } from "./calendar.js";
import { NoNewsForDay, loadDay } from "./dataSource.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { MIN_ZOOM, clampView, clusterPoints, project, zoomAt } from "./geo.js";
import { LANGUAGES, makeSay, pickLanguage } from "./i18n.js";
import { buildSearch, readState } from "./urlState.js";
import { LAND_SHAPES } from "./world.js";

const $ = (id) => document.getElementById(id);

const elements = {
  title: $("title"),
  tagline: $("tagline"),
  langPicker: $("lang-picker"),
  prevDay: $("prev-day"),
  nextDay: $("next-day"),
  latestDay: $("latest-day"),
  dayInput: $("day-input"),
  dayLabel: $("day-label"),
  map: $("map"),
  zoomIn: $("zoom-in"),
  zoomOut: $("zoom-out"),
  resetView: $("reset-view"),
  status: $("status"),
  card: $("story-card"),
  cardCategory: $("story-card-category"),
  cardHeading: $("story-card-heading"),
  cardText: $("story-card-text"),
  cardPlace: $("story-card-place"),
  cardSources: $("story-card-sources"),
  cardClose: $("story-close"),
  listHeading: $("story-list-heading"),
  listHint: $("list-hint"),
  stories: $("stories"),
  unplacedHeading: $("unplaced-heading"),
  unplacedWhy: $("unplaced-why"),
  unplaced: $("unplaced"),
  creditWikipedia: $("credit-wikipedia"),
  creditCoastlines: $("credit-coastlines"),
  creditPrivacy: $("credit-privacy"),
  deployLine: $("deploy-line"),
  backLink: $("back-link"),
};

/** How close two pins have to be, in pixels, before they become one marker. */
const CLUSTER_RADIUS = 18;
/** How far a tap may miss a marker and still count as hitting it. */
const TAP_SLACK = 16;

const state = {
  lang: "en",
  day: defaultDay(),
  view: { zoom: MIN_ZOOM, cx: 0.5, cy: 0.5 },
  pins: [],
  unplaced: [],
  stories: [],
  selectedId: null,
  /** Markers as last drawn, so a tap can be matched against what is on screen. */
  markers: [],
  loading: false,
  request: null,
};

let say = makeSay(state.lang);
const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// --- the canvas -------------------------------------------------------------

const canvas = elements.map;
const context = canvas.getContext("2d");
/** The canvas size in CSS pixels, which is what every projection call uses. */
let size = { width: 0, height: 0 };

/**
 * Match the canvas's pixel buffer to its box and to the screen's density, then
 * scale the drawing so the rest of the code can work in CSS pixels.
 */
function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const box = canvas.getBoundingClientRect();
  size = { width: Math.max(1, Math.round(box.width)), height: Math.max(1, Math.round(box.height)) };
  canvas.width = Math.round(size.width * ratio);
  canvas.height = Math.round(size.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  state.view = clampView(state.view, size);
}

const cssColour = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function drawGraticule(colour) {
  context.strokeStyle = colour;
  context.lineWidth = 1;
  context.beginPath();
  for (let lon = -180; lon <= 180; lon += 30) {
    const top = project(lon, 90, state.view, size);
    const bottom = project(lon, -90, state.view, size);
    context.moveTo(top.x, top.y);
    context.lineTo(bottom.x, bottom.y);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const left = project(-180, lat, state.view, size);
    const right = project(180, lat, state.view, size);
    context.moveTo(left.x, left.y);
    context.lineTo(right.x, right.y);
  }
  context.stroke();
}

function drawLand(fill, edge) {
  context.fillStyle = fill;
  context.strokeStyle = edge;
  context.lineWidth = 1;
  for (const shape of LAND_SHAPES) {
    context.beginPath();
    for (let i = 0; i < shape.length; i += 2) {
      const point = project(shape[i], shape[i + 1], state.view, size);
      if (i === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.closePath();
    context.fill();
    context.stroke();
  }
}

/** Draw one marker: a dot for a single story, a numbered disc for a group. */
function drawMarker(marker, colour, ink, selected) {
  const many = marker.items.length > 1;
  const radius = many ? Math.min(18, 10 + marker.items.length) : 6;

  if (selected) {
    context.beginPath();
    context.arc(marker.x, marker.y, radius + 5, 0, Math.PI * 2);
    context.fillStyle = colour;
    context.globalAlpha = 0.25;
    context.fill();
    context.globalAlpha = 1;
  }

  context.beginPath();
  context.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
  context.fillStyle = colour;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = ink;
  context.stroke();

  if (many) {
    context.fillStyle = ink;
    context.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(marker.items.length), marker.x, marker.y);
  }
}

function draw() {
  if (!size.width) return;
  const ocean = cssColour("--ocean") || "#dfe4ee";
  const land = cssColour("--land") || "#c3c9d6";
  const landEdge = cssColour("--land-edge") || "#a8b0c1";
  const graticule = cssColour("--graticule") || "rgba(0,0,0,0.06)";
  const pin = cssColour("--pin") || "#dc5a00";
  const pinInk = cssColour("--pin-ink") || "#fff";

  context.fillStyle = ocean;
  context.fillRect(0, 0, size.width, size.height);
  drawGraticule(graticule);
  drawLand(land, landEdge);

  // Group the pins at the zoom they are being drawn at, so two towns that
  // overlap when zoomed out separate as the reader zooms in.
  const points = state.pins.map((pin_) => ({ ...project(pin_.lon, pin_.lat, state.view, size), pin: pin_ }));
  state.markers = clusterPoints(points, CLUSTER_RADIUS).map((group) => ({
    x: group.x,
    y: group.y,
    items: group.items.map((point) => point.pin),
  }));

  const selectedMarkers = [];
  for (const marker of state.markers) {
    if (marker.items.some((item) => item.story.id === state.selectedId)) selectedMarkers.push(marker);
    else drawMarker(marker, pin, pinInk, false);
  }
  // The chosen marker is drawn last so nothing sits on top of it.
  for (const marker of selectedMarkers) drawMarker(marker, pin, pinInk, true);
}

let frame = null;
function scheduleDraw() {
  if (frame !== null) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    draw();
  });
}

// --- the elements -----------------------------------------------------------

/** The day, written the way a reader of this language expects. */
function formatDay(date) {
  try {
    return new Intl.DateTimeFormat(state.lang, { dateStyle: "long", timeZone: "UTC" }).format(date);
  } catch {
    return toIsoDay(date);
  }
}

function setStatus(text, stateName = "") {
  elements.status.textContent = text;
  elements.status.dataset.state = stateName;
}

function renderLanguagePicker() {
  elements.langPicker.replaceChildren();
  for (const language of LANGUAGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = language.label;
    button.setAttribute("aria-pressed", String(language.code === state.lang));
    button.addEventListener("click", () => setLanguage(language.code));
    elements.langPicker.append(button);
  }
  elements.langPicker.setAttribute("aria-label", say("ui.language"));
}

/** One story in the list. A button, so a keyboard reaches every story. */
function storyItem(story, place) {
  const item = document.createElement("li");
  item.className = "story-item";
  if (story.id === state.selectedId) item.setAttribute("aria-current", "true");

  const button = document.createElement("button");
  button.type = "button";

  const where = document.createElement("span");
  where.className = "item-where";
  where.textContent = place ? place.title : story.category;
  const text = document.createElement("span");
  text.className = "item-text";
  text.textContent = story.text;

  button.append(where, text);
  button.addEventListener("click", () => selectStory(story.id, { centre: Boolean(place) }));
  item.append(button);
  return item;
}

function renderLists() {
  elements.stories.replaceChildren(...state.pins.map((pin) => storyItem(pin.story, pin.place)));
  elements.unplaced.replaceChildren(...state.unplaced.map((story) => storyItem(story, null)));

  const hasUnplaced = state.unplaced.length > 0;
  elements.unplacedHeading.hidden = !hasUnplaced;
  elements.unplacedWhy.hidden = !hasUnplaced;
}

function renderCard() {
  const pin = state.pins.find((candidate) => candidate.story.id === state.selectedId);
  const story = pin?.story ?? state.unplaced.find((candidate) => candidate.id === state.selectedId);
  if (!story) {
    elements.card.hidden = true;
    return;
  }
  elements.card.hidden = false;
  elements.cardCategory.textContent = story.category;
  // The topic trail is the closest thing the portal gives a story to a headline.
  elements.cardHeading.textContent = story.topics.at(-1) ?? story.category;
  elements.cardText.textContent = story.text;
  elements.cardPlace.textContent = pin ? say("story.place", { place: pin.place.title }) : say("story.unplacedHeading");

  const sources = story.sources.map((source) => {
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener nofollow";
    link.textContent = source.label;
    return link;
  });
  elements.cardSources.replaceChildren(...sources);
}

function renderCredits() {
  const link = (href, text, rel) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = rel;
    anchor.textContent = text;
    return anchor;
  };
  const nodes = {
    "{portal}": () => link(portalPageUrl(state.day), say("credit.portal"), "noopener"),
    "{licence}": () =>
      link("https://creativecommons.org/licenses/by-sa/4.0/", say("credit.licence"), "noopener license"),
  };
  // The sentence holds two links, so it is built by splitting the message on its
  // own slots and putting an element where each slot was. `say` with no values
  // leaves the slots in place, which is what makes this possible.
  elements.creditWikipedia.replaceChildren(
    ...say("credit.wikipedia")
      .split(/(\{portal\}|\{licence\})/)
      .filter((part) => part !== "")
      .map((part) => (nodes[part] ? nodes[part]() : document.createTextNode(part))),
  );
  elements.creditCoastlines.textContent = say("credit.coastlines");
  elements.creditPrivacy.textContent = say("credit.privacy");
}

/** Every fixed word on the page, in the current language. */
function renderChrome() {
  document.documentElement.lang = state.lang;
  elements.title.textContent = say("app.title");
  elements.tagline.textContent = say("app.tagline");
  elements.prevDay.setAttribute("aria-label", say("day.previous"));
  elements.nextDay.setAttribute("aria-label", say("day.next"));
  elements.latestDay.textContent = say("day.latest");
  elements.dayLabel.textContent = say("day.pick");
  elements.map.setAttribute("aria-label", say("map.label"));
  elements.zoomIn.setAttribute("aria-label", say("map.zoomIn"));
  elements.zoomOut.setAttribute("aria-label", say("map.zoomOut"));
  elements.resetView.setAttribute("aria-label", say("map.reset"));
  elements.cardClose.setAttribute("aria-label", say("story.close"));
  elements.listHeading.textContent = say("story.listHeading");
  elements.unplacedHeading.textContent = say("story.unplacedHeading");
  elements.unplacedWhy.textContent = say("story.unplacedWhy");
  elements.backLink.textContent = say("ui.backToProjects");
  renderLanguagePicker();
  renderCredits();
  renderDeployLine(elements.deployLine, readStamp(document), state.lang, say, escapeHtml, "web-projects/global-news-map");
}

function renderDayBar() {
  elements.dayInput.value = toIsoDay(state.day);
  elements.dayInput.max = toIsoDay(todayUtc());
  elements.nextDay.disabled = !isSelectableDay(addDays(state.day, 1));
  elements.latestDay.disabled = toIsoDay(state.day) === toIsoDay(defaultDay());
}

function renderCounts() {
  if (state.loading) return;
  setStatus(say("status.counts", { placed: state.pins.length, unplaced: state.unplaced.length }));
  elements.listHint.textContent = state.pins.length ? say("story.selectHint") : "";
}

// --- state changes ----------------------------------------------------------

function writeUrl() {
  const search = buildSearch({ day: toIsoDay(state.day), story: state.selectedId, lang: state.lang });
  history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
}

/** Put the page back to "no story open". */
function clearSelection() {
  if (state.selectedId === null) return;
  state.selectedId = null;
  renderCard();
  renderLists();
  writeUrl();
  scheduleDraw();
}

function selectStory(id, { centre = false } = {}) {
  state.selectedId = id;
  if (state.selectedId && centre) {
    const pin = state.pins.find((candidate) => candidate.story.id === state.selectedId);
    // Bring the story into view without changing how far in the reader has zoomed.
    if (pin) {
      const zoom = Math.max(state.view.zoom, 3);
      state.view = clampView({ zoom, cx: (pin.lon + 180) / 360, cy: (90 - pin.lat) / 180 }, size);
    }
  }
  renderCard();
  renderLists();
  writeUrl();
  scheduleDraw();
}

function setLanguage(code) {
  state.lang = code;
  say = makeSay(code);
  renderChrome();
  renderDayBar();
  renderCard();
  renderCounts();
  writeUrl();
}

async function showDay(date, { keepStory = null } = {}) {
  state.day = date;
  state.selectedId = keepStory;
  state.loading = true;
  state.pins = [];
  state.unplaced = [];
  state.stories = [];
  renderDayBar();
  renderLists();
  renderCard();
  renderCredits();
  writeUrl();
  scheduleDraw();
  setStatus(say("status.loading"), "loading");

  state.request?.abort();
  const controller = new AbortController();
  state.request = controller;

  try {
    const day = await loadDay(date, {
      signal: controller.signal,
      onProgress: (stage) => setStatus(say(stage === "locating" ? "status.locating" : "status.loading"), "loading"),
    });
    if (controller.signal.aborted) return;
    state.loading = false;
    state.stories = day.stories;
    state.pins = day.pins;
    state.unplaced = day.unplaced;
    // A story kept from the URL may not exist on this day.
    if (state.selectedId && !day.stories.some((story) => story.id === state.selectedId)) state.selectedId = null;
    renderLists();
    renderCard();
    renderCounts();
    writeUrl();
    scheduleDraw();
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") return;
    state.loading = false;
    setStatus(say(error instanceof NoNewsForDay ? "status.empty" : "status.failed"), "failed");
    renderLists();
    scheduleDraw();
  }
}

// --- pointer and keyboard ---------------------------------------------------

/** The marker under a point on the canvas, if the tap was close enough. */
function markerAt(x, y) {
  let found = null;
  let best = Infinity;
  for (const marker of state.markers) {
    const radius = (marker.items.length > 1 ? Math.min(18, 10 + marker.items.length) : 6) + TAP_SLACK;
    const distance = (marker.x - x) ** 2 + (marker.y - y) ** 2;
    if (distance <= radius * radius && distance < best) {
      best = distance;
      found = marker;
    }
  }
  return found;
}

function canvasPoint(event) {
  const box = canvas.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function wireMap() {
  /** Live pointers, so one finger drags and two fingers pinch. */
  const pointers = new Map();
  let dragged = 0;
  let pinchDistance = 0;

  const pointerList = () => [...pointers.values()];

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, canvasPoint(event));
    dragged = 0;
    if (pointers.size === 2) {
      const [a, b] = pointerList();
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
    canvas.classList.add("dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId);
    const current = canvasPoint(event);
    pointers.set(event.pointerId, current);

    if (pointers.size === 2) {
      const [a, b] = pointerList();
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 0 && distance > 0) {
        const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        state.view = zoomAt(state.view, size, middle, distance / pinchDistance);
        dragged += Math.abs(distance - pinchDistance);
      }
      pinchDistance = distance;
      scheduleDraw();
      return;
    }

    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    dragged += Math.abs(dx) + Math.abs(dy);
    // Panning is done here rather than through `panBy` so the drag follows the
    // finger exactly, with no rounding building up over a long drag.
    const world = size.width * state.view.zoom;
    state.view = clampView(
      { zoom: state.view.zoom, cx: state.view.cx - dx / world, cy: state.view.cy - dy / (world / 2) },
      size,
    );
    scheduleDraw();
  });

  const endPointer = (event) => {
    if (!pointers.has(event.pointerId)) return;
    const point = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
    if (!pointers.size) canvas.classList.remove("dragging");

    // A short press is a tap, a long one was a drag. Without this a drag that
    // ends over a pin opens a story the reader never asked for.
    if (dragged < 6) {
      const marker = markerAt(point.x, point.y);
      if (!marker) {
        clearSelection();
        return;
      }
      // Tapping a group again moves to the next story in it, so every story in a
      // group is reachable without zooming in far enough to split it.
      const ids = marker.items.map((item) => item.story.id);
      const next = ids[(ids.indexOf(state.selectedId) + 1) % ids.length];
      selectStory(next);
    }
  };

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      state.view = zoomAt(state.view, size, canvasPoint(event), factor);
      scheduleDraw();
    },
    { passive: false },
  );

  const zoomFromCentre = (factor) => {
    state.view = zoomAt(state.view, size, { x: size.width / 2, y: size.height / 2 }, factor);
    scheduleDraw();
  };
  elements.zoomIn.addEventListener("click", () => zoomFromCentre(1.7));
  elements.zoomOut.addEventListener("click", () => zoomFromCentre(1 / 1.7));
  elements.resetView.addEventListener("click", () => {
    state.view = clampView({ zoom: MIN_ZOOM, cx: 0.5, cy: 0.5 }, size);
    scheduleDraw();
  });
}

function wireChrome() {
  elements.prevDay.addEventListener("click", () => showDay(addDays(state.day, -1)));
  elements.nextDay.addEventListener("click", () => {
    const next = addDays(state.day, 1);
    if (isSelectableDay(next)) showDay(next);
  });
  elements.latestDay.addEventListener("click", () => showDay(defaultDay()));
  elements.dayInput.addEventListener("change", () => {
    const chosen = fromIsoDay(elements.dayInput.value);
    if (chosen && isSelectableDay(chosen)) showDay(chosen);
    else renderDayBar();
  });
  elements.cardClose.addEventListener("click", clearSelection);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearSelection();
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      draw();
    }, 100);
  });

  // The map's colours come from CSS, so a change of theme has to redraw it.
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", scheduleDraw);
}

// --- start ------------------------------------------------------------------

function start() {
  const url = readState(location.search);
  state.lang = pickLanguage(url.lang, navigator.languages ?? [navigator.language]);
  say = makeSay(state.lang);

  const day = url.day ? fromIsoDay(url.day) : null;
  state.day = day && isSelectableDay(day) ? day : defaultDay();

  resizeCanvas();
  renderChrome();
  renderDayBar();
  wireMap();
  wireChrome();
  draw();
  showDay(state.day, { keepStory: url.story });
}

start();
