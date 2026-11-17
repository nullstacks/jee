import test from "node:test";
import assert from "node:assert/strict";
import { decodeAll, decodeSeats, classifyInst, buildSeason } from "../src/core.ts";

/* A packed seat record, hand-assembled so the format itself is under test:
   inst(2) prog(2) deg(1) seatCode(3) open(4) close(4) states(3) + pairs.
   "states" is two bits per round: 0 absent, 1 unchanged, 2 changed. */
const b36 = (n, w) => n.toString(36).padStart(w, "0");
const seatCode = (quotaIdx, seatIdx, g) => b36(quotaIdx * 20 + seatIdx * 2 + g, 3);

function pack({ inst, prog, deg = 0, quota = 0, seat = 0, g = 0, rounds, schedule }) {
  /* rounds: array of {op, cl} or null (not allocated that round) */
  const states = rounds
    .map((r, i) => (r == null ? 0 : i === 0 || (r.op === rounds[findPrev(rounds, i)].op && r.cl === rounds[findPrev(rounds, i)].cl) ? 1 : 2) << (2 * i))
    .reduce((a, b) => a | b, 0);
  let pairs = "";
  let prev = null;
  for (const r of rounds) {
    if (r == null) continue;
    if (prev && (r.op !== prev.op || r.cl !== prev.cl)) pairs += b36(r.op, 4) + b36(r.cl, 4);
    prev = r;
  }
  const first = rounds.find((r) => r != null);
  return (
    b36(inst, 2) + b36(prog, 2) + b36(deg, 1) + seatCode(quota, seat, g) +
    b36(first.op, 4) + b36(first.cl, 4) + b36(states, 3) + pairs
  );
}
function findPrev(arr, i) {
  for (let k = i - 1; k >= 0; k--) if (arr[k] != null) return k;
  return i;
}

const fixture = {
  I: ["B Institute", "A Institute"],
  P: ["Civil", "Computer Science"],
  D: ["4 Years, Bachelor of Technology"],
  T: [1, 0],
  R: { 2026: [1, 2, 3] },
  Y: {},
};

test("decodeAll round-trips a packed seat", () => {
  const data = {
    ...fixture,
    /* A one-round year: a single-round record is the whole schedule. */
    R: { 2026: [1] },
    Y: { 2026: pack({ inst: 1, prog: 1, rounds: [{ op: 10890, cl: 11172 }], schedule: [1] }) },
  };
  const rows = decodeAll(data);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    year: 2026, round: 1, inst: "A Institute", type: 0, prog: "Computer Science",
    deg: "4 Years, Bachelor of Technology", q: "AI", seat: "OPEN", g: 0,
    op: 10890, cl: 11172,
  });
});

test("decodeSeats carries a rank change forward across the rounds it held", () => {
  const data = {
    ...fixture,
    Y: { 2026: pack({
      inst: 1, prog: 1,
      rounds: [{ op: 100, cl: 200 }, { op: 100, cl: 200 }, { op: 90, cl: 180 }],
    }) },
  };
  const seats = decodeSeats(data);
  const rec = seats.get(2026)[0];
  assert.deepEqual(rec.rounds, [
    { round: 1, op: 100, cl: 200 },
    { round: 2, op: 100, cl: 200 },
    { round: 3, op: 90, cl: 180 },
  ]);
});

test("a seat that skips a round is not misnumbered", () => {
  const data = {
    ...fixture,
    Y: { 2026: pack({
      inst: 1, prog: 1,
      rounds: [null, { op: 400, cl: 500 }, null],
    }) },
  };
  const seats = decodeSeats(data);
  const rec = seats.get(2026)[0];
  assert.deepEqual(rec.rounds, [{ round: 2, op: 400, cl: 500 }]);
});

test("a seat absent in round 1 but present later still lands on the right round", () => {
  const data = {
    ...fixture,
    Y: { 2026: pack({ inst: 1, prog: 1, rounds: [null, null, { op: 7, cl: 9 }] }) },
  };
  const rec = decodeSeats(data).get(2026)[0];
  assert.equal(rec.rounds.length, 1);
  assert.equal(rec.rounds[0].round, 3);
  assert.equal(rec.rounds[0].cl, 9);
});

test("decodeAll keeps the final round of each year", () => {
  const data = {
    ...fixture,
    R: { 2026: [1, 2] },
    Y: { 2026: pack({
      inst: 1, prog: 1,
      rounds: [{ op: 100, cl: 200 }, { op: 100, cl: 150 }],
    }) },
  };
  const rows = decodeAll(data);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cl, 150, "the last round wins");
  assert.equal(rows[0].round, 2);
});

test("decodeAll drops a seat that was not allocated in the final round", () => {
  const data = {
    ...fixture,
    R: { 2026: [1, 2] },
    Y: { 2026: pack({ inst: 1, prog: 1, rounds: [{ op: 100, cl: 200 }, null] }) },
  };
  assert.equal(decodeAll(data).length, 0, "absent in the last round means absent from that view");
});

