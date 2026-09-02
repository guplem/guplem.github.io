// The page: the canvas, the pointer, and the wiring between them.
//
// Everything worth testing lives in a pure module next door. This file owns only
// what needs a browser: the canvas, the events, and the elements. It holds no
// projection maths, no parsing and no ranking.
//
// The map is redrawn from scratch on every frame that changes. That is cheap
// here, because the whole world is 111 outlines and about 5,000 points, and it
// removes the whole class of bugs where the screen and the state disagree.
//
// Text reaches the screen through `textContent`, never `innerHTML`. Story text
// comes from Wikipedia, which anyone can edit, so there is nothing to escape and
// no way for an edit to become markup. The one exception is the deploy line,
// which needs a link inside a sentence and carries its own escaper.

import { addDays, defaultDay, fromIsoDay, isSelectableDay, portalPageUrl, toIsoDay, todayUtc } from "./calendar.js";
import { CATEGORY_ICONS, classifyCategory } from "./categories.js";
import { NoNewsForDay, loadDay } from "./dataSource.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { MIN_ZOOM, clampView, clusterPoints, groupMatesOf, project, splitAtAntimeridian, zoomAt } from "./geo.js";
import { makeSay, pickLanguage } from "./i18n.js";
import { nextPlaceOnMarker, placeLabel, storyIdsAtPlace } from "./places.js";
import { summarise, tapUnfolds, topmostRow } from "./reading.js";
import { buildSearch, readState } from "./urlState.js";
import { LAND_SHAPES } from "./world.js";

const $ = (id) => document.getElementById(id);

