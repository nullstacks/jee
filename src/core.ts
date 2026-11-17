/* ═══════════════════════════════════════════════════════════════════
   JEE core — pure data + query logic.
   Runs unchanged in Node (tests) and in the browser. No DOM access.
   ═══════════════════════════════════════════════════════════════════ */

export const QUOTAS = ["AI", "HS", "OS", "GO", "JK", "LA"];
export const QUOTA_LONG: Record<string, string> = {
  AI: "All India",
  HS: "Home state",
  OS: "Other state",
  GO: "Goa",
  JK: "Jammu & Kashmir",
  LA: "Ladakh",
};
export const SEATS = [
  "OPEN", "EWS", "OBC-NCL", "SC", "ST",
  "OPEN (PwD)", "EWS (PwD)", "OBC-NCL (PwD)", "SC (PwD)", "ST (PwD)",
];
export const TYPES = ["IIT", "NIT", "IIIT", "GFTI"];
/* Fixed part of a packed seat record: inst(2) prog(2) deg(1) seatCode(3)
   open(4) close(4) states(3). Changed pairs follow. "states" packs two bits
   per round of the year (0 absent, 1 unchanged, 2 changed), low round first,
   so a seat that skips a round and returns still lines up correctly. */
export const ROW_CHARS = 19;
export const MAX_RANK = 36 ** 4 - 1; // 1,679,615 — the 4-char base-36 ceiling
export const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

export type InstType = 0 | 1 | 2 | 3;
export type Chance = "safe" | "mod" | "reach";
export type SortKey = "best" | "worst" | "inst" | "prog";

export interface PackedData {
  I: string[];
  P: string[];
  D: string[];
  T: InstType[];
  /** Rounds actually run in each year, ascending. */
  R: Record<string, number[]>;
  /** Packed seat records, delta-encoded across rounds. */
  Y: Record<string, string>;
}

export interface Row {
  year: number;
  round: number;
  inst: string;
  type: InstType;
  prog: string;
  deg: string;
  q: string;
  seat: string;
  g: 0 | 1;
  op: number;
  cl: number;
}

export interface SeatRecord {
  inst: string;
  prog: string;
  deg: string;
  q: string;
  seat: string;
  g: 0 | 1;
  /** One entry per round, in the order the year ran them. */
  rounds: { round: number; op: number; cl: number }[];
}

export interface Institute {
  name: string;
  type: InstType;
  slug: string;
  programs: Set<string>;
  years: number[];
}

/* ─────────────── decode ─────────────── */
export function classifyInst(name: string): InstType {
  const l = String(name || "").toLowerCase();
  if (/^indian institute\s+of technology/.test(l)) return 0;
  if (/^national institute of technology/.test(l)) return 1;
  if (/^(indian|international) institute of information technology/.test(l)) return 2;
  return 3;
}

/* The packed stream is read once into per-seat records. Rows are materialised
   lazily, per round, because a single year is ~7 rounds x 12k seats and most
   views only ever need one round of it. */
export function decodeSeats(data: PackedData): Map<number, SeatRecord[]> {
  const out = new Map<number, SeatRecord[]>();
  const years = Object.keys(data.Y).map(Number).sort((a, b) => a - b);

  for (const year of years) {
    const d = data.Y[year] ?? "";
    const rounds = data.R[year] ?? [];
    const list: SeatRecord[] = [];

    let o = 0;
    while (o < d.length) {
      const instIdx = parseInt(d.substr(o, 2), 36);
      const progIdx = parseInt(d.substr(o + 2, 2), 36);
      const degIdx = parseInt(d.substr(o + 4, 1), 36);
      const code = parseInt(d.substr(o + 5, 3), 36);
      let op = parseInt(d.substr(o + 8, 4), 36);
      let cl = parseInt(d.substr(o + 12, 4), 36);
      const states = parseInt(d.substr(o + 16, 3), 36);
      let cursor = o + ROW_CHARS;

      const points: { round: number; op: number; cl: number }[] = [];

      for (let i = 0; i < rounds.length; i++) {
        const state = (states >> (2 * i)) & 3;
        if (state === 0) continue;
        if (state === 2) {
          op = parseInt(d.substr(cursor, 4), 36);
          cl = parseInt(d.substr(cursor + 4, 4), 36);
          cursor += 8;
        }
        points.push({ round: rounds[i], op, cl });
      }

      list.push({
        inst: data.I[instIdx],
        prog: data.P[progIdx],
        deg: data.D[degIdx],
        q: QUOTAS[Math.floor(code / 20)] ?? "AI",
        seat: SEATS[Math.floor((code % 20) / 2)] ?? "OPEN",
        g: (code % 2) as 0 | 1,
        rounds: points,
      });

      o = cursor;
    }

    out.set(year, list);
  }

  return out;
}

