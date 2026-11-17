import { JOSAA_DATA } from "../data.generated.js";
import {
  buildIndex,
  decodeSeats,
  finalRound,
  roundsFor,
  seatsToRows,
  type Institute,
  type Row,
} from "../core";

/* The packed stream is decoded once into per-seat records (75k records, ~50 ms).
   Rows are materialised per (year, round) and cached, because a single round is
   ~12k rows and most views only ever touch one or two of them. */
const SEATS = decodeSeats(JOSAA_DATA);

export const ROUNDS_BY_YEAR: Record<string, number[]> = JOSAA_DATA.R;

export const YEARS_DESC: number[] = Object.keys(ROUNDS_BY_YEAR)
  .map(Number)
  .sort((a, b) => b - a);

export const LATEST_YEAR = YEARS_DESC[0];
export const EARLIEST_YEAR = YEARS_DESC[YEARS_DESC.length - 1];

const TYPE_BY_NAME = new Map(JOSAA_DATA.I.map((name, i) => [name, JOSAA_DATA.T[i]] as const));

const rowCache = new Map<string, Row[]>();

function rowsForRound(year: number, round: number | null): Row[] {
  const wanted = round ?? finalRound(ROUNDS_BY_YEAR, year);
  const key = year + ":" + wanted;
  const hit = rowCache.get(key);
  if (hit) return hit;
  const rows = seatsToRows(new Map([[year, SEATS.get(year) ?? []]]), wanted, () => wanted).map(
    (r) => ({ ...r, type: TYPE_BY_NAME.get(r.inst) ?? 3 }),
  );
  rowCache.set(key, rows);
  return rows;
}

/* Every round of one year, flattened. Used by the institute pages, which show
   the whole cut-off history and let the reader switch category freely. */
export function rowsForYear(year: number): Row[] {
  const key = "y" + year;
  const hit = rowCache.get(key);
  if (hit) return hit;
  const full: Row[] = [];
  for (const s of SEATS.get(year) ?? []) {
    for (const p of s.rounds) {
      full.push({
        year,
        round: p.round,
        inst: s.inst,
        type: TYPE_BY_NAME.get(s.inst) ?? 3,
        prog: s.prog,
        deg: s.deg,
        q: s.q,
        seat: s.seat,
        g: s.g,
        op: p.op,
        cl: p.cl,
      });
    }
  }
  rowCache.set(key, full);
  return full;
}

/* One row per seat per year, at that year's final round: the widest cut-off
   of each cycle. This is what the institute pages compare across years, and
   what the site used everywhere before rounds became selectable. */
export const ROWS: Row[] = YEARS_DESC.flatMap((year) => rowsForRound(year, null));
export const ROW_COUNT = ROWS.length;

const index = buildIndex(ROWS);

export const INSTITUTES: Institute[] = index.institutes;
export const ROWS_BY_INST: Map<string, Row[]> = index.byInst;

export const BY_SLUG: Map<string, Institute> = new Map(
  INSTITUTES.map((i) => [i.slug, i]),
);

export const BY_NAME: Map<string, Institute> = new Map(
  INSTITUTES.map((i) => [i.name, i]),
);

export const INSTITUTE_COUNT = INSTITUTES.length;

export const DEGREES: string[] = [...new Set(ROWS.map((r) => r.deg).filter(Boolean))].sort();

export const KNOWN_INSTITUTE_NAMES: Set<string> = new Set(INSTITUTES.map((i) => i.name));

/* Rounds a year actually ran. */
export function roundsOf(year: number): number[] {
  return roundsFor(ROUNDS_BY_YEAR, year);
}

/* The final round of a year - the default comparison everywhere. */
export function lastRoundOf(year: number): number {
  return finalRound(ROUNDS_BY_YEAR, year);
}

export { rowsForRound };

/* Best OPEN closing rank an institute has reached, and the year it did it. */
export function instBest(inst: Institute): { best: number | null; year: number | null } {
  let best: number | null = null;
  let year: number | null = null;
  for (const r of ROWS_BY_INST.get(inst.name) ?? []) {
    if (r.seat !== "OPEN") continue;
    if (year === null || r.year > year) {
      year = r.year;
      best = r.cl;
    } else if (r.year === year && best !== null && r.cl < best) {
      best = r.cl;
    }
  }
  return { best, year };
}

/* Cut-off history for one institute across every round of every year, so an
   institute page can show how a seat moved within a season, not just across
   seasons. */
export function roundsByInstitute(name: string): Map<number, Row[]> {
  const byYear = new Map<number, Row[]>();
  for (const year of YEARS_DESC) {
    const rows = rowsForYear(year).filter((r) => r.inst === name);
    if (rows.length) byYear.set(year, rows);
  }
  return byYear;
}
