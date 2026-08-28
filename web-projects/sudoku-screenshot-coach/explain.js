// Turns a Move from `techniques.js` into the words the player reads.
//
// The rule this file follows: never say "because the rules say so". Every
// explanation names the cells and digits that force the move, so the player can
// check it on the grid without trusting the tool.
//
// No sentence is written here. Each one is a key in `i18n.js`, filled with the
// cells and digits of the move, so the same explanation comes out in whatever
// language the page is set to.

import { HOUSES, cellName, digitsOf, houseName, lineWord, relationWord, rowOf, colOf } from "./board.js";
import { DEFAULT_LANGUAGE, joinList, t } from "./i18n.js";
import { techniqueInfo } from "./techniques.js";

/** "5 from r1c4, r1c5 and r1c6", with one group per digit. */
export function describeEliminations(eliminations, lang = DEFAULT_LANGUAGE) {
  const byDigit = new Map();
  for (const { cell, digit } of eliminations) {
    if (!byDigit.has(digit)) byDigit.set(digit, []);
    byDigit.get(digit).push(cell);
  }
  const parts = [...byDigit.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([digit, cells]) =>
      t(lang, "explain.elimination.group", {
        digit,
        cells: joinList(lang, cells.sort((a, b) => a - b).map(cellName)),
      })
    );
  return joinList(lang, parts);
}

/** "r1c1 (1 and 2), r1c2 (2 and 3)" -- cells with the candidates they hold. */
function describeCellsWithCandidates(cells, state, lang) {
  return joinList(
    lang,
    cells.map((cell) =>
      t(lang, "explain.cellWithCandidates", {
        cell: cellName(cell),
        digits: joinList(lang, digitsOf(state.cands[cell]).map(String)),
      })
    )
  );
}

/**
 * Group the witnesses by the cell that holds the blocking digit, so a single 7
 * that rules out three cells is named once, not three times.
 */
function describeWitnesses(witnesses, lang) {
  const byBlocker = new Map();
  for (const witness of witnesses) {
    if (!byBlocker.has(witness.cell)) byBlocker.set(witness.cell, { cell: witness.cell, digit: witness.digit, targets: [] });
    byBlocker.get(witness.cell).targets.push(witness.target);
  }
  return [...byBlocker.values()].map((group) =>
    t(lang, group.targets.length === 1 ? "explain.witness.one" : "explain.witness.many", {
      cells: joinList(lang, group.targets.sort((a, b) => a - b).map(cellName)),
      digit: group.digit,
      cell: cellName(group.cell),
    })
  );
}

/** The cells a move removes candidates from, as one phrase. */
const targetCells = (move, lang) => joinList(lang, move.eliminations.map((elimination) => cellName(elimination.cell)));

/** Names of the cover houses of a fish, e.g. "column 2 and column 7". */
const coverNames = (move, lang) => joinList(lang, (move.coverHouses ?? []).map((id) => houseName(id, lang)));

function explainNakedSingle(move, state, lang) {
  const { cell, digit } = move.placements[0];
  const blockers = move.witnesses.map((witness) =>
    t(lang, "explain.blocker", {
      digit: witness.digit,
      cell: cellName(witness.cell),
      relation: relationWord(witness.house, lang),
    })
  );
  return {
    title: t(lang, "explain.place.title", { digit, cell: cellName(cell) }),
    action: t(lang, "explain.place.action", { digit, cell: cellName(cell) }),
    reasons: [
      t(lang, "explain.naked-single.1", { cell: cellName(cell), digit }),
      blockers.length > 0
        ? t(lang, "explain.naked-single.2", { cell: cellName(cell), list: joinList(lang, blockers) })
        : t(lang, "explain.naked-single.2-short", { cell: cellName(cell) }),
    ],
    kind: "placement",
    highlight: { focus: [cell], support: move.witnesses.map((witness) => witness.cell), houses: [] },
  };
}

function explainHiddenSingle(move, state, lang) {
  const { cell, digit } = move.placements[0];
  const house = houseName(move.houses[0], lang);
  const reasons = [t(lang, "explain.hidden-single.1", { house, digit, cell: cellName(cell) })];
  if (move.witnesses.length > 0) {
    reasons.push(
      t(lang, "explain.hidden-single.2", { house, digit, list: joinList(lang, describeWitnesses(move.witnesses, lang)) })
    );
  }
  reasons.push(t(lang, "explain.hidden-single.3", { cell: cellName(cell), house, digit }));
  return {
    title: t(lang, "explain.place.title", { digit, cell: cellName(cell) }),
    action: t(lang, "explain.place.action", { digit, cell: cellName(cell) }),
    reasons,
    kind: "placement",
    highlight: { focus: [cell], support: move.witnesses.map((witness) => witness.cell), houses: [move.houses[0]] },
  };
}

