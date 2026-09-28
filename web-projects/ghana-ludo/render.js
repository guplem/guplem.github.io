// Drawing: the board as SVG, the pieces, the die. No rules live here; the
// page glue (app.js) says which pieces may move and where they may go.

import { HOUSES, START_FIELD, STAR, TRACK, YARDS, movePath } from "./rules.js";

const NS = "http://www.w3.org/2000/svg";
const CELL = 10;
const STEP_MS = 150;

const centre = ([x, y]) => [x * CELL + CELL / 2, y * CELL + CELL / 2];

function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  parent?.append(node);
  return node;
}

/** A five-pointed star, point up, as a path around (cx, cy). */
function starPath(cx, cy, outer, inner) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

/** Where a piece is drawn [x, y, scale], in board units, or null when it is off the board. */
function spotOf(piece, game) {
  if (piece.at === "gone") return null;
  if (piece.at === "yard") return [...centre(YARDS[piece.seat][piece.step]), 1];
  if (piece.at === "house") return [...centre(HOUSES[piece.house][piece.step]), 1];
  if (piece.at === "star") {
    // Small, in a 2 x 2 grid in the seat's own quarter of the star field
    // (the same corner as its yard), so sixteen finished pieces still fit.
    const [cx, cy] = centre(STAR);
    const [qx, qy] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ][piece.seat];
    const [sx, sy] = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ][piece.step % 4];
    return [cx + qx * 2.6 + sx * 1.3, cy + qy * 2.6 + sy * 1.3, 0.42];
  }
  const field = (START_FIELD[piece.seat] + piece.step) % 40;
  const [x, y] = centre(TRACK[field]);
  // A pile on a start field fans out a little.
  const pile = game.pieces.filter(
    (q) => q.at === "ring" && (START_FIELD[q.seat] + q.step) % 40 === field && q.seat === piece.seat,
  );
  const index = pile.findIndex((q) => q.id === piece.id);
  return pile.length > 1 ? [x + (index - (pile.length - 1) / 2) * 1.6, y - index * 0.4, 1] : [x, y, 1];
}

/**
 * Builds the board inside `host` and returns an updater.
 *
 * @param {HTMLElement} host
 * @param {{ onPiece: (pieceId: number) => void, onTarget: (targetId: number) => void }} handlers
 */
