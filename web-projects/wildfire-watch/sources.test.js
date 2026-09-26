// The small pure helpers for the other live sources: EEA Natura 2000, EFFIS
// and the Open-Meteo place search.
import { describe, test, expect } from "bun:test";
import { naturaQueryUrl, parseNatura, burntAreasUrl, parseBurntAreas, fwiDate, parseGeocoding } from "./sources.js";

describe("Natura 2000", () => {
  test("asks for the sites within a radius of a point, simplified", () => {
    const url = new URL(naturaQueryUrl({ lat: 41.76, lon: 2.37 }, 20, 0));
    expect(url.hostname).toBe("bio.discomap.eea.europa.eu");
    expect(url.searchParams.get("geometry")).toBe("2.37,41.76");
    expect(url.searchParams.get("distance")).toBe("20");
    expect(url.searchParams.get("f")).toBe("geojson");
    expect(url.searchParams.get("outSR")).toBe("4326");
  });
  test("reads polygons and multipolygons into outer rings", () => {
    const areas = parseNatura({
      features: [
        { properties: { SITENAME: "El Montseny", SITECODE: "ES5110001" }, geometry: { type: "Polygon", coordinates: [[[2.3, 41.7], [2.5, 41.7], [2.5, 41.8], [2.3, 41.7]]] } },
        { properties: { SITENAME: "Two parts", SITECODE: "X" }, geometry: { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[5, 5], [6, 5], [6, 6], [5, 5]]]] } },
      ],
    });
    expect(areas[0].name).toBe("El Montseny");
    expect(areas[0].polygons[0][0]).toEqual({ lat: 41.7, lon: 2.3 });
    expect(areas[1].polygons.length).toBe(2);
  });
  test("drops a site listed twice under two directives", () => {
    const f = { properties: { SITENAME: "A", SITECODE: "S1" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1]]] } };
    expect(parseNatura({ features: [f] }, { features: [f] }).length).toBe(1);
  });
});

describe("EFFIS burnt areas", () => {
  test("asks for this season's burnt areas in the view", () => {
    const url = new URL(burntAreasUrl({ south: 40, west: 0, north: 42, east: 3 }));
    expect(url.searchParams.get("typename")).toBe("modis.ba.poly.season");
    expect(url.searchParams.get("bbox")).toBe("40,0,42,3,EPSG:4326");
    expect(url.searchParams.get("outputformat")).toBe("geojson");
  });
  test("reads each area with its date, size and place", () => {
    const [a] = parseBurntAreas({
      features: [{
        properties: { id: "1", FIREDATE: "2026-02-24 12:01:00", LASTUPDATE: "2026-03-05 13:46:54.3", AREA_HA: "51", COMMUNE: "Aussurucq", PROVINCE: "Pyrénées-Atlantiques", COUNTRY: "FR" },
        geometry: { type: "Polygon", coordinates: [[[-0.9, 43.1], [-0.8, 43.1], [-0.8, 43.2]]] },
      }],
    });
    expect(a).toMatchObject({ id: "1", areaHa: 51, place: "Aussurucq, Pyrénées-Atlantiques (FR)" });
    expect(a.fireDate).toBe(Date.parse("2026-02-24T12:01:00Z"));
    expect(a.polygons[0].length).toBe(3);
  });
});

describe("fwiDate", () => {
  test("is the UTC day", () => {
    expect(fwiDate(Date.parse("2026-09-25T23:30:00Z"))).toBe("2026-09-25");
  });
});

describe("parseGeocoding", () => {
  test("reads the Open-Meteo place search", () => {
    const [p] = parseGeocoding({ results: [{ name: "Berga", latitude: 42.1, longitude: 1.85, population: 17160, country: "Spain", admin1: "Catalonia" }] });
    expect(p).toEqual({ name: "Berga", lat: 42.1, lon: 1.85, population: 17160, label: "Berga, Catalonia, Spain" });
  });
  test("returns nothing when the search finds nothing", () => {
    expect(parseGeocoding({})).toEqual([]);
  });
});
