// The game: the loop, the input, and every screen.
//
// This is the only file that owns mutable state. Everything it leans on is
// pure and tested next door: the battle engine, the script runner, the world
// rules, the save document, the menu arithmetic. This file decides what happens
// and asks `render.js` to draw it.
//
// Rough shape of a frame:
//   read input  ->  update whatever screen is on top  ->  draw it
//
// Screens stack in a simple way: `game.screen` says which one is running, and a
// message box or a question sits on top of any of them.

import {
  Renderer,
  SCREEN_W,
  SCREEN_H,
  TILE,
  UI,
  BOX,
  BOX_MARGIN,
  PANELS,
  PROMPT_W,
} from "./render.js";
import { AudioEngine } from "./audio.js";
import { Rng } from "./rng.js";
import {
  MAPS,
  STARTER_CHOICE,
  getBadge,
  getMap,
  getTrainer,
  spawnCharacters,
} from "./areas/index.js";
import {
  DIRECTIONS,
  directionTowards,
  facingPosition,
  isSolid,
  oppositeDirection,
  pickEncounter,
  rollsEncounter,
  seesPlayer,
  signAt,
  triggersAt,
  tryStep,
  warpAt,
} from "./world.js";
import { ScriptRunner, evaluateCondition } from "./events.js";
import {
  PARTY_LIMIT,
  addMonster,
  awardBadge,
  createSave,
  depositToBox,
  exportFileName,
  formatPlayTime,
  hasFlag,
  hasStoredSave,
  loadFromStorage,
  markCaught,
  markSeen,
  parseSave,
  reorderBox,
  reorderParty,
  saveToStorage,
  serialise,
  setFlag,
  swapWithBox,
  withdrawFromBox,
} from "./save.js";
import {
  createMonster,
  displayName,
  evolve,
  healParty,
  isFainted,
  learnMove,
  levelProgress,
  maxHp,
  statsOf,
} from "./monsters.js";
import { SPECIES, getSpecies } from "./species.js";
import { getMove } from "./moves.js";
import {
  ITEMS,
  addItem,
  applyItem,
  bagList,
  countOf,
  formatMoney,
  getItem,
  isBall,
  removeItem,
} from "./items.js";
import { TYPE_COLORS, TYPE_NAMES } from "./types.js";
import { paginate, wrapText } from "./art/font.js";
import { PERSON_LIFT } from "./art/people.js";
import {
  affordable,
  barWidth,
  cameraFor,
  clampScroll,
  fieldMenuItems,
  healthColor,
  layoutMode,
  messagePage,
  moveCursor,
  moveGridCursor,
  pixelScale,
  stepQuantity,
} from "./ui.js";
import { activeMonster, battleResult, createBattle, takeTurn, usableMoves } from "./battle.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { escapeHtml, say as deploySay } from "./deployText.js";

/** How many frames one step across a tile takes. */
const STEP_FRAMES = 9;

/** How long a battle message sits on screen before it moves on by itself. */
const AUTO_ADVANCE = 46;

/** The four buttons the battle offers. Short words: the columns are narrow. */
const BATTLE_ACTIONS = ["Fight", "Bag", "Team", "Run"];

const canvas = document.getElementById("screen");
const renderer = new Renderer(canvas);
const audio = new AudioEngine();

/** Everything that changes while the game runs. */
const game = {
  screen: "title",
  state: null,
  map: null,
  characters: [],
  player: { x: 0, y: 0, dir: "down", px: 0, py: 0, sprite: "playerBoy", frame: 0 },
  step: null,
  camera: { x: 0, y: 0 },
  rng: new Rng(),
  msg: null,
  choice: null,
  runner: null,
  runnerNpc: null,
  battle: null,
  battleView: null,
  battleNpc: null,
  menu: null,
  shop: null,
  starter: null,
  fade: null,
  wait: 0,
  afterWait: null,
  npcWalk: null,
  frames: 0,
  titleIndex: 0,
};

// ---------------------------------------------------------------------------
// Input
//
// The game has to be playable with a keyboard, with a finger and with a mouse.
// Three things together cover all three:
//
//   1. the pad under the screen, which is always there
//   2. hotspots: every menu entry registers the rectangle it occupies as it is
//      drawn, so tapping or clicking an entry picks it
//   3. the stick: a drag anywhere on the map walks that way, and a tap with no
//      drag talks to whatever is in front
// ---------------------------------------------------------------------------

const held = new Set();
const pressedThisFrame = new Set();

const KEY_MAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  KeyZ: "a",
  Enter: "a",
  Space: "a",
  KeyX: "b",
  Escape: "b",
  Backspace: "b",
  KeyM: "mute",
};

function press(action) {
  if (!action) return;
  if (!held.has(action)) pressedThisFrame.add(action);
  held.add(action);
  audio.unlock();
}

function release(action) {
  if (action) held.delete(action);
}

/**
 * Press a button for exactly one frame, with no key and no finger.
 *
 * `pressedThisFrame` is cleared right after `update`, so anything added between
 * two frames survives into the next one. That is what lets a pointer event
 * stand in for a key press.
 */
function virtualPress(action) {
  pressedThisFrame.add(action);
  audio.unlock();
}

/** True on the frame a button went down. */
function tapped(action) {
  return pressedThisFrame.has(action);
}

window.addEventListener("keydown", (event) => {
  const action = KEY_MAP[event.code];
  if (!action) return;
  if (document.activeElement?.tagName === "INPUT") return;
  event.preventDefault();
  press(action);
});
window.addEventListener("keyup", (event) => release(KEY_MAP[event.code]));
window.addEventListener("blur", () => held.clear());

for (const button of document.querySelectorAll("[data-key]")) {
  const action = button.dataset.key;
  const down = (event) => {
    event.preventDefault();
    press(action);
  };
  const up = (event) => {
    event.preventDefault();
    release(action);
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointerleave", up);
  button.addEventListener("pointercancel", up);
}

/**
 * Rectangles of the screen a tap can act on.
 * Rebuilt from scratch every frame, so nothing off screen can ever be tapped.
 */
let hotspots = [];

/** Mark a rectangle as something a tap can act on. */
function hot(x, y, w, h, run) {
  hotspots.push({ x, y, w, h, run });
}

/** A tap that sets a cursor and then confirms, which is what a click means. */
function hotChoose(x, y, w, h, set) {
  hot(x, y, w, h, () => {
    set();
    virtualPress("a");
  });
}

/** Where a pointer event landed, in the 240 by 160 the game draws in. */
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * SCREEN_W,
    y: ((event.clientY - rect.top) / rect.height) * SCREEN_H,
  };
}

function pointIn(spot, point) {
  return (
    point.x >= spot.x && point.x < spot.x + spot.w && point.y >= spot.y && point.y < spot.y + spot.h
  );
}

/** How far a finger has to travel before it counts as a walk and not a tap. */
const DRAG_THRESHOLD = 6;

let stick = null;

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  audio.unlock();
  const point = canvasPoint(event);
  for (let i = hotspots.length - 1; i >= 0; i--) {
    if (pointIn(hotspots[i], point)) {
      hotspots[i].run();
      return;
    }
  }
  if (game.screen === "field" && !overlayBusy()) {
    stick = { id: event.pointerId, x: point.x, y: point.y, dir: null, moved: false };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  virtualPress("a");
});

canvas.addEventListener("pointermove", (event) => {
  if (!stick || event.pointerId !== stick.id) return;
  const point = canvasPoint(event);
  const dx = point.x - stick.x;
  const dy = point.y - stick.y;
  if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
  stick.moved = true;
  stick.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
});

function endStick(event) {
  if (!stick || (event && event.pointerId !== stick.id)) return;
  const wasATap = !stick.moved;
  const origin = { x: stick.x, y: stick.y };
  stick = null;
  if (!wasATap) return;
  // A tap with no drag: turn toward the tile touched, if it is next door, and
  // then talk to whatever is there.
  const tileX = Math.floor((origin.x + game.camera.x) / TILE);
  const tileY = Math.floor((origin.y + game.camera.y) / TILE);
  const dx = tileX - game.player.x;
  const dy = tileY - game.player.y;
  if (Math.abs(dx) + Math.abs(dy) === 1) {
    game.player.dir = Math.abs(dx) > 0 ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }
  virtualPress("a");
}

canvas.addEventListener("pointerup", endStick);
canvas.addEventListener("pointercancel", endStick);

/**
 * Throw away the click that follows a tap on the screen.
 *
 * A finger on a touch screen sends `pointerdown` first and a `click` after it.
 * The game acts on the `pointerdown`, and by the time the `click` arrives the
 * page may have moved: the browser then hands that click to whatever now sits
 * under the finger. One tap on the screen was starting the game AND pressing
 * the Fullscreen button that had slid into that spot. `preventDefault` on the
 * `pointerdown` does not stop it, because it never suppresses `click`.
 *
 * So the click is caught on the way down and dropped. Any button pressed on
 * purpose gets its own `pointerdown` first, which clears the flag, so a real
 * press is never eaten.
 */
let swallowNextClick = false;

document.addEventListener(
  "pointerdown",
  (event) => {
    swallowNextClick = event.target === canvas;
  },
  true,
);

