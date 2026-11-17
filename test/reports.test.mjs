import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_YEARS,
  CHAPTER_ROWS,
  PRIO_CUT,
  RECENT_YEARS,
  REPORTS,
  REPORT_BY_ID,
  SUBJECT_KEYS,
  TOTAL_ANALYSED,
  askedEveryYear,
  chapterHref,
  matchesQuery,
  neighbours,
  priorityOf,
  recentRate,
  recentShare,
  reportFromArg,
  yearSeries,
} from "../src/lib/reports.ts";

/* Every number the site prints comes out of report/*.md through
   tools/build-reports.mjs. These tests are what keep the compiled data
   honest: a report that stops adding up, or a chapter that loses its
   route, fails here instead of rendering a chart that contradicts itself. */

test("every report is present and parsed", () => {
  assert.ok(REPORTS.length >= 90, "expected the full chapter archive, got " + REPORTS.length);
  for (const report of REPORTS) {
    assert.ok(report.chapter, report.id + " has no chapter name");
    assert.ok(report.unit, report.id + " has no unit");
    assert.ok(SUBJECT_KEYS.includes(report.subject), report.id + " has an unknown subject");
    assert.equal(report.id, report.subject + "/" + report.slug);
  }
});

test("every report's tables agree with its headline count", () => {
  for (const report of REPORTS) {
    const years = report.years.reduce((n, y) => n + y.q, 0);
    const topics = report.topics.reduce((n, t) => n + t.q, 0);
    const detail = report.detail.reduce((n, d) => n + d.q, 0);
    const matrix = report.matrix.reduce((n, r) => n + r.total, 0);
    assert.equal(years, report.analysed, report.id + " year table");
    assert.equal(topics, report.analysed, report.id + " topic table");
    assert.equal(detail, report.analysed, report.id + " topic detail");
    assert.equal(matrix, report.analysed, report.id + " matrix");
  }
});

test("a year × topic matrix has one column per topic", () => {
  for (const report of REPORTS) {
    for (const row of report.matrix) {
      assert.equal(
        row.counts.length,
        report.topics.length,
        report.id + " " + row.year + " has " + row.counts.length + " of " + report.topics.length + " topics",
      );
      assert.equal(
        row.counts.reduce((a, b) => a + b, 0),
        row.total,
        report.id + " " + row.year + " row does not sum to its total",
      );
    }
  }
});

test("every topic in a report has a matching detail block", () => {
  for (const report of REPORTS) {
    for (const topic of report.topics) {
      assert.ok(
        report.detail.some((d) => d.name === topic.name),
        report.id + ": topic " + topic.name + " has no detail block",
      );
    }
  }
});

test("a labelled report leads with at least one real question", () => {
  for (const report of REPORTS) {
    if (report.unlabelled || !report.analysed) continue;
    const withExamples = report.detail.filter((d) => d.examples.length);
    assert.ok(withExamples.length > 0, report.id + " quotes no questions");
  }
});

test("shares sum to 100 per report, within rounding", () => {
  for (const report of REPORTS) {
    /* A chapter with no 2019+ questions has no topics to divide up. */
    if (!report.topics.length) continue;
    const total = report.topics.reduce((n, t) => n + t.share, 0);
    assert.ok(
      Math.abs(total - 100) < 1.5,
      report.id + " topic shares sum to " + total.toFixed(1) + "%",
    );
  }
});

test("the recent window is the last three examined seasons", () => {
  assert.equal(RECENT_YEARS.length, 3);
  assert.deepEqual(RECENT_YEARS, ALL_YEARS.slice(-3));
  for (let i = 1; i < ALL_YEARS.length; i++) {
    assert.ok(ALL_YEARS[i] > ALL_YEARS[i - 1], "years must ascend");
  }
});

test("every chapter resolves from its own hash", () => {
  for (const report of REPORTS) {
    const hash = chapterHref(report.id);
    assert.equal(hash, "#report/" + report.id);
    assert.equal(reportFromArg(hash.replace("#report/", "")), report);
  }
});

test("an unknown chapter hash resolves to nothing, not to a wrong chapter", () => {
  assert.equal(reportFromArg("physics/nope"), null);
  assert.equal(reportFromArg(""), null);
});

test("priority bands cover every chapter and follow the published cuts", () => {
  const bands = { H: 0, M: 0, L: 0 };
  for (const row of CHAPTER_ROWS) {
    const share = recentShare(row.report);
    const prio = priorityOf(row.report);
    bands[prio] += 1;
    if (prio === "H") assert.ok(share >= PRIO_CUT.H, row.report.id + " high with " + share.toFixed(2) + "%");
    if (prio === "M") assert.ok(share >= PRIO_CUT.M && share < PRIO_CUT.H, row.report.id + " medium");
    if (prio === "L") assert.ok(share < PRIO_CUT.M, row.report.id + " low with " + share.toFixed(2) + "%");
  }
  /* A band nobody lands in means the thresholds have drifted off the data. */
  assert.ok(bands.H > 0 && bands.M > 0 && bands.L > 0, JSON.stringify(bands));
});

test("recent rate counts only the last three seasons", () => {
  const report = REPORT_BY_ID.get("physics/electrostatics");
  assert.ok(report);
  const expected = report.years
    .filter((y) => y.year >= RECENT_YEARS[0])
    .reduce((n, y) => n + y.q, 0) / 3;
  assert.equal(recentRate(report), expected);
  assert.ok(recentRate(report) > 0);
});

test("yearSeries is zero-filled across the whole archive window", () => {
  const report = REPORT_BY_ID.get("chemistry/solid-state");
  assert.ok(report);
  const series = yearSeries(report);
  assert.equal(series.length, ALL_YEARS.length);
  assert.deepEqual(series.map((s) => s.year), ALL_YEARS);
  /* Solid State was dropped after 2023, so the tail must be zeros rather than
     missing — a sparkline that drops the gap draws a lie. */
  assert.equal(series[series.length - 1].q, 0);
});

test("askedEveryYear only fires inside the recent window", () => {
  const electrostatics = REPORT_BY_ID.get("physics/electrostatics");
  assert.ok(electrostatics);
  assert.equal(askedEveryYear(electrostatics), true);
  const induction = REPORT_BY_ID.get("mathematics/mathematical-induction");
  assert.ok(induction);
  assert.equal(askedEveryYear(induction), false);
});

test("search reaches a topic name, not just the chapter name", () => {
  const electrostatics = REPORT_BY_ID.get("physics/electrostatics");
  assert.ok(electrostatics);
  assert.equal(matchesQuery(electrostatics, "electrostatics"), true);
  assert.equal(matchesQuery(electrostatics, "dipole"), true);
  assert.equal(matchesQuery(electrostatics, "not a real topic"), false);
});

test("neighbours stay inside the subject and exclude the chapter itself", () => {
  for (const report of REPORTS) {
    const { prev, next } = neighbours(report);
    for (const other of [prev, next]) {
      if (!other) continue;
      assert.equal(other.subject, report.subject);
      assert.notEqual(other.id, report.id);
    }
  }
});

test("the archive total matches the sum of every chapter", () => {
  const sum = REPORTS.reduce((n, r) => n + r.analysed, 0);
  assert.equal(sum, TOTAL_ANALYSED);
});