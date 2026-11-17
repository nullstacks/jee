import test from "node:test";
import assert from "node:assert/strict";
import { sparkPath, seriesToPoints } from "../src/core.ts";

test("sparkPath skips nulls without breaking the path", () => {
  const d = sparkPath([100, null, 50], 100, 20);
  assert.equal(d.split("M").length - 1, 2, "two spans either side of the gap");
  assert.ok(!d.includes("NaN"));
});

test("sparkPath of an all-null series is empty", () => {
  assert.equal(sparkPath([null, null], 100, 20), "");
});

test("seriesToPoints with one year centres the point", () => {
  assert.equal(seriesToPoints([2026], [500], 1000)[0].x, 0.5);
});
