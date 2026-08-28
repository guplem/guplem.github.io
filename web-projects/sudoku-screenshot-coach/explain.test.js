import { describe, test, expect } from "bun:test";
import { ALL_DIGITS, CELL_COUNT, cellAt, emptyBoard, makeState, maskOf } from "./board.js";
import { findTechnique } from "./techniques.js";
import { describeEliminations, explainMove, moveSummary } from "./explain.js";

function candState(overrides = {}, strips = []) {
  const cands = new Uint16Array(CELL_COUNT).fill(ALL_DIGITS);
  for (const strip of strips) {
    for (const cell of strip.cells) for (const digit of strip.remove) cands[cell] &= ~(1 << (digit - 1));
  }
  for (const [cell, digits] of Object.entries(overrides)) cands[Number(cell)] = maskOf(digits);
  return { board: emptyBoard(), cands };
}

const rowCells = (row) => Array.from({ length: 9 }, (_, col) => cellAt(row, col));
const allText = (explanation) => [explanation.title, explanation.action, ...explanation.reasons].join(" ");

describe("describeEliminations", () => {
  test("groups the cells under each digit", () => {
    const text = describeEliminations([
      { cell: cellAt(0, 3), digit: 5 },
      { cell: cellAt(0, 4), digit: 5 },
      { cell: cellAt(0, 5), digit: 5 },
    ]);
    expect(text).toBe("5 from r1c4, r1c5 and r1c6");
  });

  test("handles several digits", () => {
    const text = describeEliminations([
      { cell: cellAt(0, 0), digit: 1 },
      { cell: cellAt(0, 1), digit: 3 },
    ]);
    expect(text).toContain("1 from r1c1");
    expect(text).toContain("3 from r1c2");
  });
});

describe("explainMove", () => {
  test("a naked single names the cell, the digit and what blocks the rest", () => {
    const board = emptyBoard();
    for (let col = 0; col < 8; col += 1) board[cellAt(0, col)] = col + 1;
    const move = findTechnique("naked-single", makeState(board));
    const explanation = explainMove(move, makeState(board));

    expect(explanation.technique.name).toBe("Naked Single");
    expect(explanation.title).toContain("9");
    expect(explanation.title).toContain("r1c9");
    expect(explanation.action).toContain("r1c9");
    const text = allText(explanation);
    // Every blocking digit and the cell it sits in must be named.
    for (let digit = 1; digit <= 8; digit += 1) expect(text).toContain(`${digit} in r1c${digit}`);
    expect(explanation.technique.howItWorks.length).toBeGreaterThan(20);
  });

  test("a hidden single names the house and why the other cells fail", () => {
    const board = emptyBoard();
    board[cellAt(0, 8)] = 7;
    board[cellAt(1, 7)] = 7;
    board[cellAt(7, 0)] = 7;
    board[cellAt(8, 1)] = 7;
    const state = makeState(board);
    const move = findTechnique("hidden-single", state);
    const explanation = explainMove(move, state);

    expect(explanation.technique.name).toBe("Hidden Single");
    expect(explanation.title).toContain("r3c3");
    const text = allText(explanation);
    expect(text).toContain("box 1");
    expect(text).toContain("r1c9"); // one of the blocking sevens
  });

  test("a pointing move explains the box, the line and the cells cleared", () => {
    const boxCells = [0, 1, 2, 9, 10, 11, 18, 19, 20];
    const state = candState({}, [
      { cells: boxCells.filter((cell) => cell !== cellAt(0, 0) && cell !== cellAt(0, 2)), remove: [5] },
    ]);
    const move = findTechnique("pointing", state);
    const explanation = explainMove(move, state);

    const text = allText(explanation);
    expect(text).toContain("box 1");
    expect(text).toContain("row 1");
    expect(text).toContain("r1c1");
    expect(text).toContain("r1c3");
    expect(explanation.action).toContain("r1c4");
    expect(explanation.kind).toBe("elimination");
  });

  test("a claiming move explains the line and the box it clears", () => {
    const state = candState({}, [{ cells: rowCells(0).slice(3), remove: [5] }]);
    const move = findTechnique("claiming", state);
    const text = allText(explainMove(move, state));
    expect(text).toContain("row 1");
    expect(text).toContain("box 1");
    expect(text).toContain("5");
  });

  test("a naked pair names both cells and both digits", () => {
    const state = candState({ [cellAt(0, 0)]: [1, 2], [cellAt(0, 1)]: [1, 2] });
    const move = findTechnique("naked-pair", state);
    const text = allText(explainMove(move, state));
    expect(text).toContain("r1c1");
    expect(text).toContain("r1c2");
    expect(text).toContain("1 and 2");
    expect(text).toContain("row 1");
  });

  test("a hidden pair says which digits own which cells", () => {
    const state = candState(
      { [cellAt(0, 0)]: [1, 2, 4, 5], [cellAt(0, 1)]: [3, 4, 5] },
      [{ cells: rowCells(0).slice(2), remove: [4, 5] }]
    );
    const move = findTechnique("hidden-pair", state);
    const text = allText(explainMove(move, state));
    expect(text).toContain("4 and 5");
    expect(text).toContain("r1c1");
    expect(text).toContain("r1c2");
  });

  test("an X-Wing names the two base rows and the two columns it clears", () => {
    const keep = new Set([cellAt(0, 1), cellAt(0, 6), cellAt(4, 1), cellAt(4, 6)]);
    const state = candState({}, [
      { cells: [...rowCells(0), ...rowCells(4)].filter((cell) => !keep.has(cell)), remove: [3] },
    ]);
    const move = findTechnique("x-wing", state);
    const text = allText(explainMove(move, state));
    expect(text).toContain("row 1");
    expect(text).toContain("row 5");
    expect(text).toContain("column 2");
    expect(text).toContain("column 7");
  });

  test("a Y-Wing walks through both branches of the pivot", () => {
    const state = candState({
      [cellAt(0, 0)]: [1, 2],
      [cellAt(0, 4)]: [1, 3],
      [cellAt(4, 0)]: [2, 3],
    });
    const move = findTechnique("y-wing", state);
    const text = allText(explainMove(move, state));
    expect(text).toContain("r1c1"); // pivot
    expect(text).toContain("r1c5"); // pincer
    expect(text).toContain("r5c1"); // pincer
    expect(text).toContain("3");
    expect(text.toLowerCase()).toContain("either way");
  });

  test("an XYZ-Wing names the pivot and both pincers", () => {
    const state = candState({
      [cellAt(0, 0)]: [1, 2, 3],
      [cellAt(0, 1)]: [1, 3],
      [cellAt(4, 0)]: [2, 3],
    });
    const move = findTechnique("xyz-wing", state);
    const text = allText(explainMove(move, state));
    expect(text).toContain("r1c1");
    expect(text).toContain("r1c2");
    expect(text).toContain("r5c1");
  });

  test("every explanation carries the fields the UI renders", () => {
    const state = candState({ [cellAt(0, 0)]: [1, 2], [cellAt(0, 1)]: [1, 2] });
    const explanation = explainMove(findTechnique("naked-pair", state), state);
    expect(typeof explanation.title).toBe("string");
    expect(typeof explanation.action).toBe("string");
    expect(Array.isArray(explanation.reasons)).toBe(true);
    expect(explanation.reasons.length).toBeGreaterThan(0);
    for (const reason of explanation.reasons) expect(reason.length).toBeGreaterThan(0);
    expect(explanation.highlight.focus.length).toBeGreaterThan(0);
    expect(["placement", "elimination"]).toContain(explanation.kind);
  });
});

