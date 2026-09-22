import { describe, expect, test } from "bun:test";
import {
  CONNECTION_CHECKS,
  PERMISSIONS,
  REQUIRED_PERMISSIONS,
  newPermissionsSince,
  permissionsFingerprint,
  tokenNeedsUpdate,
} from "./cloudPermissions.js";

describe("the permission list (github-work-board ADR 0005, lifted)", () => {
  test("asks for exactly what a file in a private repository needs", () => {
    expect(REQUIRED_PERMISSIONS.map((one) => `${one.id}:${one.level}`)).toEqual([
      "metadata:Read-only",
      "contents:Read and write",
    ]);
    for (const one of REQUIRED_PERMISSIONS) expect(one.why.length).toBeGreaterThan(0);
  });

  test("names the permission a failed call needs the way GitHub's form does", () => {
    expect(PERMISSIONS.metadata).toBe("Metadata: read");
    expect(PERMISSIONS.contentsWrite).toBe("Contents: read and write");
  });

  test("the checks prove identity, the repository, and the folder, in that order", () => {
    expect(CONNECTION_CHECKS.map((one) => one.id)).toEqual(["identity", "repository", "folder"]);
    for (const one of CONNECTION_CHECKS) expect(Object.values(PERMISSIONS)).toContain(one.need);
  });
});

describe("permissionsFingerprint", () => {
  test("ignores the order and the wording of why", () => {
    const a = permissionsFingerprint([
      { id: "b", level: "Read-only", why: "one" },
      { id: "a", level: "Read and write", why: "two" },
    ]);
    const b = permissionsFingerprint([
      { id: "a", level: "Read and write", why: "rewritten" },
      { id: "b", level: "Read-only", why: "rewritten" },
    ]);
    expect(a).toBe(b);
    expect(a).toBe("a:read and write|b:read-only");
  });
});

describe("tokenNeedsUpdate", () => {
  test("a reader who never connected is not out of date", () => {
    expect(tokenNeedsUpdate(null)).toBe(false);
    expect(tokenNeedsUpdate("")).toBe(false);
  });

  test("a token approved against an older list needs a visit to GitHub", () => {
    expect(tokenNeedsUpdate(permissionsFingerprint())).toBe(false);
    expect(tokenNeedsUpdate("metadata:read-only")).toBe(true);
  });

  test("a token that carries more than the list asks for is not out of date", () => {
    expect(tokenNeedsUpdate(`${permissionsFingerprint()}|issues:read-only`)).toBe(false);
  });

  test("newPermissionsSince names what to add", () => {
    expect(newPermissionsSince("metadata:read-only").map((one) => one.id)).toEqual(["contents"]);
    expect(newPermissionsSince(permissionsFingerprint())).toEqual([]);
  });
});