/* Flatten to rows. Passing a round keeps only that round's seat list; passing
   null keeps the final round of each year, which is the widest cut-off and
   what the site compared against before rounds were selectable. */
export function seatsToRows(
  seats: Map<number, SeatRecord[]>,
  round: number | null,
  finalRoundOf: (year: number) => number,
): Row[] {
  const out: Row[] = [];
  for (const [year, list] of seats) {
    const wanted = round ?? finalRoundOf(year);
    for (const s of list) {
      const hit = s.rounds.find((r) => r.round === wanted);
      if (!hit) continue;
      out.push({
        year,
        round: hit.round,
        inst: s.inst,
        type: 0, // filled in by the caller, which owns the type dictionary
        prog: s.prog,
        deg: s.deg,
        q: s.q,
        seat: s.seat,
        g: s.g,
        op: hit.op,
        cl: hit.cl,
      });
    }
  }
  return out;
}

export function decodeAll(data: PackedData): Row[] {
  const seats = decodeSeats(data);
  const finalRoundOf = (year: number) => {
    const rounds = data.R[year] ?? [];
    return rounds[rounds.length - 1];
  };
  const typeByName = new Map(data.I.map((name, i) => [name, data.T[i]]));
  return seatsToRows(seats, null, finalRoundOf).map((r) => ({
    ...r,
    type: typeByName.get(r.inst) ?? 3,
  }));
}

/* ─────────────── keys + quota merge ─────────────── */
export function keyOf(r: Row): string {
  return r.inst + "|" + r.prog + "|" + r.deg + "|" + r.seat + "|" + r.g;
}

/* With "Any quota" selected a seat can appear in several quota pools with
   different ranks. Collapse to the best (smallest) closing rank and record
   which quotas contributed, so a row is never listed twice. */
export function mergeQuotas(rows: Row[]): { row: Row; quotas: string[] }[] {
  const groups = new Map<string, { row: Row; quotas: string[] }>();
  for (const r of rows) {
    const k = keyOf(r);
    const hit = groups.get(k);
    if (!hit) {
      groups.set(k, { row: r, quotas: [r.q] });
      continue;
    }
    if (!hit.quotas.includes(r.q)) hit.quotas.push(r.q);
    if (r.cl < hit.row.cl) hit.row = r;
  }
  for (const g of groups.values()) g.quotas.sort();
  return [...groups.values()];
}

export function chanceOf(rank: number, cl: number): Chance | null {
  if (rank <= cl * 0.9) return "safe";
  if (rank <= cl) return "mod";
  if (rank <= cl * 1.15) return "reach";
  return null;
}

export interface PredictQuery {
  rows: Row[];
  rank: number;
  seat: string;
  quota: string;
  gender: number;
  deg?: string;
  types?: Set<number>;
  terms?: string[];
  sort?: SortKey;
  year?: number | null;
  /** Round to compare against. null means the final round of each year. */
  round?: number | null;
}

/* Rounds available for one year, ascending. */
export function roundsFor(roundsByYear: Record<string, number[]>, year: number): number[] {
  return roundsByYear[year] ?? [];
}

/* The last round a year ran - the widest cut-off, and what "final round"
   means everywhere else in the app. */
export function finalRound(roundsByYear: Record<string, number[]>, year: number): number {
  const list = roundsByYear[year] ?? [];
  return list[list.length - 1] ?? 0;
}

export interface PredictHit {
  row: Row;
  quotas: string[];
  chance: Chance;
}

export interface PredictResult {
  results: PredictHit[];
  counts: { safe: number; mod: number; reach: number; all: number };
}

