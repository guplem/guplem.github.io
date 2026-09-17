import { describe, expect, test } from "bun:test";
import { CONNECTION_CHECKS, PERMISSIONS, describeFailure } from "./githubErrors.js";

describe("CONNECTION_CHECKS", () => {
  test("every check has a unique id and names the permission it needs", () => {
    const ids = CONNECTION_CHECKS.map((check) => check.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const check of CONNECTION_CHECKS) {
      expect(check.label.length).toBeGreaterThan(0);
      expect(Object.values(PERMISSIONS)).toContain(check.need);
    }
  });
});

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
    const sentence = describeFailure({ status: 404, message: "Not Found", need: PERMISSIONS.contentsWrite });
    expect(sentence).toContain(PERMISSIONS.contentsWrite);
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
