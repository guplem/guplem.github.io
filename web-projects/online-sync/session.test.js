import { describe, expect, it } from "bun:test";
import { loopbackPair } from "./link.js";
import { createGuest, createHost } from "./session.js";

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

// A tiny game: a shared counter, a list of seated names, and a cap of two
// guests. Only a seated player may add, and only by 1 to 3.
const counterGame = {
  state: { count: 0, seated: [] },
  apply(state, intent, playerId) {
    if (intent.t !== "add" || !state.seated.includes(playerId)) return null;
    if (intent.n < 1 || intent.n > 3) return null;
    state.count += intent.n;
    return state;
  },
  admit(state, player) {
    if (state.seated.includes(player.id)) return { state };
    if (state.seated.length >= 3) return { refuse: "full" };
    return { state: { ...state, seated: [...state.seated, player.id] } };
  },
};

function makeHost(extra = {}) {
  const changes = [];
  const host = createHost({
    app: "counter",
    room: "ROOM01",
    self: { id: "h", name: "Host" },
    state: structuredClone(counterGame.state),
    apply: counterGame.apply,
    admit: counterGame.admit,
    onChange: (c) => changes.push(c),
    ...extra,
  });
  return { host, changes };
}

function join(host, self, extra = {}) {
  const [hostEnd, guestEnd] = loopbackPair();
  host.connect(hostEnd);
  const seen = { changes: [], refused: null, closed: null };
  const guest = createGuest({
    app: "counter",
    self,
    link: guestEnd,
    onChange: (c) => seen.changes.push(c),
    onRefuse: (reason) => (seen.refused = reason),
    onClose: (reason) => (seen.closed = reason),
    ...extra,
  });
  return { guest, seen, hostEnd, guestEnd };
}

describe("joining", () => {
  it("welcomes a guest, seats it through admit, and sends it the state", async () => {
    const { host } = makeHost();
    host.update((s) => ({ ...s, seated: ["h"] }));
    const { guest } = join(host, { id: "g1", name: "Ama" });
    await settle();

    expect(guest.status).toBe("live");
    expect(guest.room).toBe("ROOM01");
    expect(guest.hostId).toBe("h");
    expect(guest.state.seated).toEqual(["h", "g1"]);
    expect(guest.version).toBe(host.version);
    expect(host.peers.map((p) => [p.id, p.name, p.status])).toEqual([
      ["h", "Host", "live"],
      ["g1", "Ama", "live"],
    ]);
    expect(guest.peers.map((p) => p.id)).toEqual(["h", "g1"]);
  });

  it("refuses a guest that admit turns away, and closes the link", async () => {
    const { host } = makeHost();
    host.update((s) => ({ ...s, seated: ["a", "b", "c"] }));
    const { guest, seen } = join(host, { id: "g1", name: "Kofi" });
    await settle();

    expect(seen.refused).toBe("full");
    expect(guest.status).toBe("closed");
    expect(host.peers.map((p) => p.id)).toEqual(["h"]);
  });

  it("refuses an invite meant for another app", async () => {
    const { host } = makeHost();
    const { seen } = join(host, { id: "g1", name: "Esi" }, { app: "chess" });
    await settle();
    expect(seen.refused).toBe("app");
  });

  it("gives a second tab of the same browser a fresh id instead of taking the seat", async () => {
    const { host } = makeHost();
    const first = join(host, { id: "same", name: "Ama" });
    await settle();
    const ids = [];
    const second = join(host, { id: "same", name: "Ama 2" }, { freshId: () => "fresh", onIdChange: (id) => ids.push(id) });
    await settle();

    expect(first.guest.status).toBe("live");
    expect(second.guest.status).toBe("live");
    expect(second.guest.self.id).toBe("fresh");
    expect(ids).toEqual(["fresh"]);
    expect(host.peers.map((p) => p.id)).toEqual(["h", "same", "fresh"]);
  });
});