export function createBoard(host, { onPiece, onTarget }) {
  const root = svg("svg", { viewBox: "0 0 110 110", class: "board", role: "img", "aria-label": "Ludo board" });
  host.replaceChildren(root);

  svg("rect", { x: 0.5, y: 0.5, width: 109, height: 109, rx: 6, class: "board__bg" }, root);

  // Yards, one per corner.
  YARDS.forEach((cells, seat) => {
    const [x, y] = cells[0];
    svg("rect", {
      x: (x - 0.6) * CELL,
      y: (y - 0.6) * CELL,
      width: 3.2 * CELL,
      height: 3.2 * CELL,
      rx: 5,
      class: `yard seat-${seat}`,
    }, root);
    cells.forEach((cell) => {
      const [cx, cy] = centre(cell);
      svg("circle", { cx, cy, r: 3.8, class: "spot spot--yard" }, root);
    });
  });

  TRACK.forEach((cell, field) => {
    const [cx, cy] = centre(cell);
    const seat = START_FIELD.indexOf(field);
    svg("circle", { cx, cy, r: 4.1, class: seat >= 0 ? `spot spot--start seat-${seat}` : "spot" }, root);
  });
  HOUSES.forEach((cells, seat) =>
    cells.forEach((cell) => {
      const [cx, cy] = centre(cell);
      svg("circle", { cx, cy, r: 4.1, class: `spot spot--house seat-${seat}` }, root);
    }),
  );
  const [sx, sy] = centre(STAR);
  svg("circle", { cx: sx, cy: sy, r: 4.9, class: "spot spot--star" }, root);
  svg("path", { d: starPath(sx, sy, 4.4, 1.8), class: "star" }, root);

  const pieceLayer = svg("g", { class: "pieces" }, root);
  // Above the pieces: a kick's target stands on the piece it knocks out.
  const targetLayer = svg("g", { class: "targets" }, root);
  const nodes = new Map();
  let previous = null;
  let animating = 0;

  function pieceNode(piece) {
    let node = nodes.get(piece.id);
    if (node) return node;
    node = svg("g", { class: `piece seat-${piece.seat}`, tabindex: "-1" }, pieceLayer);
    svg("circle", { r: 3.3, class: "piece__body" }, node);
    svg("circle", { r: 1.5, class: "piece__eye" }, node);
    node.addEventListener("click", () => onPiece(piece.id));
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPiece(piece.id);
      }
    });
    nodes.set(piece.id, node);
    return node;
  }

  const place = (node, [x, y, scale = 1]) =>
    node.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale})`);

  /**
   * Draws a game state.
   *
   * @param {object} game
   * @param {{ movable?: Set<number>, targets?: { id: number, cell: number[], label: string }[],
   *           selected?: number | null }} [marks]
   */
  function update(game, marks = {}) {
    const movable = marks.movable ?? new Set();
    const lastChanged = previous && game.last && game.last.n !== previous.last?.n;
    const sameRound = previous && previous.pieces.length === game.pieces.length;
    const walker = lastChanged && sameRound ? game.last : null;
    const path = walker ? movePath(walker) : [];

    game.pieces.forEach((piece) => {
      const node = pieceNode(piece);
      const spot = spotOf(piece, game);
      node.style.display = spot ? "" : "none";
      node.classList.toggle("is-movable", movable.has(piece.id));
      node.classList.toggle("is-selected", marks.selected === piece.id);
      node.setAttribute("tabindex", movable.has(piece.id) ? "0" : "-1");
      node.setAttribute("role", movable.has(piece.id) ? "button" : "presentation");
      if (!spot) return;

      const isWalker = walker && piece.id === walker.piece && path.length > 1;
      const isVictim = walker && walker.kicks.includes(piece.id);
      if (isWalker) {
        animating += 1;
        pieceLayer.append(node); // on top while it walks
        path.forEach((cell, i) => setTimeout(() => place(node, centre(cell)), i * STEP_MS));
        setTimeout(() => {
          place(node, spotOf(piece, game));
          animating -= 1;
        }, path.length * STEP_MS);
      } else if (isVictim && previous) {
        // Stays where it stood until the kicker arrives, then goes home.
        const before = spotOf(previous.pieces[piece.id], previous);
        if (before) place(node, before);
        setTimeout(() => place(node, spot), Math.max(1, path.length) * STEP_MS);
      } else {
        place(node, spot);
      }
    });

    targetLayer.replaceChildren();
    (marks.targets ?? []).forEach((target) => {
      const [cx, cy] = centre(target.cell);
      const g = svg("g", { class: "target", tabindex: "0", role: "button", "aria-label": target.label }, targetLayer);
      svg("circle", { cx, cy, r: 4.6, class: "target__ring" }, g);
      const text = svg("text", { x: cx, y: cy + 1.4, class: "target__label" }, g);
      text.textContent = target.short ?? "";
      g.addEventListener("click", () => onTarget(target.id));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTarget(target.id);
        }
      });
    });

    previous = structuredClone(game);
  }

  return {
    update,
    /** Forget the last state, so the next one is drawn without walking (a new round). */
    reset() {
      previous = null;
    },
    get busy() {
      return animating > 0;
    },
  };
}

const PIPS = {
  1: [[5, 5]],
  2: [[2.6, 2.6], [7.4, 7.4]],
  3: [[2.6, 2.6], [5, 5], [7.4, 7.4]],
  4: [[2.6, 2.6], [7.4, 2.6], [2.6, 7.4], [7.4, 7.4]],
  5: [[2.6, 2.6], [7.4, 2.6], [5, 5], [2.6, 7.4], [7.4, 7.4]],
  6: [[2.6, 2.5], [7.4, 2.5], [2.6, 5], [7.4, 5], [2.6, 7.5], [7.4, 7.5]],
};

/** Draws a die face (1-6), or a blank die for null. */
export function drawDie(host, value) {
  const root = svg("svg", { viewBox: "0 0 10 10", class: "die__face", "aria-hidden": "true" });
  svg("rect", { x: 0.4, y: 0.4, width: 9.2, height: 9.2, rx: 2, class: "die__body" }, root);
  (PIPS[value] ?? []).forEach(([cx, cy]) => svg("circle", { cx, cy, r: 0.95, class: "die__pip" }, root));
  host.replaceChildren(root);
}
