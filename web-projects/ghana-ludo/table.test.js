import { describe, expect, it } from "bun:test";
import {
  addBot,
  addLocal,
  admit,
  backToLobby,
  botStep,
  dieFromBytes,
  forcedStep,
  makeReducer,
  newTable,
  removeSeat,
  seatsControlledBy,
  setOption,
  startRound,
  takeOut,
} from "./table.js";

const host = { id: "H", name: "Ama" };
const guest = (id, name = id) => ({ id, name });

describe("the lobby", () => {
  it("opens with the host in the first seat and every rule on", () => {
    const t = newTable(host);
    expect(t.seats).toEqual([{ id: "H", name: "Ama", kind: "host" }]);
    expect(t.options.back).toBe(true);
    expect(t.game).toBeNull();
  });

  it("seats guests up to four, then refuses", () => {
    let t = newTable(host);
    t = admit(t, guest("a")).state;
    t = admit(t, guest("b")).state;
    t = admit(t, guest("c")).state;
    expect(t.seats.map((s) => s.kind)).toEqual(["host", "guest", "guest", "guest"]);
    expect(admit(t, guest("d"))).toEqual({ refuse: "full" });
  });

  it("gives a newcomer a bot's chair when the table is full of bots", () => {
    let t = addBot(addBot(addBot(newTable(host))));
    t = admit(t, guest("a", "Kofi")).state;
    expect(t.seats.map((s) => s.kind)).toEqual(["host", "guest", "bot", "bot"]);
    expect(t.seats[1].name).toBe("Kofi");
  });

  it("gives a returning player the seat they had, even mid-round", () => {
    let t = admit(newTable(host), guest("a")).state;
    t = startRound(t);
    expect(admit(t, guest("a")).state).toEqual(t);
    expect(admit(t, guest("z"))).toEqual({ refuse: "running" });
  });

  it("adds bots and players on this device, never past four", () => {
    let t = addLocal(addBot(newTable(host)), "Yaw");
    expect(t.seats.map((s) => s.kind)).toEqual(["host", "bot", "local"]);
    expect(t.seats[2].name).toBe("Yaw");
    t = addBot(t);
    expect(addBot(t)).toBeNull();
    expect(new Set(t.seats.map((s) => s.id)).size).toBe(4);
  });

  it("removes any seat but the host's", () => {
    const t = addBot(newTable(host));
    expect(removeSeat(t, t.seats[1].id).seats).toHaveLength(1);
    expect(removeSeat(t, "H")).toBeNull();
  });

  it("switches a rule in the lobby only", () => {
    const t = setOption(newTable(host), "side", false);
    expect(t.options.side).toBe(false);
    expect(setOption(t, "nonsense", false)).toBeNull();
    expect(setOption(startRound(addBot(t)), "back", false)).toBeNull();
  });
});

describe("rounds", () => {
  it("starts with two to four seats, with the chosen rules", () => {
    expect(startRound(newTable(host))).toBeNull();
    const t = startRound(setOption(addBot(newTable(host)), "home", false));
    expect(t.game.players.map((p) => p.id)).toEqual(["H", t.seats[1].id]);
    expect(t.game.options.home).toBe(false);
    expect(t.round).toBe(1);
  });

  it("goes back to the lobby after a round, without the players who were taken out", () => {
    let t = startRound(admit(addBot(newTable(host)), guest("a")).state);
    t = takeOut(t, "a");
    expect(t.game.players.find((p) => p.id === "a").gone).toBe(true);
    expect(backToLobby(t)).toBeNull(); // two still playing
    t = takeOut(t, t.seats[1].id);
    expect(t.game.phase).toBe("over");
    t = backToLobby(t);
    expect(t.game).toBeNull();
    expect(t.seats.map((s) => s.id)).not.toContain("a");
  });

  it("will not go back to the lobby while a round is running", () => {
    const t = startRound(addBot(newTable(host)));
    expect(backToLobby(t)).toBeNull();
  });
});

