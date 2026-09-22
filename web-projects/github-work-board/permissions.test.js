import { describe, expect, test } from "bun:test";
import {
  CONNECTION_CHECKS,
  PERMISSIONS,
  REQUIRED_PERMISSIONS,
  newPermissionsSince,
  permissionsFingerprint,
  tokenNeedsUpdate,
} from "./permissions.js";

describe("REQUIRED_PERMISSIONS", () => {
  // The board file moved to the shared cloud storage (root ADR 0016), which
  // asks for Contents on its own token. A token that only reads work no
  // longer needs it.
  test("asks for what reading work needs, and not for Contents", () => {
    expect(REQUIRED_PERMISSIONS.map((one) => one.id)).toEqual(["metadata", "issues", "pull-requests"]);
    expect(CONNECTION_CHECKS.map((one) => one.id)).toEqual(["identity", "issues"]);
  });

  test("every entry carries what the setup guide has to show", () => {
    expect(REQUIRED_PERMISSIONS.length).toBeGreaterThan(0);
    for (const permission of REQUIRED_PERMISSIONS) {
      expect(permission.id).toMatch(/^[a-z-]+$/);
      expect(permission.name.length).toBeGreaterThan(0);
      expect(permission.level).toMatch(/^(Read-only|Read and write)$/);
      expect(permission.why.length).toBeGreaterThan(0);
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
});

describe("permissionsFingerprint", () => {
  const list = [
    { id: "issues", name: "Issues", level: "Read and write", why: "x" },
    { id: "metadata", name: "Metadata", level: "Read-only", why: "y" },
  ];

  test("does not change when the same permissions are listed in another order", () => {
    expect(permissionsFingerprint(list)).toBe(permissionsFingerprint([...list].reverse()));
  });

  test("changes when a permission is added", () => {
    const more = [...list, { id: "contents", name: "Contents", level: "Read and write", why: "z" }];
    expect(permissionsFingerprint(more)).not.toBe(permissionsFingerprint(list));
  });

  // Raising Issues from read to write needs the reader to edit the token just
  // as much as adding a whole new permission does.
  test("changes when a permission is raised from read to write", () => {
    const raised = list.map((p) => (p.id === "metadata" ? { ...p, level: "Read and write" } : p));
    expect(permissionsFingerprint(raised)).not.toBe(permissionsFingerprint(list));
  });

  test("ignores the wording of the reason", () => {
    const reworded = list.map((p) => ({ ...p, why: "a completely different sentence" }));
    expect(permissionsFingerprint(reworded)).toBe(permissionsFingerprint(list));
  });
});

describe("tokenNeedsUpdate", () => {
  test("says no when the token was approved against exactly this list", () => {
    expect(tokenNeedsUpdate(permissionsFingerprint())).toBe(false);
  });

  test("says yes when the list has moved on", () => {
    expect(tokenNeedsUpdate("metadata:read-only")).toBe(true);
  });

  // The list shrank once, when Contents moved to cloud storage. A token that
  // carries more than the list asks for is not out of date: there is nothing
  // to add, so there is nothing to ask the reader to do.
  test("says no when the token carries more than the list asks for", () => {
    expect(tokenNeedsUpdate(`${permissionsFingerprint()}|contents:read and write`)).toBe(false);
  });

  // A reader who has never connected is in the setup guide already. Telling
  // them their token is out of date would be nonsense.
  test("says no when no token was ever approved", () => {
    expect(tokenNeedsUpdate(null)).toBe(false);
    expect(tokenNeedsUpdate("")).toBe(false);
    expect(tokenNeedsUpdate(undefined)).toBe(false);
  });
});

describe("newPermissionsSince", () => {
  const list = [
    { id: "metadata", name: "Metadata", level: "Read-only", why: "y" },
    { id: "issues", name: "Issues", level: "Read and write", why: "x" },
  ];

  test("names only the permissions the token does not already carry", () => {
    const missing = newPermissionsSince("metadata:read-only", list);
    expect(missing.map((permission) => permission.id)).toEqual(["issues"]);
  });

  test("names a permission whose level went up", () => {
    const missing = newPermissionsSince("metadata:read-only|issues:read-only", list);
    expect(missing.map((permission) => permission.id)).toEqual(["issues"]);
  });

  test("names nothing when the token is current", () => {
    expect(newPermissionsSince(permissionsFingerprint(list), list)).toEqual([]);
  });
});
