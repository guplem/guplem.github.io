import { describe, it, expect } from "bun:test";
import { snapshot, applyEvent, applyEvents, paceFor, sowingLaps } from "./playback.js";
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

describe("sowingLaps", () => {
  const rules = rulesFor("kalah");

  it("puts every seed of a move in one lap", () => {
    const { events } = rules.applyMove(newGame("kalah"), 2);
    const { laps, tail } = sowingLaps(events);
    expect(laps).toHaveLength(1);
    expect(laps[0].lift.count).toBe(4);
    // Four seeds, so four steps: three pits and the store.
    expect(laps[0].steps).toHaveLength(4);
    expect(laps[0].steps.map((step) => step.event.type)).toEqual(["drop", "drop", "drop", "store"]);
    // The fourth seed reaches South's own store, so South plays again.
    expect(tail.map((event) => event.type)).toEqual(["extraTurn"]);
  });

  it("splits a Ba-awa relay into one lap per lift", () => {
    const ghana = rulesFor("baawa");
    // Pit 1 holds one seed, and pit 2 holds one, so the relay lifts twice.
    const start = { ...newGame("baawa"), pits: [1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 12, 0] };
    const { events } = ghana.applyMove(start, 0);
    const { laps } = sowingLaps(events);
    expect(laps).toHaveLength(2);
    expect(laps[0].lift.count).toBe(1);
    expect(laps[1].lift.count).toBe(2);
    // Every lap sows exactly as many seeds as its lift picked up.
    for (const lap of laps) expect(lap.steps).toHaveLength(lap.lift.count);
  });

  it("hangs a capture on the seed that caused it", () => {
    const ghana = rulesFor("baawa");
    const start = { ...newGame("baawa"), pits: [2, 3, 0, 0, 0, 0, 1, 0, 0, 0, 12, 0] };
    const { events } = ghana.applyMove(start, 0);
    const { laps } = sowingLaps(events);
    // Two seeds. The first makes pit 2 hold four, which is taken at once.
    expect(laps[0].steps[0].extras.map((event) => event.type)).toEqual(["capture"]);
    expect(laps[0].steps[1].extras).toEqual([]);
  });

  it("keeps the closing events out of the laps", () => {
    const ghana = rulesFor("baawa");
    const start = { ...newGame("baawa"), turn: 1, pits: [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 12, 0] };
    const { events } = ghana.applyMove(start, 6);
    const { laps, tail } = sowingLaps(events);
    expect(laps.length).toBeGreaterThan(0);
    expect(tail.map((event) => event.type)).toEqual(["sweep", "gameOver"]);
  });

  it("accounts for every event exactly once", () => {
    for (const mode of MODE_IDS) {
      const engine = rulesFor(mode);
      const rng = mulberry32(5);
      let state = newGame(mode);
      let guard = 0;
      while (!state.over && guard < 200) {
        const moves = engine.legalMoves(state);
        const { state: after, events } = engine.applyMove(state, moves[Math.floor(rng() * moves.length) % moves.length]);
        const { laps, tail } = sowingLaps(events);
        let seen = tail.length;
        for (const lap of laps) {
          seen += 1;
          for (const step of lap.steps) seen += 1 + step.extras.length;
        }
        expect(seen).toBe(events.length);
        state = after;
        guard += 1;
      }
    }
  });
});

describe("paceFor", () => {
  const drops = (count) => new Array(count).fill({ type: "drop" });

  it("gives a seed long enough to be watched crossing one pit", () => {
    // The reference game this copies takes about half a second per pit. A
    // seed that crosses in 150ms reads as a jump, not as a throw.
    expect(paceFor(drops(4), 1)).toBeGreaterThanOrEqual(400);
  });

  it("keeps the same pace for every short move", () => {
    expect(paceFor(drops(2), 1)).toBe(paceFor(drops(6), 1));
  });

  it("speeds a long relay up so the whole move stays watchable", () => {
    // The last seed of a lap flies for one gap per seed, so a 40-seed relay
    // at the short-move pace would run for nearly 20 seconds.
    const long = paceFor(drops(40), 1);
    expect(long).toBeLessThan(paceFor(drops(4), 1));
    expect(40 * long).toBeLessThan(8000);
  });

  it("never goes below a floor, however long the relay", () => {
    expect(paceFor(drops(500), 1)).toBeGreaterThanOrEqual(80);
  });

  it("divides the wait by the speed the player chose", () => {
    expect(paceFor(drops(4), 2)).toBe(Math.round(paceFor(drops(4), 1) / 2));
    expect(paceFor(drops(4), 3)).toBe(Math.round(paceFor(drops(4), 1) / 3));
  });

  it("gives no wait at all when animation is off", () => {
    expect(paceFor(drops(30), 0)).toBe(0);
  });
});
