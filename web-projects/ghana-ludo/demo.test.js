import { describe, expect, it } from "bun:test";
import { demoTable } from "./demo.js";

describe("demoTable", () => {
  it("deals the same round in progress every time, for a picture that can be taken again", () => {
    expect(demoTable()).toEqual(demoTable());
  });

  it("stops mid-round on the host's turn, with pieces spread over the board", () => {
    const t = demoTable();
    expect(t.game.phase).toBe("play");
    expect(t.game.turn).toBe(0);
    expect(t.game.awaiting).toBe("roll");
    expect(t.game.pieces.filter((p) => p.at === "ring").length).toBeGreaterThanOrEqual(5);
    expect(t.seats.map((s) => s.kind)).toEqual(["host", "bot", "bot", "bot"]);
  });
});