const elements = {
  title: $("title"),
  tagline: $("tagline"),
  prevDay: $("prev-day"),
  nextDay: $("next-day"),
  latestDay: $("latest-day"),
  dayInput: $("day-input"),
  dayLabel: $("day-label"),
  stage: $("stage"),
  map: $("map"),
  toggleMap: $("toggle-map"),
  zoomIn: $("zoom-in"),
  zoomOut: $("zoom-out"),
  resetView: $("reset-view"),
  status: $("status"),
  nextPlace: $("next-place"),
  reading: $("reading"),
  panel: $("selected-panel"),
  panelLabel: $("selected-label"),
  panelHeading: $("selected-heading"),
  panelCount: $("selected-count"),
  panelNote: $("selected-note"),
  panelStories: $("selected-stories"),
  panelClose: $("selected-close"),
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

/**
 * The coastlines the canvas draws: every shape from `world.js`, cut where it
 * crosses the 180th meridian.
 *
 * Natural Earth spans that meridian with a vertex at +180 next to one at -180.
 * The two are the same place on a globe and opposite sides of a flat map, so an
 * uncut shape draws a straight line across the whole world. Four shapes carry
 * such a pair and three of them drew such a line, which a reader reported. Cut
 * once here, because the answer never changes: it depends on the data and not on
 * the zoom. See `splitAtAntimeridian` and ADR 0003.
 */
const COASTLINES = LAND_SHAPES.flatMap(splitAtAntimeridian);

/** How close two pins have to be, in pixels, before they become one marker. */
const CLUSTER_RADIUS = 18;
/** How far a tap may miss a marker and still count as hitting it. */
const TAP_SLACK = 16;
/** How far below the top of the list a story brought there by the map sits. */
const REVEAL_MARGIN = 8;
/** How long the address bar waits while the reader keeps scrolling. */
const URL_QUIET = 400;
/** How long the map takes to slide from one story to the next, in milliseconds. */
const GLIDE_MS = 260;
/** How far in the map goes to show a place the reader tapped in the list. */
const CLOSE_ZOOM = 3;
/** How long a row takes to open or fold. Short enough to feel like an answer. */
const FOLD_MS = 220;
/** The easing the style sheet uses, so the two agree about how motion looks. */
const FOLD_EASE = "cubic-bezier(0.25, 1, 0.5, 1)";

const SVG_NS = "http://www.w3.org/2000/svg";
/** The chevron on the fold button. It points down when the row is folded. */
const CHEVRON = ["M6 9.5 12 15.5 18 9.5"];

/**
 * Whether the reader has asked their system for less movement.
 *
 * Four things on this page move: the map's slide, the list's scroll, a row's
 * height and the block that appears inside it. All four ask here, so a reader
 * who turns motion off is never left with one of them still animating.
 */
const reducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/**
 * Which layout is on screen. The wide one puts the map and the reading column
 * side by side; the narrow one stacks them and scrolls only the list.
 *
 * The query is the one `style.css` uses, written once here, so the page and its
 * styles can never disagree about which layout the reader has.
 */
const wideLayout = window.matchMedia("(min-width: 60rem)");
const isWide = () => wideLayout.matches;

const state = {
  lang: "en",
  day: defaultDay(),
  view: { zoom: MIN_ZOOM, cx: 0.5, cy: 0.5 },
  pins: [],
  unplaced: [],
  stories: [],
  selectedId: null,
  /**
   * The stories at the same PLACE as the chosen one. This is what the panel holds
   * and what the list marks.
   *
   * Grouped by place and never by distance on screen. One marker can cover
   * several places, so a distance group put a story in Aarau, Switzerland under
   * the heading "Amsterdam, Netherlands": the two land about six pixels apart at
   * the opening zoom on a phone.
   */
  group: [],
  /**
   * The stories on the marker that was chosen, which can span several places.
   *
   * Used for two things only: to say that the pin also covers stories elsewhere,
   * and to step to the next place when the same marker is chosen again. Captured
   * at the moment of choosing, because the grouping moves with the zoom.
   */
  pinGroup: [],
  /** Markers as last drawn, so a tap can be matched against what is on screen. */
  markers: [],
  /**
   * The stories the reader has opened in the list, by id.
   *
   * It is held here and not in the DOM because `renderLists` rebuilds every row
   * when the countries arrive, about half a second after the map. Without this
   * an opened story would fold itself again under the reader's eyes.
   */
  expanded: new Set(),
  /**
   * Whether the map is folded away, leaving the whole screen to the words.
   *
   * It is not remembered anywhere. The page stores nothing about the reader,
   * which is what lets the credit line say so with no caveat, and a fold is a
   * choice about this minute rather than about every visit.
   */
  mapCollapsed: false,
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
  for (const shape of COASTLINES) {
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

/**
 * Draw one plain dot per story, which is what the collapsed map shows.
 *
 * The collapsed map groups nothing. A numbered disc is 20 to 36 pixels across
 * and the whole map is 160 at its widest, so one disc would cover a quarter of
 * it, and every pin would fall in the same group anyway. Dots say "here, and
 * here" and that is all a map this size can say.
 *
 * The dots are measured against the canvas and not in fixed pixels. The card
 * gives the map the width the day bar leaves, which is 48 pixels on the
 * narrowest phone, and a fixed 2.5-pixel dot there covered a tenth of the world:
 * a real day of news drew Europe as one orange blob. At 10rem, the width the
 * small map asks for, this is the same 2.5 it always was.
 */
function drawDots(colour, ink) {
  const scale = Math.min(1, size.width / 160);
  const plain = Math.max(1, 2.5 * scale);
  const marked = Math.max(1.75, 4 * scale);
  for (const pin of state.pins) {
    const point = project(pin.lon, pin.lat, state.view, size);
    const chosen = pin.story.id === state.selectedId;
    context.beginPath();
    context.arc(point.x, point.y, chosen ? marked : plain, 0, Math.PI * 2);
    context.fillStyle = colour;
    context.fill();
    if (!chosen) continue;
    // The chosen story gets a ring, because a dot one pixel bigger than its
    // neighbours is not a difference anybody sees.
    context.lineWidth = Math.max(0.75, 1.5 * scale);
    context.strokeStyle = ink;
    context.stroke();
  }
}

/**
 * Group the pins at the zoom they are about to be drawn at, so two towns that
 * overlap when zoomed out separate as the reader zooms in.
 *
 * This lives apart from `draw` because the story list needs the same grouping:
 * the list highlights every story sharing a marker, so it has to agree with the
 * canvas about which stories those are.
 */
function updateMarkers() {
  // Nothing is chosen on the collapsed map, so the grouping stays as it was on
  // the full-size one. Grouping against 160 pixels would make one marker of the
  // whole world, and `pinGroup` feeds the panel's "also covers N more" note.
  if (!size.width || state.mapCollapsed) return;
  const points = state.pins.map((pin) => ({ ...project(pin.lon, pin.lat, state.view, size), pin }));
  state.markers = clusterPoints(points, CLUSTER_RADIUS).map((group) => ({
    x: group.x,
    y: group.y,
    items: group.items.map((point) => point.pin),
  }));
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

  // The collapsed map is a picture of where the day is happening, so it stops
  // here, with a dot per story and no markers to aim at.
  if (state.mapCollapsed) {
    drawDots(pin, pinInk);
    return;
  }

  updateMarkers();

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

// --- moving the map ---------------------------------------------------------

/**
 * The frame of a slide in progress, or null. Only one slide runs at a time: a
 * second story chosen while the map is still moving replaces the first.
 */
let glide = null;

/** Stop a slide, so the reader's own hand on the map always wins. */
function cancelGlide() {
  if (glide !== null) cancelAnimationFrame(glide);
  glide = null;
}

/**
 * Slide the map to another view rather than cut to it.
 *
 * The list scrolls smoothly, so a map that jumped from one story to the next
 * would read as a fault. Only the view moves: the pins are drawn from it on
 * every frame, so nothing else has to be told that the map went somewhere.
 *
 * A reader who asked their system for less movement gets the cut instead.
 */
function glideTo(target) {
  cancelGlide();
  if (reducedMotion()) {
    state.view = target;
    scheduleDraw();
    return;
  }

  const from = state.view;
  const started = performance.now();
  const step = (now) => {
    const part = Math.min(1, (now - started) / GLIDE_MS);
    // Eased out, so the map arrives softly instead of stopping dead.
    const eased = 1 - (1 - part) ** 3;
    const mix = (start, end) => start + (end - start) * eased;
    state.view = clampView(
      { zoom: mix(from.zoom, target.zoom), cx: mix(from.cx, target.cx), cy: mix(from.cy, target.cy) },
      size,
    );
    draw();
    glide = part < 1 ? requestAnimationFrame(step) : null;
  };
  glide = requestAnimationFrame(step);
}

/**
 * Bring the chosen story's pin to the middle of the map.
 *
 * @param {object} [options]
 * @param {boolean} [options.closer] also zoom in far enough to see the place,
 *   which a tap on a row does and the reader's own scrolling never does
 */
function moveMapToSelection({ closer = false } = {}) {
  // Scrolling the list moves a map the reader has already zoomed into, and only
  // that map. At the opening zoom the whole world is on screen, so there is
  // nowhere to move to, and the whole world is what makes a pin worth looking
  // at (ADR 0004).
  if (!closer && state.view.zoom <= MIN_ZOOM) return;

  const pin = state.pins.find((candidate) => candidate.story.id === state.selectedId);
  if (!pin) return;
  // Never zoom out: the reader is as close in as they put themselves.
  const zoom = closer ? Math.max(state.view.zoom, CLOSE_ZOOM) : state.view.zoom;
  glideTo(clampView({ zoom, cx: (pin.lon + 180) / 360, cy: (90 - pin.lat) / 180 }, size));
}

/**
 * Collapse the map, or bring it back to full size.
 *
 * Both the button and a tap on the small map come through here, so the two can
 * never disagree about which state the map is in.
 */
function setMapCollapsed(collapsed) {
  if (state.mapCollapsed === collapsed) return;
  state.mapCollapsed = collapsed;
  renderMapCollapsed();
}

/**
 * Show the map collapsed or full size.
 *
 * Collapsed, the whole stage is one card holding the day bar, a small map and
 * the pill, so the reader keeps every day control, can still see where the day
 * is happening, and can still be told that the day is loading, empty or
 * unreachable. The list is the rest of the page, and it gets the room the map
 * gave up. The mark goes on the stage and not on the map's own wrapper, because
 * the day bar is the wrapper's sibling and the card holds both.
 *
 * The small map is the only way back to the big one, so while it is small it is
 * a real button: a screen reader announces it as one and the keyboard reaches
 * it. Full size it is a picture again, and the story list is its accessible
 * copy.
 *
 * The canvas changes shape here, so it is measured again before anything is
 * drawn on it. `resizeCanvas` clamps the view to the new shape, and the map then
 * moves to the story being read, at either size.
 */
function renderMapCollapsed() {
  cancelGlide();
  elements.stage.toggleAttribute("data-collapsed", state.mapCollapsed);
  elements.map.setAttribute("role", state.mapCollapsed ? "button" : "img");
  elements.map.setAttribute("aria-label", say(state.mapCollapsed ? "map.expand" : "map.label"));
  // The fold hides one of these two controls and shows the other, and each one
  // stands where the other stood. So the focus passes between them: whichever
  // one the reader just used is about to disappear, and letting it disappear
  // under the focus drops that focus to the document, which sends the next Tab
  // back to the top of the page.
  if (state.mapCollapsed) {
    const held = document.activeElement === elements.toggleMap;
    elements.map.setAttribute("tabindex", "0");
    if (held) elements.map.focus();
  } else {
    const held = document.activeElement === elements.map;
    elements.map.removeAttribute("tabindex");
    if (held) elements.toggleMap.focus();
  }
  elements.toggleMap.setAttribute("aria-expanded", String(!state.mapCollapsed));
  resizeCanvas();
  draw();
  moveMapToSelection();
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

/**
 * One story in the list.
 *
 * The row is folded: it shows where the story happened, what kind of story it
 * is, and a summary of it. A chevron opens the rest, and on a phone a tap on the
 * row itself opens it too. On a phone the opened row is the whole story, panel
 * and all, because that layout shows no panel.
 *
 * The row is a button, so a keyboard reaches every story.
 */
function storyItem(story, place) {
  const item = document.createElement("li");
  item.className = "story-item";
  // `refreshHighlight` marks which items are open or grouped, by this id.
  item.dataset.storyId = story.id;

  const open = state.expanded.has(story.id);
  const { summary, folded } = summarise(story.text);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "item-main";

  // The first line carries both facts a reader sorts stories by: where it
  // happened, and what kind of story it is. The place is left out when there is
  // none, and then the chip stands alone rather than under an empty line.
  const head = document.createElement("span");
  head.className = "item-head";
  if (place) {
    const where = document.createElement("span");
    where.className = "item-where";
    where.textContent = placeLabel(place, state.lang);
    head.append(where);
  }
  const chip = categoryChip(story.category, open);
  if (chip) head.append(chip);

  // The topic trail's last entry is the closest thing the portal gives a story
  // to a headline. It is left out when it only repeats the category.
  const topic = story.topics.at(-1);
  const heading = topic && topic !== story.category ? document.createElement("span") : null;
  if (heading) {
    heading.className = "item-topic";
    heading.textContent = topic;
  }

  const text = document.createElement("span");
  text.className = "item-text";
  text.textContent = open ? story.text : summary;

  button.append(...[head.childElementCount ? head : null, heading, text].filter(Boolean));
  button.addEventListener("click", () => {
    // On a phone the row is the whole story, so the tap opens it as well as
    // choosing it: the chevron is one small target and a reader who taps a
    // story means "show me this story". `tapUnfolds` holds the two limits on
    // that, and both matter (see `reading.js`).
    //
    // The row is unfolded before the list is scrolled. A row grows downwards,
    // so its own top does not move and the scroll below still aims true.
    if (tapUnfolds({ wide: isWide(), open: state.expanded.has(story.id) })) toggleStory(story, item);
    // A wide screen shows the story in the panel beside the map, so the map
    // moves to it and zooms in on the place. A phone has no panel: the row
    // itself goes to the top of the list, where it is the story the map marks,
    // and a map the reader has zoomed into slides to it without zooming further.
    selectStory(story.id, {
      centre: isWide() && Boolean(place),
      follow: !isWide(),
      reveal: !isWide(),
    });
  });
  item.append(button);

  // The category is not repeated here: the chip on the first line carries it,
  // open or folded, and writing it twice was the reason this block existed.
  const more = document.createElement("div");
  more.className = "item-more";
  more.id = `more-${story.id}`;
  more.hidden = !open;
  if (story.sources.length) more.append(sourceLinks(story));

  // A story with nothing more to show needs no chevron. Every story on the
  // portal carries at least one source, so in practice every row has one.
  if (folded || more.childElementCount) {
    const fold = document.createElement("button");
    fold.type = "button";
    fold.className = "item-fold";
    // The button shows a chevron and no words, so its name is its label.
    fold.setAttribute("aria-label", say(open ? "story.showLess" : "story.showMore"));
    fold.setAttribute("aria-expanded", String(open));
    fold.setAttribute("aria-controls", more.id);
    fold.append(iconSvg(CHEVRON, "item-chevron"));
    fold.addEventListener("click", () => toggleStory(story, item));
    item.append(more, fold);
  }
  return item;
}

/**
 * Open or fold one row, in place.
 *
 * The row is not rebuilt. Rebuilding it would move the focus off the button the
 * reader just pressed, and on a phone it would also move the list under them.
 *
 * The row's height is animated from what it was to what it becomes, which is the
 * only way to make the whole change smooth: the summary is replaced by the full
 * text at the same moment as the sources appear, and neither of those can be
 * eased on its own.
 */
function toggleStory(story, item) {
  const open = !state.expanded.has(story.id);
  if (open) state.expanded.add(story.id);
  else state.expanded.delete(story.id);
  const more = item.querySelector(".item-more");

  animateHeight(item, () => {
    item.querySelector(".item-text").textContent = open ? story.text : summarise(story.text).summary;
    if (more) more.hidden = !open;
    // The chip widens to the category's full name once there is room for it.
    const name = item.querySelector(".item-category-name");
    if (name) name.textContent = categoryName(story.category, open);
    const fold = item.querySelector(".item-fold");
    if (fold) {
      fold.setAttribute("aria-label", say(open ? "story.showLess" : "story.showMore"));
      fold.setAttribute("aria-expanded", String(open));
    }
  });

  if (open && more) fadeIn(more);
}

/**
 * Run a change to a row and ease its height across it.
 *
 * The row already clips what it holds, so animating its height slides the new
 * content into view. A reader who has asked for less motion gets the change with
 * no animation at all.
 */
function animateHeight(item, change) {
  if (reducedMotion() || typeof item.animate !== "function") {
    change();
    return;
  }
  // Read the height the reader can see right now, which on a second press is
  // part way through the first animation, and only then drop that animation. Do
  // it the other way round and the row jumps to where it was going before it
  // starts coming back.
  const from = item.getBoundingClientRect().height;
  for (const running of item.getAnimations()) running.cancel();
  change();
  const to = item.getBoundingClientRect().height;
  if (Math.abs(to - from) < 1) return;
  item.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: FOLD_MS, easing: FOLD_EASE });
}

/** Bring a block that has just appeared up out of the row rather than snapping it in. */
function fadeIn(element) {
  if (reducedMotion() || typeof element.animate !== "function") return;
  element.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], {
    duration: FOLD_MS,
    easing: FOLD_EASE,
  });
}

function renderLists() {
  // The portal's own order, always. The chosen location is shown in full anyway,
  // in the panel on a wide screen and in the row itself on a phone, so promoting
  // its stories here would print each of them twice.
  elements.stories.replaceChildren(...state.pins.map((pin) => storyItem(pin.story, pin.place)));
  elements.unplaced.replaceChildren(...state.unplaced.map((story) => storyItem(story, null)));

  const hasUnplaced = state.unplaced.length > 0;
  elements.unplacedHeading.hidden = !hasUnplaced;
  elements.unplacedWhy.hidden = !hasUnplaced;

  // The list is rebuilt here, so the marks have to go back on. `updateMarkers`
  // runs first because the highlight is derived from the grouping.
  updateMarkers();
  refreshHighlight();
}

/**
 * Read the marker under the chosen story and remember what stands on it.
 *
 * Called when the selection changes, never on a redraw: `pinGroup` moves with the
 * zoom, and the marker it stands for has to be the one the reader chose.
 */
function captureGroup() {
  const chosen = state.pins.find((pin) => pin.story.id === state.selectedId);
  // What the panel shows: one place, so its heading is always true of every story
  // in it.
  state.group = chosen ? storyIdsAtPlace(state.pins, chosen.place.title) : [];

  // What the marker covers, which may be more than one place.
  const mates = groupMatesOf(state.markers, (item) => item.story.id === state.selectedId);
  const onPin = new Set(mates.map((item) => item.story.id));
  state.pinGroup = state.pins.filter((pin) => onPin.has(pin.story.id)).map((pin) => pin.story.id);
}

/** The pins standing on the marker that was chosen, in the list's order. */
function chosenMarkerPins() {
  const ids = new Set(state.pinGroup);
  return state.pins.filter((pin) => ids.has(pin.story.id));
}

/**
 * Mark the list to match the map.
 *
 * Two levels, because they answer two different questions. `aria-current` marks
 * the one story that is open. `data-grouped` marks the others standing on the
 * same pin, which is what makes a marker reading "5" legible: the reader taps it
 * and sees all five stories called out in the list, not just the one that opened.
 *
 * Attributes are toggled on the existing items rather than rebuilding the list,
 * so this can run on every frame of a drag without losing keyboard focus.
 */
function refreshHighlight() {
  const grouped = new Set(state.group);
  for (const list of [elements.stories, elements.unplaced]) {
    for (const item of list.children) {
      const id = item.dataset.storyId;
      const open = id === state.selectedId;
      if (open) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
      // A group of one needs no second mark: the open story already carries one.
      item.toggleAttribute("data-grouped", !open && grouped.size > 1 && grouped.has(id));
    }
  }
}

/**
 * The button over the map, which only the narrow layout shows.
 *
 * One marker can cover several places, and the reader is shown one of them. The
 * panel says so on a wide screen. A phone has no panel, so without this button
 * the other places on a marker cannot be reached at all: nothing would hint that
 * they are there.
 */
function renderNextPlace() {
  const chosen = state.pins.find((pin) => pin.story.id === state.selectedId);
  const elsewhere = chosen ? state.pinGroup.filter((id) => !state.group.includes(id)).length : 0;
  elements.nextPlace.hidden = elsewhere === 0;
  elements.nextPlace.textContent = elsewhere === 0 ? "" : say("selected.nextPlace", { count: elsewhere });
}

// --- the list as the reader scrolls it (narrow layout) -----------------------

/**
 * The story the list is being scrolled to, until it arrives.
 *
 * A scroll started by the map passes over other stories on its way, and each of
 * those would otherwise be read as "the reader is looking at this one" and undo
 * the choice they just made. So the scrolling is ignored until the story asked
 * for is at the top, or until the reader touches the list themselves.
 */
let travellingTo = null;

/** Where every row sits, in the scrolling list's own coordinates. */
function rowMetrics() {
  const box = elements.reading.getBoundingClientRect();
  const offset = elements.reading.scrollTop - box.top;
  const rows = [];
  for (const list of [elements.stories, elements.unplaced]) {
    for (const item of list.children) {
      const rect = item.getBoundingClientRect();
      rows.push({ id: item.dataset.storyId, top: rect.top + offset, bottom: rect.bottom + offset });
    }
  }
  return rows;
}

/** Put one story at the top of the list, which is where the map reads it from. */
function revealInList(id) {
  const row = [...elements.stories.children, ...elements.unplaced.children].find(
    (item) => item.dataset.storyId === id,
  );
  if (!row) return;
  const box = elements.reading.getBoundingClientRect();
  const top = elements.reading.scrollTop + row.getBoundingClientRect().top - box.top - REVEAL_MARGIN;
  travellingTo = id;
  // An explicit behaviour in JavaScript beats the `scroll-behavior` in the style
  // sheet, so the reader's own setting has to be honoured here too.
  elements.reading.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? "auto" : "smooth" });
}

