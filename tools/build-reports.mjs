#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   report/*.md  →  src/reports.generated.js

   Every chapter in the site is one PYQ topic-analysis report. This tool
   reads those markdown files (the hand-written source of truth) and emits
   the same numbers as structured data, so the app never parses markdown at
   runtime and the two can never drift.

   Run: node tools/build-reports.mjs
   ═══════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "report");
const OUT = path.join(ROOT, "src", "reports.generated.js");

/* ── markdown helpers ── */

const plain = (s) =>
  String(s ?? "")
    .replace(/\*\*/g, "")
    .replace(/\u0060/g, "")
    .replace(/\s+/g, " ")
    .trim();

/* Table cells are separated by " | " and never by a bare "|", because topic
   names legitimately contain pipes ("maximum-minimum of |z|"). Splitting on
   the spaced delimiter is what keeps that name in one cell. */
function cells(line) {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split(/\s+\|\s+/).map((c) => c.trim());
}

/* A rule row is "|---|---|" with no padding, so it never survives the
   spaced-cell split. Test the raw line instead. */
const isRuleLine = (line) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

function tableAfter(lines, head) {
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const first = cells(lines[i])[0];
    if (first !== head) continue;
    const rows = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (!/^\s*\|/.test(lines[j])) break;
      if (isRuleLine(lines[j])) continue;
      rows.push(cells(lines[j]));
    }
    return rows;
  }
  return [];
}

const num = (s) => {
  const cleaned = String(s ?? "").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};
const pctOf = (s) => num(String(s ?? "").replace(/%/g, ""));

/* "2019 (7), 2020 (6)" → [{year, q}] */
function yearList(text) {
  const out = [];
  const re = /(\d{4})\s*\((\d+)\)/g;
  let m;
  while ((m = re.exec(text))) out.push({ year: Number(m[1]), q: Number(m[2]) });
  return out;
}

