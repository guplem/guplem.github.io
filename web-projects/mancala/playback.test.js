import { describe, it, expect } from "bun:test";
import { snapshot, applyEvent, applyEvents, paceFor } from "./playback.js";
import { MODE_IDS, rulesFor, newGame } from "./modes.js";
import { mulberry32 } from "./rng.js";

describe("the picture and the engine agree", () => {
  for (const mode of MODE_IDS) {
    it(`ends every ${mode} move showing exactly what the engine has`, () => {
      const rules = rulesFor(mode);
      const rng = mulberry32(11);
      let state = newGame(mode);
      let guard = 0;

      while (!state.over && guard < 300) {
        const moves = rules.legalMoves(state);
        const move = moves[Math.floor(rng() * moves.length) % moves.length];
        const before = snapshot(state);
        const { state: after, events } = rules.applyMove(state, move);
        const shown = applyEvents(before, events);

        expect(shown.pits).toEqual(after.pits);
        expect(shown.scores).toEqual(after.scores);
        expect(shown.turn).toBe(after.turn);
        expect(shown.over).toBe(after.over);
        state = after;
        guard += 1;
      }
      expect(state.over).toBe(true);
    });
  }
});

describe("one event at a time", () => {
  const rules = rulesFor("kalah");
  const start = newGame("kalah");

  it("empties the pit it lifts from and puts the seeds in the hand", () => {
    const shown = applyEvent(snapshot(start), { type: "lift", pit: 2, count: 4, player: 0 });
    expect(shown.pits[2]).toBe(0);
    expect(shown.hand).toEqual({ pit: 2, left: 4 });
  });

  it("takes one seed out of the hand for every drop", () => {
    const { events } = rules.applyMove(start, 2);
    let shown = snapshot(start);
    const left = [];
    for (const event of events) {
      shown = applyEvent(shown, event);
      if (shown.hand) left.push(shown.hand.left);
    }
    expect(left).toEqual([4, 3, 2, 1, 0]);
    expect(shown.hand).toBe(null);
  });

  it("empties both pits of a Kalah capture", () => {
    const shown = applyEvent(snapshot(start), {
      type: "capture",
      pit: 3,
      facing: 8,
      count: 6,
      player: 0,
    });
    expect(shown.pits[3]).toBe(0);
    expect(shown.pits[8]).toBe(0);
    expect(shown.scores[0]).toBe(6);
  });

  it("empties only the one pit of a Ba-awa capture", () => {
    const ghana = newGame("baawa");
    const shown = applyEvent(snapshot(ghana), { type: "capture", pit: 3, count: 4, player: 1 });
    expect(shown.pits[3]).toBe(0);
    expect(shown.pits[8]).toBe(4);
    expect(shown.scores[1]).toBe(4);
  });

  it("ignores an event it does not know", () => {
    const before = snapshot(start);
    const after = applyEvent(before, { type: "relayCutOff", pit: 3, laps: 300 });
    expect(after.pits).toEqual(before.pits);
    expect(after.scores).toEqual(before.scores);
  });

  it("never changes the picture it was given", () => {
    const before = snapshot(start);
    const frozen = JSON.stringify(before);
    applyEvent(before, { type: "lift", pit: 0, count: 4, player: 0 });
    expect(JSON.stringify(before)).toBe(frozen);
  });
});

describe("paceFor", () => {
  const drops = (count) => new Array(count).fill({ type: "drop" });

  it("gives a short move a slow, readable pace", () => {
    expect(paceFor(drops(3), 1)).toBeGreaterThan(paceFor(drops(20), 1));
  });

  it("speeds a long relay up so it does not outstay its welcome", () => {
    expect(paceFor(drops(60), 1)).toBeLessThan(paceFor(drops(10), 1));
  });

  it("halves the wait on the fast setting", () => {
    expect(paceFor(drops(3), 2)).toBe(Math.round(paceFor(drops(3), 1) / 2));
  });

  it("gives no wait at all when animation is off", () => {
    expect(paceFor(drops(30), 0)).toBe(0);
  });
});