/**
 * Mark the story at the top of the list on the map.
 *
 * This is what makes the two halves of the narrow layout one thing: the reader
 * scrolls the list and the map follows, with no tapping at all.
 *
 * A map the reader has zoomed into also slides to the story, because a pin
 * outside the window is a pin they cannot see. A map showing the whole world
 * holds still: everything is already on it.
 */
function followList() {
  const id = topmostRow(rowMetrics(), elements.reading.scrollTop);
  if (!id) return;
  if (travellingTo) {
    if (id !== travellingTo) return;
    travellingTo = null;
  }
  // The address bar waits until the scrolling stops. Browsers limit how often a
  // page may rewrite it, and a long scroll would spend that budget in seconds.
  if (id !== state.selectedId) selectStory(id, { url: false, follow: true });
}

/**
 * Every story at the chosen location, in full, above the day's full list.
 *
 * The wide layout only: the narrow one hides this panel and opens each row in
 * place instead, because a panel that rewrote itself while the reader scrolled
 * would resize the column they are scrolling.
 *
 * This replaced a panel that showed only the story that was tapped. A marker
 * reading "5" stood for five stories and showed one of them, which a reader
 * reported twice: first as "only one is highlighted", then as "only one appears
 * under the map". The whole group belongs here.
 */
function renderSelectedPanel() {
  const byId = new Map(state.pins.map((pin) => [pin.story.id, pin]));
  const chosen = byId.get(state.selectedId);
  const unplaced = state.unplaced.find((story) => story.id === state.selectedId);

  if (!chosen && !unplaced) {
    elements.panel.hidden = true;
    elements.panelStories.replaceChildren();
    return;
  }
  elements.panel.hidden = false;

  // A story with no place is its own group of one; there is no location to head.
  const group = chosen ? state.group.filter((id) => byId.has(id)) : [state.selectedId];
  const stories = chosen ? group.map((id) => byId.get(id).story) : [unplaced];

  elements.panelLabel.textContent = say(chosen ? "selected.label" : "story.unplacedHeading");
  elements.panelHeading.textContent = chosen ? placeLabel(chosen.place, state.lang) : unplaced.category;
  const count = stories.length;
  elements.panelCount.hidden = count < 2;
  elements.panelCount.textContent = count < 2 ? "" : say("selected.count", { count });

  // A marker can cover several places while the panel shows one. Say so, or the
  // other places on that pin are unreachable in practice: nothing hints at them.
  const elsewhere = chosen ? state.pinGroup.filter((id) => !group.includes(id)).length : 0;
  elements.panelNote.hidden = elsewhere === 0;
  elements.panelNote.textContent = elsewhere === 0 ? "" : say("selected.alsoOnPin", { count: elsewhere });

  elements.panelStories.replaceChildren(...stories.map((story) => selectedStory(story)));
}

