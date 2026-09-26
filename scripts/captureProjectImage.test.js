// Tests for the portfolio image capture script.
//
// The browser part is not tested here. These tests pin the two choices that
// decide which picture comes out: the flags, and which button a label presses.

import { describe, expect, test } from "bun:test";
import { parseCaptureArgs, pickButtonIndex } from "./captureProjectImage.js";

describe("parseCaptureArgs", () => {
  test("reads every flag and keeps the clicks in order", () => {
    const parsed = parseCaptureArgs([
      "--page", "web-projects/demo/", "--out", "out.webp",
      "--click", "First", "--click", "Second", "--width", "1200", "--height", "700", "--wait", "100", "--quality", "70",
    ]);
    expect(parsed).toEqual({
      page: "web-projects/demo/", out: "out.webp", clicks: ["First", "Second"],
      width: 1200, height: 700, waitMs: 100, quality: 70,
    });
  });

  test("uses the portfolio defaults when only the page and the file are given", () => {
    const parsed = parseCaptureArgs(["--page", "a/", "--out", "b.webp"]);
    expect(parsed).toMatchObject({ clicks: [], width: 1600, height: 900 });
  });

  test("refuses a run without a page or an output file", () => {
    expect(() => parseCaptureArgs(["--page", "a/"])).toThrow("required");
  });

  test("refuses an unknown flag, so a typo cannot be ignored", () => {
    expect(() => parseCaptureArgs(["--page", "a/", "--out", "b.webp", "--clik", "Go"])).toThrow("Unknown flag");
  });
});

describe("pickButtonIndex", () => {
  const buttons = ["Fires", "Weather (wind)", "+6h", "+12h", "Berguedà slope — 3.4 km from Berga"];

  test("an exact label wins over a partial one", () => {
    expect(pickButtonIndex(buttons, "Fires")).toBe(0);
  });

  test("a label inside one button's text presses that button", () => {
    expect(pickButtonIndex(buttons, "Berguedà")).toBe(4);
  });

  test("a label that matches no button stops the run", () => {
    expect(() => pickButtonIndex(buttons, "Spread")).toThrow("No button");
  });

  test("a label inside several buttons stops the run", () => {
    expect(() => pickButtonIndex(buttons, "h")).toThrow("buttons contain");
  });
});
