import { describe, expect, test } from "bun:test";
import { createGrid, setCell } from "../grid.js";
import {
  JUDGE_METRICS,
  METRICS,
  SPECIFICATIONS,
  isDoorType,
  isPathType,
  metricsForSpecification,
  renderAscii,
  scoreMap,
} from "./mapMetrics.js";

const vocabulary = {
  name: "Test",
  summary: "A test world.",
  elements: [
    { id: "grass", label: "Grass", description: "", placementRules: "", walkable: true, interactable: false, isBarrier: false, visualTag: "grass", instanceFields: [] },
    { id: "wall", label: "Wall", description: "", placementRules: "", walkable: false, interactable: false, isBarrier: true, visualTag: "stone-wall", instanceFields: [] },
    { id: "path", label: "Dirt path", description: "", placementRules: "", walkable: true, interactable: false, isBarrier: false, visualTag: "path", instanceFields: [] },
    { id: "corridor", label: "Corridor", description: "", placementRules: "", walkable: true, interactable: false, isBarrier: false, visualTag: "metal-floor", instanceFields: [] },
    { id: "door", label: "Door", description: "", placementRules: "", walkable: true, interactable: true, isBarrier: false, visualTag: "door", instanceFields: ["locked"] },
    { id: "tree", label: "Tree", description: "", placementRules: "", walkable: false, interactable: false, isBarrier: true, visualTag: "tree", instanceFields: [] },
  ],
};

/** A grid from rows of letters: g grass, # wall, p path, d door, t tree, . undecided. */
function fill(rows, source = "model") {
  const grid = createGrid(rows[0].length, rows.length);
  const byChar = { g: "grass", "#": "wall", p: "path", d: "door", t: "tree", c: "corridor" };
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (byChar[char]) setCell(grid, x, y, { typeId: byChar[char], source, confidence: 1, probabilities: {} });
    });
  });
  return grid;
}

