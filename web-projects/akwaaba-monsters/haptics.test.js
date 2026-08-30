import { describe, test, expect } from "bun:test";
import { Haptics, HAPTICS_KEY, BUZZ_MS } from "./haptics.js";

/** A stand-in for `localStorage` that keeps its values in memory. */
function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

/** A stand-in for `navigator.vibrate` that records what it was asked to do. */
function fakeVibrate() {
  const calls = [];
  const vibrate = (ms) => {
    calls.push(ms);
    return true;
  };
  vibrate.calls = calls;
  return vibrate;
}

describe("Haptics", () => {
  test("buzzes for one press, and keeps the buzz short", () => {
    const vibrate = fakeVibrate();
    const haptics = new Haptics({ storage: fakeStorage(), vibrate });
    haptics.buzz();
    expect(vibrate.calls).toEqual([BUZZ_MS]);
    expect(BUZZ_MS).toBeLessThanOrEqual(20);
  });

  test("starts switched on", () => {
    const haptics = new Haptics({ storage: fakeStorage(), vibrate: fakeVibrate() });
    expect(haptics.enabled).toBe(true);
  });

  test("stays quiet when the player switched it off", () => {
    const vibrate = fakeVibrate();
    const haptics = new Haptics({ storage: fakeStorage(), vibrate });
    haptics.setEnabled(false);
    haptics.buzz();
    expect(vibrate.calls).toEqual([]);
  });

  test("remembers the setting for the next visit", () => {
    const storage = fakeStorage();
    new Haptics({ storage, vibrate: fakeVibrate() }).toggle();
    expect(storage.getItem(HAPTICS_KEY)).toBe("0");
    expect(new Haptics({ storage, vibrate: fakeVibrate() }).enabled).toBe(false);
  });

  test("toggle reports the setting it landed on", () => {
    const haptics = new Haptics({ storage: fakeStorage(), vibrate: fakeVibrate() });
    expect(haptics.toggle()).toBe(false);
    expect(haptics.toggle()).toBe(true);
  });

  test("reports no support when the browser cannot vibrate", () => {
    const haptics = new Haptics({ storage: fakeStorage(), vibrate: null });
    expect(haptics.supported).toBe(false);
    expect(() => haptics.buzz()).not.toThrow();
    expect(haptics.buzz()).toBe(false);
  });

  test("survives a browser that refuses to vibrate", () => {
    const haptics = new Haptics({
      storage: fakeStorage(),
      vibrate: () => {
        throw new Error("refused");
      },
    });
    expect(haptics.buzz()).toBe(false);
  });

  test("survives storage that refuses to answer", () => {
    const angry = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    const haptics = new Haptics({ storage: angry, vibrate: fakeVibrate() });
    expect(haptics.enabled).toBe(true);
    expect(() => haptics.setEnabled(false)).not.toThrow();
    expect(haptics.enabled).toBe(false);
  });
});
