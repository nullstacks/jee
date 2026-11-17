import test from "node:test";
import assert from "node:assert/strict";
import { slugify, buildIndex, buildInstituteSeries, seriesToPoints } from "../src/core.ts";

const row = (o) => ({ year: 2026, inst: "IIT Bombay", type: 0, prog: "CS",
  deg: "4 Years, Bachelor of Technology", q: "AI", seat: "OPEN", g: 0,
  op: 100, cl: 200, ...o });

test("slugify is lowercase, hyphenated and unique-ish", () => {
  assert.equal(slugify("Indian Institute of Technology Bombay"), "indian-institute-of-technology-bombay");
  assert.equal(slugify("Birla Institute of Technology, Mesra, Ranchi"),
               "birla-institute-of-technology-mesra-ranchi");
});

test("buildIndex collects institutes with their branch count", () => {
  const idx = buildIndex([row({}), row({ prog: "EE" })]);
  assert.equal(idx.institutes.length, 1);
  assert.equal(idx.institutes[0].programs.size, 2);
  assert.equal(idx.institutes[0].slug, "iit-bombay");
});

test("buildInstituteSeries gaps a branch that did not exist in a year", () => {
  const rows = [row({ year: 2025, prog: "CS", cl: 100 }),
                row({ year: 2026, prog: "CS", cl: 90 }),
                row({ year: 2026, prog: "AI", cl: 300 })];
  const { years, series } = buildInstituteSeries(rows, { seat: "OPEN", gender: 0, metric: "cl" });
  assert.deepEqual(years, [2025, 2026]);
  assert.deepEqual(series.find(s => s.label === "AI").points, [null, 300]);
});

test("seriesToPoints places a missing year at that year's x, not at an index", () => {
  const pts = seriesToPoints([2020, 2024, 2026], [100, null, 50], 1000);
  assert.equal(pts.length, 3);
  assert.equal(pts[0].x, 0);
  assert.equal(pts[2].x, 1);
  assert.equal(pts[1].y, null);
});

test("seriesToPoints inverts the rank axis so rank 1 sits at the top", () => {
  const [top, bottom] = seriesToPoints([2020, 2021], [1, 1000], 1000);
  assert.ok(top.y < bottom.y);
});
