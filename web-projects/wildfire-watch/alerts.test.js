import { describe, test, expect } from "bun:test";
import { impactAlerts, protectedAreaFact, findTown, formatKm } from "./alerts.js";

const towns = [
  { name: "Berga", lat: 42.104, lon: 1.845, population: 17000 },
  { name: "L'Escala", lat: 42.125, lon: 3.131, population: 10000 },
  { name: "Barcelona", lat: 41.387, lon: 2.17, population: 1600000 },
];

describe("impactAlerts", () => {
  test("lists only fires within the radius, nearest first", () => {
    const fires = [
      { id: "a", name: "Close", lat: 42.08, lon: 1.87 },
      { id: "b", name: "Closer", lat: 42.1, lon: 1.85 },
      { id: "c", name: "Far away", lat: 40.8, lon: 0.5 },
    ];
    const alerts = impactAlerts(fires, towns, 10);
    expect(alerts.map((a) => a.fire.id)).toEqual(["b", "a"]);
    expect(alerts[0].town.name).toBe("Berga");
  });
  test("names only the nearest town for each fire", () => {
    const alerts = impactAlerts([{ id: "a", lat: 42.1, lon: 1.85 }], towns, 500);
    expect(alerts.length).toBe(1);
  });
});

describe("protectedAreaFact", () => {
  const areas = [
    { name: "Box", polygon: [
      { lat: 41, lon: 1 }, { lat: 41, lon: 2 }, { lat: 42, lon: 2 }, { lat: 42, lon: 1 },
    ] },
  ];
  test("says a fire is inside", () => {
    expect(protectedAreaFact({ lat: 41.5, lon: 1.5 }, areas)).toEqual({ area: areas[0], inside: true, km: 0 });
  });
  test("gives the distance when outside", () => {
    const fact = protectedAreaFact({ lat: 41.5, lon: 0.9 }, areas);
    expect(fact.inside).toBe(false);
    expect(fact.km).toBeGreaterThan(5);
  });
});

describe("findTown", () => {
  test("ignores case and accents", () => {
    expect(findTown("barcelóna", towns).name).toBe("Barcelona");
    expect(findTown("l’escala", towns).name).toBe("L'Escala");
  });
  test("prefers a name that starts with the query", () => {
    expect(findTown("ber", towns).name).toBe("Berga");
  });
  test("returns null for no match or an empty query", () => {
    expect(findTown("zzz", towns)).toBeNull();
    expect(findTown("  ", towns)).toBeNull();
  });
});

describe("formatKm", () => {
  test("keeps one decimal under 10 km and none above", () => {
    expect(formatKm(3.24)).toBe("3.2 km");
    expect(formatKm(12.6)).toBe("13 km");
  });
});
