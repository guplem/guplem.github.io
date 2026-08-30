// Everything that puts pixels on the screen.
//
// The game draws to one 240 by 160 canvas, which is the size of a Game Boy
// Advance screen, and then blows that up by a whole number to fill the window.
// Whole numbers only: at 3.5 times, every pixel is a different size and the
// whole thing turns to mush.
//
// This file touches the browser, so it holds no rules and no decisions. It is
// handed a map, a battle or a menu and it draws exactly that. The deciding
// happens in `app.js`, and the arithmetic in `ui.js`.

import { CHAR_H, CHAR_W, LEADING, TRACKING, glyphFor } from "./art/font.js";
import { CREATURE_ART_IDS, creatureDrawing, SPRITE_SIZE } from "./art/creatures.js";
import { TILE_ART_IDS, TILE_SIZE, tileDrawing } from "./art/tiles.js";
import { PEOPLE_IDS, PERSON_H, PERSON_LIFT, PERSON_W, personDrawing } from "./art/people.js";
import { pixelsToCanvas, rasterise } from "./art/pixelArt.js";
import { TYPE_COLORS, TYPE_NAMES } from "./types.js";
import { barWidth, healthColor } from "./ui.js";

/** The size of the screen the game draws, before it is scaled up. */
export const SCREEN_W = 240;
export const SCREEN_H = 160;
export const TILE = TILE_SIZE;

/** The palette the interface is built from. */
export const UI = {
  ink: "#20140a",
  paper: "#f4ead2",
  paperShade: "#d8c9a6",
  border: "#7a5a2e",
  highlight: "#e0622b",
  sky: "#8fc4de",
  skyLow: "#cfe6ef",
  ground: "#c9a06a",
  shadow: "rgba(32, 20, 10, 0.25)",
};

/** Where the message box sits, and how much room the words have inside it. */
export const BOX = { x: 4, y: 110, w: 232, h: 46, textX: 12, textY: 121, textW: 216 };

/**
 * Draw every picture in the game once, into offscreen canvases.
 *
 * Rasterising a shape list is cheap but not free, and the map draws 150 tiles a
 * frame. Doing it once at start-up costs a few milliseconds and makes every
 * frame afterwards a straight copy.
 */
