import { describe, test, expect } from "bun:test";
import { parseFirmsCsv, firmsConfidence, firmsTime, FIRMS_SOURCES } from "./firms.js";

const VIIRS = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
42.07812,1.86601,336.07,0.5,0.41,2026-09-25,0041,N,nominal,2.0NRT,281.96,3.23,N
42.07900,1.86700,340.00,0.5,0.41,2026-09-25,1312,N,h,2.0NRT,290.00,12.5,D
`;
const MODIS = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight
37.48998,-5.20913,301.65,1.01,1,2026-09-25,0427,A,43,6.1NRT,288.47,5.5,N
37.5,-5.2,301.65,1.01,1,2026-09-25,0427,A,85,6.1NRT,288.47,20,N
`;

describe("firmsTime", () => {
  test("reads the UTC date and the HHMM time", () => {
    expect(firmsTime("2026-09-25", "0041")).toBe(Date.parse("2026-09-25T00:41:00Z"));
    expect(firmsTime("2026-09-25", "5")).toBe(Date.parse("2026-09-25T00:05:00Z"));
  });
});

describe("firmsConfidence", () => {
  test("maps the VIIRS words and letters", () => {
    expect(firmsConfidence("low")).toBe("low");
    expect(firmsConfidence("nominal")).toBe("medium");
    expect(firmsConfidence("n")).toBe("medium");
    expect(firmsConfidence("h")).toBe("high");
  });
  test("maps the MODIS percentage with the FIRMS thresholds", () => {
    expect(firmsConfidence("29")).toBe("low");
    expect(firmsConfidence("30")).toBe("medium");
    expect(firmsConfidence("80")).toBe("high");
  });
});

describe("parseFirmsCsv", () => {
  test("reads VIIRS rows", () => {
    const rows = parseFirmsCsv(VIIRS, "VIIRS_SNPP");
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({
      lat: 42.07812, lon: 1.86601, frp: 3.23, confidence: "medium",
      time: Date.parse("2026-09-25T00:41:00Z"), source: "VIIRS_SNPP",
    });
    expect(rows[1].confidence).toBe("high");
  });
  test("reads MODIS rows", () => {
    const rows = parseFirmsCsv(MODIS, "MODIS");
    expect(rows.map((r) => r.confidence)).toEqual(["medium", "high"]);
  });
  test("skips broken rows and an empty file", () => {
    expect(parseFirmsCsv("", "MODIS")).toEqual([]);
    expect(parseFirmsCsv(`${MODIS}not,a,row\n`, "MODIS").length).toBe(2);
  });
});

describe("FIRMS_SOURCES", () => {
  test("every source names its satellite, its sensor and its file", () => {
    for (const s of FIRMS_SOURCES) {
      expect(s.key).toBeTruthy();
      expect(s.satellite).toBeTruthy();
      expect(["VIIRS", "MODIS"]).toContain(s.sensor);
      expect(s.url).toStartWith("https://firms.modaps.eosdis.nasa.gov/data/active_fire/");
    }
  });
});
