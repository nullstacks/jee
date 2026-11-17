#!/usr/bin/env node
/* Packs the seven JoSAA CSVs into base-36 strings and rewrites index.html.
   Node built-ins only. Run: node tools/build.mjs  */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QUOTAS, SEATS, TYPES, ROW_CHARS, MAX_RANK, slugify } from "../src/core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_DIR = path.resolve(ROOT, "..");
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

/* RFC-4180 CSV: quoted fields, doubled quotes, CRLF. */
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let f = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ""; }
    else if (c === '\n') { row.push(f); f = ""; rows.push(row); row = []; }
    else if (c !== '\r') f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ""));
}

const norm = s => String(s ?? "").replace(/\s+/g, " ").trim();

/* Source files write "OPEN (PWD)"; our canonical label is "OPEN (PwD)".
   Match case-insensitively and emit the canonical spelling. */
const byUpper = list => new Map(list.map(v => [v.toUpperCase(), v]));
const QUOTA_BY_UP = byUpper(QUOTAS);
const SEAT_BY_UP = byUpper(SEATS);
const canonical = (map, raw) => {
  const hit = map.get(raw.toUpperCase());
  if (!hit) throw new Error(`unrecognised value "${raw}" — expected one of ${[...map.values()].join(", ")}`);
  return hit;
};

/* "<programme> (<degree>)" -> {prog, deg}. Degrees always start with a year
   count, e.g. "4 Years, Bachelor of Technology". */
function splitProgramme(full) {
  const m = norm(full).match(/^(.*?)[\s]*[(](\d+ Years?,.*)[)]$/);
  return m ? { prog: norm(m[1]), deg: norm(m[2]) } : { prog: norm(full), deg: "" };
}

function classify(name) {
  const l = name.toLowerCase();
  if (/^indian institute\s+of technology/.test(l)) return 0;
  if (/^national institute of technology/.test(l)) return 1;
  if (/^(indian|international) institute of information technology/.test(l)) return 2;
  return 3;
}

/* ── read every year, keep only that year's final round ── */
const records = [];
for (const year of YEARS) {
  const file = path.join(CSV_DIR, `josaa_${year}.csv`);
  if (!fs.existsSync(file)) { console.error(`missing ${file}`); process.exit(1); }
  const table = parseCSV(fs.readFileSync(file, "utf8"));
  const head = table[0].map(h => h.toLowerCase().trim());
  const col = k => head.findIndex(h => h === k);
  const CI = {
    round: col("round"), inst: col("institute"), prog: col("academic_program"),
    q: col("quota"), seat: col("seat_type"), g: col("gender"),
    op: col("opening_rank"), cl: col("closing_rank")
  };
  const body = table.slice(1);
  const lastRound = Math.max(...body.map(r => Number(r[CI.round])));
  let n = 0;
  for (const r of body) {
    if (Number(r[CI.round]) !== lastRound) continue;
    const inst = norm(r[CI.inst]);
    const { prog, deg } = splitProgramme(r[CI.prog]);
    const op = Number(r[CI.op]) || 0;
    const cl = Number(r[CI.cl]) || 0;
    if (!cl) continue;
    if (op > MAX_RANK || cl > MAX_RANK) {
      console.error(`${year}: rank ${Math.max(op, cl)} exceeds the packed field`); process.exit(1);
    }
    records.push({ year, inst, prog, deg,
      q: canonical(QUOTA_BY_UP, norm(r[CI.q])),
      seat: canonical(SEAT_BY_UP, norm(r[CI.seat])),
      g: norm(r[CI.g]).toLowerCase().startsWith("female") ? 1 : 0, op, cl });
    n++;
  }
  console.log(`${year}  round ${lastRound}  ${n} rows`);
}

/* ── dictionaries ── */
const insts = [...new Set(records.map(r => r.inst))].sort((a, b) => a.localeCompare(b));
const progs = [...new Set(records.map(r => r.prog))].sort((a, b) => a.localeCompare(b));
const degs = [...new Set(records.map(r => r.deg))].sort((a, b) => a.localeCompare(b));
if (insts.length > 36 ** 2) throw new Error("too many institutes for a 2-char index");
if (progs.length > 36 ** 2) throw new Error("too many programmes for a 2-char index");
if (degs.length > 36) throw new Error("too many degrees for a 1-char index");

const iI = new Map(insts.map((v, i) => [v, i]));
const iP = new Map(progs.map((v, i) => [v, i]));
const iD = new Map(degs.map((v, i) => [v, i]));
const types = insts.map(classify);

/* ── pack ── */
const byYear = {};
for (const y of YEARS) byYear[y] = "";
let counter = 0;
for (const r of records) {
  const seatIdx = SEATS.indexOf(r.seat);
  const quotaIdx = QUOTAS.indexOf(r.q);
  if (seatIdx < 0 || quotaIdx < 0) throw new Error(`unknown seat/quota: ${r.seat} / ${r.q}`);
  const code = quotaIdx * 20 + seatIdx * 2 + r.g;
  byYear[r.year] +=
    iI.get(r.inst).toString(36).padStart(2, "0") +
    iP.get(r.prog).toString(36).padStart(2, "0") +
    iD.get(r.deg).toString(36) +
    code.toString(36).padStart(3, "0") +
    r.op.toString(36).padStart(4, "0") +
    r.cl.toString(36).padStart(4, "0");
  counter++;
}

const packedLen = Object.values(byYear).reduce((a, s) => a + s.length, 0);
console.log(`total ${counter} rows`);
console.log(`packed ${(packedLen / 1024).toFixed(0)} KB (${insts.length} institutes, ${progs.length} programmes, ${degs.length} degrees)`);

/* ── emit data module ── */
const dataJs = "export const JOSAA_DATA = " + JSON.stringify({
  I: insts, P: progs, D: degs, T: types, Y: byYear
}) + ";\n";
fs.mkdirSync(path.join(ROOT, "src"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "src", "data.generated.js"), dataJs);
console.log("wrote src/data.generated.js");

/* ── rewrite index.html between the marker pairs ── */
const htmlPath = path.join(ROOT, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");

/* index.html is CRLF on disk, so normalise what we inject to match and the
   build stays byte-identical on every run. */
const crlf = s => s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
const core = crlf(fs.readFileSync(path.join(ROOT, "src", "core.js"), "utf8")
  .replace(/^export /gm, "")
  .trimEnd());

function swap(src, tag, body) {
  const re = new RegExp(`(/\\*<${tag}>\\*/)[\\s\\S]*?(/\\*</${tag}>\\*/)`, "g");
  const hits = src.match(re);
  if (!hits || hits.length !== 1) {
    console.error(`expected exactly one <${tag}> block in index.html, found ${hits ? hits.length : 0}`);
    process.exit(1);
  }
  return src.replace(re, `$1\n${body}\n$2`);
}

html = swap(html, "CORE", core);
html = swap(html, "DATA", crlf("const JOSAA_DATA = " + JSON.stringify({ I: insts, P: progs, D: degs, T: types, Y: byYear }) + ";"));
fs.writeFileSync(htmlPath, html);
console.log(`index.html now ${(html.length / 1024 / 1024).toFixed(2)} MB`);