/**
 * What to call a category, in as much room as there is.
 *
 * A folded row gets the short name, an open one the full name. A heading the
 * page does not recognise keeps the portal's own words either way, which are
 * true of any heading an editor writes. See `categories.js`.
 */
function categoryName(category, full) {
  const key = classifyCategory(category);
  return key ? say(`category.${key}.${full ? "full" : "short"}`) : category;
}

/**
 * The portal's own grouping of the day, as an icon and a name.
 *
 * @param {string} category the portal's heading, for example "Law and crime"
 * @param {boolean} full show the full name rather than the short one
 * @returns {HTMLElement|null} null when the story carries no category at all,
 *   which happens on a day whose editor wrote no headings
 */
function categoryChip(category, full) {
  if (!category) return null;
  const key = classifyCategory(category);
  const chip = document.createElement("span");
  chip.className = "item-category";
  if (key) chip.dataset.category = key;
  // No icon for a heading the page does not recognise. A wrong picture on a
  // story is worse than no picture, and the name still says what it is.
  if (key) chip.append(iconSvg(CATEGORY_ICONS[key], "item-category-icon"));
  const name = document.createElement("span");
  name.className = "item-category-name";
  name.textContent = categoryName(category, full);
  chip.append(name);
  return chip;
}

/**
 * One icon, built from the path data a module carries.
 *
 * Built element by element rather than written as markup, because this file
 * never writes `innerHTML`: see the note at the top.
 */
