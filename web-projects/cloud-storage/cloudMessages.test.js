import { describe, expect, test } from "bun:test";
import { describeFailure, describeSync, summariseChecks } from "./cloudMessages.js";

describe("describeFailure (github-work-board, lifted)", () => {
  test("a call that never reached GitHub", () => {
    expect(describeFailure({ status: 0 })).toMatch(/did not reach GitHub/);
  });

  test("a rejected token", () => {
    expect(describeFailure({ status: 401 })).toMatch(/rejected the token/);
  });

  test("a rate limit is a 403 with the opposite advice: wait", () => {
    expect(describeFailure({ status: 403, message: "API rate limit exceeded" })).toMatch(/Wait a few minutes/);
  });

  test("a missing permission names the permission", () => {
    expect(describeFailure({ status: 403, need: "Contents: read and write" })).toContain('"Contents: read and write"');
  });

  test("a 404 says the token may not list the repository", () => {
    expect(describeFailure({ status: 404, need: "Metadata: read" })).toMatch(/repository list/);
  });

  test("a 409 says another device saved first, and that nothing was lost", () => {
    expect(describeFailure({ status: 409 })).toMatch(/Another device saved first/);
  });

  test("anything else carries the number and GitHub's words", () => {
    expect(describeFailure({ status: 500, message: "boom" })).toBe("GitHub answered 500. boom");
  });
});

describe("summariseChecks", () => {
  test("says how many passed, or which one did not", () => {
    expect(summariseChecks([])).toBe("Not connected yet");
    expect(summariseChecks([{ ok: true }, { ok: true }])).toBe("All 2 checks passed");
    expect(summariseChecks([{ ok: true }, { ok: false, label: "Reach the folder" }])).toBe("Reach the folder did not pass");
    expect(summariseChecks([{ ok: false }, { ok: false }, { ok: true }])).toBe("2 of 3 checks did not pass");
  });
});

describe("describeSync (github-work-board ADR 0019, lifted)", () => {
  test("with nothing configured, the data stays on this device, and that is not broken", () => {
    expect(describeSync([], { configured: false, asked: true })).toEqual({
      state: "local",
      label: "This device only",
      detail: "No cloud storage is set up. Everything is saved in this browser.",
    });
  });

  test("while the checks run", () => {
    expect(describeSync([], { configured: true, asked: false }).state).toBe("checking");
  });

  test("the folder check answers for the whole thing", () => {
    const rows = [
      { id: "identity", ok: true },
      { id: "repository", ok: true },
      { id: "folder", ok: true, detail: "me/triunity-studios-data" },
    ];
    expect(describeSync(rows, { configured: true, asked: true })).toEqual({
      state: "ok",
      label: "Saving to the cloud",
      detail: "me/triunity-studios-data",
    });
  });

  test("a failed check is broken, with the sentence that names the fix", () => {
    const rows = [{ id: "identity", ok: false, detail: "GitHub rejected the token." }];
    const said = describeSync(rows, { configured: true, asked: true });
    expect(said.state).toBe("broken");
    expect(said.label).toBe("Not saving");
    expect(said.detail).toBe("GitHub rejected the token.");
  });

  test("configured but no check reached the folder is broken too", () => {
    const said = describeSync([{ id: "identity", ok: true }], { configured: true, asked: true });
    expect(said.state).toBe("broken");
  });
});