describe("intents", () => {
  it("applies a guest's intent on the host and sends the result to everybody", async () => {
    const { host } = makeHost();
    const a = join(host, { id: "a", name: "A" });
    const b = join(host, { id: "b", name: "B" });
    await settle();
    const before = host.version;

    a.guest.dispatch({ t: "add", n: 2 });
    await settle();

    expect(host.state.count).toBe(2);
    expect(host.version).toBe(before + 1);
    expect(a.guest.state.count).toBe(2);
    expect(b.guest.state.count).toBe(2);
    expect(b.guest.version).toBe(host.version);
  });

  it("ignores an intent the game rejects, and changes nothing", async () => {
    const { host } = makeHost();
    const a = join(host, { id: "a", name: "A" });
    await settle();
    const before = host.version;

    a.guest.dispatch({ t: "add", n: 9 });
    await settle();

    expect(host.state.count).toBe(0);
    expect(host.version).toBe(before);
  });

  it("gives the reducer a copy, so a rejected intent that mutated it leaves no trace", async () => {
    const { host } = makeHost({
      apply(state) {
        state.count = 999; // a sloppy reducer
        return null;
      },
    });
    const a = join(host, { id: "a", name: "A" });
    await settle();
    a.guest.dispatch({ t: "anything" });
    await settle();
    expect(host.state.count).toBe(0);
  });

  it("names the sender from the link, never from the message", async () => {
    const seenIds = [];
    const { host } = makeHost({
      apply(state, intent, playerId) {
        seenIds.push(playerId);
        return null;
      },
    });
    const a = join(host, { id: "a", name: "A" });
    await settle();
    a.guest.dispatch({ t: "add", n: 1, playerId: "h" });
    await settle();
    expect(seenIds).toEqual(["a"]);
  });

  it("runs the host's own intents through the same reducer, as the host's id", async () => {
    const { host } = makeHost();
    host.update((s) => ({ ...s, seated: ["h"] }));
    const a = join(host, { id: "a", name: "A" });
    await settle();
    expect(host.dispatch({ t: "add", n: 3 })).toBe(true);
    await settle();
    expect(a.guest.state.count).toBe(3);
    expect(host.dispatch({ t: "add", n: 7 })).toBe(false);
  });

  it("drops an intent sent before the welcome", async () => {
    const { host } = makeHost();
    const [hostEnd, guestEnd] = loopbackPair();
    host.connect(hostEnd);
    guestEnd.send({ t: "intent", i: { t: "add", n: 1 } });
    await settle();
    expect(host.state.count).toBe(0);
  });
});

describe("presence and leaving", () => {
  it("marks a peer quiet and closed as its link reports it, and tells everybody", async () => {
    const { host, changes } = makeHost();
    const a = join(host, { id: "a", name: "A" });
    const b = join(host, { id: "b", name: "B" });
    await settle();

    a.guestEnd.close();
    await settle();

    expect(host.peers.find((p) => p.id === "a").status).toBe("closed");
    expect(b.guest.peers.find((p) => p.id === "a").status).toBe("closed");
    expect(changes.at(-1).peers.find((p) => p.id === "a").status).toBe("closed");
  });

  it("takes a returning player back into the same peer on a new link", async () => {
    const { host } = makeHost();
    const first = join(host, { id: "a", name: "A" });
    await settle();
    first.guestEnd.close();
    await settle();

    const again = join(host, { id: "a", name: "A" });
    await settle();

    expect(again.guest.status).toBe("live");
    expect(host.peers.filter((p) => p.id === "a")).toHaveLength(1);
    expect(host.peers.find((p) => p.id === "a").status).toBe("live");
    expect(host.state.seated.filter((id) => id === "a")).toHaveLength(1);
  });

  it("drops a player: says why, closes the link, forgets the peer", async () => {
    const { host } = makeHost();
    const a = join(host, { id: "a", name: "A" });
    await settle();

    host.drop("a", "removed");
    await settle();

    expect(a.seen.closed).toBe("removed");
    expect(a.guest.status).toBe("closed");
    expect(host.peers.map((p) => p.id)).toEqual(["h"]);
  });

  it("says goodbye to everybody when the host closes the table", async () => {
    const { host } = makeHost();
    const a = join(host, { id: "a", name: "A" });
    await settle();
    host.close();
    await settle();
    expect(a.seen.closed).toBe("host-left");
  });
});

describe("versions and restoring", () => {
  it("lets a guest ignore a state older than the one it holds", async () => {
    const { host } = makeHost();
    const a = join(host, { id: "a", name: "A" });
    await settle();
    host.update((s) => ({ ...s, count: 5 }));
    await settle();
    a.hostEnd.send({ t: "state", v: 1, s: { count: -1, seated: [] } });
    await settle();
    expect(a.guest.state.count).toBe(5);
  });

  it("takes the board back from a guest when the host lost it", async () => {
    // The host reloaded with nothing; a guest still holds version 12.
    const { host } = makeHost({ state: { count: 0, seated: [] }, version: 0 });
    const held = { count: 40, seated: ["a"] };
    const a = join(host, { id: "a", name: "A" }, { state: held, version: 12 });
    await settle();

    expect(host.state.count).toBe(40);
    expect(host.version).toBeGreaterThanOrEqual(12);
    expect(a.guest.state.count).toBe(40);
  });

  it("keeps its own board when it is newer than the guest's", async () => {
    const { host } = makeHost({ state: { count: 7, seated: ["a"] }, version: 20 });
    const a = join(host, { id: "a", name: "A" }, { state: { count: 1, seated: ["a"] }, version: 3 });
    await settle();
    expect(host.state.count).toBe(7);
    expect(a.guest.state.count).toBe(7);
  });
});
