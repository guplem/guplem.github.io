import { describe, expect, test } from "bun:test";
import {
  DEFAULT_REFRESH,
  REFRESH_CHOICES,
  SEARCH_CALLS_PER_TOKEN,
  SEARCH_BUDGET_PER_MINUTE,
  knownRefresh,
  refreshDue,
  refreshSeconds,
} from "./refresh.js";

describe("REFRESH_CHOICES", () => {
  // An id is written into `board.json` the moment somebody picks one, so it is
  // as permanent as a colour id or a storage key (ADR 0025).
  test("these are the choices, and an id is never renamed", () => {
    expect(REFRESH_CHOICES.map((one) => one.id)).toEqual(["off", "30s", "1m", "5m"]);
  });

  test("every choice has something to say, and only 'off' waits for nothing", () => {
    for (const choice of REFRESH_CHOICES) {
      expect(choice.label.length).toBeGreaterThan(0);
      if (choice.id === "off") expect(choice.seconds).toBe(0);
      else expect(choice.seconds).toBeGreaterThan(0);
    }
  });

  // Asking costs the reader's rate limit, so the board asks only when told to.
  test("the board asks for nothing until the reader turns it on", () => {
    expect(DEFAULT_REFRESH).toBe("off");
    expect(REFRESH_CHOICES[0].id).toBe(DEFAULT_REFRESH);
  });

  // The tightest GitHub budget is the search one: 30 calls a minute, measured
  // live. One refresh spends one search call per token, so the shortest
  // interval decides how many tokens a reader can hold (ADR 0025).
  test("the shortest interval leaves room for ten tokens inside the search budget", () => {
    const shortest = Math.min(...REFRESH_CHOICES.filter((one) => one.seconds > 0).map((one) => one.seconds));
    const perMinute = (60 / shortest) * SEARCH_CALLS_PER_TOKEN * 10;
    expect(perMinute).toBeLessThanOrEqual(SEARCH_BUDGET_PER_MINUTE);
  });
});

describe("knownRefresh", () => {
  test("keeps a choice the board knows", () => {
    expect(knownRefresh("30s")).toBe("30s");
    expect(knownRefresh("5m")).toBe("5m");
  });

  // A choice written by a newer build, or by somebody editing the file by
  // hand, must never leave the board asking GitHub on a schedule nobody chose.
  test("anything else asks for nothing", () => {
    expect(knownRefresh("10ms")).toBe(DEFAULT_REFRESH);
    expect(knownRefresh("")).toBe(DEFAULT_REFRESH);
    expect(knownRefresh(null)).toBe(DEFAULT_REFRESH);
    expect(knownRefresh(30)).toBe(DEFAULT_REFRESH);
  });
});

describe("refreshSeconds", () => {
  test("how long the board waits between questions", () => {
    expect(refreshSeconds("30s")).toBe(30);
    expect(refreshSeconds("1m")).toBe(60);
    expect(refreshSeconds("5m")).toBe(300);
  });

  test("off waits forever, and so does anything it does not know", () => {
    expect(refreshSeconds("off")).toBe(0);
    expect(refreshSeconds("banana")).toBe(0);
  });
});

describe("refreshDue", () => {
  const at = (seconds) => new Date(`2026-09-21T10:00:${String(seconds).padStart(2, "0")}Z`).getTime();

  test("due once the chosen time has passed", () => {
    expect(refreshDue({ choice: "30s", lastAt: at(0), now: at(30) })).toBe(true);
    expect(refreshDue({ choice: "30s", lastAt: at(0), now: at(45) })).toBe(true);
  });

  test("not due before then", () => {
    expect(refreshDue({ choice: "30s", lastAt: at(0), now: at(29) })).toBe(false);
  });

  test("off is never due", () => {
    expect(refreshDue({ choice: "off", lastAt: at(0), now: at(600) })).toBe(false);
  });

  // A board nobody is looking at is a board nobody needs refreshed, and the
  // rate limit is spent all the same. The tick resumes when the tab comes back.
  test("a hidden tab is never due", () => {
    expect(refreshDue({ choice: "30s", lastAt: at(0), now: at(300), hidden: true })).toBe(false);
  });

  // A refresh replaces the board document it just read. While a note is on its
  // way to GitHub, that would race the reader's own typing (ADR 0002).
  test("not due while the board is busy reading or saving", () => {
    expect(refreshDue({ choice: "30s", lastAt: at(0), now: at(300), busy: true })).toBe(false);
  });

  // The board has answered once by the time the tick starts, so this is the
  // safe reading: it means "nothing has been read yet", and that is due.
  test("due when nothing has been read yet", () => {
    expect(refreshDue({ choice: "30s", lastAt: null, now: at(10) })).toBe(true);
    expect(refreshDue({ choice: "off", lastAt: null, now: at(10) })).toBe(false);
  });

  // A machine whose clock moves backwards must not stop the board for hours.
  test("a clock that went backwards is due, not stuck", () => {
    expect(refreshDue({ choice: "30s", lastAt: at(50), now: at(10) })).toBe(true);
  });

  test("never throws, whatever it is handed", () => {
    expect(refreshDue({})).toBe(false);
    expect(refreshDue()).toBe(false);
  });
});
