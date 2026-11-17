#!/usr/bin/env node
/* Packs the JoSAA CSVs into base-36 strings and writes src/data.generated.js.
   Node built-ins only.

   Every round of every year is kept, delta-encoded. A seat is stored once with
   its round-1 ranks, then a bitmask says which later rounds moved, followed by
   only those new pairs. Cut-offs tighten by thousands of ranks between round 1
   and the final round, so this is the difference between "this college is out
   of reach" and "you would have been admitted here".

   Row layout (all base 36):
     inst(2) prog(2) deg(1) seatCode(3) open(4) close(4) states(3) pairs(c*8)

   "states" packs two bits per round of the year, low round first:
     0 = this seat is not allocated in that round
     1 = allocated, ranks unchanged from the previous allocated round
     2 = allocated, ranks changed (a new pair follows)
   Six rounds therefore need 12 bits, which fits in three base-36 characters.
   Presence has to be explicit: a seat can drop out of the allocation for a
   round and come back, so a run of rounds is not always contiguous.

   Run: npm run data   (from site/) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { QUOTAS, SEATS, YEARS, MAX_RANK, classifyInst } from "../src/core.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_DIR = path.resolve(ROOT, "..");

/* RFC-4180 CSV: quoted fields, doubled quotes, CRLF. */
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let f = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); f = ""; rows.push(row); row = []; }
    else if (c !== "\r") f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/* Source files write "OPEN (PWD)"; our canonical label is "OPEN (PwD)".
   Match case-insensitively and emit the canonical spelling. */
const byUpper = (list) => new Map(list.map((v) => [v.toUpperCase(), v]));
const QUOTA_BY_UP = byUpper(QUOTAS);
const SEAT_BY_UP = byUpper(SEATS);
const canonical = (map, raw) => {
  const hit = map.get(raw.toUpperCase());
  if (!hit) {
    throw new Error(
      'unrecognised value "' + raw + '" - expected one of ' + [...map.values()].join(", "),
    );
  }
  return hit;
};

/* "<programme> (<degree>)" -> { prog, deg }. Degrees always start with a
   year count, e.g. "4 Years, Bachelor of Technology". */
function splitProgramme(full) {
  const m = norm(full).match(/^(.*?)[\s]*[(](\d+ Years?,.*)[)]$/);
  return m ? { prog: norm(m[1]), deg: norm(m[2]) } : { prog: norm(full), deg: "" };
}

/* ── read every year, every round ── */
const records = [];
const R = {};
for (const year of YEARS) {
  const file = path.join(CSV_DIR, "josaa_" + year + ".csv");
  if (!fs.existsSync(file)) {
    console.error("missing " + file);
    process.exit(1);
  }
  const table = parseCSV(fs.readFileSync(file, "utf8"));
  const head = table[0].map((h) => h.toLowerCase().trim());
  const col = (k) => head.findIndex((h) => h === k);
  const CI = {
    round: col("round"), inst: col("institute"), prog: col("academic_program"),
    q: col("quota"), seat: col("seat_type"), g: col("gender"),
    op: col("opening_rank"), cl: col("closing_rank"),
  };
  const seen = new Set();
  let n = 0;
  for (const r of table.slice(1)) {
    const round = Number(r[CI.round]);
    if (!round) continue;
    const cl = Number(r[CI.cl]) || 0;
    if (!cl) continue;
    const op = Number(r[CI.op]) || 0;
    if (op > MAX_RANK || cl > MAX_RANK) {
      console.error(year + ": rank " + Math.max(op, cl) + " exceeds the packed field");
      process.exit(1);
    }
    const inst = norm(r[CI.inst]);
    const { prog, deg } = splitProgramme(r[CI.prog]);
    records.push({
      year, round, inst, prog, deg,
      q: canonical(QUOTA_BY_UP, norm(r[CI.q])),
      seat: canonical(SEAT_BY_UP, norm(r[CI.seat])),
      g: norm(r[CI.g]).toLowerCase().startsWith("female") ? 1 : 0,
      op, cl,
    });
    seen.add(round);
    n++;
  }
  R[year] = [...seen].sort((a, b) => a - b);
  console.log(year + "  rounds " + R[year].join(",") + "  " + n + " rows");
}