export function buildAtlas(documentRef = globalThis.document) {
  const tiles = {};
  for (const id of TILE_ART_IDS) {
    tiles[id] = pixelsToCanvas(rasterise(tileDrawing(id)), 1, documentRef);
  }
  const creatures = {};
  for (const id of CREATURE_ART_IDS) {
    creatures[id] = pixelsToCanvas(rasterise(creatureDrawing(id)), 1, documentRef);
  }
  const people = {};
  for (const id of PEOPLE_IDS) {
    people[id] = {};
    for (const dir of ["down", "up", "left", "right"]) {
      people[id][dir] = [0, 1].map((frame) =>
        pixelsToCanvas(rasterise(personDrawing(id, dir, frame)), 1, documentRef),
      );
    }
  }
  return { tiles, creatures, people };
}

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas the visible canvas
   */
  constructor(canvas, documentRef = globalThis.document) {
    this.canvas = canvas;
    this.document = documentRef;
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.atlas = buildAtlas(documentRef);
    this.shakeUntil = 0;
    this.shakeFrames = 0;
  }

  /** Fill the whole screen with one colour. */
  clear(color = "#000000") {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  /** Shake the screen for a while. Used when the mine pumps come out. */
  shake(frames) {
    this.shakeFrames = frames;
  }

  /** How far the screen is offset by the shake this frame. */
  shakeOffset() {
    if (this.shakeFrames <= 0) return { x: 0, y: 0 };
    this.shakeFrames -= 1;
    const strength = Math.min(3, Math.ceil(this.shakeFrames / 8));
    return {
      x: (this.shakeFrames % 2 === 0 ? 1 : -1) * strength,
      y: (this.shakeFrames % 4 < 2 ? 1 : -1) * Math.ceil(strength / 2),
    };
  }

  // --- Words --------------------------------------------------------------

  /**
   * Draw one line of text.
   * Every letter gets a soft drop shadow, which is what keeps small white text
   * readable over a bright map.
   */
  text(line, x, y, { color = UI.ink, shadow = null } = {}) {
    if (shadow) this.#stamp(line, x + 1, y + 1, 1, shadow);
    this.#stamp(line, x, y, 1, color);
    return measureAt(line, 1);
  }

  /**
   * Paint one string, one pixel block per set bit.
   *
   * The shadow is a whole separate pass over the string. Drawing it a row at a
   * time looked right at one pixel per bit and filled the inside of every
   * letter once the game scaled the title up.
   */
  #stamp(line, x, y, scale, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    let cursor = x;
    for (const character of String(line ?? "")) {
      const rows = glyphFor(character);
      for (let row = 0; row < CHAR_H; row++) {
        for (let column = 0; column < CHAR_W; column++) {
          if (rows[row][column] !== "#") continue;
          ctx.fillRect(cursor + column * scale, y + row * scale, scale, scale);
        }
      }
      cursor += (CHAR_W + TRACKING) * scale;
    }
  }

  /**
   * The same letters, drawn several pixels wide each.
   * Used for the title and for the word BOSUA GYM over a door.
   */
  textBig(line, x, y, scale = 2, { color = UI.ink, shadow = null } = {}) {
    // The shadow moves by two screen pixels, not by one scaled block. At three
    // pixels per bit a scaled shadow lands inside the letter and fills it in.
    if (shadow) this.#stamp(line, x + 2, y + 2, scale, shadow);
    this.#stamp(line, x, y, scale, color);
    return measureAt(line, scale);
  }

  /** The same, centred on a point. */
  textBigCentred(line, centreX, y, scale = 2, options) {
    this.textBig(line, Math.round(centreX - measureAt(line, scale) / 2), y, scale, options);
  }

  /** Draw several lines, one under another. */
  lines(list, x, y, options) {
    list.forEach((line, index) => this.text(line, x, y + index * (CHAR_H + LEADING), options));
  }

  /** Draw a line of text with its middle at `centreX`. */
  textCentred(line, centreX, y, options) {
    this.text(line, Math.round(centreX - measureAt(line, 1) / 2), y, options);
  }

  /** Draw a line of text ending at `rightX`. */
  textRight(line, rightX, y, options) {
    this.text(line, Math.round(rightX - measureAt(line, 1)), y, options);
  }

  // --- Boxes --------------------------------------------------------------

  /** The window every menu and every message sits in. */
  box(x, y, w, h, { fill = UI.paper, border = UI.border, ink = UI.ink } = {}) {
    const ctx = this.ctx;
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = border;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    // Two corner marks, so the border reads as carved rather than as a stroke.
    ctx.fillStyle = border;
    ctx.fillRect(x + 3, y + 3, 2, 2);
    ctx.fillRect(x + w - 5, y + h - 5, 2, 2);
  }

  /** A plain filled rectangle. */
  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  /** The little triangle that means "press A for the next page". */
  pageArrow(x, y, blink) {
    if (!blink) return;
    this.ctx.fillStyle = UI.highlight;
    for (let row = 0; row < 3; row++) this.ctx.fillRect(x + row, y + row, 7 - row * 2, 1);
  }

  /** The cursor that marks the highlighted entry in a menu. */
  cursor(x, y) {
    this.ctx.fillStyle = UI.highlight;
    for (let row = 0; row < 5; row++) {
      this.ctx.fillRect(x, y + row, Math.min(row + 1, 5 - row) + 1, 1);
    }
  }

  // --- Pictures -----------------------------------------------------------

  /** Copy one of the pictures from the atlas onto the screen. */
  sprite(image, x, y, { flip = false, scale = 1, alpha = 1 } = {}) {
    if (!image) return;
    const ctx = this.ctx;
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.translate(Math.round(x) + w, Math.round(y));
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, 0, w, h);
    } else {
      ctx.drawImage(image, Math.round(x), Math.round(y), w, h);
    }
    ctx.restore();
  }

  /** A creature, at its battle size. */
  creature(speciesId, x, y, options) {
    this.sprite(this.atlas.creatures[speciesId], x, y, options);
  }

  /** A person, facing a direction, on one frame of their walk. */
  person(spriteId, dir, frame, x, y, options) {
    const set = this.atlas.people[spriteId];
    if (!set) return;
    const list = set[dir] ?? set.down;
    this.sprite(list[frame % list.length], x, y, options);
  }

  // --- The map ------------------------------------------------------------

  /**
   * Draw a map, the people on it and the player.
   *
   * @param {object} map
   * @param {{x:number,y:number}} camera in pixels
   * @param {object[]} characters everyone on the map, with pixel positions
   * @param {object} player the player, with a pixel position
   */
  drawMap(map, camera, characters, player) {
    const ctx = this.ctx;
    const left = Math.floor(camera.x / TILE) - 1;
    const top = Math.floor(camera.y / TILE) - 1;
    const across = Math.ceil(SCREEN_W / TILE) + 2;
    const down = Math.ceil(SCREEN_H / TILE) + 2;

    this.clear("#101820");

    const drawLayer = (layer, allowBlank) => {
      for (let row = top; row < top + down; row++) {
        for (let column = left; column < left + across; column++) {
          const line = layer?.[row];
          const character = line?.[column];
          if (character === undefined) continue;
          if (character === " ") {
            if (!allowBlank) continue;
            continue;
          }
          const tileId = map.legend[character];
          const image = this.atlas.tiles[tileId];
          if (!image) continue;
          ctx.drawImage(image, column * TILE - camera.x, row * TILE - camera.y);
        }
      }
    };

    drawLayer(map.ground, true);
    drawLayer(map.over, false);

    // Everyone, back to front, so somebody lower on the screen stands in front.
    const everyone = [...characters.filter((entry) => !entry.hidden), player].sort(
      (a, b) => a.py - b.py,
    );
    for (const entry of everyone) {
      const x = entry.px - camera.x;
      const y = entry.py - camera.y - PERSON_LIFT;
      ctx.fillStyle = UI.shadow;
      ctx.beginPath();
      ctx.ellipse(x + PERSON_W / 2, y + PERSON_H - 1, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      this.person(entry.sprite, entry.dir ?? "down", entry.frame ?? 0, x, y);
    }

    drawLayer(map.top, false);
  }

  /** A dark wash over the whole screen, for a fade or for a cave. */
  veil(alpha, color = "#000000") {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.restore();
  }

  // --- Battle -------------------------------------------------------------

  /** The sky, the sun and the two patches of ground the creatures stand on. */
  battleBackdrop(kind = "wild") {
    const ctx = this.ctx;
    for (let y = 0; y < 96; y++) {
      const share = y / 96;
      ctx.fillStyle = mix(UI.sky, UI.skyLow, share);
      ctx.fillRect(0, y, SCREEN_W, 1);
    }
    ctx.fillStyle = kind === "trainer" ? "#d8a86a" : "#cfa86e";
    ctx.fillRect(0, 96, SCREEN_W, SCREEN_H - 96);
    ctx.fillStyle = "#e8c98a";
    ctx.beginPath();
    ctx.ellipse(178, 58, 46, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b98d57";
    ctx.beginPath();
    ctx.ellipse(58, 104, 54, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // A low sun and a couple of flat-topped trees on the horizon.
    ctx.fillStyle = "#f7d98c";
    ctx.beginPath();
    ctx.arc(32, 26, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5f8a4a";
    for (const x of [96, 128, 210]) {
      ctx.fillRect(x, 78, 3, 14);
      ctx.beginPath();
      ctx.ellipse(x + 1, 76, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * The panel over a creature: its name, its level and its health.
   * The player's own panel also carries the experience bar.
   */
  statusPanel({ x, y, name, level, hp, maxHp, status, showExp = false, expShare = 0 }) {
    const w = 100;
    // One height for both sides. The bottom row holds the condition badge on
    // the left and the experience bar on the right, and the badge shortens the
    // bar rather than sitting on top of it.
    const h = 36;
    this.box(x, y, w, h);
    this.text(name, x + 7, y + 7);
    this.textRight(`L${level}`, x + w - 7, y + 7);

    const barX = x + 7;
    const barY = y + 18;
    const barW = w - 14;
    this.rect(barX - 1, barY - 1, barW + 2, 5, UI.ink);
    this.rect(barX, barY, barW, 3, UI.paperShade);
    this.rect(barX, barY, barWidth(hp, maxHp, barW), 3, healthColor(hp, maxHp));

    const bottomY = y + 26;
    if (status) {
      this.rect(x + 7, bottomY - 1, 22, 8, statusColor(status));
      this.text(statusShort(status), x + 9, bottomY, { color: UI.paper });
    }
    if (showExp) {
      const expX = status ? x + 33 : barX;
      const expW = x + w - 7 - expX;
      this.rect(expX - 1, bottomY + 1, expW + 2, 4, UI.ink);
      this.rect(expX, bottomY + 2, expW, 2, UI.paperShade);
      this.rect(expX, bottomY + 2, Math.round(expW * expShare), 2, "#4a9fd8");
    }
  }

  /** The four move buttons. */
  moveMenu(moves, selected) {
    this.box(0, BOX.y, 168, BOX.h);
    moves.forEach((entry, index) => {
      const x = 12 + (index % 2) * 78;
      const y = BOX.y + 8 + Math.floor(index / 2) * 16;
      const dim = entry.usable ? UI.ink : "#9a8d78";
      this.text(entry.move ? entry.move.name : "-", x, y, { color: dim });
      if (index === selected) this.cursor(x - 8, y + 1);
    });
    const chosen = moves[selected];
    this.box(168, BOX.y, 72, BOX.h);
    if (chosen?.move) {
      this.rect(174, BOX.y + 8, 60, 9, TYPE_COLORS[chosen.move.type]);
      this.textCentred(TYPE_NAMES[chosen.move.type], 204, BOX.y + 9, { color: "#ffffff" });
      this.text(`PP ${chosen.pp}/${chosen.max}`, 174, BOX.y + 24);
    }
  }

  /** The Fight, Bag, Creatures and Run buttons. */
  actionMenu(options, selected) {
    this.box(124, BOX.y, 116, BOX.h);
    options.forEach((label, index) => {
      const x = 140 + (index % 2) * 54;
      const y = BOX.y + 10 + Math.floor(index / 2) * 16;
      this.text(label, x, y);
      if (index === selected) this.cursor(x - 9, y + 1);
    });
  }

  /** The message box, with its page arrow. */
  message(lines, { arrow = false, blink = true, width = BOX.w } = {}) {
    this.box(BOX.x, BOX.y, width, BOX.h);
    this.lines(lines, BOX.textX, BOX.textY);
    if (arrow) this.pageArrow(BOX.x + width - 16, BOX.y + BOX.h - 12, blink);
  }

  /** A list of choices in a small box in the corner. */
  choiceBox(options, selected, { x = 150, y = 60, w = 86 } = {}) {
    const h = options.length * 12 + 10;
    this.box(x, y, w, h);
    options.forEach((label, index) => {
      this.text(label, x + 16, y + 8 + index * 12);
      if (index === selected) this.cursor(x + 7, y + 9 + index * 12);
    });
  }
}

/** How wide a string is at a given number of pixels per bit. */
function measureAt(line, scale) {
  const length = String(line ?? "").length;
  return length === 0 ? 0 : (length * (CHAR_W + TRACKING) - TRACKING) * scale;
}

/** Blend two hex colours. */
function mix(a, b, share) {
  const read = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const [ar, ag, ab] = read(a);
  const [br, bg, bb] = read(b);
  const blend = (from, to) => Math.round(from + (to - from) * share);
  return `rgb(${blend(ar, br)}, ${blend(ag, bg)}, ${blend(ab, bb)})`;
}

/** The colour of the little badge that marks a lasting condition. */
export function statusColor(status) {
  return {
    poison: "#8a4fa8",
    burn: "#e0622b",
    sleep: "#5a6a8a",
    paralysis: "#e3b23a",
  }[status] ?? "#6a6a6a";
}

/** The three letters that fit in that badge. */
export function statusShort(status) {
  return { poison: "PSN", burn: "BRN", sleep: "SLP", paralysis: "PAR" }[status] ?? "???";
}

/** How big a creature is drawn in battle. The player's side is nearer. */
export const CREATURE_SLOTS = {
  foe: { x: 158, y: 18, scale: 1 },
  player: { x: 38, y: 56, scale: 1.2 },
};

/** The middle of a creature's slot, for the catch animation to fly at. */
export function slotCentre(side) {
  const slot = CREATURE_SLOTS[side];
  const size = SPRITE_SIZE * slot.scale;
  return { x: slot.x + size / 2, y: slot.y + size / 2 };
}