function explainPointing(move, state, lang) {
  const digit = move.digits[0];
  const box = houseName(move.baseHouse, lang);
  const lineId = move.coverHouses[0];
  const line = houseName(lineId, lang);
  const word = lineWord(lineId, lang);
  return {
    title: t(lang, "explain.rule-out.title", { digit, cells: targetCells(move, lang) }),
    action: t(lang, "explain.remove.action", { list: describeEliminations(move.eliminations, lang) }),
    reasons: [
      t(lang, "explain.pointing.1", { box, digit, cells: joinList(lang, move.patternCells.map(cellName)) }),
      t(lang, "explain.pointing.2", { line, box, digit, lineWord: word }),
      t(lang, "explain.pointing.3", { lineWord: word, digit, box, line }),
    ],
    kind: "elimination",
    highlight: {
      focus: move.eliminations.map((elimination) => elimination.cell),
      support: move.patternCells,
      houses: [move.baseHouse, lineId],
    },
  };
}

function explainClaiming(move, state, lang) {
  const digit = move.digits[0];
  const line = houseName(move.baseHouse, lang);
  const box = houseName(move.coverHouses[0], lang);
  return {
    title: t(lang, "explain.rule-out.title", { digit, cells: targetCells(move, lang) }),
    action: t(lang, "explain.remove.action", { list: describeEliminations(move.eliminations, lang) }),
    reasons: [
      t(lang, "explain.claiming.1", { line, digit, cells: joinList(lang, move.patternCells.map(cellName)) }),
      t(lang, "explain.claiming.2", { box, line, digit }),
      t(lang, "explain.claiming.3", { box, digit, line }),
    ],
    kind: "elimination",
    highlight: {
      focus: move.eliminations.map((elimination) => elimination.cell),
      support: move.patternCells,
      houses: [move.baseHouse, move.coverHouses[0]],
    },
  };
}

function explainNakedSubset(move, state, lang) {
  const house = houseName(move.houses[0], lang);
  const digits = joinList(lang, move.digits.map(String));
  const count = move.patternCells.length;
  return {
    title: t(lang, "explain.naked-subset.title", { digits, house }),
    action: t(lang, "explain.remove.action", { list: describeEliminations(move.eliminations, lang) }),
    reasons: [
      t(lang, "explain.naked-subset.1", { house, cells: describeCellsWithCandidates(move.patternCells, state, lang), digits }),
      t(lang, "explain.naked-subset.2", { countWord: t(lang, `count.${count}`), count }),
      t(lang, "explain.naked-subset.3", { house, digits }),
    ],
    kind: "elimination",
    highlight: {
      focus: move.eliminations.map((elimination) => elimination.cell),
      support: move.patternCells,
      houses: [move.houses[0]],
    },
  };
}

function explainHiddenSubset(move, state, lang) {
  const house = houseName(move.houses[0], lang);
  const digits = joinList(lang, move.digits.map(String));
  const cells = joinList(lang, move.patternCells.map(cellName));
  return {
    title: t(lang, "explain.hidden-subset.title", { cells }),
    action: t(lang, "explain.remove.action", { list: describeEliminations(move.eliminations, lang) }),
    reasons: [
      t(lang, "explain.hidden-subset.1", { house, digits, cells }),
      t(lang, "explain.hidden-subset.2", { count: move.digits.length }),
      t(lang, "explain.hidden-subset.3"),
    ],
    kind: "elimination",
    highlight: { focus: move.patternCells, support: move.patternCells, houses: [move.houses[0]] },
  };
}

