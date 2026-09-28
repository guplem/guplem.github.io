import { describe, expect, it } from "bun:test";
import { loopbackPair, wrapChannel } from "./link.js";

/** A stand-in for RTCDataChannel: what one side sends, the test reads. */
function fakeChannel() {
  const channel = {
    readyState: "open",
    sent: [],
    onmessage: null,
    onclose: null,
    send(text) {
      if (channel.readyState !== "open") throw new Error("closed");
      channel.sent.push(JSON.parse(text));
    },
    close() {
      channel.readyState = "closed";
      channel.onclose?.();
    },
    receive(obj) {
      channel.onmessage?.({ data: JSON.stringify(obj) });
    },
  };
  return channel;
}

/** Timers the test moves by hand. */
function fakeTimers() {
  let now = 0;
  const intervals = new Map();
  let nextId = 1;
  return {
    now: () => now,
    setInterval(fn, ms) {
      const id = nextId++;
      intervals.set(id, { fn, ms, due: now + ms });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...intervals.values()].filter((t) => t.due <= end).sort((a, b) => a.due - b.due)[0];
        if (!next) break;
        now = next.due;
        next.due += next.ms;
        next.fn();
      }
      now = end;
    },
    get active() {
      return intervals.size;
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("wrapChannel", () => {
  it("sends objects as JSON and hands incoming objects to the listener", () => {
    const channel = fakeChannel();
    const link = wrapChannel(channel, { timers: fakeTimers() });
    const got = [];
    link.listen({ message: (m) => got.push(m) });

    expect(link.send({ t: "hello", n: 1 })).toBe(true);
    channel.receive({ t: "state", v: 2 });

    expect(channel.sent).toEqual([{ t: "hello", n: 1 }]);
    expect(got).toEqual([{ t: "state", v: 2 }]);
  });

  it("ignores text that is not JSON instead of throwing", () => {
    const channel = fakeChannel();
    const link = wrapChannel(channel, { timers: fakeTimers() });
    const got = [];
    link.listen({ message: (m) => got.push(m) });
    channel.onmessage({ data: "{not json" });
    expect(got).toEqual([]);
  });

  it("beats while idle, and keeps the beat away from the listener", () => {
    const channel = fakeChannel();
    const timers = fakeTimers();
    const link = wrapChannel(channel, { timers, beatMs: 1000, quietMs: 5000 });
    const got = [];
    link.listen({ message: (m) => got.push(m) });

    timers.advance(3000);
    expect(channel.sent.filter((m) => m["~"] === 1)).toHaveLength(3);

    channel.receive({ "~": 1 });
    expect(got).toEqual([]);
  });

  it("turns quiet when the other side stops talking, and live again when it speaks", () => {
    const channel = fakeChannel();
    const timers = fakeTimers();
    const link = wrapChannel(channel, { timers, beatMs: 1000, quietMs: 5000 });
    const statuses = [];
    link.listen({ status: (s) => statuses.push(s) });

    timers.advance(4000);
    expect(link.status).toBe("live");
    timers.advance(2000);
    expect(link.status).toBe("quiet");

    channel.receive({ "~": 1 });
    expect(link.status).toBe("live");
    expect(statuses).toEqual(["quiet", "live"]);
  });

  it("reports closed once, stops its timer, and refuses to send after", () => {
    const channel = fakeChannel();
    const timers = fakeTimers();
    const link = wrapChannel(channel, { timers });
    const statuses = [];
    link.listen({ status: (s) => statuses.push(s) });

    channel.close();
    link.close();

    expect(statuses).toEqual(["closed"]);
    expect(link.status).toBe("closed");
    expect(timers.active).toBe(0);
    expect(link.send({ t: "late" })).toBe(false);
  });

  it("lets a listener stop listening", () => {
    const channel = fakeChannel();
    const link = wrapChannel(channel, { timers: fakeTimers() });
    const got = [];
    const stop = link.listen({ message: (m) => got.push(m) });
    stop();
    channel.receive({ t: "x" });
    expect(got).toEqual([]);
  });
});

describe("loopbackPair", () => {
  it("delivers each side's messages to the other, after the current task", async () => {
    const [a, b] = loopbackPair();
    const atB = [];
    b.listen({ message: (m) => atB.push(m) });

    a.send({ t: "one" });
    expect(atB).toEqual([]); // never re-entrant
    await settle();
    expect(atB).toEqual([{ t: "one" }]);
  });

  it("delivers a copy, so neither side can change the other's object", async () => {
    const [a, b] = loopbackPair();
    let received;
    b.listen({ message: (m) => (received = m) });
    const sent = { list: [1] };
    a.send(sent);
    await settle();
    sent.list.push(2);
    expect(received).toEqual({ list: [1] });
  });

  it("closes both ends together", async () => {
    const [a, b] = loopbackPair();
    const statuses = [];
    b.listen({ status: (s) => statuses.push(s) });
    a.close();
    await settle();
    expect(a.status).toBe("closed");
    expect(b.status).toBe("closed");
    expect(statuses).toEqual(["closed"]);
    expect(a.send({ t: "x" })).toBe(false);
  });
});
