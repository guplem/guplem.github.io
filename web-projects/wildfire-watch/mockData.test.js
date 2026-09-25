import { describe, test, expect } from "bun:test";
import { FIRES, MTG_ONLY, TOWNS, PROTECTED_AREAS, windGrid } from "./mockData.js";
import { impactAlerts } from "./alerts.js";

describe("mock data", () => {
  test("every fire has the fields the page reads", () => {
    for (const f of FIRES) {
      expect(typeof f.id).toBe("string");
      expect(["low", "medium", "high"]).toContain(f.confidence);
      expect(f.frp).toBeGreaterThan(0);
      expect(f.ageMin).toBeGreaterThan(0);
      expect(typeof f.mtg.confirmed).toBe("boolean");
      expect(f.weather.windKmh).toBeGreaterThanOrEqual(0);
    }
  });
  test("ids are unique across both detection lists", () => {
    const ids = [...FIRES, ...MTG_ONLY].map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test("the demo shows at least one impact alert and one protected area hit", () => {
    expect(impactAlerts(FIRES, TOWNS, 10).length).toBeGreaterThan(0);
    expect(PROTECTED_AREAS.length).toBeGreaterThan(0);
  });
  test("the wind grid covers the region with valid vectors", () => {
    const grid = windGrid();
    expect(grid.length).toBeGreaterThan(20);
    for (const g of grid) {
      expect(g.windFrom).toBeGreaterThanOrEqual(0);
      expect(g.windFrom).toBeLessThan(360);
    }
  });
});