export function predict(o: PredictQuery): PredictResult {
  const {
    rows, rank, seat, quota, gender, deg = "",
    types = new Set([0, 1, 2, 3]), terms = [], sort = "best", year, round,
  } = o;
  const pre: Row[] = [];
  for (const r of rows) {
    if (year != null && r.year !== year) continue;
    if (round != null && r.round !== round) continue;
    if (r.seat !== seat) continue;
    if (quota && r.q !== quota) continue;
    if (gender >= 0 && r.g !== gender) continue;
    if (!types.has(r.type)) continue;
    if (deg && r.deg !== deg) continue;
    pre.push(r);
  }

  const merged = quota
    ? pre.map((r) => ({ row: r, quotas: [r.q] }))
    : mergeQuotas(pre);

  const results: PredictHit[] = [];
  let nS = 0, nM = 0, nR = 0;
  for (const m of merged) {
    const ch = rank ? chanceOf(rank, m.row.cl) : "safe";
    if (!ch) continue;
    if (terms.length) {
      const hay = (m.row.inst + " " + m.row.prog + " " + m.row.deg).toLowerCase();
      if (!terms.every((t) => hay.includes(t))) continue;
    }
    if (ch === "safe") nS++;
    else if (ch === "mod") nM++;
    else nR++;
    results.push({ row: m.row, quotas: m.quotas, chance: ch });
  }

  results.sort((a, b) => {
    if (sort === "best") return a.row.cl - b.row.cl || a.row.inst.localeCompare(b.row.inst);
    if (sort === "worst") return b.row.cl - a.row.cl || a.row.inst.localeCompare(b.row.inst);
    if (sort === "inst") return a.row.inst.localeCompare(b.row.inst) || a.row.cl - b.row.cl;
    return a.row.prog.localeCompare(b.row.prog) || a.row.cl - b.row.cl;
  });

  return { results, counts: { safe: nS, mod: nM, reach: nR, all: results.length } };
}

/* ─────────────── institutes ─────────────── */
export function slugify(name: string): string {
  return String(name || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildIndex(rows: Row[]): {
  institutes: Institute[];
  byInst: Map<string, Row[]>;
} {
  const byInst = new Map<string, Row[]>();
  for (const r of rows) {
    let list = byInst.get(r.inst);
    if (!list) {
      list = [];
      byInst.set(r.inst, list);
    }
    list.push(r);
  }
  const institutes: Institute[] = [...byInst.keys()].sort((a, b) => a.localeCompare(b)).map((name) => {
    const list = byInst.get(name)!;
    return {
      name,
      type: list[0].type,
      slug: slugify(name),
      programs: new Set(list.map((r) => r.prog)),
      years: [...new Set(list.map((r) => r.year))].sort((a, b) => a - b),
    };
  });
  return { institutes, byInst };
}

export interface Series {
  label: string;
  points: (number | null)[];
}

/* One line per programme across the years present for this institute, under
   one seat type + gender pool. A year the institute did not offer the
   programme stays null so the chart shows a gap and the table shows a dash.

   Pass `round` to read one round across every year (round 1 of 2020 against
   round 1 of 2026). Leave it null to read each year's final round, which is
   the widest cut-off and therefore the fairest year-over-year comparison. */
export function buildInstituteSeries(
  rows: Row[],
  { seat, gender, metric = "cl", round = null }: {
    seat?: string | null;
    gender?: number | null;
    metric?: "cl" | "op";
    round?: number | null;
  } = {},
): { years: number[]; series: Series[] } {
  const picked = rows.filter(
    (r) =>
      (seat == null || r.seat === seat) &&
      (gender == null || r.g === gender) &&
      (round == null || r.round === round),
  );

  const years = [...new Set(picked.map((r) => r.year))].sort((a, b) => a - b);
  const byProg = new Map<string, Record<number, number>>();
  for (const r of picked) {
    let rec = byProg.get(r.prog);
    if (!rec) {
      rec = {};
      byProg.set(r.prog, rec);
    }
    const prev = rec[r.year];
    const val = r[metric];
    if (prev == null || val < prev) rec[r.year] = val;
  }

  const series: Series[] = [...byProg.entries()].map(([label, rec]) => ({
    label,
    points: years.map((y) => (rec[y] == null ? null : rec[y])),
  }));

  const latest = (s: Series) => {
    for (let i = s.points.length - 1; i >= 0; i--) if (s.points[i] != null) return s.points[i]!;
    return Infinity;
  };
  series.sort((a, b) => latest(a) - latest(b) || a.label.localeCompare(b.label));
  return { years, series };
}

/* How one seat moved through the rounds of one year. This is the question the
   round data exists to answer: cut-offs tighten as candidates withdraw, so a
   branch can be out of reach in round 1 and open by round 5.

   Returns the closing (or opening) rank per round, plus how far it moved from
   the previous round that ran. */
export interface SeasonPoint {
  round: number;
  value: number;
  /** Change from the previous round that ran; null on the first. */
  delta: number | null;
}

export function buildSeason(
  rows: Row[],
  { branch, seat, gender, year, metric = "cl" }: {
    branch: string;
    seat: string;
    gender: number;
    year: number;
    metric?: "cl" | "op";
  },
): SeasonPoint[] {
  const points: SeasonPoint[] = [];
  let prev: number | null = null;

  const picked = rows
    .filter(
      (r) =>
        r.year === year &&
        r.prog === branch &&
        r.seat === seat &&
        r.g === gender,
    )
    .sort((a, b) => a.round - b.round);

  /* Several quota pools can share a seat in one round. The friendliest pool
     (smallest rank) is the one a candidate would actually take, and it matches
     how "Any quota" is resolved everywhere else. */
  const bestByRound = new Map<number, number>();
  for (const r of picked) {
    const v = r[metric];
    const hit = bestByRound.get(r.round);
    if (hit == null || v < hit) bestByRound.set(r.round, v);
  }

  for (const round of [...bestByRound.keys()].sort((a, b) => a - b)) {
    const value = bestByRound.get(round)!;
    points.push({ round, value, delta: prev == null ? null : value - prev });
    prev = value;
  }

  return points;
}

/* ─────────────── geometry (pure, unit-normalised) ─────────────── */
export function seriesToPoints(
  years: number[],
  values: (number | null)[],
  yMax: number,
): { x: number; y: number | null }[] {
  const first = years[0], last = years[years.length - 1];
  const span = last - first;
  const lmax = Math.log10(Math.max(yMax, 10));
  return years.map((y, i) => {
    const v = values[i];
    return {
      x: span === 0 ? 0.5 : (y - first) / span,
      y: v == null ? null : Math.log10(Math.max(v, 1)) / lmax,
    };
  });
}

export function sparkPath(values: (number | null)[], w: number, h: number): string {
  const vals = values.filter((v): v is number => v != null);
  if (!vals.length) return "";
  const lo = Math.log10(Math.max(Math.min(...vals), 1));
  const hi = Math.log10(Math.max(Math.max(...vals), 10));
  const span = hi - lo || 1;
  const n = values.length;
  const px = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const py = (v: number) => h - ((Math.log10(Math.max(v, 1)) - lo) / span) * h;

  let d = "", pen = false;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v == null) {
      pen = false;
      continue;
    }
    d += (pen ? "L" : "M") + px(i).toFixed(1) + " " + py(v).toFixed(1) + " ";
    pen = true;
  }
  return d.trim();
}

