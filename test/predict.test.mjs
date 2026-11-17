import test from "node:test";
import assert from "node:assert/strict";
import { keyOf, mergeQuotas, chanceOf, predict } from "../src/core.ts";
import { setPendingRank, takePendingRank } from "../src/lib/handoff.ts";

const row = (o) => ({ year: 2026, inst: "IIT Bombay", type: 0, prog: "CS",
  deg: "4 Years, Bachelor of Technology", q: "AI", seat: "OPEN", g: 0,
  op: 100, cl: 200, ...o });

test("keyOf ignores quota and year but not gender or seat", () => {
  assert.equal(keyOf(row({ q: "AI" })), keyOf(row({ q: "HS" })));
  assert.notEqual(keyOf(row({ g: 1 })), keyOf(row({ g: 0 })));
  assert.notEqual(keyOf(row({ seat: "EWS" })), keyOf(row({ seat: "OPEN" })));
});

test("mergeQuotas keeps the best closing rank and names the winning quota", () => {
  const merged = mergeQuotas([row({ q: "AI", op: 14576, cl: 16001 }),
                              row({ q: "HS", op: 33757, cl: 35618 })]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].row.cl, 16001);
  assert.equal(merged[0].row.q, "AI");
  assert.deepEqual(merged[0].quotas.sort(), ["AI", "HS"]);
});

test("mergeQuotas leaves a single-quota row alone", () => {
  const merged = mergeQuotas([row({ q: "OS", cl: 500 })]);
  assert.deepEqual(merged[0].quotas, ["OS"]);
});

test("chanceOf buckets at 10% below, at the line, and 15% above", () => {
  assert.equal(chanceOf(900, 1000), "safe");
  assert.equal(chanceOf(1000, 1000), "mod");
  assert.equal(chanceOf(1100, 1000), "reach");
  assert.equal(chanceOf(1200, 1000), null);
});

test("predict with an empty quota compares against the best quota", () => {
  const rows = [row({ q: "AI", cl: 16001 }), row({ q: "HS", cl: 35618 })];
  const { results } = predict({ rows, rank: 17000, seat: "OPEN", quota: "",
    gender: 0, deg: "", types: new Set([0,1,2,3]), terms: [], sort: "best", year: 2026 });
  assert.equal(results.length, 1, "the two quota rows collapse into one");
  assert.equal(results[0].row.cl, 16001);
});

test("predict filters by explicit quota, year and gender", () => {
  const rows = [row({ q: "AI", cl: 100 }), row({ q: "HS", cl: 100 }),
                row({ q: "AI", cl: 100, year: 2025 }), row({ q: "AI", cl: 100, g: 1 })];
  const { results } = predict({ rows, rank: 50, seat: "OPEN", quota: "AI",
    gender: 0, deg: "", types: new Set([0]), terms: [], sort: "best", year: 2026 });
  assert.equal(results.length, 1);
});

/* ─────────────── Cut-offs → predictor handoff ─────────────── */

test("the handoff slot is read once and then empty", () => {
  setPendingRank(4242);
  assert.equal(takePendingRank(), 4242);
  assert.equal(takePendingRank(), null);
});

test("the handoff slot ignores a rank that is not a usable number", () => {
  setPendingRank(0);
  assert.equal(takePendingRank(), null);
  setPendingRank(Number.NaN);
  assert.equal(takePendingRank(), null);
  setPendingRank(-5);
  assert.equal(takePendingRank(), null);
});