function explainFish(move, state, lang) {
  const digit = move.digits[0];
  const alongRows = move.orientation === "row";
  const lines = move.houses.map((houseId) => {
    const cells = move.patternCells.filter((cell) =>
      alongRows ? rowOf(cell) === HOUSES[houseId].index : colOf(cell) === HOUSES[houseId].index
    );
    return t(lang, "explain.fish.line", { house: houseName(houseId, lang), cells: joinList(lang, cells.map(cellName)) });
  });
  const baseWord = t(lang, alongRows ? "houseWord.row" : "houseWord.col");
  const basePlural = t(lang, alongRows ? "houseWord.rows" : "houseWord.cols");
  const coverPlural = t(lang, alongRows ? "houseWord.cols" : "houseWord.rows");
  const covers = coverNames(move, lang);
  return {
    title: t(lang, "explain.rule-out.title", { digit, cells: targetCells(move, lang) }),
    action: t(lang, "explain.remove.action", { list: describeEliminations(move.eliminations, lang) }),
    reasons: [
      t(lang, "explain.fish.1", { digit, lines: joinList(lang, lines) }),
      t(lang, "explain.fish.2", { covers }),
      t(lang, "explain.fish.3", { baseWord, digit, basePlural, coverPlural }),
      t(lang, "explain.fish.4", { covers, digit }),
    ],
    kind: "elimination",
    highlight: {
      focus: move.eliminations.map((elimination) => elimination.cell),
      support: move.patternCells,
      houses: [...move.houses, ...(move.coverHouses ?? [])],
    },
  };
}

function explainYWing(move, state, lang) {
  const digit = move.digits[0];
  const [first, second] = move.pincers;
  const [a, b] = move.pivotDigits;
  return {
    title: t(lang, "explain.rule-out.title", { digit, cells: targetCells(move, lang) }),
    action: t(lang, "explain.remove.action", { list: describeEliminations(move.eliminations, lang) }),
    reasons: [
      t(lang, "explain.y-wing.1", { pivot: cellName(move.pivot), a, b }),
      t(lang, "explain.y-wing.2", { pincers: describeCellsWithCandidates([first, second], state, lang), digit }),
      t(lang, "explain.y-wing.3", {
        pivot: cellName(move.pivot),
        a,
        b,
        first: cellName(first),
        second: cellName(second),
        digit,
      }),
      t(lang, "explain.y-wing.4", { digit }),
    ],
    kind: "elimination",
    highlight: { focus: move.eliminations.map((elimination) => elimination.cell), support: move.patternCells, houses: [] },
  };
}

function explainXyzWing(move, state, lang) {
  const digit = move.digits[0];
  const [first, second] = move.pincers;
  return {
    title: t(lang, "explain.rule-out.title", { digit, cells: targetCells(move, lang) }),
    action: t(lang, "explain.remove.action", { list: describeEliminations(move.eliminations, lang) }),
    reasons: [
      t(lang, "explain.xyz-wing.1", { pivot: cellName(move.pivot), digits: joinList(lang, move.pivotDigits.map(String)) }),
      t(lang, "explain.xyz-wing.2", { pincers: describeCellsWithCandidates([first, second], state, lang), digit }),
      t(lang, "explain.xyz-wing.3", { digit }),
      t(lang, "explain.xyz-wing.4", { digit }),
    ],
    kind: "elimination",
    highlight: { focus: move.eliminations.map((elimination) => elimination.cell), support: move.patternCells, houses: [] },
  };
}

const EXPLAINERS = {
  "naked-single": explainNakedSingle,
  "hidden-single": explainHiddenSingle,
  pointing: explainPointing,
  claiming: explainClaiming,
  "naked-pair": explainNakedSubset,
  "naked-triple": explainNakedSubset,
  "naked-quad": explainNakedSubset,
  "hidden-pair": explainHiddenSubset,
  "hidden-triple": explainHiddenSubset,
  "x-wing": explainFish,
  swordfish: explainFish,
  "y-wing": explainYWing,
  "xyz-wing": explainXyzWing,
};

/**
 * Build the full explanation of a move.
 * @param {object} move a Move from techniques.js
 * @param {{board: Int8Array, cands: Uint16Array}} state the grid the move was found in
 * @param {string} [lang] language code
 * @returns {{title: string, action: string, reasons: string[], kind: string,
 *   technique: object, highlight: {focus: number[], support: number[], houses: number[]}}}
 */
export function explainMove(move, state, lang = DEFAULT_LANGUAGE) {
  const explainer = EXPLAINERS[move.technique];
  if (!explainer) throw new Error(`No explanation for technique: ${move.technique}`);
  return {
    ...explainer(move, state, lang),
    move,
    technique: techniqueInfo(move.technique, lang),
  };
}

/** One short line for a step list: "Naked Single: r1c9 = 9". */
export function moveSummary(move, lang = DEFAULT_LANGUAGE) {
  const technique = techniqueInfo(move.technique, lang).name;
  if (move.placements.length > 0) {
    const { cell, digit } = move.placements[0];
    return t(lang, "summary.placement", { technique, cell: cellName(cell), digit });
  }
  return t(lang, "summary.elimination", { technique, list: describeEliminations(move.eliminations, lang) });
}
