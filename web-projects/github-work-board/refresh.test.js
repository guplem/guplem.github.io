import { describe, expect, test } from "bun:test";
import {
  DEFAULT_REFRESH,
  OFF,
  REFRESH_CHOICES,
  GRAPHQL_BUDGET_PER_HOUR,
  GRAPHQL_POINTS_PER_TOKEN,
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

  // A board left open goes stale, and the reader cannot tell a quiet day from a
  // board that stopped asking. So it asks by itself, and it asks every minute
  // rather than every 30 seconds: the board also asks the moment a hidden tab
  // is looked at again, so the interval only decides how fresh the board stays
  // while somebody watches it, and a minute is fresh enough for work that
  // moves in hours (ADR 0025).
  test("the board asks every minute unless the reader says otherwise", () => {
    expect(DEFAULT_REFRESH).toBe("1m");
  });

  // "Off" and "the default" were the same string once, and one line in
  // `app.js` read `state.refreshId === DEFAULT_REFRESH` to mean "off". The day
  // the default stopped being "off" that line inverted: the timer would never
  // start on the default and would start, uselessly, on "off". Nothing would
  // have failed.
  test("off is its own thing, and is not whatever the default happens to be", () => {
    expect(OFF).toBe("off");
    expect(OFF).not.toBe(DEFAULT_REFRESH);
    expect(REFRESH_CHOICES[0].id).toBe(OFF);
    expect(refreshSeconds(OFF)).toBe(0);
  });

  test("the default is a schedule the board actually knows", () => {
    expect(REFRESH_CHOICES.map((one) => one.id)).toContain(DEFAULT_REFRESH);
    expect(refreshSeconds(DEFAULT_REFRESH)).toBeGreaterThan(0);
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

  test("off waits forever", () => {
    expect(refreshSeconds(OFF)).toBe(0);
  });

  // A schedule this build cannot read is treated as no choice at all, which is
  // the default. Reading it as "off" would quietly switch a feature off that
  // the reader had switched on, which is the worse of the two mistakes.
  test("a schedule it does not know is treated as no choice, so the default", () => {
    expect(refreshSeconds("banana")).toBe(refreshSeconds(DEFAULT_REFRESH));
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

  // A call that says nothing about the schedule must not start a call to
  // GitHub, whatever the default schedule happens to be.
  test("never throws, and asks nothing, whatever it is handed", () => {
    expect(refreshDue({})).toBe(false);
    expect(refreshDue()).toBe(false);
  });
});

describe("what the default costs the reader (ADR 0025)", () => {
  // Measured against the live API: 5000 REST calls an hour, and one refresh
  // spends 5 of them for each token. A reader with three tokens who leaves the
  // board open on a second screen all day is the case that decides this.
  test("three tokens on the default stay well inside the hourly budget", () => {
    const perHour = (3600 / refreshSeconds(DEFAULT_REFRESH)) * 5 * 3;
    expect(perHour).toBeLessThanOrEqual(5000 * 0.2);
  });

  // GraphQL is charged by how much a query could return. The board asks for the
  // links, and then once more for the children of any issue that has them, so
  // the arithmetic has to hold for both calls at the largest batch there is.
  test("the biggest board on the shortest schedule stays inside the GraphQL budget", () => {
    const shortest = Math.min(...REFRESH_CHOICES.filter((one) => one.seconds > 0).map((one) => one.seconds));
    const perHour = (3600 / shortest) * GRAPHQL_POINTS_PER_TOKEN;
    expect(perHour).toBeLessThanOrEqual(GRAPHQL_BUDGET_PER_HOUR);
  });

  test("the default costs a third of the GraphQL budget at its very worst", () => {
    const perHour = (3600 / refreshSeconds(DEFAULT_REFRESH)) * GRAPHQL_POINTS_PER_TOKEN;
    expect(perHour).toBeLessThanOrEqual(GRAPHQL_BUDGET_PER_HOUR * 0.35);
  });

  // The tight budget is per minute, not per hour.
  test("the default leaves the per-minute search budget almost untouched", () => {
    const perMinute = (60 / refreshSeconds(DEFAULT_REFRESH)) * SEARCH_CALLS_PER_TOKEN * 3;
    expect(perMinute).toBeLessThanOrEqual(SEARCH_BUDGET_PER_MINUTE * 0.2);
  });
});