/* ─────────────── routes ─────────────── */
/* Canonical route names, plus the short forms the tabs write. An unknown or
   empty hash lands on the syllabus, which is the site's front page. */
const ROUTE_ALIAS: Record<string, string> = {
  "": "syllabus", syl: "syllabus", syllabus: "syllabus",
  chapter: "syllabus", chapters: "syllabus",
  predict: "predict", predictor: "predict",
  inst: "institutes", institutes: "institutes",
  institute: "institute",
  rank: "ranks", ranks: "ranks",
  /* One chapter's PYQ report: #report/physics/electrostatics */
  report: "report", reports: "report",
};
export const DEFAULT_VIEW = "syllabus";

export interface Route {
  view: string;
  arg: string;
}

export function parseRoute(hash: string): Route {
  /* A view can carry a query string (#predict?rank=42000). It belongs to the
     view, not to the route name, so strip it before resolving. */
  const raw = String(hash || "")
    .replace(/^#/, "")
    .split("?")[0]
    .replace(/^\/+|\/+$/g, "");
  const [head, ...rest] = raw.split("/");
  const view = ROUTE_ALIAS[head.toLowerCase()] || DEFAULT_VIEW;
  let arg = rest.join("/");
  if (arg) {
    try {
      arg = decodeURIComponent(arg);
    } catch {
      /* keep raw */
    }
  }
  return { view, arg };
}

/* ─────────────── favourites ─────────────── */
export interface Favourite {
  name: string;
  addedAt: number;
}

export const FAV_CAP = 20;

export function toggleFavourite(list: Favourite[], name: string): Favourite[] {
  const at = list.findIndex((f) => f.name === name);
  if (at > -1) return list.filter((_, i) => i !== at);
  if (list.length >= FAV_CAP) return list;
  return [...list, { name, addedAt: Date.now() }];
}

/* Returns kept entries plus the bare names that vanished, so the UI can say
   "2 favourites are no longer offered" without leaking stale records. */
export function pruneFavourites(
  list: Favourite[],
  knownNames: Set<string>,
): { kept: Favourite[]; removed: string[] } {
  const kept: Favourite[] = [], removed: string[] = [];
  for (const f of list) {
    if (knownNames.has(f.name)) kept.push(f);
    else removed.push(f.name);
  }
  return { kept, removed };
}