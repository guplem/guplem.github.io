import { describe, test, expect } from "bun:test";
import { readMode, modeSearch, feedUrl, DEFAULT_MODE } from "./mode.js";

describe("readMode", () => {
  test("defaults to real data", () => {
    expect(DEFAULT_MODE).toBe("real");
    expect(readMode("")).toBe("real");
  });
  test("reads the demo mode from the link", () => {
    expect(readMode("?mode=demo")).toBe("demo");
  });
  test("ignores a value it does not know", () => {
    expect(readMode("?mode=fake")).toBe("real");
  });
});

describe("modeSearch", () => {
  test("drops the parameter for the default mode, so the plain link stays plain", () => {
    expect(modeSearch("?mode=demo", "real")).toBe("");
  });
  test("keeps other parameters", () => {
    expect(modeSearch("?x=1", "demo")).toBe("?x=1&mode=demo");
  });
});

describe("feedUrl", () => {
  const PUBLISHED = "https://raw.githubusercontent.com/guplem/guplem.github.io/wildfire-feed/fires.json";
  test("uses the published feed on the live site, whatever the link says", () => {
    expect(feedUrl("?feed=https://evil.example/fires.json", "triunitystudios.com")).toBe(PUBLISHED);
  });
  test("lets a developer point a local copy at a test feed", () => {
    expect(feedUrl("?feed=/tmp/fires.json", "localhost")).toBe("/tmp/fires.json");
    expect(feedUrl("", "127.0.0.1")).toBe(PUBLISHED);
  });
});