/* ── dictionaries ── */
const insts = [...new Set(records.map((r) => r.inst))].sort((a, b) => a.localeCompare(b));
const progs = [...new Set(records.map((r) => r.prog))].sort((a, b) => a.localeCompare(b));
const degs = [...new Set(records.map((r) => r.deg))].sort((a, b) => a.localeCompare(b));
if (insts.length > 36 ** 2) throw new Error("too many institutes for a 2-char index");
if (progs.length > 36 ** 2) throw new Error("too many programmes for a 2-char index");
if (degs.length > 36) throw new Error("too many degrees for a 1-char index");

const iI = new Map(insts.map((v, i) => [v, i]));
const iP = new Map(progs.map((v, i) => [v, i]));
const iD = new Map(degs.map((v, i) => [v, i]));
const types = insts.map(classifyInst);
const b36 = (n, w) => n.toString(36).padStart(w, "0");

/* ── group by seat ──
   A seat is one institute + programme + degree + quota + seat type + gender
   pool. Across rounds its ranks move; the group is stored once and later
   rounds carry only the values that changed. */
const groups = new Map();
for (const r of records) {
  const key =
    r.year + "|" + r.inst + "|" + r.prog + "|" + r.deg + "|" + r.q + "|" + r.seat + "|" + r.g;
  let g = groups.get(key);
  if (!g) {
    g = { year: r.year, inst: r.inst, prog: r.prog, deg: r.deg, q: r.q, seat: r.seat, g: r.g, byRound: new Map() };
    groups.set(key, g);
  }
  g.byRound.set(r.round, { op: r.op, cl: r.cl });
}

let moved = 0, held = 0, late = 0;
const Y = {};
for (const y of YEARS) Y[y] = "";

for (const g of groups.values()) {
  const schedule = R[g.year];
  const rounds = [...g.byRound.keys()].sort((a, b) => a - b);
  if (rounds[0] !== schedule[0]) late++;

  const seatIdx = SEATS.indexOf(g.seat);
  const quotaIdx = QUOTAS.indexOf(g.q);
  const code = quotaIdx * 20 + seatIdx * 2 + g.g;
  const base = g.byRound.get(rounds[0]);

  let states = 0;
  let pairs = "";
  let prev = null;
  for (let i = 0; i < schedule.length; i++) {
    const cur = g.byRound.get(schedule[i]);
    if (!cur) continue; // absent this round
    if (prev === null) {
      states |= 1 << (2 * i); // present, values live in the header
      prev = cur;
      continue;
    }
    if (cur.op === prev.op && cur.cl === prev.cl) {
      states |= 1 << (2 * i); // present, unchanged
      held++;
    } else {
      states |= 2 << (2 * i); // present, changed
      pairs += b36(cur.op, 4) + b36(cur.cl, 4);
      moved++;
    }
    prev = cur;
  }

  Y[g.year] +=
    b36(iI.get(g.inst), 2) + b36(iP.get(g.prog), 2) + b36(iD.get(g.deg), 1) +
    b36(code, 3) + b36(base.op, 4) + b36(base.cl, 4) +
    b36(states, 3) + pairs;
}

if (Object.values(Y).some((s) => s.includes("undefined"))) {
  throw new Error("encoding produced undefined indices");
}

const packedLen = Object.values(Y).reduce((a, s) => a + s.length, 0);
console.log("seats " + groups.size + " (" + late + " start after round 1)");
console.log("transitions: " + moved + " moved, " + held + " held (" + Math.round((held / (moved + held)) * 100) + "% static)");
console.log(
  "packed " + (packedLen / 1048576).toFixed(2) + " MB (" + insts.length +
  " institutes, " + progs.length + " programmes, " + degs.length + " degrees)",
);

/* ── emit ── */
const out = path.join(ROOT, "src", "data.generated.js");
const payload = { I: insts, P: progs, D: degs, T: types, R, Y };
fs.writeFileSync(out, "export const JOSAA_DATA = " + JSON.stringify(payload) + ";\n");
console.log("wrote src/data.generated.js (" + (fs.statSync(out).size / 1048576).toFixed(2) + " MB)");