document.addEventListener(
  "click",
  (event) => {
    if (!swallowNextClick) return;
    swallowNextClick = false;
    if (event.target === canvas) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true,
);

/**
 * The direction the player wants to walk, or null.
 *
 * A direction still held counts, one pressed and let go inside the same frame
 * counts, and so does a drag. Without the second case a quick tap of a key does
 * nothing at all, which is exactly how a person nudges a character one tile.
 */
function heldDirection() {
  for (const dir of ["up", "down", "left", "right"]) {
    if (held.has(dir) || pressedThisFrame.has(dir)) return dir;
  }
  return stick?.dir ?? null;
}

// ---------------------------------------------------------------------------
// Messages and questions
// ---------------------------------------------------------------------------

/**
 * Draw a description into a panel that cannot turn a page.
 *
 * The panel shows every line the text needs, because a line it left out would
 * go nowhere: no arrow shows and no key advances it. `art/font.test.js` checks
 * that each description still fits the panel that shows it.
 */
function drawPanel(panel, text) {
  renderer.lines(wrapText(text, panel.w), panel.x, panel.y);
}

/** Put a message on screen and run `after` once the player reads it all. */
function say(text, after = null, { width = BOX.w } = {}) {
  game.msg = { pages: paginate(text, width - BOX_MARGIN, 2), index: 0, after, width };
}

/** Ask a question with a small list of answers. */
function ask(text, options, onPick) {
  say(text, () => {
    game.choice = { options, index: 0, onPick };
  });
}

function updateMessage() {
  if (!game.msg) return;
  if (!tapped("a") && !tapped("b")) return;
  const { last } = messagePage(game.msg.pages, game.msg.index);
  audio.playSound("blip");
  if (!last) {
    game.msg.index += 1;
    return;
  }
  const after = game.msg.after;
  game.msg = null;
  if (after) after();
}

function updateChoice() {
  if (!game.choice) return;
  const options = game.choice.options;
  if (tapped("up")) {
    game.choice.index = moveCursor(game.choice.index, -1, options.length);
    audio.playSound("blip");
  }
  if (tapped("down")) {
    game.choice.index = moveCursor(game.choice.index, 1, options.length);
    audio.playSound("blip");
  }
  if (!tapped("a")) return;
  const picked = game.choice.index;
  const onPick = game.choice.onPick;
  game.choice = null;
  audio.playSound("select");
  onPick(picked);
}

/** True when a message or a question is holding everything else up. */
function overlayBusy() {
  return Boolean(game.msg || game.choice || game.wait > 0 || game.npcWalk);
}

// ---------------------------------------------------------------------------
// Loading a map
// ---------------------------------------------------------------------------

function enterMap(mapId, x, y, dir) {
  const map = getMap(mapId);
  if (!map) return;
  game.map = map;
  game.characters = spawnCharacters(map).map((npc) => ({
    ...npc,
    px: npc.x * TILE,
    py: npc.y * TILE,
  }));
  refreshCharacterVisibility();
  game.player.x = x;
  game.player.y = y;
  game.player.dir = dir ?? game.player.dir;
  game.player.px = x * TILE;
  game.player.py = y * TILE;
  game.player.frame = 0;
  game.step = null;
  game.state.player.map = mapId;
  game.state.player.x = x;
  game.state.player.y = y;
  game.state.player.dir = game.player.dir;
  updateCamera(true);
  audio.playMusic(map.music);
  autosave();
}

/** Hide or show everyone whose `hideWhen` condition has changed. */
function refreshCharacterVisibility() {
  for (const npc of game.characters) {
    if (npc.hideWhen) npc.hidden = evaluateCondition(npc.hideWhen, game.state);
  }
}

/**
 * People marked `wander` glance about now and then.
 *
 * They turn but never walk. Somebody who wandered into a doorway would shut the
 * player out of a building, and the bug would only show up sometimes.
 * `Math.random` on purpose: this is decoration, and it must not move the saved
 * generator along and change which creature the next patch of grass holds.
 */
function updateWanderers() {
  if (game.frames % 96 !== 0) return;
  for (const npc of game.characters) {
    if (!npc.wander || npc.hidden || npc === game.npcWalk?.npc) continue;
    if (Math.random() < 0.5) {
      npc.dir = ["up", "down", "left", "right"][Math.floor(Math.random() * 4)];
    }
  }
}

function updateCamera(snap = false) {
  const target = cameraFor({
    centreX: game.player.px + TILE / 2,
    centreY: game.player.py + TILE / 2,
    viewW: SCREEN_W,
    viewH: SCREEN_H,
    mapW: game.map.width * TILE,
    mapH: game.map.height * TILE,
  });
  if (snap) {
    game.camera = target;
  } else {
    game.camera.x = target.x;
    game.camera.y = target.y;
  }
}

// ---------------------------------------------------------------------------
// The overworld
// ---------------------------------------------------------------------------

function updateField() {
  if (game.step) {
    game.step.elapsed += 1;
    const share = Math.min(1, game.step.elapsed / game.step.frames);
    game.player.px = game.step.fromX + (game.step.toX - game.step.fromX) * share;
    game.player.py = game.step.fromY + (game.step.toY - game.step.fromY) * share;
    game.player.frame = Math.floor(game.step.elapsed / 5) % 2;
    if (share >= 1) {
      game.player.x = game.step.tileX;
      game.player.y = game.step.tileY;
      game.player.px = game.player.x * TILE;
      game.player.py = game.player.y * TILE;
      game.state.player.x = game.player.x;
      game.state.player.y = game.player.y;
      game.state.player.steps += 1;
      game.step = null;
      arrivedOnTile();
    }
    updateCamera();
    return;
  }

  if (tapped("a")) {
    interact();
    return;
  }
  if (tapped("b")) {
    openFieldMenu();
    return;
  }

  const dir = heldDirection();
  if (!dir) {
    game.player.frame = 0;
    return;
  }
  game.player.dir = dir;
  game.state.player.dir = dir;
  const result = tryStep(game.map, game.player, dir, game.characters);
  if (!result.ok) {
    if (game.frames % 20 === 0) audio.playSound("bump");
    return;
  }
  game.step = {
    elapsed: 0,
    frames: result.jumped ? STEP_FRAMES * 2 : STEP_FRAMES,
    fromX: game.player.px,
    fromY: game.player.py,
    toX: result.x * TILE,
    toY: result.y * TILE,
    tileX: result.x,
    tileY: result.y,
  };
  if (result.jumped) audio.playSound("bump");
}

/** Everything that can happen the moment the player lands on a new tile. */
function arrivedOnTile() {
  const { x, y } = game.player;

  const warp = warpAt(game.map, x, y);
  if (warp) {
    startFade(() => {
      audio.playSound("door");
      enterMap(warp.to, warp.tx, warp.ty, warp.dir);
    });
    return;
  }

  for (const trigger of triggersAt(game.map, x, y)) {
    if (trigger.once && hasFlag(game.state, trigger.once)) continue;
    if (trigger.condition && !evaluateCondition(trigger.condition, game.state)) continue;
    if (trigger.once) game.state = setFlag(game.state, trigger.once);
    startScript(trigger.script, null);
    return;
  }

  if (checkTrainerSight()) return;

  if (rollsEncounter(game.map, x, y, game.rng)) {
    const met = pickEncounter(game.map, game.rng);
    if (met) startWildBattle(met.species, met.level);
  }
}

/** Has anybody spotted the player standing there? */
function checkTrainerSight() {
  for (const npc of game.characters) {
    if (npc.hidden || !npc.trainer) continue;
    if (npc.defeatFlag && hasFlag(game.state, npc.defeatFlag)) continue;
    if (!seesPlayer(game.map, npc, game.player, game.characters)) continue;
    startTrainerApproach(npc);
    return true;
  }
  return false;
}

/** The trainer notices you, walks over and starts the fight. */
function startTrainerApproach(npc) {
  audio.playSound("select");
  npc.alert = 40;
  game.wait = 40;
  game.afterWait = () => {
    const path = [];
    const step = DIRECTIONS[npc.dir];
    let x = npc.x;
    let y = npc.y;
    // Stop one tile short of the player.
    while (path.length < 8) {
      const nextX = x + step.dx;
      const nextY = y + step.dy;
      if (nextX === game.player.x && nextY === game.player.y) break;
      if (isSolid(game.map, nextX, nextY)) break;
      x = nextX;
      y = nextY;
      path.push({ x, y });
    }
    walkNpcAlong(npc, path, () => {
      npc.dir = directionTowards(npc, game.player);
      game.player.dir = oppositeDirection(npc.dir);
      say(getTrainer(npc.trainer).intro, () => startTrainerBattle(npc));
    });
  };
}

/** Walk a person along a list of tiles, then run `done`. */
function walkNpcAlong(npc, path, done) {
  if (path.length === 0) {
    done();
    return;
  }
  game.npcWalk = { npc, path, index: 0, elapsed: 0, done };
}

function updateNpcWalk() {
  const walk = game.npcWalk;
  if (!walk) return;
  const target = walk.path[walk.index];
  const fromX = walk.index === 0 ? walk.npc.x * TILE : walk.path[walk.index - 1].x * TILE;
  const fromY = walk.index === 0 ? walk.npc.y * TILE : walk.path[walk.index - 1].y * TILE;
  walk.elapsed += 1;
  const share = Math.min(1, walk.elapsed / STEP_FRAMES);
  walk.npc.px = fromX + (target.x * TILE - fromX) * share;
  walk.npc.py = fromY + (target.y * TILE - fromY) * share;
  walk.npc.frame = Math.floor(walk.elapsed / 5) % 2;
  if (share < 1) return;
  walk.npc.x = target.x;
  walk.npc.y = target.y;
  walk.npc.px = target.x * TILE;
  walk.npc.py = target.y * TILE;
  walk.npc.frame = 0;
  walk.index += 1;
  walk.elapsed = 0;
  if (walk.index < walk.path.length) return;
  game.npcWalk = null;
  walk.done();
}

/** Press A: talk to whoever or whatever is in front. */
function interact() {
  const front = facingPosition(game.player, game.player.dir);
  const npc = game.characters.find(
    (entry) => !entry.hidden && entry.x === front.x && entry.y === front.y,
  );
  if (npc) {
    npc.dir = directionTowards(npc, game.player);
    if (npc.trainer && !(npc.defeatFlag && hasFlag(game.state, npc.defeatFlag))) {
      say(getTrainer(npc.trainer).intro, () => startTrainerBattle(npc));
      return;
    }
    startScript(npc.script ?? [["say", "..."]], npc);
    return;
  }
  const sign = signAt(game.map, front.x, front.y);
  if (!sign) return;
  if (sign.script) startScript(sign.script, null);
  else say(sign.text);
}

// ---------------------------------------------------------------------------
// Scripts
// ---------------------------------------------------------------------------

function startScript(script, npc) {
  game.runner = new ScriptRunner(script, { npc: npc?.id });
  game.runnerNpc = npc;
  advanceScript();
}

/** Pull effects off the runner until one of them needs the player. */
function advanceScript() {
  if (!game.runner) return;
  for (let guard = 0; guard < 500; guard++) {
    if (overlayBusy()) return;
    const effect = game.runner.step(game.state);
    if (effect.type === "end") {
      game.runner = null;
      game.runnerNpc = null;
      refreshCharacterVisibility();
      autosave();
      return;
    }
    if (runEffect(effect)) return;
  }
}

/**
 * Carry out one effect.
 * @returns {boolean} true when the script has to stop and wait
 */
function runEffect(effect) {
  switch (effect.type) {
    case "say":
      say(effect.text, advanceScript);
      return true;
    case "ask":
      ask(
        effect.text,
        effect.options.map((option) => option.label),
        (index) => {
          game.runner.answer(index);
          advanceScript();
        },
      );
      return true;
    case "setFlag":
      game.state = setFlag(game.state, effect.flag, effect.value);
      refreshCharacterVisibility();
      return false;
    case "give": {
      const item = getItem(effect.item);
      game.state = { ...game.state, bag: addItem(game.state.bag, effect.item, effect.count) };
      audio.playSound("money");
      say(
        `You got ${effect.count > 1 ? `${effect.count} ` : ""}${item?.name ?? "something"}!`,
        advanceScript,
      );
      return true;
    }
    case "money":
      game.state = {
        ...game.state,
        player: {
          ...game.state.player,
          money: Math.max(0, game.state.player.money + effect.amount),
        },
      };
      if (effect.amount !== 0) audio.playSound("money");
      return false;
    case "giveMonster": {
      const monster = createMonster({
        species: effect.species,
        level: effect.level,
        rng: game.rng,
        metAt: game.map.id,
      });
      const added = addMonster(game.state, monster);
      game.state = added.state;
      audio.playCry(effect.species, getSpecies(effect.species).weight);
      say(
        `You received ${displayName(monster)}!${added.wentToBox ? " It was sent to the box." : ""}`,
        advanceScript,
      );
      return true;
    }
    case "battle":
      startTrainerBattle(null, effect.trainer);
      return true;
    case "wildBattle":
      startWildBattle(effect.species, effect.level);
      return true;
    case "warp":
      startFade(() => enterMap(effect.map, effect.x, effect.y, effect.dir));
      return true;
    case "heal":
      game.state = { ...game.state, party: healParty(game.state.party) };
      audio.playSound("heal");
      return false;
    case "shop":
      openShop(effect.stock);
      return true;
    case "badge":
      game.state = awardBadge(game.state, effect.badge);
      audio.playSound("levelUp");
      say(`You received the ${getBadge(effect.badge)?.name ?? "badge"}!`, advanceScript);
      return true;
    case "face": {
      const npc = findNpc(effect.who);
      if (npc) npc.dir = effect.dir;
      return false;
    }
    case "walk": {
      const npc = findNpc(effect.who);
      if (!npc) return false;
      const step = DIRECTIONS[effect.dir] ?? DIRECTIONS.down;
      const path = [];
      let x = npc.x;
      let y = npc.y;
      for (let i = 0; i < effect.steps; i++) {
        x += step.dx;
        y += step.dy;
        if (isSolid(game.map, x, y)) break;
        if (x === game.player.x && y === game.player.y) break;
        path.push({ x, y });
      }
      npc.dir = effect.dir;
      npc.hidden = false;
      walkNpcAlong(npc, path, advanceScript);
      return true;
    }
    case "visible": {
      const npc = findNpc(effect.who);
      if (npc) npc.hidden = !effect.visible;
      return false;
    }
    case "chooseStarter":
      openStarterChoice();
      return true;
    case "poisonParty": {
      const party = game.state.party.map((monster) =>
        isFainted(monster) || monster.status ? monster : { ...monster, status: "poison" },
      );
      game.state = { ...game.state, party };
      audio.playSound("faint");
      say("Everything in your bag feels heavier. Your creatures were poisoned!", advanceScript);
      return true;
    }
    case "wait":
      game.wait = Math.ceil(effect.ms / 16);
      game.afterWait = advanceScript;
      return true;
    case "music":
      audio.playMusic(effect.track);
      return false;
    case "sound":
      audio.playSound(effect.sound);
      return false;
    case "shake":
      renderer.shake(Math.ceil(effect.ms / 16));
      game.wait = Math.ceil(effect.ms / 16);
      game.afterWait = advanceScript;
      return true;
    default:
      return false;
  }
}

function findNpc(id) {
  return game.characters.find((npc) => npc.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Battles
// ---------------------------------------------------------------------------

function startWildBattle(speciesId, level) {
  const wild = createMonster({ species: speciesId, level, rng: game.rng, metAt: game.map.id });
  game.state = markSeen(game.state, speciesId);
  beginBattle(
    createBattle({ party: game.state.party, foeParty: [wild], kind: "wild", rng: game.rng }),
    null,
  );
}

function startTrainerBattle(npc, trainerId = null) {
  const id = trainerId ?? npc?.trainer;
  const trainer = getTrainer(id);
  if (!trainer) return;
  const party = trainer.party.map((entry) =>
    createMonster({ species: entry.species, level: entry.level, moves: entry.moves, rng: game.rng }),
  );
  for (const entry of party) game.state = markSeen(game.state, entry.species);
  beginBattle(
    createBattle({
      party: game.state.party,
      foeParty: party,
      kind: "trainer",
      trainer: { ...trainer, id },
      rng: game.rng,
    }),
    npc,
  );
}

function beginBattle(battle, npc) {
  game.battle = battle;
  game.battleNpc = npc;
  game.screen = "battle";
  game.battleView = {
    phase: "intro",
    queue: [],
    timer: 0,
    text: "",
    cursor: 0,
    moveCursor: 0,
    listCursor: 0,
    scroll: 0,
    showHp: { player: null, foe: null },
    flash: 0,
    throwFrames: 0,
    finished: false,
  };
  const isBoss = battle.kind === "trainer" && (battle.trainer?.prize ?? 0) >= 1200;
  audio.playMusic(isBoss ? "boss" : "battle");
  const foe = activeMonster(battle, "foe");
  const mine = activeMonster(battle, "player");
  game.battleView.showHp.foe = foe.hp;
  game.battleView.showHp.player = mine.hp;
  audio.playCry(foe.species, getSpecies(foe.species).weight);
  game.battleView.queue.push({
    type: "message",
    text:
      battle.kind === "wild"
        ? `A wild ${displayName(foe)} appeared!`
        : `${battle.trainer.name} wants to fight!`,
  });
  game.battleView.queue.push({ type: "message", text: `Go, ${displayName(mine)}!` });
}

/** Play one battle event, and say how long to hold it on screen. */
function playBattleEvent(event) {
  const view = game.battleView;
  switch (event.type) {
    case "message":
      view.text = event.text;
      view.timer = AUTO_ADVANCE;
      return;
    case "damage":
      audio.playSound(event.amount > 0 ? "hit" : "hitWeak");
      view.flash = 8;
      view.timer = 18;
      return;
    case "faint":
      audio.playSound("faint");
      view.timer = 26;
      return;
    case "useMove":
      view.timer = 6;
      return;
    case "miss":
      audio.playSound("miss");
      view.timer = 10;
      return;
    case "heal":
      audio.playSound("heal");
      view.timer = 14;
      return;
    case "status":
    case "stat":
      view.timer = 8;
      return;
    case "throw":
      audio.playSound("throw");
      view.throwFrames = 30 + event.shakes * 20;
      view.timer = view.throwFrames;
      return;
    case "levelUp":
      audio.playSound("levelUp");
      view.timer = 20;
      return;
    case "sendOut":
      if (event.side === "foe") {
        const foe = activeMonster(game.battle, "foe");
        audio.playCry(foe.species, getSpecies(foe.species).weight);
      }
      view.showHp[event.side] = null;
      view.timer = 16;
      return;
    default:
      view.timer = 6;
  }
}

function updateBattle() {
  const view = game.battleView;
  const battle = game.battle;
  if (!view || !battle) return;

  // Ease the health bars toward the real numbers.
  for (const side of ["player", "foe"]) {
    const monster = activeMonster(battle, side);
    if (view.showHp[side] === null) view.showHp[side] = monster.hp;
    const gap = monster.hp - view.showHp[side];
    if (gap !== 0) view.showHp[side] += Math.sign(gap) * Math.max(1, Math.ceil(Math.abs(gap) / 8));
  }
  if (view.flash > 0) view.flash -= 1;
  if (view.throwFrames > 0) view.throwFrames -= 1;

  if (view.timer > 0) {
    view.timer -= 1;
    if (tapped("a") || tapped("b")) view.timer = 0;
    return;
  }

  if (view.queue.length > 0) {
    playBattleEvent(view.queue.shift());
    return;
  }

  if (battle.over) {
    if (!view.finished) {
      view.finished = true;
      finishBattle();
    }
    return;
  }
  if (battle.awaiting === "switch") view.phase = "switchForced";
  else if (view.phase === "intro" || view.phase === "playing") view.phase = "menu";

  switch (view.phase) {
    case "menu":
      updateBattleMenu();
      break;
    case "move":
      updateMoveMenu();
      break;
    case "bag":
      updateBattleBag();
      break;
    case "party":
    case "switchForced":
      updateBattleParty();
      break;
    default:
      break;
  }
}

function updateBattleMenu() {
  const view = game.battleView;
  for (const dir of ["up", "down", "left", "right"]) {
    if (tapped(dir)) {
      view.cursor = moveGridCursor(view.cursor, dir, 2, BATTLE_ACTIONS.length);
      audio.playSound("blip");
    }
  }
  if (!tapped("a")) return;
  audio.playSound("select");
  if (view.cursor === 0) {
    view.phase = "move";
    view.moveCursor = 0;
  } else if (view.cursor === 1) {
    view.phase = "bag";
    view.listCursor = 0;
    view.scroll = 0;
  } else if (view.cursor === 2) {
    view.phase = "party";
    view.listCursor = 0;
  } else {
    submitBattleAction({ kind: "run" });
  }
}

function updateMoveMenu() {
  const view = game.battleView;
  const moves = usableMoves(game.battle);
  for (const dir of ["up", "down", "left", "right"]) {
    if (tapped(dir)) {
      view.moveCursor = moveGridCursor(view.moveCursor, dir, 2, moves.length);
      audio.playSound("blip");
    }
  }
  if (tapped("b")) {
    view.phase = "menu";
    audio.playSound("back");
    return;
  }
  if (!tapped("a")) return;
  const chosen = moves[view.moveCursor];
  if (!chosen?.usable) {
    audio.playSound("bump");
    return;
  }
  audio.playSound("select");
  submitBattleAction({ kind: "move", slot: view.moveCursor });
}

function battleBagEntries() {
  return bagList(game.state.bag).filter((entry) => entry.item.inBattle);
}

function updateBattleBag() {
  const view = game.battleView;
  const entries = battleBagEntries();
  if (tapped("b")) {
    view.phase = "menu";
    audio.playSound("back");
    return;
  }
  if (entries.length === 0) return;
  if (tapped("up")) view.listCursor = moveCursor(view.listCursor, -1, entries.length);
  if (tapped("down")) view.listCursor = moveCursor(view.listCursor, 1, entries.length);
  view.scroll = clampScroll(view.listCursor, view.scroll, 3, entries.length);
  if (!tapped("a")) return;
  const entry = entries[view.listCursor];
  audio.playSound("select");

  if (isBall(entry.item)) {
    if (game.battle.kind === "trainer") {
      view.text = "You cannot catch another trainer's creature!";
      view.timer = AUTO_ADVANCE;
      view.phase = "playing";
      return;
    }
    game.state = { ...game.state, bag: removeItem(game.state.bag, entry.item.id, 1) };
    submitBattleAction({
      kind: "catch",
      ballBonus: entry.item.ballBonus,
      ballName: entry.item.name,
    });
    return;
  }

  const target = activeMonster(game.battle, "player");
  const result = applyItem(entry.item, target, maxHp(target));
  if (!result.used) {
    view.text = result.message;
    view.timer = AUTO_ADVANCE;
    return;
  }
  game.state = { ...game.state, bag: removeItem(game.state.bag, entry.item.id, 1) };
  submitBattleAction({
    kind: "item",
    message: `You used the ${entry.item.name}.`,
    heal: entry.item.healHp ?? 0,
    cureStatus: Boolean(entry.item.cures),
  });
}

function updateBattleParty() {
  const view = game.battleView;
  const party = game.battle.player.party;
  if (tapped("up")) view.listCursor = moveCursor(view.listCursor, -1, party.length);
  if (tapped("down")) view.listCursor = moveCursor(view.listCursor, 1, party.length);
  if (tapped("b") && view.phase !== "switchForced") {
    view.phase = "menu";
    audio.playSound("back");
    return;
  }
  if (!tapped("a")) return;
  const chosen = party[view.listCursor];
  if (!chosen || isFainted(chosen) || view.listCursor === game.battle.player.active) {
    audio.playSound("bump");
    return;
  }
  audio.playSound("select");
  submitBattleAction({ kind: "switch", index: view.listCursor });
}

function submitBattleAction(action) {
  const { battle, events } = takeTurn(game.battle, action);
  game.battle = battle;
  game.battleView.queue = events;
  game.battleView.phase = "playing";
  game.battleView.text = "";
  game.battleView.timer = 0;
}

function finishBattle() {
  const result = battleResult(game.battle);
  const npc = game.battleNpc;
  const wasTrainer = game.battle.kind === "trainer";
  const trainer = game.battle.trainer;
  game.state = { ...game.state, party: result.party };

  const wrapUp = () => {
    game.battle = null;
    game.battleView = null;
    game.battleNpc = null;
    game.screen = "field";
    audio.playMusic(game.map.music);
    autosave();
    if (game.runner) advanceScript();
  };

  const afterLearns = () => {
    if (result.outcome === "lose") {
      whiteOut();
      return;
    }
    if (wasTrainer && npc?.defeatFlag) {
      game.state = setFlag(game.state, npc.defeatFlag);
      refreshCharacterVisibility();
    }
    if (result.outcome === "win" && wasTrainer) {
      say(`You beat ${trainer.name}! You got ${formatMoney(result.prize)}.`, () => {
        game.state = {
          ...game.state,
          player: { ...game.state.player, money: game.state.player.money + result.prize },
        };
        say(trainer.defeat, wrapUp);
      });
      return;
    }
    wrapUp();
  };

  const afterEvolutions = () => {
    if (result.pendingLearns.length > 0) offerLearn(result.pendingLearns, afterLearns);
    else afterLearns();
  };

  const runEvolutions = (index) => {
    if (index >= result.evolutions.length) {
      afterEvolutions();
      return;
    }
    const entry = result.evolutions[index];
    const before = game.state.party[entry.partyIndex];
    if (!before) {
      runEvolutions(index + 1);
      return;
    }
    const after = evolve(before, entry.to);
    const party = [...game.state.party];
    party[entry.partyIndex] = after;
    game.state = markCaught({ ...game.state, party }, entry.to);
    audio.playSound("levelUp");
    audio.playCry(after.species, getSpecies(after.species).weight);
    say(`${displayName(before)} grew into ${getSpecies(entry.to).name}!`, () =>
      runEvolutions(index + 1),
    );
  };

  if (result.outcome === "caught" && result.caught) {
    const added = addMonster(game.state, result.caught);
    game.state = added.state;
    audio.playSound("caught");
    say(
      `${displayName(result.caught)} was added to your team!${
        added.wentToBox ? " It was sent to the box." : ""
      }`,
      () => runEvolutions(0),
    );
    return;
  }
  runEvolutions(0);
}

/** Ask whether a creature should learn a move it has no room for. */
function offerLearn(pending, done) {
  const next = (index) => {
    if (index >= pending.length) {
      done();
      return;
    }
    const entry = pending[index];
    const monster = game.state.party[entry.partyIndex];
    const move = getMove(entry.moveId);
    if (!monster || !move) {
      next(index + 1);
      return;
    }
    const direct = learnMove(monster, entry.moveId);
    if (direct.learned) {
      const party = [...game.state.party];
      party[entry.partyIndex] = direct.monster;
      game.state = { ...game.state, party };
      say(`${displayName(monster)} learned ${move.name}!`, () => next(index + 1));
      return;
    }
    ask(
      `${displayName(monster)} wants to learn ${move.name}, but it already knows four. Forget one?`,
      [...monster.moves.map((slot) => getMove(slot.id).name), "Do not learn"],
      (choice) => {
        if (choice >= monster.moves.length) {
          say(`${displayName(monster)} did not learn ${move.name}.`, () => next(index + 1));
          return;
        }
        const replaced = learnMove(monster, entry.moveId, choice);
        const party = [...game.state.party];
        party[entry.partyIndex] = replaced.monster;
        game.state = { ...game.state, party };
        say(
          `${displayName(monster)} forgot ${getMove(replaced.replaced).name} and learned ${move.name}!`,
          () => next(index + 1),
        );
      },
    );
  };
  next(0);
}

/** Everything has fainted. Wake up at the Centre once it is known, else at home. */
function whiteOut() {
  const knowsCentre = (game.state.player.badges ?? []).length > 0 || hasFlag(game.state, "beatBoss");
  say("You have no creatures left to fight...", () => {
    say("You made it back, and everything was seen to.", () => {
      game.state = { ...game.state, party: healParty(game.state.party) };
      game.battle = null;
      game.battleView = null;
      game.battleNpc = null;
      game.screen = "field";
      startFade(() => {
        if (knowsCentre) enterMap("centre", 5, 5, "down");
        else enterMap("playerHouse", 4, 4, "down");
        audio.playSound("heal");
      });
    });
  });
}

// ---------------------------------------------------------------------------
// The field menu, the bag, the party and the shop
// ---------------------------------------------------------------------------

function openFieldMenu() {
  audio.playSound("select");
  game.menu = { items: fieldMenuItems(game.state), index: 0, view: "root", cursor: 0, scroll: 0 };
  game.screen = "menu";
}

function closeMenu() {
  game.menu = null;
  game.screen = "field";
  audio.playSound("back");
}

function updateMenu() {
  const menu = game.menu;
  if (!menu) return;

  if (menu.view === "root") {
    if (tapped("up")) {
      menu.index = moveCursor(menu.index, -1, menu.items.length);
      audio.playSound("blip");
    }
    if (tapped("down")) {
      menu.index = moveCursor(menu.index, 1, menu.items.length);
      audio.playSound("blip");
    }
    if (tapped("b")) {
      closeMenu();
      return;
    }
    if (!tapped("a")) return;
    audio.playSound("select");
    const id = menu.items[menu.index].id;
    if (id === "close") closeMenu();
    else if (id === "party") {
      menu.view = "party";
      menu.cursor = 0;
    } else if (id === "box") {
      menu.view = "box";
      menu.side = "party";
      menu.partyCursor = 0;
      menu.boxCursor = 0;
      menu.boxScroll = 0;
      menu.held = null;
    } else if (id === "bag") {
      menu.view = "bag";
      menu.cursor = 0;
      menu.scroll = 0;
    } else if (id === "player") menu.view = "player";
    else if (id === "save") openSaveMenu();
    else if (id === "options") menu.view = "options";
    return;
  }

  if (menu.view === "party") {
    const party = game.state.party;
    if (tapped("up")) menu.cursor = moveCursor(menu.cursor, -1, party.length);
    if (tapped("down")) menu.cursor = moveCursor(menu.cursor, 1, party.length);
    if (tapped("b")) {
      menu.view = "root";
      audio.playSound("back");
      return;
    }
    if (tapped("a") && party[menu.cursor]) {
      audio.playSound("select");
      audio.playCry(party[menu.cursor].species, getSpecies(party[menu.cursor].species).weight);
      menu.view = "summary";
    }
    return;
  }

  if (menu.view === "summary") {
    if (tapped("a") || tapped("b")) {
      menu.view = "party";
      audio.playSound("back");
    }
    return;
  }

  if (menu.view === "box") {
    updateBox(menu);
    return;
  }

  if (menu.view === "bag") {
    const entries = bagList(game.state.bag);
    if (tapped("b")) {
      menu.view = "root";
      audio.playSound("back");
      return;
    }
    if (entries.length === 0) return;
    if (tapped("up")) menu.cursor = moveCursor(menu.cursor, -1, entries.length);
    if (tapped("down")) menu.cursor = moveCursor(menu.cursor, 1, entries.length);
    menu.scroll = clampScroll(menu.cursor, menu.scroll, 6, entries.length);
    if (!tapped("a") || !entries[menu.cursor]) return;
    const entry = entries[menu.cursor];
    if (!entry.item.outside) {
      audio.playSound("bump");
      return;
    }
    audio.playSound("select");
    menu.pendingItem = entry.item;
    menu.view = "useOn";
    menu.cursor = 0;
    return;
  }

  if (menu.view === "useOn") {
    const party = game.state.party;
    if (tapped("up")) menu.cursor = moveCursor(menu.cursor, -1, party.length);
    if (tapped("down")) menu.cursor = moveCursor(menu.cursor, 1, party.length);
    if (tapped("b")) {
      menu.view = "bag";
      audio.playSound("back");
      return;
    }
    if (!tapped("a")) return;
    const target = party[menu.cursor];
    if (!target) return;
    const result = applyItem(menu.pendingItem, target, maxHp(target));
    if (!result.used) {
      audio.playSound("bump");
      say(result.message);
      return;
    }
    const updated = [...party];
    updated[menu.cursor] = result.monster;
    game.state = {
      ...game.state,
      party: updated,
      bag: removeItem(game.state.bag, menu.pendingItem.id, 1),
    };
    audio.playSound("heal");
    say(`${displayName(target)}: ${result.message}`, () => {
      menu.view = "bag";
      menu.cursor = 0;
    });
    return;
  }

  if (menu.view === "options" && tapped("a")) {
    audio.toggleMuted();
    audio.playSound("select");
  }
  if (tapped("b")) {
    menu.view = "root";
    audio.playSound("back");
  }
}

// --- The box ---------------------------------------------------------------
//
// Two columns: the team on the left, the box on the right. One rule works
// everywhere. A picks a creature up, A puts it down. Where it lands decides
// which of the five moves in `save.js` runs.
//
// Each column ends in one empty slot, except the team column when the team is
// full. That slot is what makes a move possible with no partner: drop a
// creature on the empty box row to put it away, drop a boxed creature on the
// empty team row to bring it out.

/** How many rows the box screen shows in each column. */
const BOX_ROWS = 6;

/** How tall one row of the box screen is, and where the first one sits. */
const BOX_ROW_H = 18;
const BOX_TOP = 34;

/** Where each column starts, and how wide it is. */
const BOX_COLUMNS = { party: 8, box: 122 };
const BOX_COL_W = 110;

/**
 * How many rows each column has, counting the empty slot at the end.
 * The team never shows more than six, because it never holds more than six.
 */
function boxRowCounts(state) {
  return {
    party: Math.min(PARTY_LIMIT, state.party.length + 1),
    box: state.box.length + 1,
  };
}

/** Keep both cursors inside their column after a move changed the counts. */
function clampBoxCursors(menu) {
  const rows = boxRowCounts(game.state);
  menu.partyCursor = Math.max(0, Math.min(menu.partyCursor, rows.party - 1));
  menu.boxCursor = Math.max(0, Math.min(menu.boxCursor, rows.box - 1));
  menu.boxScroll = clampScroll(menu.boxCursor, menu.boxScroll, BOX_ROWS, rows.box);
}

function updateBox(menu) {
  const state = game.state;
  const rows = boxRowCounts(state);
  const rowsHere = menu.side === "party" ? rows.party : rows.box;
  const cursorKey = menu.side === "party" ? "partyCursor" : "boxCursor";

  if (tapped("up")) {
    menu[cursorKey] = moveCursor(menu[cursorKey], -1, rowsHere);
    audio.playSound("blip");
  }
  if (tapped("down")) {
    menu[cursorKey] = moveCursor(menu[cursorKey], 1, rowsHere);
    audio.playSound("blip");
  }
  if (tapped("left") && menu.side === "box") {
    menu.side = "party";
    audio.playSound("blip");
  }
  if (tapped("right") && menu.side === "party") {
    menu.side = "box";
    audio.playSound("blip");
  }
  clampBoxCursors(menu);

  if (tapped("b")) {
    audio.playSound("back");
    // The first B puts the creature down. Only the second one leaves, so a
    // player carrying somebody cannot walk out of the screen by accident.
    if (menu.held) menu.held = null;
    else menu.view = "root";
    return;
  }
  if (!tapped("a")) return;

  const index = menu.side === "party" ? menu.partyCursor : menu.boxCursor;
  const list = menu.side === "party" ? state.party : state.box;

  if (!menu.held) {
    if (!list[index]) {
      audio.playSound("bump");
      return;
    }
    menu.held = { side: menu.side, index };
    audio.playSound("select");
    return;
  }
  placeHeldCreature(menu, menu.side, index);
}

/** Put the creature the player is carrying into the slot under the cursor. */
function placeHeldCreature(menu, side, index) {
  const state = game.state;
  const held = menu.held;
  const carried = held.side === "party" ? state.party[held.index] : state.box[held.index];
  if (!carried) {
    menu.held = null;
    return;
  }

  // Same column: swap the two, or do nothing at all on the empty end slot.
  if (held.side === side) {
    const list = side === "party" ? state.party : state.box;
    if (list[index]) {
      game.state =
        side === "party"
          ? reorderParty(state, held.index, index)
          : reorderBox(state, held.index, index);
    }
    menu.held = null;
    audio.playSound("select");
    clampBoxCursors(menu);
    return;
  }

  const partyIndex = side === "party" ? index : held.index;
  const boxIndex = side === "box" ? index : held.index;
  const target = side === "party" ? state.party[index] : state.box[index];

  let outcome;
  if (target) {
    const swap = swapWithBox(state, partyIndex, boxIndex);
    outcome = { state: swap.state, ok: swap.swapped, reason: swap.reason };
  } else if (side === "box") {
    const put = depositToBox(state, held.index);
    outcome = { state: put.state, ok: put.moved, reason: put.reason };
  } else {
    const out = withdrawFromBox(state, held.index);
    outcome = { state: out.state, ok: out.moved, reason: out.reason };
  }

  if (!outcome.ok) {
    // Keep hold of the creature so the player can try another slot.
    audio.playSound("bump");
    say(outcome.reason);
    return;
  }
  game.state = outcome.state;
  menu.held = null;
  audio.playSound("select");
  clampBoxCursors(menu);
}

/** One row of one column: a creature, or the empty slot at the end. */
function drawBoxRow(monster, x, y, { held, chosen }) {
  if (held) renderer.rect(x, y - 4, BOX_COL_W, BOX_ROW_H - 2, "#f7d98c");
  if (chosen) renderer.cursor(x + 2, y + 1);
  if (!monster) {
    renderer.text("- - -", x + 20, y, { color: UI.border });
    return;
  }
  renderer.creature(monster.species, x + 8, y - 4, { scale: 0.35 });
  renderer.text(displayName(monster), x + 24, y - 2);
  renderer.textRight(`L${monster.level}`, x + BOX_COL_W - 4, y - 2);
  // The numbers go on the left of the second line and the bar on the right of
  // it. A creature at 100/100 is the widest this ever gets, and it still clears
  // the bar.
  const full = maxHp(monster);
  renderer.text(`${monster.hp}/${full}`, x + 24, y + 6);
  renderer.rect(x + 68, y + 7, 38, 5, UI.ink);
  renderer.rect(x + 69, y + 8, 36, 3, UI.paperShade);
  renderer.rect(x + 69, y + 8, barWidth(monster.hp, full, 36), 3, healthColor(monster.hp, full));
}

/** Draw one column of the box screen, and make each row a tap target. */
function drawBoxColumn(menu, side, list, scroll, cursor, rowCount) {
  const x = BOX_COLUMNS[side];
  for (let row = 0; row < Math.min(BOX_ROWS, rowCount - scroll); row++) {
    const at = scroll + row;
    const y = BOX_TOP + row * BOX_ROW_H;
    drawBoxRow(list[at], x, y, {
      held: menu.held?.side === side && menu.held.index === at,
      chosen: menu.side === side && cursor === at,
    });
    hotChoose(x, y - 5, BOX_COL_W, BOX_ROW_H, () => {
      menu.side = side;
      if (side === "party") menu.partyCursor = at;
      else menu.boxCursor = at;
    });
  }
}

function drawBox() {
  const menu = game.menu;
  const state = game.state;
  const rows = boxRowCounts(state);
  renderer.box(4, 4, 232, 152);
  renderer.text("Box", 14, 10);
  renderer.textRight(`Team ${state.party.length}/${PARTY_LIMIT}`, 226, 10);
  renderer.text("TEAM", BOX_COLUMNS.party + 2, 22);
  renderer.text(`BOX ${state.box.length}`, BOX_COLUMNS.box + 2, 22);
  renderer.rect(120, 20, 1, 118, UI.border);

  drawBoxColumn(menu, "party", state.party, 0, menu.partyCursor, rows.party);
  drawBoxColumn(menu, "box", state.box, menu.boxScroll, menu.boxCursor, rows.box);

  const carried = menu.held
    ? menu.held.side === "party"
      ? state.party[menu.held.index]
      : state.box[menu.held.index]
    : null;
  // The hint stays short so it never runs into the back label on the right. The
  // widest it gets is "Holding Baobanto.", and the label owns everything past
  // x 176.
  renderer.text(carried ? `Holding ${displayName(carried)}.` : "A picks up and puts down", 14, 142);
  renderer.textRight("B: back", 226, 142);
  hot(176, 136, 60, 20, () => virtualPress("b"));
}

function openSaveMenu() {
  ask("Save your game?", ["Save", "Download a copy", "Load a file", "Cancel"], (choice) => {
    if (choice === 0) {
      const result = saveToStorage(localStorage, game.state);
      audio.playSound(result.ok ? "save" : "bump");
      say(result.ok ? "Your game was saved." : result.error);
    } else if (choice === 1) {
      downloadSave();
      say("The save file was downloaded. Keep it to carry on somewhere else.");
    } else if (choice === 2) {
      document.getElementById("load-file").click();
    }
  });
}

function downloadSave() {
  const blob = new Blob([serialise(game.state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(game.state);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  audio.playSound("save");
}

document.getElementById("load-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const result = parseSave(await file.text());
  if (!result.ok) {
    audio.playSound("bump");
    say(result.error);
    return;
  }
  game.state = result.state;
  game.rng = new Rng(game.state.rngState);
  game.menu = null;
  game.screen = "field";
  game.player.sprite = game.state.player.sprite === "girl" ? "playerGirl" : "playerBoy";
  enterMap(game.state.player.map, game.state.player.x, game.state.player.y, game.state.player.dir);
  audio.playSound("save");
  say("Saved game loaded. Welcome back.");
});

function openShop(stock) {
  game.shop = {
    stock: stock.map((id) => ITEMS[id]).filter(Boolean),
    index: 0,
    scroll: 0,
    quantity: 1,
    max: 1,
    mode: "list",
  };
  game.screen = "shop";
}

function updateShop() {
  const shop = game.shop;
  if (!shop) return;

  if (shop.mode === "list") {
    if (tapped("up")) {
      shop.index = moveCursor(shop.index, -1, shop.stock.length);
      audio.playSound("blip");
    }
    if (tapped("down")) {
      shop.index = moveCursor(shop.index, 1, shop.stock.length);
      audio.playSound("blip");
    }
    shop.scroll = clampScroll(shop.index, shop.scroll, 5, shop.stock.length);
    if (tapped("b")) {
      game.shop = null;
      game.screen = "field";
      audio.playSound("back");
      advanceScript();
      return;
    }
    if (!tapped("a")) return;
    const item = shop.stock[shop.index];
    const most = Math.min(
      99 - countOf(game.state.bag, item.id),
      affordable(game.state.player.money, item.price),
    );
    if (most <= 0) {
      audio.playSound("bump");
      say("You cannot afford that.");
      return;
    }
    shop.mode = "quantity";
    shop.quantity = 1;
    shop.max = most;
    audio.playSound("select");
    return;
  }

  if (tapped("up")) shop.quantity = stepQuantity(shop.quantity, 1, shop.max);
  if (tapped("down")) shop.quantity = stepQuantity(shop.quantity, -1, shop.max);
  if (tapped("b")) {
    shop.mode = "list";
    audio.playSound("back");
    return;
  }
  if (!tapped("a")) return;
  const item = shop.stock[shop.index];
  const cost = item.price * shop.quantity;
  game.state = {
    ...game.state,
    bag: addItem(game.state.bag, item.id, shop.quantity),
    player: { ...game.state.player, money: game.state.player.money - cost },
  };
  shop.mode = "list";
  audio.playSound("money");
  say(`${item.name} x${shop.quantity}. Thank you!`);
}

// ---------------------------------------------------------------------------
// Choosing a first creature
// ---------------------------------------------------------------------------

function openStarterChoice() {
  game.starter = { index: 0 };
  game.screen = "starter";
}

function updateStarter() {
  const starter = game.starter;
  if (tapped("left")) {
    starter.index = moveCursor(starter.index, -1, STARTER_CHOICE.length);
    audio.playSound("blip");
  }
  if (tapped("right")) {
    starter.index = moveCursor(starter.index, 1, STARTER_CHOICE.length);
    audio.playSound("blip");
  }
  if (!tapped("a")) return;
  const chosen = STARTER_CHOICE[starter.index];
  audio.playSound("select");
  audio.playCry(chosen.species, getSpecies(chosen.species).weight);
  ask(`Take ${getSpecies(chosen.species).name}?`, ["Yes", "Let me look again"], (choice) => {
    if (choice !== 0) return;
    const monster = createMonster({
      species: chosen.species,
      level: chosen.level,
      rng: game.rng,
      metAt: "profHut",
    });
    game.state = addMonster(game.state, monster).state;
    game.state = setFlag(game.state, "gotStarter");
    game.starter = null;
    game.screen = "field";
    refreshCharacterVisibility();
    say(`${getSpecies(chosen.species).name} is yours. Look after it.`, advanceScript);
  });
}

// ---------------------------------------------------------------------------
// Title and new game
// ---------------------------------------------------------------------------

const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");

function titleOptions() {
  const options = [];
  if (hasStoredSave(localStorage)) options.push({ id: "continue", label: "Continue" });
  options.push({ id: "new", label: "New game" });
  options.push({ id: "load", label: "Load a file" });
  return options;
}

function updateTitle() {
  const options = titleOptions();
  if (tapped("up")) {
    game.titleIndex = moveCursor(game.titleIndex, -1, options.length);
    audio.playSound("blip");
  }
  if (tapped("down")) {
    game.titleIndex = moveCursor(game.titleIndex, 1, options.length);
    audio.playSound("blip");
  }
  if (!tapped("a")) return;
  audio.playSound("select");
  const id = options[game.titleIndex].id;
  if (id === "continue") {
    const loaded = loadFromStorage(localStorage);
    if (!loaded) return;
    game.state = loaded;
    game.rng = new Rng(loaded.rngState);
    game.player.sprite = loaded.player.sprite === "girl" ? "playerGirl" : "playerBoy";
    game.screen = "field";
    enterMap(loaded.player.map, loaded.player.x, loaded.player.y, loaded.player.dir);
  } else if (id === "new") {
    openNameEntry();
  } else {
    document.getElementById("load-file").click();
  }
}

function openNameEntry() {
  game.screen = "nameEntry";
  nameForm.hidden = false;
  nameInput.value = "Guillem";
  nameInput.focus();
  nameInput.select();
}

nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const sprite = nameForm.querySelector("input[name='sprite']:checked")?.value ?? "boy";
  nameForm.hidden = true;
  game.state = createSave({ name: nameInput.value, sprite });
  game.rng = new Rng(game.state.rngState);
  game.player.sprite = sprite === "girl" ? "playerGirl" : "playerBoy";
  game.screen = "field";
  enterMap(game.state.player.map, game.state.player.x, game.state.player.y, game.state.player.dir);
  say(`Akwaaba, ${game.state.player.name}. Professor Abenaa has been asking for you all morning.`);
});

// ---------------------------------------------------------------------------
// Fades and saving
// ---------------------------------------------------------------------------

function startFade(midway) {
  game.fade = { frames: 0, total: 24, midway, fired: false };
}

function updateFade() {
  if (!game.fade) return;
  game.fade.frames += 1;
  if (!game.fade.fired && game.fade.frames >= game.fade.total / 2) {
    game.fade.fired = true;
    game.fade.midway();
  }
  if (game.fade.frames >= game.fade.total) game.fade = null;
}

function fadeAlpha() {
  if (!game.fade) return 0;
  const half = game.fade.total / 2;
  return game.fade.frames < half ? game.fade.frames / half : 1 - (game.fade.frames - half) / half;
}

function autosave() {
  if (!game.state) return;
  game.state.rngState = game.rng.state;
  saveToStorage(localStorage, game.state);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function draw() {
  hotspots = [];
  const shake = renderer.shakeOffset();
  renderer.ctx.save();
  renderer.ctx.translate(shake.x, shake.y);

  if (game.screen === "title" || game.screen === "nameEntry") drawTitle();
  else if (game.screen === "battle") drawBattle();
  else if (game.screen === "starter") drawStarter();
  else if (game.screen === "shop") drawShop();
  else {
    drawField();
    if (game.screen === "menu") drawMenu();
  }

  if (game.msg) {
    const { page } = messagePage(game.msg.pages, game.msg.index);
    renderer.message(page, { arrow: true, blink: game.frames % 40 < 26, width: game.msg.width });
    // Tapping the box turns the page, which is what everyone tries first.
    hot(BOX.x, BOX.y, game.msg.width, BOX.h, () => virtualPress("a"));
  }
  if (game.choice) {
    const y = Math.max(6, BOX.y - game.choice.options.length * 12 - 14);
    renderer.choiceBox(game.choice.options, game.choice.index, { y });
    game.choice.options.forEach((label, index) => {
      hotChoose(150, y + 5 + index * 12, 86, 12, () => {
        game.choice.index = index;
      });
    });
  }

  renderer.ctx.restore();
  const alpha = fadeAlpha();
  if (alpha > 0) renderer.veil(alpha);
}

function drawTitle() {
  renderer.clear("#20140a");
  for (let y = 0; y < SCREEN_H; y++) {
    renderer.rect(0, y, SCREEN_W, 1, y / SCREEN_H < 0.6 ? "#e08a3c" : "#8a4a24");
  }
  renderer.ctx.fillStyle = "#f7d98c";
  renderer.ctx.beginPath();
  renderer.ctx.arc(120, 74, 34, 0, Math.PI * 2);
  renderer.ctx.fill();

  renderer.creature("hinoko", 12, 58, { scale: 1.4 });
  renderer.creature("polete", 186, 74, { scale: 1.1, flip: true });

  renderer.textBigCentred("AKWAABA", 120, 16, 3, { color: "#f4ead2", shadow: "#20140a" });
  renderer.textBigCentred("MONSTERS", 120, 40, 2, { color: "#f7d98c", shadow: "#20140a" });

  if (game.screen === "nameEntry") {
    renderer.message("Type your name in the box below the screen.");
    return;
  }
  const options = titleOptions();
  const boxH = options.length * 12 + 10;
  const boxW = 96;
  const boxX = Math.round((SCREEN_W - boxW) / 2);
  renderer.box(boxX, SCREEN_H - boxH - 6, boxW, boxH);
  options.forEach((option, index) => {
    const y = SCREEN_H - boxH + 2 + index * 12;
    renderer.text(option.label, boxX + 18, y);
    if (index === game.titleIndex) renderer.cursor(boxX + 9, y + 1);
    hotChoose(boxX, y - 3, boxW, 12, () => {
      game.titleIndex = index;
    });
  });
}

function drawField() {
  if (!game.map) {
    renderer.clear("#20140a");
    return;
  }
  renderer.drawMap(game.map, game.camera, game.characters, game.player);

  if (game.screen === "field" && !overlayBusy()) {
    // A visible way into the menu for anyone playing with a finger or a mouse.
    renderer.box(SCREEN_W - 22, 4, 18, 16, { fill: UI.paper });
    for (let bar = 0; bar < 3; bar++) renderer.rect(SCREEN_W - 17, 8 + bar * 4, 8, 2, UI.ink);
    hot(SCREEN_W - 24, 2, 22, 20, () => virtualPress("b"));
  }

  for (const npc of game.characters) {
    if (!npc.alert) continue;
    npc.alert -= 1;
    const x = npc.px - game.camera.x + 5;
    const y = npc.py - game.camera.y - PERSON_LIFT - 10;
    renderer.box(x - 3, y - 2, 12, 14, { fill: UI.paper });
    renderer.text("!", x + 1, y + 2, { color: "#c0392b" });
  }
}

function drawMenu() {
  const menu = game.menu;
  if (!menu) return;

  if (menu.view === "root") {
    const h = menu.items.length * 12 + 10;
    hot(0, 0, SCREEN_W, SCREEN_H, () => virtualPress("b"));
    renderer.box(SCREEN_W - 86, 4, 82, h);
    menu.items.forEach((item, index) => {
      renderer.text(item.label, SCREEN_W - 68, 12 + index * 12);
      if (index === menu.index) renderer.cursor(SCREEN_W - 77, 13 + index * 12);
      hotChoose(SCREEN_W - 86, 9 + index * 12, 82, 12, () => {
        menu.index = index;
      });
    });
    return;
  }

  if (menu.view === "party" || menu.view === "useOn") {
    renderer.box(4, 4, 232, 152);
    renderer.text(
      menu.view === "useOn" ? `Use ${menu.pendingItem.name} on which?` : "Your creatures",
      14,
      12,
    );
    game.state.party.forEach((monster, index) => {
      const y = 26 + index * 21;
      const species = getSpecies(monster.species);
      const share = monster.hp / maxHp(monster);
      renderer.creature(monster.species, 14, y - 4, { scale: 0.45 });
      renderer.text(displayName(monster), 38, y);
      renderer.text(`L${monster.level}`, 132, y);
      renderer.rect(160, y + 1, 62, 5, UI.ink);
      renderer.rect(161, y + 2, 60, 3, "#d8c9a6");
      renderer.rect(
        161,
        y + 2,
        Math.round(share * 60),
        3,
        share > 0.5 ? "#4fbf46" : share > 0.2 ? "#e3b23a" : "#c0392b",
      );
      renderer.text(`${monster.hp}/${maxHp(monster)}`, 38, y + 8);
      renderer.text(species.types.map((type) => TYPE_NAMES[type]).join(" "), 92, y + 8);
      if (index === menu.cursor) renderer.cursor(6, y + 1);
      hotChoose(6, y - 6, 224, 20, () => {
        menu.cursor = index;
      });
    });
    renderer.text("B or tap here to go back", 14, 146);
    hot(4, 140, 120, 16, () => virtualPress("b"));
    return;
  }

  if (menu.view === "summary") {
    const monster = game.state.party[menu.cursor];
    if (!monster) return;
    const species = getSpecies(monster.species);
    const stats = statsOf(monster);
    renderer.box(4, 4, 232, 152);
    renderer.creature(monster.species, 12, 14);
    renderer.text(displayName(monster), 60, 14);
    renderer.text(`Level ${monster.level}`, 60, 26);
    species.types.forEach((type, index) => {
      renderer.rect(60 + index * 44, 36, 40, 9, TYPE_COLORS[type]);
      renderer.textCentred(TYPE_NAMES[type], 80 + index * 44, 37, { color: "#ffffff" });
    });
    renderer.text(`HP  ${monster.hp}/${stats.hp}`, 60, 50);
    renderer.text(`Atk ${stats.attack}   Def ${stats.defense}`, 60, 60);
    renderer.text(`SpA ${stats.spAttack}   SpD ${stats.spDefense}`, 60, 70);
    renderer.text(`Spe ${stats.speed}`, 60, 80);
    renderer.text("EXP", 14, 62);
    renderer.rect(12, 74, 40, 4, UI.ink);
    renderer.rect(13, 75, 38, 2, "#d8c9a6");
    renderer.rect(13, 75, Math.round(38 * levelProgress(monster)), 2, "#8fd0ff");
    monster.moves.forEach((slot, index) => {
      const move = getMove(slot.id);
      const y = 96 + index * 13;
      renderer.rect(12, y, 34, 9, TYPE_COLORS[move.type]);
      renderer.textCentred(TYPE_NAMES[move.type], 29, y + 1, { color: "#ffffff" });
      renderer.text(move.name, 52, y + 1);
      renderer.text(`${slot.pp}/${move.pp}`, 150, y + 1);
      renderer.text(move.power ? `${move.power}` : "-", 194, y + 1);
    });
    renderer.text("B or tap to go back", 118, 146);
    hot(0, 0, SCREEN_W, SCREEN_H, () => virtualPress("b"));
    return;
  }

  if (menu.view === "box") {
    drawBox();
    return;
  }

  if (menu.view === "bag") {
    const entries = bagList(game.state.bag);
    renderer.box(4, 4, 232, 152);
    renderer.text("Bag", 14, 12);
    renderer.textRight(formatMoney(game.state.player.money), 226, 12);
    if (entries.length === 0) renderer.text("The bag is empty.", 20, 34);
    entries.slice(menu.scroll, menu.scroll + 6).forEach((entry, index) => {
      const y = 30 + index * 16;
      const at = menu.scroll + index;
      renderer.text(entry.item.name, 20, y);
      renderer.text(`x${entry.count}`, 190, y);
      if (at === menu.cursor) {
        renderer.cursor(12, y + 1);
        drawPanel(PANELS.bag, entry.item.desc);
      }
      hotChoose(12, y - 4, 210, 15, () => {
        menu.cursor = at;
      });
    });
    hot(4, 140, 110, 16, () => virtualPress("b"));
    return;
  }

  if (menu.view === "player") {
    renderer.box(4, 4, 232, 152);
    renderer.text(game.state.player.name, 16, 16);
    renderer.text(`Money  ${formatMoney(game.state.player.money)}`, 16, 34);
    renderer.text(`Badges ${game.state.player.badges.length}`, 16, 46);
    renderer.text(`Seen   ${game.state.seen.length} of ${Object.keys(SPECIES).length}`, 16, 58);
    renderer.text(`Caught ${game.state.caught.length}`, 16, 70);
    renderer.text(`Steps  ${game.state.player.steps}`, 16, 82);
    renderer.text(`Time   ${formatPlayTime(game.state.player.playTime)}`, 16, 94);
    game.state.player.badges.forEach((badgeId, index) => {
      renderer.text(getBadge(badgeId)?.name ?? badgeId, 16, 112 + index * 12);
    });
    renderer.text("B or tap to go back", 118, 146);
    hot(0, 0, SCREEN_W, SCREEN_H, () => virtualPress("b"));
    return;
  }

  if (menu.view === "options") {
    renderer.box(4, 4, 232, 152);
    renderer.text("Options", 16, 16);
    renderer.text(`Sound: ${audio.muted ? "off" : "on"}  (A to change)`, 16, 40);
    hot(12, 34, 200, 14, () => virtualPress("a"));
    renderer.text("Arrow keys or WASD to walk", 16, 62);
    renderer.text("Z or Enter to talk and confirm", 16, 74);
    renderer.text("X or Escape for the menu", 16, 86);
    renderer.text("Drag the map to walk, tap to talk", 16, 98);
    renderer.text("M mutes the sound", 16, 110);
    renderer.text("B or tap here to go back", 16, 146);
    hot(0, 138, SCREEN_W, 22, () => virtualPress("b"));
  }
}

function drawStarter() {
  renderer.clear("#c9b08a");
  renderer.rect(0, 96, SCREEN_W, SCREEN_H - 96, "#a37d4c");
  renderer.textCentred("Choose one.", 120, 10);
  STARTER_CHOICE.forEach((entry, index) => {
    const x = 20 + index * 68;
    const chosen = index === game.starter.index;
    renderer.box(x, 24, 60, 62, { fill: chosen ? "#f7d98c" : UI.paper });
    renderer.creature(entry.species, x + 10, 30);
    renderer.textCentred(getSpecies(entry.species).name, x + 30, 74);
    hotChoose(x, 24, 60, 62, () => {
      game.starter.index = index;
    });
  });
  const entry = STARTER_CHOICE[game.starter.index];
  const species = getSpecies(entry.species);
  renderer.box(4, 92, 232, 46);
  renderer.rect(12, 100, 40, 9, TYPE_COLORS[species.types[0]]);
  renderer.textCentred(TYPE_NAMES[species.types[0]], 32, 101, { color: "#ffffff" });
  drawPanel(PANELS.starter, entry.blurb);
  renderer.textCentred("Left and right to look, Z to take", 120, 148);
}

function drawShop() {
  drawField();
  const shop = game.shop;
  const item = shop.stock[shop.index];
  renderer.box(4, 4, 150, 96);
  renderer.textRight(formatMoney(game.state.player.money), 226, 12);
  shop.stock.slice(shop.scroll, shop.scroll + 5).forEach((entry, index) => {
    const y = 14 + index * 16;
    const at = shop.scroll + index;
    renderer.text(entry.name, 22, y);
    renderer.textRight(String(entry.price), 146, y);
    if (at === shop.index) renderer.cursor(13, y + 1);
    hotChoose(10, y - 3, 140, 15, () => {
      shop.index = at;
    });
  });
  renderer.box(4, 100, 232, 56);
  // The description takes the rows above the key hint, which sits on the last
  // row of the box. `PANELS.shop` and this hint have to move together.
  drawPanel(PANELS.shop, item.desc);
  if (shop.mode === "quantity") {
    renderer.box(154, 4, 82, 44);
    renderer.text(`x ${shop.quantity}`, 168, 14);
    renderer.text(formatMoney(item.price * shop.quantity), 164, 30);
    renderer.text("Up and down, Z to buy, X to stop", 12, 140);
    hot(154, 4, 82, 22, () => virtualPress("up"));
    hot(154, 26, 82, 22, () => virtualPress("down"));
  } else {
    renderer.text("Z to choose, X or tap here to leave", 12, 140);
    hot(4, 136, 232, 20, () => virtualPress("b"));
  }
}

function drawBattle() {
  const battle = game.battle;
  const view = game.battleView;
  if (!battle || !view) return;
  renderer.battleBackdrop(battle.kind);

  const foe = activeMonster(battle, "foe");
  const mine = activeMonster(battle, "player");
  const foeShake = view.flash > 0 && view.flash % 4 < 2 ? 2 : 0;

  if (view.throwFrames > 0) {
    // The calabash arcs across the screen and shakes where the creature was.
    const share = Math.min(1, (1 - view.throwFrames / 30) * 2);
    const x = 60 + (118 - 60) * share;
    const y = 100 - Math.sin(share * Math.PI) * 46;
    renderer.ctx.fillStyle = "#c9a06a";
    renderer.ctx.beginPath();
    renderer.ctx.arc(x, y, 5, 0, Math.PI * 2);
    renderer.ctx.fill();
    if (share < 0.5) {
      renderer.creatureShadow(158 + foeShake, 18);
      renderer.creature(foe.species, 158 + foeShake, 18);
    }
  } else {
    renderer.creatureShadow(158 + foeShake, 18);
    renderer.creature(foe.species, 158 + foeShake, 18);
  }
  renderer.creatureShadow(30, 54, 1.2);
  renderer.creature(mine.species, 30, 54, { scale: 1.2, flip: true });

  renderer.statusPanel({
    x: 8,
    y: 8,
    name: displayName(foe),
    level: foe.level,
    hp: Math.max(0, Math.round(view.showHp.foe ?? foe.hp)),
    maxHp: maxHp(foe),
    status: foe.status,
  });
  renderer.statusPanel({
    x: 132,
    y: 62,
    name: displayName(mine),
    level: mine.level,
    hp: Math.max(0, Math.round(view.showHp.player ?? mine.hp)),
    maxHp: maxHp(mine),
    status: mine.status,
    showExp: true,
    expShare: levelProgress(mine),
  });

  if (battle.kind === "trainer") renderer.text(battle.trainer.name, 10, 50);

  if (view.phase === "menu") {
    renderer.message(`What will\n${displayName(mine)} do?`, { width: PROMPT_W });
    renderer.actionMenu(BATTLE_ACTIONS, view.cursor);
    BATTLE_ACTIONS.forEach((label, index) => {
      const x = 132 + (index % 2) * 54;
      const y = BOX.y + 6 + Math.floor(index / 2) * 16;
      hotChoose(x, y, 52, 15, () => {
        view.cursor = index;
      });
    });
    return;
  }
  if (view.phase === "move") {
    const moves = usableMoves(battle);
    renderer.moveMenu(moves, view.moveCursor);
    moves.forEach((entry, index) => {
      const x = 4 + (index % 2) * 78;
      const y = BOX.y + 5 + Math.floor(index / 2) * 16;
      hotChoose(x, y, 78, 15, () => {
        view.moveCursor = index;
      });
    });
    hot(168, BOX.y + 30, 72, 16, () => virtualPress("b"));
    return;
  }
  if (view.phase === "bag") {
    const entries = battleBagEntries();
    renderer.box(BOX.x, BOX.y, BOX.w, BOX.h);
    if (entries.length === 0) {
      renderer.text("The bag is empty. Press X or tap.", BOX.textX, BOX.textY);
      hot(BOX.x, BOX.y, BOX.w, BOX.h, () => virtualPress("b"));
    }
    entries.slice(view.scroll, view.scroll + 3).forEach((entry, index) => {
      const y = BOX.y + 8 + index * 12;
      const at = view.scroll + index;
      renderer.text(`${entry.item.name}  x${entry.count}`, BOX.textX + 8, y);
      if (at === view.listCursor) renderer.cursor(BOX.textX, y + 1);
      hotChoose(BOX.x + 4, y - 3, 180, 12, () => {
        view.listCursor = at;
      });
    });
    hot(BOX.x + 190, BOX.y + 4, 38, BOX.h - 8, () => virtualPress("b"));
    return;
  }
  if (view.phase === "party" || view.phase === "switchForced") {
    renderer.box(BOX.x, BOX.y, BOX.w, BOX.h);
    battle.player.party.slice(0, 3).forEach((monster, index) => {
      const y = BOX.y + 8 + index * 12;
      renderer.text(
        `${displayName(monster)} L${monster.level}  ${monster.hp}/${maxHp(monster)}`,
        BOX.textX + 8,
        y,
        { color: isFainted(monster) ? "#9a8d78" : UI.ink },
      );
      if (index === view.listCursor) renderer.cursor(BOX.textX, y + 1);
      hotChoose(BOX.x + 4, y - 3, 180, 12, () => {
        view.listCursor = index;
      });
    });
    if (view.phase === "party") hot(BOX.x + 190, BOX.y + 4, 38, BOX.h - 8, () => virtualPress("b"));
    return;
  }
  renderer.message(view.text, { arrow: view.timer > 0, blink: game.frames % 40 < 26 });
  hot(BOX.x, BOX.y, BOX.w, BOX.h, () => virtualPress("a"));
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

function update() {
  game.frames += 1;
  if (tapped("mute")) {
    audio.toggleMuted();
    audio.playSound("select");
  }
  updateFade();
  updateNpcWalk();

  if (game.wait > 0) {
    game.wait -= 1;
    if (game.wait === 0 && game.afterWait) {
      const after = game.afterWait;
      game.afterWait = null;
      after();
    }
    return;
  }
  if (game.msg) {
    updateMessage();
    return;
  }
  if (game.choice) {
    updateChoice();
    return;
  }
  if (game.npcWalk) return;

  switch (game.screen) {
    case "title":
      updateTitle();
      break;
    case "nameEntry":
      break;
    case "field":
      if (game.state) {
        game.state.player.playTime += 1 / 60;
        updateWanderers();
        updateField();
      }
      break;
    case "menu":
      updateMenu();
      break;
    case "battle":
      updateBattle();
      break;
    case "starter":
      updateStarter();
      break;
    case "shop":
      updateShop();
      break;
    default:
      break;
  }
}

let lastFrame = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (now - lastFrame < 15) return;
  lastFrame = now;
  update();
  pressedThisFrame.clear();
  draw();
}

// ---------------------------------------------------------------------------
// Fitting the screen to the window
//
// `layoutMode` in `ui.js` picks one of three layouts and `style.css` draws it.
// The work left here is to measure how much room that layout leaves and to set
// the canvas to fill it.
// ---------------------------------------------------------------------------

const gameRoot = document.querySelector("main.game");
const padElement = document.querySelector(".pad");
const fullscreenButton = document.getElementById("fullscreen");

/**
 * True while the player has asked for the big screen.
 *
 * This is not the same as the browser being in fullscreen. Safari on an iPhone
 * gives fullscreen to a video and to nothing else, so the request fails there.
 * The overlay layout covers the window on its own, so the game still fills the
 * phone; only the browser's own bars stay. Holding the wish separately from the
 * browser's answer is what lets both cases share one layout.
 */
let immersive = false;

/** Room the page layout takes above and beside the screen. */
const PAGE_MARGIN_X = 16;
const PAGE_MARGIN_Y = 260;

/**
 * The two 10px gaps the theater column puts between its three parts.
 * `style.css` sets them, and nothing else here can measure them.
 */
const THEATER_GAPS = 20;

function resize() {
  const mode = layoutMode({
    fullscreen: immersive,
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  });
  // Set the layout before measuring anything. The layout decides how tall the
  // pad is and where it sits, and the next three lines read those back.
  document.body.dataset.layout = mode;
  fullscreenButton.setAttribute("aria-pressed", String(immersive));

  // `clientWidth` of the document, not `innerWidth`: it leaves out a scrollbar,
  // and it cannot be widened by a canvas that the last call sized too big.
  const viewportW = document.documentElement.clientWidth;
  let availableW = viewportW - PAGE_MARGIN_X;
  let availableH = window.innerHeight - PAGE_MARGIN_Y;
  if (mode === "theater") {
    const reserved =
      padElement.offsetHeight + fullscreenButton.offsetHeight + THEATER_GAPS + bottomPadding();
    availableW = viewportW;
    availableH = window.innerHeight - reserved;
  } else if (mode === "overlay") {
    // The pad floats on top, so it takes nothing away.
    availableW = viewportW;
    availableH = window.innerHeight;
  }

  const scale = pixelScale(availableW, availableH, SCREEN_W, SCREEN_H, {
    // Fullscreen means as big as it goes, so the ceiling lifts.
    max: mode === "overlay" ? 12 : 6,
    pixelRatio: window.devicePixelRatio || 1,
  });
  canvas.style.width = `${SCREEN_W * scale}px`;
  canvas.style.height = `${SCREEN_H * scale}px`;
}

/**
 * The space kept under the pad, which no `offsetHeight` counts.
 * On a phone this holds the strip the system keeps for its own home bar.
 */
function bottomPadding() {
  return Number.parseFloat(getComputedStyle(gameRoot).paddingBottom) || 0;
}

/**
 * Ask for the big screen, or give it back.
 *
 * The browser's fullscreen is tried first and its failure is ignored on purpose:
 * the overlay layout alone already covers the window, so a browser that refuses
 * costs the player nothing but the browser's own bars.
 */
function setImmersive(wanted) {
  immersive = wanted;
  const request = gameRoot.requestFullscreen ?? gameRoot.webkitRequestFullscreen;
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
  try {
    if (wanted) {
      request?.call(gameRoot)?.catch(() => {});
    } else if (document.fullscreenElement || document.webkitFullscreenElement) {
      exit?.call(document)?.catch(() => {});
    }
  } catch {
    // An older browser throws here instead of refusing quietly. Same answer.
  }
  resize();
}

fullscreenButton.addEventListener("click", () => {
  audio.unlock();
  setImmersive(!immersive);
});

// Escape and the phone's own back gesture leave fullscreen without telling the
// button. This puts the page back in step when that happens.
for (const event of ["fullscreenchange", "webkitfullscreenchange"]) {
  document.addEventListener(event, () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) immersive = false;
    resize();
  });
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
// A phone's address bar slides away as the page scrolls. That changes how much
// room there is without firing `resize` on some browsers.
window.visualViewport?.addEventListener("resize", resize);
resize();

// The "deployed at" line in the footer, read out of this page's own head.
// The words live in `deployText.js` so the tests can read them too.
renderDeployLine(
  document.getElementById("deploy-line"),
  readStamp(document),
  "en",
  deploySay,
  escapeHtml,
  "web-projects/akwaaba-monsters",
);

requestAnimationFrame(loop);
