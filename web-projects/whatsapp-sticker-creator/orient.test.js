import { describe, expect, test } from "bun:test";
import { flipX, rotateQuarter } from "./orient.js";

/** A one-byte-per-pixel grid, written as rows of digits. */
const grid = (rows) => ({
  data: new Uint8Array(rows.flatMap((row) => [...row].map(Number))),
  width: rows[0].length,
  height: rows.length,
});

/** Read a one-byte-per-pixel grid back as rows of digits. */
const rowsOf = (data, width, height) =>
  Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => data[y * width + x]).join(""),
  );

describe("flipX", () => {
  test("mirrors a grid left to right", () => {
    const { data, width, height } = grid(["123", "456"]);
    expect(rowsOf(flipX(data, width, height, 1), width, height)).toEqual(["321", "654"]);
  });

  test("mirrors an RGBA picture without shuffling the channels", () => {
    // Four bytes move together. A flip that reversed bytes rather than pixels
    // would turn every red pixel into a transparent blue one.
    const rgba = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...flipX(rgba, 2, 1, 4)]).toEqual([5, 6, 7, 8, 1, 2, 3, 4]);
  });

  test("comes back to the start when applied twice", () => {
    const { data, width, height } = grid(["123", "456"]);
    const twice = flipX(flipX(data, width, height, 1), width, height, 1);
    expect([...twice]).toEqual([...data]);
  });

  test("leaves a single column alone", () => {
    const { data, width, height } = grid(["1", "2"]);
    expect([...flipX(data, width, height, 1)]).toEqual([1, 2]);
  });
});

describe("rotateQuarter", () => {
  test("turns a grid a quarter turn clockwise", () => {
    // The top left corner becomes the top right one.
    const { data, width, height } = grid(["123", "456"]);
    const turned = rotateQuarter(data, width, height, 1);
    expect(turned.width).toBe(2);
    expect(turned.height).toBe(3);
    expect(rowsOf(turned.data, turned.width, turned.height)).toEqual(["41", "52", "63"]);
  });

  test("swaps the width and the height", () => {
    const turned = rotateQuarter(new Uint8Array(6), 3, 2, 1);
    expect([turned.width, turned.height]).toEqual([2, 3]);
  });

  test("turns an RGBA picture without shuffling the channels", () => {
    const rgba = new Uint8ClampedArray([1, 1, 1, 1, 2, 2, 2, 2]);
    const turned = rotateQuarter(rgba, 2, 1, 4);
    expect([turned.width, turned.height]).toEqual([1, 2]);
    expect([...turned.data]).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  test("comes back to the start after four turns", () => {
    const { data, width, height } = grid(["123", "456"]);
    let current = { data, width, height };
    for (let turn = 0; turn < 4; turn += 1) {
      current = rotateQuarter(current.data, current.width, current.height, 1);
    }
    expect(current.width).toBe(width);
    expect([...current.data]).toEqual([...data]);
  });

  test("leaves a single pixel alone", () => {
    const turned = rotateQuarter(new Uint8Array([9]), 1, 1, 1);
    expect([...turned.data]).toEqual([9]);
  });
});
