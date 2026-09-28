import { describe, expect, it } from "bun:test";
import { listenForAnswers, relayAnswer } from "./relay.js";

/** BroadcastChannel stand-in: every channel with a name hears the others. */
function fakeChannels() {
  const byName = new Map();
  return (name) => {
    const channel = {
      onmessage: null,
      postMessage(data) {
        (byName.get(name) ?? []).forEach((other) => {
          if (other !== channel) other.onmessage?.({ data });
        });
      },
      close() {
        byName.set(
          name,
          (byName.get(name) ?? []).filter((c) => c !== channel),
        );
      },
    };
    byName.set(name, [...(byName.get(name) ?? []), channel]);
    return channel;
  };
}

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function fakeTarget() {
  const handlers = new Map();
  return {
    addEventListener: (type, fn) => handlers.set(type, [...(handlers.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => handlers.set(type, (handlers.get(type) ?? []).filter((h) => h !== fn)),
    fire: (type, event = {}) => (handlers.get(type) ?? []).forEach((fn) => fn(event)),
  };
}

describe("relayAnswer and listenForAnswers", () => {
  it("hands an answer opened in a new tab to the tab that holds the table", () => {
    const channelFactory = fakeChannels();
    const storage = fakeStorage();
    const got = [];
    listenForAnswers({ app: "ludo", onAnswer: (c) => got.push(c), channelFactory, storage, target: fakeTarget() });

    relayAnswer({ app: "ludo", code: "ANSWER1", channelFactory, storage });
    expect(got).toEqual(["ANSWER1"]);
  });

  it("keeps the answer for a table tab that was asleep, and gives it once it wakes", () => {
    const channelFactory = fakeChannels();
    const storage = fakeStorage();
    // Written while no table tab was listening.
    relayAnswer({ app: "ludo", code: "LATE", channelFactory, storage });

    const target = fakeTarget();
    const got = [];
    listenForAnswers({ app: "ludo", onAnswer: (c) => got.push(c), channelFactory, storage, target });
    expect(got).toEqual(["LATE"]); // read at start

    target.fire("visibilitychange");
    expect(got).toEqual(["LATE"]); // and never twice
  });

  it("reads answers written by another tab when the storage event fires", () => {
    const channelFactory = fakeChannels();
    const storage = fakeStorage();
    const target = fakeTarget();
    const got = [];
    listenForAnswers({ app: "ludo", onAnswer: (c) => got.push(c), channelFactory: () => ({ close() {} }), storage, target });

    relayAnswer({ app: "ludo", code: "VIA_STORAGE", channelFactory, storage });
    target.fire("storage", { key: "online-sync.ludo.answers" });
    expect(got).toEqual(["VIA_STORAGE"]);
  });

  it("keeps apps apart and forgets answers older than ten minutes", () => {
    const channelFactory = fakeChannels();
    const storage = fakeStorage();
    let clock = 0;
    relayAnswer({ app: "chess", code: "OTHER", channelFactory, storage, now: () => clock });
    relayAnswer({ app: "ludo", code: "OLD", channelFactory, storage, now: () => clock });
    clock = 11 * 60 * 1000;

    const got = [];
    listenForAnswers({
      app: "ludo",
      onAnswer: (c) => got.push(c),
      channelFactory,
      storage,
      target: fakeTarget(),
      now: () => clock,
    });
    expect(got).toEqual([]);
  });

  it("stops listening when asked", () => {
    const channelFactory = fakeChannels();
    const storage = fakeStorage();
    const got = [];
    const stop = listenForAnswers({ app: "ludo", onAnswer: (c) => got.push(c), channelFactory, storage, target: fakeTarget() });
    stop();
    relayAnswer({ app: "ludo", code: "AFTER", channelFactory, storage });
    expect(got).toEqual([]);
  });

  it("never throws when storage or BroadcastChannel is missing", () => {
    const broken = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    expect(relayAnswer({ app: "ludo", code: "X", channelFactory: null, storage: broken })).toBe(false);
    expect(() =>
      listenForAnswers({ app: "ludo", onAnswer() {}, channelFactory: null, storage: broken, target: fakeTarget() }),
    ).not.toThrow();
  });
});