function iconSvg(paths, className) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

/** Who reported the story. The row and the panel both show these. */
function sourceLinks(story) {
  const sources = document.createElement("div");
  sources.className = "story-sources";
  sources.replaceChildren(
    ...story.sources.map((source) => {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener nofollow";
      link.textContent = source.label;
      return link;
    }),
  );
  return sources;
}

/** One story inside the panel: its own words, and the sources that reported it. */
function selectedStory(story) {
  const article = document.createElement("article");
  article.className = "selected-story";
  // No mark for "the one you tapped". A reader asked what the bar down the side
  // meant, which is the answer: nothing worth a mark. Every story in the panel is
  // at the same place and all of them are meant to be read.

  // The topic trail is the closest thing the portal gives a story to a headline,
  // and some stories have none. Falling back to the category printed it twice,
  // once as the label above and once as the heading, so the heading is left out
  // instead of repeating what the reader has just read.
  const topic = story.topics.at(-1);
  const heading = topic && topic !== story.category ? document.createElement("h3") : null;
  if (heading) {
    heading.className = "story-heading";
    heading.textContent = topic;
  }

  const text = document.createElement("p");
  text.className = "story-text";
  text.textContent = story.text;

  // The panel shows a story in full, so its chip carries the full name too.
  article.append(...[categoryChip(story.category, true), heading, text, sourceLinks(story)].filter(Boolean));
  return article;
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

/**
 * Every fixed word on the page, in the reader's language.
 *
 * This runs once, at start-up. The page shows no language picker: it follows the
 * `lang` parameter in the address bar, then the browser's own languages.
 */
function renderChrome() {
  document.documentElement.lang = state.lang;
  elements.title.textContent = say("app.title");
  elements.tagline.textContent = say("app.tagline");
  elements.prevDay.setAttribute("aria-label", say("day.previous"));
  elements.nextDay.setAttribute("aria-label", say("day.next"));
  elements.latestDay.textContent = say("day.latest");
  elements.dayLabel.textContent = say("day.pick");
  elements.zoomIn.setAttribute("aria-label", say("map.zoomIn"));
  elements.zoomOut.setAttribute("aria-label", say("map.zoomOut"));
  elements.resetView.setAttribute("aria-label", say("map.reset"));
  // The button only ever folds the map away; the small map is what unfolds it.
  elements.toggleMap.textContent = say("map.collapse");
  // Names the canvas for both states, and marks it a button while it is small.
  renderMapCollapsed();
  elements.panelClose.setAttribute("aria-label", say("story.close"));
  elements.listHeading.textContent = say("story.listHeading");
  elements.unplacedHeading.textContent = say("story.unplacedHeading");
  elements.unplacedWhy.textContent = say("story.unplacedWhy");
  elements.backLink.textContent = say("ui.backToProjects");
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
  // The state name is what lets a phone leave this one out. The pill stands over
  // the map, and the counts are the only thing it says that nobody waits for.
  setStatus(say("status.counts", { placed: state.pins.length, unplaced: state.unplaced.length }), "counts");
  renderListHint();
}

/** The "pick a pin" nudge, which has nothing to say once one is open. */
function renderListHint() {
  const show = state.pins.length > 0 && state.selectedId === null;
  elements.listHint.textContent = show ? say("story.selectHint") : "";
}

// --- state changes ----------------------------------------------------------

function writeUrl() {
  clearTimeout(urlTimer);
  const search = buildSearch({ day: toIsoDay(state.day), story: state.selectedId, lang: state.lang });
  history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
}

/**
 * Write the address bar once the reader stops scrolling.
 *
 * Scrolling the list changes which story is open, and a browser allows a page
 * only so many rewrites of its address in a given time. One write per scroll,
 * not one per row.
 */
let urlTimer = null;
function writeUrlSoon() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(writeUrl, URL_QUIET);
}

