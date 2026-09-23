import { describe, expect, test } from "bun:test";
import { describeFailure, describeMissingPermission } from "./githubErrors.js";
import { PERMISSIONS } from "./permissions.js";

describe("describeFailure", () => {
  // GitHub answers a missing fine-grained permission with "Resource not
  // accessible by personal access token", which tells the reader nothing about
  // which permission to add. Naming it is the whole job of this module.
  test("names the missing permission on a refusal", () => {
    const sentence = describeFailure({
      status: 403,
      message: "Resource not accessible by personal access token",
      need: PERMISSIONS.issuesRead,
    });
    expect(sentence).toContain(PERMISSIONS.issuesRead);
    expect(sentence).not.toContain("Resource not accessible");
  });

  test("tells the reader to make a new token when the old one is rejected", () => {
    const sentence = describeFailure({ status: 401, message: "Bad credentials" });
    expect(sentence.toLowerCase()).toContain("token");
    expect(sentence.toLowerCase()).toContain("new one");
  });

  // A rate limit is also a 403, and the advice is the opposite: wait, do not
  // go and change the token.
  test("tells a rate limit apart from a missing permission", () => {
    const sentence = describeFailure({
      status: 403,
      message: "API rate limit exceeded for user ID 1.",
      need: PERMISSIONS.issuesRead,
    });
    expect(sentence.toLowerCase()).toContain("wait");
    expect(sentence).not.toContain(PERMISSIONS.issuesRead);
  });

  test("explains that a 404 can mean the token cannot see it", () => {
    const sentence = describeFailure({ status: 404, message: "Not Found", need: PERMISSIONS.issuesRead });
    expect(sentence).toContain(PERMISSIONS.issuesRead);
    expect(sentence.toLowerCase()).toContain("list");
  });

  test("explains a save conflict as another device having saved first", () => {
    expect(describeFailure({ status: 409, message: "is at abc but expected def" }).toLowerCase()).toContain(
      "another device",
    );
  });

  test("says the call never reached GitHub when there is no status", () => {
    expect(describeFailure({ status: 0, message: "Failed to fetch" }).toLowerCase()).toContain("connection");
  });

  test("falls back to the status and GitHub's own words", () => {
    const sentence = describeFailure({ status: 500, message: "Server Error" });
    expect(sentence).toContain("500");
    expect(sentence).toContain("Server Error");
  });

  test("never throws, whatever it is handed", () => {
    for (const junk of [null, undefined, {}, "boom", 7]) {
      expect(typeof describeFailure(junk)).toBe("string");
      expect(describeFailure(junk).length).toBeGreaterThan(0);
    }
  });
});

describe("describeMissingPermission", () => {
  const actions = { id: "actions", name: "Actions", level: "Read-only", why: "x", without: "Without it, the board cannot read the checks." };

  // GitHub says "Resource not accessible by personal access token" and names
  // neither the permission nor the level. The reader is looking at a form with
  // forty permissions on it, so the row has to name the exact one and its
  // exact level, spelled the way that form spells it (ADR 0005).
  test("a refusal names the permission, the level, and what is lost", () => {
    const said = describeMissingPermission({ status: 403, message: "Resource not accessible" }, actions);
    expect(said).toContain("Actions");
    expect(said).toContain("Read-only");
    expect(said).toContain("Without it, the board cannot read the checks.");
  });

  // A rate limit is a 403 too, and the advice is the opposite: wait, do not go
  // and change the token.
  test("a rate limit is not a missing permission", () => {
    const said = describeMissingPermission({ status: 403, message: "API rate limit exceeded" }, actions);
    expect(said).not.toContain("Read-only");
    expect(said).toContain("Wait");
  });

  test("a dead token, or no network, says that instead", () => {
    expect(describeMissingPermission({ status: 401 }, actions)).toContain("rejected the token");
    expect(describeMissingPermission({ status: 0 }, actions)).toContain("did not reach GitHub");
  });

  // A 404 on a fine-grained token is usually the repository list, not the
  // permission, and both are worth saying.
  test("a 404 names the repository list and the permission", () => {
    const said = describeMissingPermission({ status: 404 }, actions);
    expect(said).toContain("repository list");
    expect(said).toContain("Actions");
  });

  test("no permission to name still answers", () => {
    expect(describeMissingPermission({ status: 403 }, null).length).toBeGreaterThan(0);
  });
});