describe("the specifications and their metrics", () => {
  test("there are four specifications, each with at least two metrics, and every metric belongs to one", () => {
    expect(SPECIFICATIONS.map((one) => one.id)).toEqual(["structures", "paths", "reachability", "coherence"]);
    for (const spec of SPECIFICATIONS) {
      expect(spec.name.length).toBeGreaterThan(0);
      expect(spec.description.length).toBeGreaterThan(0);
      expect(metricsForSpecification(spec.id).length).toBeGreaterThanOrEqual(2);
    }
    for (const metric of METRICS) {
      expect(SPECIFICATIONS.some((one) => one.id === metric.specificationId)).toBe(true);
      expect(metric.name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(metric.description.length).toBeGreaterThan(0);
    }
    expect(new Set(METRICS.map((one) => one.name)).size).toBe(METRICS.length);
  });

  test("every judge metric belongs to a specification, has a prompt, and shares no name with a computed metric", () => {
    expect(JUDGE_METRICS.length).toBeGreaterThan(0);
    const computed = new Set(METRICS.map((one) => one.name));
    for (const metric of JUDGE_METRICS) {
      expect(SPECIFICATIONS.some((one) => one.id === metric.specificationId)).toBe(true);
      expect(metric.name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(metric.judgePrompt.length).toBeGreaterThan(100);
      expect(computed.has(metric.name)).toBe(false);
    }
  });
});

describe("isPathType", () => {
  test("a type is a path by its visual tag or by its name", () => {
    expect(isPathType(vocabulary.elements[2])).toBe(true);
    expect(isPathType(vocabulary.elements[3])).toBe(true);
    expect(isPathType(vocabulary.elements[0])).toBe(false);
    expect(isPathType(vocabulary.elements[1])).toBe(false);
  });
});

describe("scoreMap: structures", () => {
  test("a closed room scores full marks; scattered single walls score low", () => {
    const room = scoreMap(fill(["gggggg", "g####g", "g#gg#g", "g#gg#g", "g####g", "gggggg"]), vocabulary, { fallbackCount: 0 });
    expect(room["barrier-not-isolated"]).toBe(1);
    expect(room["barrier-in-structure"]).toBe(1);

    const debris = scoreMap(fill(["g#gggg", "gggg#g", "g#gggg", "gggg#g", "g#gggg", "gggggg"]), vocabulary, { fallbackCount: 0 });
    expect(debris["barrier-not-isolated"]).toBe(0);
    expect(debris["barrier-in-structure"]).toBe(0);
  });

  test("a pair of walls is not isolated but is not yet a structure", () => {
    const pair = scoreMap(fill(["gggg", "g##g", "gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(pair["barrier-not-isolated"]).toBe(1);
    expect(pair["barrier-in-structure"]).toBe(0);
  });

  test("the barrier share is judged against a healthy range", () => {
    const allWall = scoreMap(fill(["####", "####", "####", "####"]), vocabulary, { fallbackCount: 0 });
    expect(allWall["barrier-share-in-range"]).toBe(0);
    const none = scoreMap(fill(["gggg", "gggg", "gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(none["barrier-share-in-range"]).toBe(0);
    const some = scoreMap(fill(["gggggg", "g####g", "g#gg#g", "g#gg#g", "g####g", "gggggg"]), vocabulary, { fallbackCount: 0 });
    expect(some["barrier-share-in-range"]).toBe(1);
  });

  test("with no barrier at all the isolation metrics are null, not a false pass", () => {
    const none = scoreMap(fill(["gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(none["barrier-not-isolated"]).toBeNull();
    expect(none["barrier-in-structure"]).toBeNull();
  });
});

describe("scoreMap: paths", () => {
  test("one continuous path scores full marks", () => {
    const line = scoreMap(fill(["gggggg", "pppppp", "gggggg"]), vocabulary, { fallbackCount: 0 });
    expect(line["path-not-isolated"]).toBe(1);
    expect(line["path-in-largest-network"]).toBe(1);
    expect(line["path-continuity"]).toBeCloseTo(4 / 6, 5);
  });

  test("scattered path cells score low, and two separate networks split the largest share", () => {
    const dots = scoreMap(fill(["pgpgpg", "gggggg", "pgpgpg"]), vocabulary, { fallbackCount: 0 });
    expect(dots["path-not-isolated"]).toBe(0);
    expect(dots["path-continuity"]).toBe(0);
    const two = scoreMap(fill(["pppggg", "gggggg", "gggppp"]), vocabulary, { fallbackCount: 0 });
    expect(two["path-in-largest-network"]).toBe(0.5);
  });

  test("a corridor counts as a path type by its name", () => {
    const corridor = scoreMap(fill(["cccc", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(corridor["path-not-isolated"]).toBe(1);
  });

  test("a vocabulary without any path type gives null path scores", () => {
    const none = scoreMap(fill(["gggg", "g##g"]), vocabulary, { fallbackCount: 0 });
    expect(none["path-not-isolated"]).toBeNull();
    expect(none["path-in-largest-network"]).toBeNull();
    expect(none["path-continuity"]).toBeNull();
  });
});

describe("scoreMap: reachability and playability", () => {
  test("one open region is fully reachable; a wall across it is not", () => {
    const open = scoreMap(fill(["gggg", "gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(open["walkable-reachable-share"]).toBe(1);
    expect(open["single-walkable-region"]).toBe(1);
    const split = scoreMap(fill(["gg#g", "gg#g", "gg#g"]), vocabulary, { fallbackCount: 0 });
    expect(split["walkable-reachable-share"]).toBeCloseTo(6 / 9, 5);
    expect(split["single-walkable-region"]).toBe(0.5);
  });

  test("the walkable share is judged against a healthy range", () => {
    const allWall = scoreMap(fill(["####", "####"]), vocabulary, { fallbackCount: 0 });
    expect(allWall["walkable-share-in-range"]).toBe(0);
    const mixed = scoreMap(fill(["gggg", "g##g", "gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(mixed["walkable-share-in-range"]).toBe(1);
  });

  test("vocabulary coverage is the share of types the map uses", () => {
    const two = scoreMap(fill(["gg#g", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(two["vocabulary-coverage"]).toBeCloseTo(2 / 6, 5);
  });

  test("fallback cells count against the model", () => {
    const grid = fill(["gggg", "gggg"]);
    expect(scoreMap(grid, vocabulary, { fallbackCount: 2 })["model-answered"]).toBe(0.75);
    expect(scoreMap(grid, vocabulary, { fallbackCount: 0 })["model-answered"]).toBe(1);
  });

  test("every metric name in METRICS appears in the scores, and every score is null or within 0..1", () => {
    const scores = scoreMap(fill(["gp#g", "gpgg", "gp#g"]), vocabulary, { fallbackCount: 1 });
    for (const metric of METRICS) {
      expect(metric.name in scores).toBe(true);
      const value = scores[metric.name];
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("scoreMap: paths share", () => {
  test("a map that is all path is not a route network, and a few path cells are", () => {
    const flood = scoreMap(fill(["pppp", "pppp", "pppp", "pppp"]), vocabulary, { fallbackCount: 0 });
    expect(flood["path-share-in-range"]).toBe(0);
    const some = scoreMap(fill(["gggg", "pppp", "gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(some["path-share-in-range"]).toBe(1);
    const none = scoreMap(fill(["gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(none["path-share-in-range"]).toBe(0);
  });
});

describe("isDoorType", () => {
  test("a door is known by its visual tag", () => {
    expect(isDoorType(vocabulary.elements[4])).toBe(true);
    expect(isDoorType({ ...vocabulary.elements[4], visualTag: "wood-door" })).toBe(true);
    expect(isDoorType({ ...vocabulary.elements[4], visualTag: "arch" })).toBe(true);
    expect(isDoorType(vocabulary.elements[0])).toBe(false);
    expect(isDoorType(null)).toBe(false);
  });
});

describe("scoreMap: coherence", () => {
  test("a door between two walls is in a wall; a door in open grass is not; no door is nothing to judge", () => {
    const inWall = scoreMap(fill(["gggg", "#d#g", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(inWall["door-in-wall"]).toBe(1);
    const vertical = scoreMap(fill(["g#g", "gdg", "g#g"]), vocabulary, { fallbackCount: 0 });
    expect(vertical["door-in-wall"]).toBe(1);
    const loose = scoreMap(fill(["gggg", "gdgg", "gg#g"]), vocabulary, { fallbackCount: 0 });
    expect(loose["door-in-wall"]).toBe(0);
    const half = scoreMap(fill(["gggg", "#dgd", "ggg#"]), vocabulary, { fallbackCount: 0 });
    expect(half["door-in-wall"]).toBe(0);
    expect(scoreMap(fill(["gggg", "g##g"]), vocabulary, { fallbackCount: 0 })["door-in-wall"]).toBeNull();
  });

  test("walls are outlines: a wall cell buried among walls on all four sides is a filled block", () => {
    const ring = scoreMap(fill(["#####", "#ggg#", "#ggg#", "#####"]), vocabulary, { fallbackCount: 0 });
    expect(ring["barrier-outline"]).toBe(1);
    const block = scoreMap(fill(["ggggg", "g###g", "g###g", "g###g", "ggggg"]), vocabulary, { fallbackCount: 0 });
    expect(block["barrier-outline"]).toBeCloseTo(8 / 9, 5);
    expect(scoreMap(fill(["gggg"]), vocabulary, { fallbackCount: 0 })["barrier-outline"]).toBeNull();
  });

  test("an enclosed room exists when some floor cannot be reached from the map edge without a door", () => {
    const closed = scoreMap(fill(["gggggg", "g####g", "g#gg#g", "g####g", "gggggg"]), vocabulary, { fallbackCount: 0 });
    expect(closed["enclosed-room-exists"]).toBe(1);
    const withDoor = scoreMap(fill(["gggggg", "g####g", "g#ggdg", "g####g", "gggggg"]), vocabulary, { fallbackCount: 0 });
    expect(withDoor["enclosed-room-exists"]).toBe(1);
    const gap = scoreMap(fill(["gggggg", "g####g", "g#gggg", "g####g", "gggggg"]), vocabulary, { fallbackCount: 0 });
    expect(gap["enclosed-room-exists"]).toBe(0);
    const solid = scoreMap(fill(["gggggg", "g####g", "g####g", "gggggg"]), vocabulary, { fallbackCount: 0 });
    expect(solid["enclosed-room-exists"]).toBe(0);
  });

  test("ground comes in patches: a cell of a ground type wants two neighbours of its own type", () => {
    const patch = scoreMap(fill(["ggg", "ggg", "ggg"]), vocabulary, { fallbackCount: 0 });
    expect(patch["ground-in-patches"]).toBe(1);
    const confetti = scoreMap(fill(["gcg", "cgc", "gcg"]), vocabulary, { fallbackCount: 0 });
    expect(confetti["ground-in-patches"]).toBe(0);
    const routesDoNotCount = scoreMap(fill(["ppp", "ppp", "ppp"]), vocabulary, { fallbackCount: 0 });
    expect(routesDoNotCount["ground-in-patches"]).toBeNull();
    expect(scoreMap(fill(["###"]), vocabulary, { fallbackCount: 0 })["ground-in-patches"]).toBeNull();
  });

  test("interactable things are sprinkled: none is empty, a heap is too many", () => {
    const none = scoreMap(fill(["gggg", "gggg", "gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(none["interactable-share-in-range"]).toBe(0);
    const one = scoreMap(fill(["gggg", "gdgg", "gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(one["interactable-share-in-range"]).toBe(1);
    const heap = scoreMap(fill(["dddd", "dddd", "gggg", "gggg"]), vocabulary, { fallbackCount: 0 });
    expect(heap["interactable-share-in-range"]).toBe(0);
  });
});

describe("renderAscii", () => {
  test("draws one glyph per cell with a legend, and a dot for an undecided cell", () => {
    const text = renderAscii(fill(["g#p", "gd."]), vocabulary);
    const lines = text.split("\n");
    expect(lines[0]).toBe('"#.');
    expect(lines[1]).toBe('"+·');
    expect(text).toContain('" Grass');
    expect(text).toContain("# Wall");
  });
});