/**
 * Put the page back to "no story open".
 *
 * The narrow layout has no such state: there the map marks whatever story stands
 * at the top of the list, and there is always one. So a tap on the open sea
 * leaves that reader where they are, rather than blanking the pin they are
 * reading about.
 */
function clearSelection() {
  if (!isWide()) return;
  if (state.selectedId === null) return;
  state.selectedId = null;
  state.group = [];
  state.pinGroup = [];
  renderSelectedPanel();
  // The rows themselves do not change, only their marks. Rebuilding them would
  // throw away keyboard focus and fold open any story the reader had opened.
  refreshHighlight();
  renderNextPlace();
  renderListHint();
  writeUrl();
  scheduleDraw();
}

/**
 * Open one story.
 *
 * @param {string} id the story to open
 * @param {object} [options]
 * @param {boolean} [options.centre] move the map to the story's pin, and zoom in
 *   on it if the map is still showing the whole world
 * @param {boolean} [options.follow] move the map to the story's pin without
 *   touching the zoom, and do nothing while the whole world is on screen. This
 *   is the reader scrolling the list on a phone.
 * @param {boolean} [options.reveal] bring the story to the top of the list,
 *   which is what the map does when the reader taps a pin
 * @param {boolean} [options.url] write the address bar now rather than once the
 *   scrolling stops
 */
