import { describe, it, expect } from "bun:test";
import { MODES, MODE_IDS, DEFAULT_MODE, isMode, modeById, rulesFor, newGame } from "./modes.js";

describe("the mode registry", () => {
  it("lists exactly the modes it holds", () => {
    expect(MODE_IDS.slice().sort()).toEqual(Object.keys(MODES).sort());
    expect(isMode(DEFAULT_MODE)).toBe(true);
  });

  it("gives every mode a name, an origin and six how-to-play cards", () => {
    for (const id of MODE_IDS) {
      const mode = MODES[id];
      expect(mode.id).toBe(id);
      expect(mode.name.length).toBeGreaterThan(0);
      expect(mode.tagline.length).toBeGreaterThan(0);
      expect(mode.origin.length).toBeGreaterThan(0);
      expect(mode.howToPlay).toHaveLength(6);
      for (const card of mode.howToPlay) {
        expect(card.title.length).toBeGreaterThan(0);
        expect(card.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives every card a board the real board code can draw", () => {
    for (const id of MODE_IDS) {
      for (const card of MODES[id].howToPlay) {
        const shape = card.figure;
        expect(shape.pits).toHaveLength(12);
        expect(shape.owner).toHaveLength(12);
        expect(shape.scores).toHaveLength(2);
        for (const pit of shape.highlight) expect(pit).toBeLessThan(12);
        for (const owner of shape.owner) expect([0, 1]).toContain(owner);
        // Neither game ever loses a seed: a captured seed moves to a score.
        // So every card must add up to the whole board, or it teaches a
        // position that could not happen.
        const total = shape.pits.reduce((a, b) => a + b, 0) + shape.scores[0] + shape.scores[1];
        expect(total).toBe(48);
      }
    }
  });

  it("says which mode has stores and which plays rounds", () => {
    expect(MODES.kalah.hasStores).toBe(true);
    expect(MODES.kalah.conquest).toBe(false);
    expect(MODES.baawa.hasStores).toBe(false);
    expect(MODES.baawa.conquest).toBe(true);
  });

  it("falls back to the default for a mode it does not know", () => {
    expect(isMode("ludo")).toBe(false);
    expect(modeById("ludo").id).toBe(DEFAULT_MODE);
    expect(modeById(undefined).id).toBe(DEFAULT_MODE);
  });
});

describe("every engine answers the same calls", () => {
  for (const id of MODE_IDS) {
    it(`${id} opens a game, lists moves, plays one and describes one`, () => {
      const rules = rulesFor(id);
      for (const call of ["createGame", "legalMoves", "applyMove", "describeMove"]) {
        expect(typeof rules[call]).toBe("function");
      }
      const game = newGame(id);
      expect(game.mode).toBe(id);
      expect(game.pits).toHaveLength(12);
      expect(rules.legalMoves(game)).toHaveLength(6);
      const { state, events } = rules.applyMove(game, rules.legalMoves(game)[0]);
      expect(state.plies).toBe(1);
      expect(events[0].type).toBe("lift");
      expect(typeof rules.describeMove(game, 0).state).toBe("object");
    });

    it(`${id} describes a move with the same fields as the other rule set`, () => {
      // The screen shows one preview line and one summary line for both games
      // (see captions.js), so both engines must answer the same questions.
      const rules = rulesFor(id);
      const game = newGame(id);
      const look = rules.describeMove(game, rules.legalMoves(game)[0]);
      for (const field of ["gain", "given", "laps", "captured", "extraTurn", "landsInStore"]) {
        expect(look).toHaveProperty(field);
      }
      expect(look.lands === null || (look.lands >= 0 && look.lands < 12)).toBe(true);
    });
  }
});