test("decodeAll marks the row with the institute type from the dictionary", () => {
  const data = {
    ...fixture,
    R: { 2026: [1] },
    Y: { 2026: pack({ inst: 0, prog: 0, rounds: [{ op: 1, cl: 2 }] }) },
  };
  assert.equal(decodeAll(data)[0].type, 1);
});

test("classifyInst sorts the four kinds", () => {
  assert.equal(classifyInst("Indian Institute of Technology Bombay"), 0);
  assert.equal(classifyInst("National Institute of Technology Trichy"), 1);
  assert.equal(classifyInst("International Institute of Information Technology Hyderabad"), 2);
  assert.equal(classifyInst("Birla Institute of Technology, Mesra"), 3);
});

test("buildSeason reports how a cut-off moved within one year", () => {
  const mk = (round, cl) => ({
    year: 2026, round, inst: "IIT Bombay", type: 0, prog: "CS",
    deg: "4 Years, Bachelor of Technology", q: "AI", seat: "OPEN", g: 0,
    op: 1, cl,
  });
  const rows = [mk(1, 1000), mk(2, 800), mk(3, 800), mk(4, 640)];
  const season = buildSeason(rows, { branch: "CS", seat: "OPEN", gender: 0, year: 2026 });
  assert.deepEqual(season.map((p) => p.round), [1, 2, 3, 4]);
  assert.deepEqual(season.map((p) => p.delta), [null, -200, 0, -160]);
  assert.equal(season[3].value, 640);
});

test("buildSeason keeps the friendliest quota pool when several share a round", () => {
  const base = {
    year: 2026, inst: "IIT Bombay", type: 0, prog: "CS",
    deg: "4 Years, Bachelor of Technology", seat: "OPEN", g: 0, op: 1,
  };
  const rows = [
    { ...base, round: 1, q: "AI", cl: 16000 },
    { ...base, round: 1, q: "HS", cl: 35000 },
  ];
  const season = buildSeason(rows, { branch: "CS", seat: "OPEN", gender: 0, year: 2026 });
  assert.equal(season.length, 1);
  assert.equal(season[0].value, 16000);
});

test("buildSeason of a branch the institute did not offer is empty", () => {
  assert.deepEqual(
    buildSeason([], { branch: "CS", seat: "OPEN", gender: 0, year: 2026 }),
    [],
  );
});

/* ── the shipped dataset itself ── */
import { JOSAA_DATA } from "../src/data.generated.js";

test("shipped data decodes to every year with plausible ranks", () => {
  const rows = decodeAll(JOSAA_DATA);
  assert.equal(rows.length, 72999);
  assert.deepEqual([...new Set(rows.map((r) => r.year))],
    [2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.equal(rows.filter((r) => r.op > r.cl).length, 0, "no opening above closing");
  assert.equal(rows.filter((r) => !r.cl).length, 0, "no blank closing rank");
  assert.equal(rows.filter((r) => !r.op).length, 0, "no blank opening rank");
  assert.equal(new Set(rows.map((r) => r.inst)).size, 147);
  assert.equal(new Set(rows.map((r) => r.prog)).size, 300);
});

test("2026 reproduces the single-year snapshot the site shipped before", () => {
  const rows = decodeAll(JOSAA_DATA).filter((r) => r.year === 2026);
  assert.equal(rows.length, 12763);
});

test("every decoded institute carries a type index in range", () => {
  const rows = decodeAll(JOSAA_DATA);
  assert.ok(rows.every((r) => r.type >= 0 && r.type <= 3));
  assert.equal(rows.filter((r) => r.type === 0).length > 0, true, "some IITs");
  assert.equal(rows.filter((r) => r.type === 1).length > 0, true, "some NITs");
});

test("shipped data keeps every round, not just the final one", () => {
  const seats = decodeSeats(JOSAA_DATA);
  let points = 0;
  for (const [, list] of seats) for (const s of list) points += s.rounds.length;
  assert.equal(points, 418156, "every round of every seat is in the bundle");

  /* 2026 ran five rounds; a seat that existed in round 1 must appear in all. */
  const r2026 = seats.get(2026);
  const full = r2026.filter((s) => s.rounds.length === 5);
  assert.ok(full.length > 10000, "most seats span the whole season");
});

test("cut-offs widen as the rounds progress, which is why the round matters", () => {
  const seats = decodeSeats(JOSAA_DATA);
  let widened = 0;
  let narrowed = 0;
  for (const [, list] of seats) {
    for (const s of list) {
      for (let i = 1; i < s.rounds.length; i++) {
        if (s.rounds[i].cl > s.rounds[i - 1].cl) widened++;
        else if (s.rounds[i].cl < s.rounds[i - 1].cl) narrowed++;
      }
    }
  }
  /* A later round admits candidates further down the list, so the closing rank
     number grows. Later rounds are very nearly never stricter. */
  assert.ok(widened > narrowed * 10, "expected widening to dominate: " + widened + " vs " + narrowed);
  assert.ok(widened > 100000, "and to dominate across the whole dataset");
});
