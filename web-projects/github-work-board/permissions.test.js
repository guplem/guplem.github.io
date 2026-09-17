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