/* ── one report ── */
function parseReport(text, file) {
  const lines = text.split(/\r?\n/);
  const parts = file.replace(/\.md$/, "").split("__");
  const subject = parts[0];
  const slug = parts.slice(1).join("__");

  const report = {
    file,
    subject,
    slug,
    id: subject + "/" + slug,
    chapter: "",
    unit: "",
    exams: "",
    questionsInFile: 0,
    analysed: 0,
    excluded: 0,
    grouping: "",
    span: "",
    unlabelled: /NOT YET LABELLED/i.test(text),
    summary: "",
    years: [],
    topics: [],
    matrix: [],
    detail: [],
    pattern: [],
  };

  const titleM = /^#\s+(.*?)\s+-\s+PYQ Topic Analysis\s*\((.*?)\)\s*$/.exec(lines[0] || "");
  if (titleM) {
    report.chapter = plain(titleM[1]);
    report.span = titleM[2];
  }

  /* front matter: the first two-column table */
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) continue;
    const row = cells(line);
    if (row.length !== 2 || row[0] === "Field") continue;
    const k = plain(row[0]);
    const v = plain(row[1]);
    if (k === "Chapter") report.chapter = v;
    else if (k === "Unit") report.unit = v;
    else if (k === "Exams present") report.exams = v;
    else if (k === "Questions in file") report.questionsInFile = num(v);
    else if (k.indexOf("2019 and after") >= 0) report.analysed = num(v);
    else if (k.indexOf("Excluded") === 0) report.excluded = num(v);
    else if (k === "Topic grouping") report.grouping = v;
  }

  /* section offsets */
  const h2 = [];
  lines.forEach((line, i) => {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) h2.push({ name: m[1], at: i });
  });
  const section = (prefix) => {
    const hit = h2.find((h) => h.name.indexOf(prefix) === 0);
    if (!hit) return null;
    const next = h2.find((h) => h.at > hit.at);
    return lines.slice(hit.at + 1, next ? next.at : lines.length);
  };

  const summaryBlock = section("0.");
  if (summaryBlock) {
    const line = summaryBlock.find((l) => /\*\*\d+ questions/.test(l));
    if (line) report.summary = plain(line);
  }

  const yearBlock = section("1.");
  if (yearBlock) {
    const rows = tableAfter(yearBlock, "Year").filter((r) => /^\d{4}$/.test(r[0]));
    report.years = rows.map((r) => ({
      year: Number(r[0]),
      q: num(r[1]),
      mcq: num(r[2]),
      num: num(r[3]),
    }));
  }

  const topicBlock = section("2.");
  if (topicBlock) {
    const rows = tableAfter(topicBlock, "Topic");
    report.topics = rows.map((r) => ({
      name: plain(r[0]),
      q: num(r[1]),
      share: pctOf(r[2]),
      mcq: num(r[3]),
      num: num(r[4]),
      span: plain(r[5] || ""),
    }));
  }

  const matrixBlock = section("3.");
  if (matrixBlock) {
    const rows = tableAfter(matrixBlock, "Year").filter((r) => /^\d{4}$/.test(r[0]));
    report.matrix = rows.map((r) => ({
      year: Number(r[0]),
      counts: r.slice(1, -1).map(num),
      total: num(r[r.length - 1]),
    }));
  }

  /* section 4 — one H3 per topic, then its sub-topic table */
  const detailBlock = section("4.");
  if (detailBlock) {
    let cur = null;
    let mode = "";
    for (const line of detailBlock) {
      const h3 = /^###\s+(?:\d+\.\d+\s*)?(.*)$/.exec(line);
      if (h3) {
        cur = { name: plain(h3[1]), q: 0, share: 0, mcq: 0, num: 0, years: [], subtopics: [], examples: [] };
        report.detail.push(cur);
        mode = "";
        continue;
      }
      if (!cur) continue;

      if (/^\s*<details>/.test(line)) {
        mode = "examples";
        continue;
      }
      if (/^\s*<\/details>/.test(line)) {
        mode = "";
        continue;
      }
      if (mode === "examples") {
        const ex = /^\s*-\s+\*\*(\d{4})\*\*\s*\(([^)]*)\)\s*(.*)$/.exec(line);
        if (ex) {
          cur.examples.push({
            year: Number(ex[1]),
            type: ex[2].trim(),
            text: plain(ex[3]).replace(/\.\.\.$/, "…"),
          });
        }
        continue;
      }

      const stats = /^\s*\*\*(\d+) questions\*\*\s*\(([\d.]+)\s*%\)\s*-\s*MCQ (\d+), Numerical (\d+)/.exec(line);
      if (stats) {
        cur.q = Number(stats[1]);
        cur.share = Number(stats[2]);
        cur.mcq = Number(stats[3]);
        cur.num = Number(stats[4]);
        continue;
      }
      if (/^\s*Years:/.test(line)) {
        cur.years = yearList(line);
        continue;
      }
      if (/^\s*\|/.test(line)) {
        if (isRuleLine(line)) continue;
        const row = cells(line);
        if (/^Sub-topic/i.test(row[0]) || row.length < 4) continue;
        if (!/^\d+$/.test(row[1])) continue;
        cur.subtopics.push({ name: plain(row[0]), q: num(row[1]), share: pctOf(row[2]), span: plain(row[3]) });
      }
    }
  }

  const patternBlock = section("5.");
  if (patternBlock) {
    report.pattern = patternBlock
      .filter((l) => /^\s*-\s+/.test(l))
      .map((l) => plain(l.replace(/^\s*-\s+/, "")));
  }

  return report;
}

/* ── build ── */
const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".md")).sort();
if (!files.length) {
  console.error("no reports found in " + SRC);
  process.exit(1);
}

const reports = {};
const problems = [];
for (const file of files) {
  const report = parseReport(fs.readFileSync(path.join(SRC, file), "utf8"), file);

  /* Every table in a report must agree with its headline count. A report
     that does not add up would render a chart contradicting its own totals,
     so the build stops instead of shipping it. */
  const sum = (list, key) => list.reduce((n, r) => n + r[key], 0);
  const checks = {
    years: sum(report.years, "q"),
    topics: sum(report.topics, "q"),
    detail: sum(report.detail, "q"),
    matrix: sum(report.matrix, "total"),
  };
  for (const where of Object.keys(checks)) {
    if (checks[where] !== report.analysed) {
      problems.push(report.id + ": " + where + " sums to " + checks[where] + ", headline says " + report.analysed);
    }
  }
  for (const row of report.matrix) {
    if (row.counts.length !== report.topics.length) {
      problems.push(report.id + ": matrix row " + row.year + " has " + row.counts.length + " topics, expected " + report.topics.length);
    }
  }
  reports[report.id] = report;
}

if (problems.length) {
  console.error("report data does not add up:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

const payload = { generatedFrom: "report/", reports };
const js =
  "/* Generated by tools/build-reports.mjs from report/*.md - do not edit. */\n" +
  "export const REPORT_DATA = " + JSON.stringify(payload) + ";\n";
fs.writeFileSync(OUT, js);

const ids = Object.keys(reports);
const totalQ = ids.reduce((n, id) => n + reports[id].analysed, 0);
console.log("reports: " + ids.length + ", questions since 2019: " + totalQ);
console.log("wrote " + path.relative(ROOT, OUT) + " (" + (js.length / 1024).toFixed(0) + " KB)");