function selectStory(id, { centre = false, follow = false, reveal = false, url = true } = {}) {
  state.selectedId = id;
  // Read the marker as it stands right now, before any centring moves the view:
  // the group must be the one the reader was looking at when they chose it.
  updateMarkers();
  captureGroup();
  if (state.selectedId && (centre || follow)) moveMapToSelection({ closer: centre });
  renderSelectedPanel();
  refreshHighlight();
  renderNextPlace();
  renderListHint();
  if (reveal && !isWide()) revealInList(id);
  if (url) writeUrl();
  else writeUrlSoon();
  scheduleDraw();
}

/**
 * Make the map and the list agree, once the day's rows are on screen.
 *
 * On the narrow layout the story at the top of the list is the one the map
 * marks, so a day has to open with one of them chosen: the story the address bar
 * asked for, brought to the top, or else the first row of the day.
 */
function startReadingList() {
  if (isWide()) return;
  travellingTo = null;
  if (state.selectedId) revealInList(state.selectedId);
  else followList();
}

async function showDay(date, { keepStory = null } = {}) {
  state.day = date;
  state.selectedId = keepStory;
  state.group = [];
  state.pinGroup = [];
  state.loading = true;
  state.pins = [];
  state.unplaced = [];
  state.stories = [];
  state.expanded.clear();
  state.markers = [];
  travellingTo = null;
  cancelGlide();
  renderDayBar();
  renderLists();
  renderSelectedPanel();
  renderNextPlace();
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
      // The countries land after the map is already drawn, so the place names
      // they belong to have to be written again when they do.
      onCountries: () => {
        if (controller.signal.aborted) return;
        renderLists();
        renderSelectedPanel();
        renderNextPlace();
      },
    });
    if (controller.signal.aborted) return;
    state.loading = false;
    state.stories = day.stories;
    state.pins = day.pins;
    state.unplaced = day.unplaced;
    // A story kept from the URL may not exist on this day.
    if (state.selectedId && !day.stories.some((story) => story.id === state.selectedId)) state.selectedId = null;
    // The markers only exist once the day's pins do, so a story carried in from
    // the address bar gets its group read here rather than at start-up.
    updateMarkers();
    captureGroup();
    renderLists();
    renderSelectedPanel();
    renderNextPlace();
    renderCounts();
    writeUrl();
    scheduleDraw();
    startReadingList();
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

  // A tap on the small map expands it. Nothing else on it responds: the handlers
  // below all return while it is collapsed, so a finger that lands on it neither
  // pans a map too small to aim nor opens a story the reader could not see.
  canvas.addEventListener("click", () => {
    if (state.mapCollapsed) setMapCollapsed(false);
  });

  // The same on a keyboard, because the small map is the only way back to the
  // big one. `renderMapCollapsed` carries the focus over to the fold button.
  canvas.addEventListener("keydown", (event) => {
    if (!state.mapCollapsed) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    // Space scrolls the page by default, and the page under a phone's list must
    // not move because the reader opened the map.
    event.preventDefault();
    setMapCollapsed(false);
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state.mapCollapsed) return;
    // The reader's own hand wins over a slide the list started.
    cancelGlide();
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
      // Choosing a marker again moves to the next PLACE on it. A marker can cover
      // several places, and the panel shows one place at a time, so stepping by
      // story would need three taps to reach the second place on a pin holding
      // two stories at the first.
      const here = state.pins.find((pin) => pin.story.id === state.selectedId)?.place?.title ?? null;
      const next = nextPlaceOnMarker(
        marker.items,
        marker.items.some((item) => item.story.id === state.selectedId) ? here : null,
      );
      // The list follows the map: the story the reader chose goes to the top of
      // it, which on a phone is the only way to read the story at all.
      if (next) selectStory(next, { reveal: true });
    }
  };

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (state.mapCollapsed) return;
      event.preventDefault();
      cancelGlide();
      const factor = Math.exp(-event.deltaY * 0.0015);
      state.view = zoomAt(state.view, size, canvasPoint(event), factor);
      scheduleDraw();
    },
    { passive: false },
  );

  const zoomFromCentre = (factor) => {
    cancelGlide();
    state.view = zoomAt(state.view, size, { x: size.width / 2, y: size.height / 2 }, factor);
    scheduleDraw();
  };
  elements.zoomIn.addEventListener("click", () => zoomFromCentre(1.7));
  elements.zoomOut.addEventListener("click", () => zoomFromCentre(1 / 1.7));
  elements.resetView.addEventListener("click", () => {
    cancelGlide();
    state.view = clampView({ zoom: MIN_ZOOM, cx: 0.5, cy: 0.5 }, size);
    scheduleDraw();
  });
}

