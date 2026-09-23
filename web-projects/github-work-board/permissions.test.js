import { describe, expect, test } from "bun:test";
import { CONNECTION_CHECKS, PERMISSIONS, REQUIRED_PERMISSIONS, permissionFor } from "./permissions.js";

describe("REQUIRED_PERMISSIONS", () => {
  // The board file moved to the shared cloud storage (root ADR 0016), which
  // asks for Contents on its own token. A token that only reads work no
  // longer needs it.
  test("asks for what reading work needs, and not for Contents", () => {
    expect(REQUIRED_PERMISSIONS.map((one) => one.id)).toEqual(["metadata", "issues", "pull-requests", "actions"]);
    expect(CONNECTION_CHECKS.map((one) => one.id)).toEqual(["identity", "issues", "reviews", "checks"]);
  });

  test("every entry carries what the setup guide has to show", () => {
    expect(REQUIRED_PERMISSIONS.length).toBeGreaterThan(0);
    for (const permission of REQUIRED_PERMISSIONS) {
      expect(permission.id).toMatch(/^[a-z-]+$/);
      expect(permission.name.length).toBeGreaterThan(0);
      expect(permission.level).toMatch(/^(Read-only|Read and write)$/);
      expect(permission.why.length).toBeGreaterThan(0);
      // What the reader loses without it, as a whole sentence. A reader looking
      // at a red row needs to know what stops working, not only what to tick.
      expect(permission.without).toMatch(/^Without it, .*\.$/);
    }
  });

  test("no identifier is used twice", () => {
    const ids = REQUIRED_PERMISSIONS.map((permission) => permission.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every connection check needs a permission this list asks for", () => {
    for (const check of CONNECTION_CHECKS) {
      expect(Object.values(PERMISSIONS)).toContain(check.need);
    }
  });

  // Settings says green or red for every permission the reader was told to
  // grant. A permission nothing proves would sit there with no answer, and the
  // reader would have no way to tell a good token from a broken one (ADR 0005).
  test("every permission the reader grants is proved by a check", () => {
    const proved = new Set(CONNECTION_CHECKS.map((one) => one.permission));
    for (const permission of REQUIRED_PERMISSIONS) expect(proved).toContain(permission.id);
  });

  test("every check says which call it is, and what to add when it fails", () => {
    for (const check of CONNECTION_CHECKS) {
      expect(check.label.length).toBeGreaterThan(0);
      expect(REQUIRED_PERMISSIONS.map((one) => one.id)).toContain(check.permission);
    }
  });
});

describe("permissionFor", () => {
  test("finds the permission a check proves", () => {
    for (const check of CONNECTION_CHECKS) {
      expect(permissionFor(check.permission)?.id).toBe(check.permission);
    }
  });

  test("an id nobody knows has no permission, and never throws", () => {
    expect(permissionFor("nonsense")).toBe(null);
    expect(permissionFor(undefined)).toBe(null);
  });
});
