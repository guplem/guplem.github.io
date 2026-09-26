import { describe, test, expect } from "bun:test";
import { openMeteoUrl, parseOpenMeteo, meanWeather, gridPoints } from "./weather.js";

describe("openMeteoUrl", () => {
  test("asks for every point in one call", () => {
    const url = new URL(openMeteoUrl([{ lat: 42.1, lon: 1.8 }, { lat: 41.2, lon: 0.5 }]));
    expect(url.origin).toBe("https://api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("42.1,41.2");
    expect(url.searchParams.get("longitude")).toBe("1.8,0.5");
    expect(url.searchParams.get("current")).toContain("wind_direction_10m");
    expect(url.searchParams.get("wind_speed_unit")).toBe("kmh");
    expect(url.searchParams.get("timezone")).toBe("GMT");
  });
});

const one = {
  current: { time: "2026-09-25T12:00", wind_speed_10m: 20, wind_direction_10m: 270, temperature_2m: 30, relative_humidity_2m: 25 },
  hourly: {
    time: ["2026-09-25T12:00", "2026-09-25T13:00", "2026-09-25T14:00"],
    wind_speed_10m: [10, 20, 30],
    wind_direction_10m: [350, 10, 0],
    temperature_2m: [30, 32, 34],
    relative_humidity_2m: [30, 20, 10],
  },
};

describe("parseOpenMeteo", () => {
  test("reads one location, which the API sends as an object", () => {
    const [w] = parseOpenMeteo(one);
    expect(w.current).toEqual({ windFrom: 270, windKmh: 20, tempC: 30, humidity: 25 });
    expect(w.hourly.length).toBe(3);
    expect(w.hourly[0].time).toBe(Date.parse("2026-09-25T12:00:00Z"));
  });
  test("reads several locations, which the API sends as a list", () => {
    expect(parseOpenMeteo([one, one]).length).toBe(2);
  });
});

describe("meanWeather", () => {
  const [w] = parseOpenMeteo(one);
  test("averages the hours in the window", () => {
    const m = meanWeather(w, Date.parse("2026-09-25T12:00:00Z"), 3);
    expect(m.windKmh).toBeCloseTo(20, 0);
    expect(m.tempC).toBeCloseTo(32, 5);
  });
  test("averages the direction as a vector, so north stays north", () => {
    const m = meanWeather(w, Date.parse("2026-09-25T12:00:00Z"), 3);
    expect(Math.min(m.windFrom, 360 - m.windFrom)).toBeLessThan(10);
  });
  test("falls back to the current reading when the window has no hours", () => {
    expect(meanWeather(w, Date.parse("2030-01-01T00:00:00Z"), 6)).toEqual(w.current);
  });
});

describe("gridPoints", () => {
  test("spreads points evenly over the view", () => {
    const pts = gridPoints({ south: 40, west: 0, north: 42, east: 3 }, 3);
    expect(pts.length).toBe(9);
    expect(pts[0].lat).toBeGreaterThan(40);
    expect(pts[8].lon).toBeLessThan(3);
  });
});
