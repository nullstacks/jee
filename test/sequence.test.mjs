import test from "node:test";
import assert from "node:assert/strict";
import { REPORTS } from "../src/lib/reports.ts";
import { groupByUnit, readingOrder, sequenceIndex, unitOf } from "../src/lib/syllabus.ts";

/* The reading order is authored by hand, which means it can fall out of step
   with the archive. These tests make that a build failure rather than a
   chapter that silently sorts to the bottom of every list. */

test("every chapter appears exactly once in the authored sequence", () => {
  for (const report of REPORTS) {
    assert.ok(
      sequenceIndex(report.id) !== Number.MAX_SAFE_INTEGER,
      report.id + " is missing from SEQUENCE in src/lib/syllabus.ts",
    );
  }
});

test("the sequence has no duplicate or stale entries", () => {
  const ids = new Set(REPORTS.map((r) => r.id));
  const seen = new Set();
  const ordered = REPORTS
    .map((r) => ({ id: r.id, at: sequenceIndex(r.id) }))
    .sort((a, b) => a.at - b.at);
  for (const row of ordered) {
    assert.ok(!seen.has(row.id), row.id + " appears twice in the sequence");
    seen.add(row.id);
    assert.ok(ids.has(row.id), row.id + " is in the sequence but not in the archive");
  }
});

test("readingOrder returns every chapter of a subject, in sequence", () => {
  for (const subject of ["physics", "chemistry", "mathematics"]) {
    const list = REPORTS.filter((r) => r.subject === subject);
    const order = readingOrder(subject, list);
    assert.equal(order.length, list.length);
    for (let i = 1; i < order.length; i++) {
      assert.ok(
        sequenceIndex(order[i - 1].id) < sequenceIndex(order[i].id),
        subject + ": " + order[i - 1].chapter + " should come after " + order[i].chapter,
      );
    }
  }
});

test("a subject reads Mechanics before Modern Physics", () => {
  const physics = REPORTS.filter((r) => r.subject === "physics");
  const order = readingOrder("physics", physics).map((r) => unitOf(r));
  assert.equal(order[0], "Mechanics");
  assert.equal(order[order.length - 1], "Modern Physics");
});

test("foundations come before the chapters that build on them", () => {
  const physics = REPORTS.filter((r) => r.subject === "physics");
  const orderP = readingOrder("physics", physics);
  const at = (id) => orderP.findIndex((r) => r.id === id);

  /* Every one of these pairs is a prerequisite relationship, not a taste. */
  assert.ok(at("physics/units-and-measurements") < at("physics/heat-and-thermodynamics"));
  assert.ok(at("physics/laws-of-motion") < at("physics/rotational-motion"));
  assert.ok(at("physics/electrostatics") < at("physics/capacitor"));
  assert.ok(at("physics/magnetics") < at("physics/electromagnetic-induction"));

  const maths = REPORTS.filter((r) => r.subject === "mathematics");
  const orderM = readingOrder("mathematics", maths);
  const mat = (id) => orderM.findIndex((r) => r.id === id);
  assert.ok(
    mat("mathematics/limits-continuity-and-differentiability") <
      mat("mathematics/application-of-derivatives"),
  );
  assert.ok(mat("mathematics/indefinite-integrals") < mat("mathematics/definite-integration"));
  assert.ok(mat("mathematics/vector-algebra") < mat("mathematics/3d-geometry"));
});

test("unitOf files vectors and 3D geometry together", () => {
  const vectors = REPORTS.find((r) => r.id === "mathematics/vector-algebra");
  const geometry = REPORTS.find((r) => r.id === "mathematics/3d-geometry");
  assert.ok(vectors && geometry);
  assert.equal(unitOf(vectors), unitOf(geometry));
});
test("a unit becomes exactly one group, no matter how the list is ordered", () => {
  /* Regression: bucketing by consecutive runs split Algebra in two whenever
     Calculus sat in the middle of the authored sequence, which produced two
     headings with the same React key and, on a subject switch, left the
     previous subject's rows on screen. */
  for (const subject of ["physics", "chemistry", "mathematics"]) {
    const list = REPORTS.filter((r) => r.subject === subject);
    const groups = groupByUnit(subject, readingOrder(subject, list));
    const titles = groups.map((g) => g.title);
    assert.equal(
      new Set(titles).size,
      titles.length,
      subject + " has duplicate unit headings: " + titles.join(", "),
    );
    const total = groups.reduce((n, g) => n + g.chapters.length, 0);
    assert.equal(total, list.length, subject + " lost chapters while grouping");
  }
});

test("every subject has a distinct set of unit headings", () => {
  /* The headings are used as React keys across the whole card, so two
     subjects sharing a heading name is safe only because the list is
     remounted per subject — this records that the collision is real. */
  const bySubject = {};
  for (const subject of ["physics", "chemistry", "mathematics"]) {
    bySubject[subject] = groupByUnit(
      subject,
      readingOrder(subject, REPORTS.filter((r) => r.subject === subject)),
    ).map((g) => g.title);
  }
  assert.ok(bySubject.physics.includes("Mechanics"));
  assert.deepEqual(bySubject.mathematics, [
    "Algebra",
    "Trigonometry",
    "Coordinate Geometry",
    "Vector & 3D",
    "Calculus",
  ]);
});