describe("Spanish", () => {
  test("explains a naked single in Spanish, with the same facts", () => {
    const board = emptyBoard();
    for (let col = 0; col < 8; col += 1) board[cellAt(0, col)] = col + 1;
    const state = makeState(board);
    const move = findTechnique("naked-single", state);
    const spanish = explainMove(move, state, "es");

    expect(spanish.technique.name).toBe("Única candidata");
    expect(spanish.title).toBe("Coloca el 9 en r1c9");
    expect(spanish.action).toContain("Escribe el 9");
    const text = allText(spanish);
    // The cells and digits are the same; only the words around them change.
    for (let digit = 1; digit <= 8; digit += 1) expect(text).toContain(`el ${digit} de r1c${digit}`);
    expect(text).toContain("misma fila");
    expect(text).not.toContain("same row");
  });

  test("explains a hidden single in Spanish", () => {
    const board = emptyBoard();
    board[cellAt(0, 8)] = 7;
    board[cellAt(1, 7)] = 7;
    board[cellAt(7, 0)] = 7;
    board[cellAt(8, 1)] = 7;
    const state = makeState(board);
    const text = allText(explainMove(findTechnique("hidden-single", state), state, "es"));
    expect(text).toContain("la caja 1");
    expect(text).toContain("r3c3");
    expect(text).not.toContain("box 1");
  });

  test("explains an elimination in Spanish", () => {
    const state = candState({ [cellAt(0, 0)]: [1, 2], [cellAt(0, 1)]: [1, 2] });
    const explanation = explainMove(findTechnique("naked-pair", state), state, "es");
    expect(explanation.action).toContain("Elimina");
    expect(allText(explanation)).toContain("la fila 1");
  });

  test("leaves no untranslated key in any explanation, in either language", () => {
    const state = candState({ [cellAt(0, 0)]: [1, 2], [cellAt(0, 1)]: [1, 2] });
    for (const lang of ["en", "es"]) {
      const explanation = explainMove(findTechnique("naked-pair", state), state, lang);
      const text = allText(explanation) + explanation.technique.howItWorks;
      expect(text).not.toContain("explain.");
      expect(text).not.toContain("technique.");
      expect(text).not.toContain("{");
    }
  });
});

describe("moveSummary", () => {
  test("reads as one short line for a placement", () => {
    const board = emptyBoard();
    for (let col = 0; col < 8; col += 1) board[cellAt(0, col)] = col + 1;
    const move = findTechnique("naked-single", makeState(board));
    expect(moveSummary(move)).toBe("Naked Single: r1c9 = 9");
  });

  test("reads as one short line for an elimination", () => {
    const state = candState({ [cellAt(0, 0)]: [1, 2], [cellAt(0, 1)]: [1, 2] });
    const move = findTechnique("naked-pair", state);
    expect(moveSummary(move)).toContain("Naked Pair");
    expect(moveSummary(move)).toContain("removes");
  });
});