describe("the reducer the host runs", () => {
  const reduce = makeReducer({ rollDie: () => 6 });
  const running = () => startRound(admit(newTable(host), guest("g")).state);

  it("lets only the player on turn roll", () => {
    const t = running();
    expect(reduce(t, { t: "roll" }, "g")).toBeNull();
    const after = reduce(t, { t: "roll" }, "H");
    expect(after.game.die).toBe(6);
  });

  it("plays a move and a side-kick decision for the player on turn", () => {
    let t = reduce(running(), { t: "roll" }, "H");
    t = reduce(t, { t: "move", id: t.game.moves[0].id }, "H");
    expect(t.game.pieces[0].at).toBe("ring");
    expect(reduce(t, { t: "side", id: null }, "H")).toBeNull(); // no side kick on offer
  });

  it("returns null for a move the rules reject, so nothing is sent", () => {
    const t = reduce(running(), { t: "roll" }, "H");
    expect(reduce(t, { t: "move", id: 99 }, "H")).toBeNull();
    expect(reduce(t, { t: "dance" }, "H")).toBeNull();
  });

  it("lets the host act for a player on its own device, and nobody else", () => {
    let t = startRound(addLocal(newTable(host), "Yaw"));
    t = reduce(t, { t: "roll" }, "H"); // host rolls 6 ...
    t = reduce(t, { t: "move", id: t.game.moves[0].id }, "H");
    t = reduce(t, { t: "roll" }, "H");
    t = reduce(t, { t: "move", id: t.game.moves[0].id }, "H");
    // Force the turn over to the local seat.
    t.game.turn = 1;
    t.game.awaiting = "roll";
    const local = t.seats[1].id;
    expect(reduce(t, { t: "roll" }, "H")).toBeNull(); // not the host's turn
    expect(reduce(t, { t: "roll", as: local }, "H").game.die).toBe(6);
    expect(reduce(t, { t: "roll", as: local }, "g")).toBeNull();
  });

  it("never acts for a bot: the host drives bots through update, not intents", () => {
    let t = startRound(addBot(newTable(host)));
    t.game.turn = 1;
    expect(reduce(t, { t: "roll", as: t.seats[1].id }, "H")).toBeNull();
  });
});

describe("seatsControlledBy", () => {
  it("gives a guest its own seat, and the host its own and the local ones", () => {
    const t = addBot(addLocal(admit(newTable(host), guest("g")).state, "Yaw"));
    expect(seatsControlledBy(t, "g")).toEqual(["g"]);
    expect(seatsControlledBy(t, "H")).toEqual(["H", t.seats[2].id]);
  });
});

describe("dieFromBytes", () => {
  it("maps a byte to 1-6 and throws away the bytes that would bias it", () => {
    const bytes = [255, 252, 0, 5, 251];
    const next = () => bytes.shift();
    expect(dieFromBytes(next)).toBe(1); // 255 and 252 skipped, 0 -> 1
    expect(dieFromBytes(next)).toBe(6); // 5 -> 6
    expect(dieFromBytes(next)).toBe(6); // 251 % 6 = 5 -> 6
  });

  it("gives every face the same share over all accepted bytes", () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let b = 0; b < 252; b++) counts[dieFromBytes(() => b) - 1]++;
    expect(new Set(counts).size).toBe(1);
  });
});

describe("botStep", () => {
  const pickFirst = (game) => (game.awaiting === "side" ? game.sides[0]?.id ?? null : game.moves[0].id);

  it("rolls, moves and decides for a bot on turn, one step at a time", () => {
    let t = startRound(addBot(newTable(host)));
    t.game.turn = 1;
    t = botStep(t, { rollDie: () => 6, choose: pickFirst });
    expect(t.game.awaiting).toBe("move");
    t = botStep(t, { rollDie: () => 6, choose: pickFirst });
    expect(t.game.pieces.find((p) => p.seat === 2 && p.at === "ring")).toBeDefined();
  });

  it("does nothing when a person is on turn", () => {
    const t = startRound(addBot(newTable(host)));
    expect(botStep(t, { rollDie: () => 6, choose: pickFirst })).toBeNull();
  });
});

describe("forcedStep", () => {
  it("plays the only possible move for a person, so nobody taps for nothing", () => {
    let t = startRound(addBot(newTable(host)));
    t = makeReducer({ rollDie: () => 6 })(t, { t: "roll" }, "H");
    expect(t.game.moves).toHaveLength(1);
    t = forcedStep(t);
    expect(t.game.pieces[0].at).toBe("ring");
  });

  it("leaves a real choice alone, and never plays for a bot", () => {
    let t = startRound(addBot(newTable(host)));
    t.game.pieces[0] = { ...t.game.pieces[0], at: "ring", step: 3 };
    t = makeReducer({ rollDie: () => 6 })(t, { t: "roll" }, "H");
    expect(t.game.moves.length).toBeGreaterThan(1);
    expect(forcedStep(t)).toBeNull();
  });
});