/**
 * The scrolling list, on the narrow layout.
 *
 * Scrolling is watched once per frame at most, because the wide layout scrolls
 * the same element and reading every row's box is not free. The wide layout
 * takes no part in this at all: there the panel sits inside this same scrolling
 * column, so a selection that followed the scrolling would resize the column and
 * scroll it again, on and on.
 */
function wireReadingList() {
  let scrollFrame = null;
  elements.reading.addEventListener(
    "scroll",
    () => {
      if (isWide() || scrollFrame !== null) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        followList();
      });
    },
    { passive: true },
  );

  // The reader's own hand wins over a scroll the map started: whatever they are
  // scrolling towards is now the story they mean.
  for (const event of ["pointerdown", "wheel", "touchstart", "keydown"]) {
    elements.reading.addEventListener(event, () => (travellingTo = null), { passive: true });
  }
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
  elements.panelClose.addEventListener("click", clearSelection);
  elements.toggleMap.addEventListener("click", () => setMapCollapsed(!state.mapCollapsed));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearSelection();
  });

  // The other places on the chosen pin, one tap away. Same step as choosing the
  // marker again, which is what a wide screen tells the reader to do.
  elements.nextPlace.addEventListener("click", () => {
    const chosen = state.pins.find((pin) => pin.story.id === state.selectedId);
    if (!chosen) return;
    const next = nextPlaceOnMarker(chosenMarkerPins(), chosen.place.title);
    if (next) selectStory(next, { reveal: true });
  });

  wireReadingList();

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      draw();
    }, 100);
  });

  // Turning a phone sideways can swap the layout. The narrow one needs a story
  // chosen, because the map marks whatever stands at the top of the list.
  wideLayout.addEventListener?.("change", () => {
    resizeCanvas();
    draw();
    startReadingList();
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
