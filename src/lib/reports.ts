/* ═══════════════════════════════════════════════════════════════════
   Chapters are the PYQ topic-analysis reports in report/*.md, compiled by
   tools/build-reports.mjs into src/reports.generated.js.

   This module is the only place that knows how a report is shaped. Every
   priority, share and rate on the site is derived here from the same
   numbers the report prints, so a chapter card and its report page can
   never disagree.
   ═══════════════════════════════════════════════════════════════════ */
import { REPORT_DATA } from "../reports.generated.js";

export type SubjectKey = "physics" | "chemistry" | "mathematics";

export interface YearRow {
  year: number;
  q: number;
  mcq: number;
  num: number;
}

export interface TopicRow {
  name: string;
  q: number;
  /** Percent of the chapter's 2019+ pool. */
  share: number;
  mcq: number;
  num: number;
  /** "2019-2026" as the report prints it. */
  span: string;
}

export interface MatrixRow {
  year: number;
  counts: number[];
  total: number;
}

export interface SubTopicRow {
  name: string;
  q: number;
  share: number;
  span: string;
}

export interface ExampleQuestion {
  year: number;
  type: string;
  text: string;
}

export interface TopicDetail {
  name: string;
  q: number;
  share: number;
  mcq: number;
  num: number;
  years: { year: number; q: number }[];
  subtopics: SubTopicRow[];
  examples: ExampleQuestion[];
}

export interface ChapterReport {
  file: string;
  subject: SubjectKey;
  slug: string;
  id: string;
  chapter: string;
  unit: string;
  exams: string;
  questionsInFile: number;
  /** Questions from 2019 on — the pool every table in the report counts. */
  analysed: number;
  excluded: number;
  grouping: string;
  span: string;
  unlabelled: boolean;
  summary: string;
  years: YearRow[];
  topics: TopicRow[];
  matrix: MatrixRow[];
  detail: TopicDetail[];
  pattern: string[];
}

/* ─────────────── the dataset ─────────────── */

export const REPORTS: ChapterReport[] = Object.values(
  REPORT_DATA.reports as unknown as Record<string, ChapterReport>,
);

export const REPORT_BY_ID: Map<string, ChapterReport> = new Map(
  REPORTS.map((r) => [r.id, r]),
);

export const SUBJECT_KEYS: SubjectKey[] = ["physics", "chemistry", "mathematics"];

export const SUBJECT_LABEL: Record<SubjectKey, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  mathematics: "Mathematics",
};

export function isSubjectKey(value: string): value is SubjectKey {
  return (SUBJECT_KEYS as string[]).includes(value);
}

/* Every year the archive covers, ascending. Derived rather than hard-coded so
   a new exam season only needs a regenerated report, not an edit here. */
export const ALL_YEARS: number[] = (() => {
  const seen = new Set<number>();
  for (const r of REPORTS) for (const y of r.years) seen.add(y.year);
  return [...seen].sort((a, b) => a - b);
})();

export const FIRST_YEAR = ALL_YEARS[0];
export const LAST_YEAR = ALL_YEARS[ALL_YEARS.length - 1];

/* "Recent" is the last three examined seasons — the window a reader actually
   has to plan for. Priority is computed on this window, not on eight years
   of history, so a chapter that stopped appearing drops out of the top tier. */
export const RECENT_YEARS: number[] = ALL_YEARS.slice(-3);

export const TOTAL_ANALYSED = REPORTS.reduce((n, r) => n + r.analysed, 0);
export const TOTAL_ARCHIVE = REPORTS.reduce((n, r) => n + r.questionsInFile, 0);
export const CHAPTER_COUNT = REPORTS.length;

/* ─────────────── per-chapter numbers ─────────────── */

export function recentQuestions(r: ChapterReport): number {
  return r.years
    .filter((y) => y.year >= RECENT_YEARS[0])
    .reduce((n, y) => n + y.q, 0);
}

/* Questions per exam in the recent window: the number a reader can budget
   revision time against. */
export function recentRate(r: ChapterReport): number {
  return recentQuestions(r) / RECENT_YEARS.length;
}

export function numericalShare(r: ChapterReport): number {
  if (!r.analysed) return 0;
  const num = r.years.reduce((n, y) => n + y.num, 0);
  return (num / r.analysed) * 100;
}

export function peakYear(r: ChapterReport): YearRow | null {
  let best: YearRow | null = null;
  for (const y of r.years) if (!best || y.q > best.q) best = y;
  return best;
}

export function lastAsked(r: ChapterReport): number | null {
  let last: number | null = null;
  for (const y of r.years) if (y.q > 0 && (last === null || y.year > last)) last = y.year;
  return last;
}

/* True when the chapter has appeared in every season of the recent window. */
export function askedEveryYear(r: ChapterReport): boolean {
  return RECENT_YEARS.every((year) => {
    const hit = r.years.find((y) => y.year === year);
    return !!hit && hit.q > 0;
  });
}

/* One entry per year in the archive window, zero-filled, so a sparkline is
   comparable down a column of chapter rows. */
export function yearSeries(r: ChapterReport): YearRow[] {
  return ALL_YEARS.map(
    (year) => r.years.find((y) => y.year === year) ?? { year, q: 0, mcq: 0, num: 0 },
  );
}

export function dominantTopic(r: ChapterReport): TopicRow | null {
  let best: TopicRow | null = null;
  for (const t of r.topics) if (!best || t.q > best.q) best = t;
  return best;
}

/* Share of the chapter's questions held by its three biggest topics. */
export function topThreeShare(r: ChapterReport): number {
  return [...r.topics]
    .sort((a, b) => b.q - a.q)
    .slice(0, 3)
    .reduce((n, t) => n + t.share, 0);
}

/* ─────────────── priority ─────────────── */

export type Prio = "H" | "M" | "L";

export const PRIO_LABEL: Record<Prio, string> = { H: "High", M: "Medium", L: "Low" };
export const PRIO_ORDER: Record<Prio, number> = { H: 0, M: 1, L: 2 };
export const PRIO_NOTE: Record<Prio, string> = {
  H: "4.5 % or more of the last three years of this paper. Start here.",
  M: "1.5–4.5 % of recent papers. Cover once the high set is done.",
  L: "under 1.5 % of recent papers — occasional, shrinking, or dropped.",
};

/* Share of a subject's recent questions, per subject, so the three subjects
   are judged against their own pool instead of a single global scale. */
const SUBJECT_RECENT_TOTAL: Record<SubjectKey, number> = (() => {
  const totals: Record<SubjectKey, number> = { physics: 0, chemistry: 0, mathematics: 0 };
  for (const r of REPORTS) totals[r.subject] += recentQuestions(r);
  return totals;
})();

export const PRIO_CUT: Record<"H" | "M", number> = { H: 4.5, M: 1.5 };

export function recentShare(r: ChapterReport): number {
  const total = SUBJECT_RECENT_TOTAL[r.subject];
  return total ? (recentQuestions(r) / total) * 100 : 0;
}

export function priorityOf(r: ChapterReport): Prio {
  const share = recentShare(r);
  if (share >= PRIO_CUT.H) return "H";
  if (share >= PRIO_CUT.M) return "M";
  return "L";
}

/* ─────────────── grouping ─────────────── */

export interface ChapterRow {
  report: ChapterReport;
  prio: Prio;
  rate: number;
  share: number;
  series: YearRow[];
}

export const CHAPTER_ROWS: ChapterRow[] = REPORTS.map((report) => ({
  report,
  prio: priorityOf(report),
  rate: recentRate(report),
  share: recentShare(report),
  series: yearSeries(report),
}));

export function rowsForSubject(subject: SubjectKey): ChapterRow[] {
  return CHAPTER_ROWS.filter((row) => row.report.subject === subject);
}

export function unitsForSubject(subject: SubjectKey): string[] {
  const seen: string[] = [];
  for (const row of rowsForSubject(subject)) {
    if (!seen.includes(row.report.unit)) seen.push(row.report.unit);
  }
  return seen;
}

/* Subject totals for the progress meter and the segmented counts. */
export const SUBJECT_CHAPTER_COUNT: Record<SubjectKey, number> = (() => {
  const counts: Record<SubjectKey, number> = { physics: 0, chemistry: 0, mathematics: 0 };
  for (const r of REPORTS) counts[r.subject] += 1;
  return counts;
})();

export const SUBJECT_ANALYSED: Record<SubjectKey, number> = (() => {
  const totals: Record<SubjectKey, number> = { physics: 0, chemistry: 0, mathematics: 0 };
  for (const r of REPORTS) totals[r.subject] += r.analysed;
  return totals;
})();

/* ─────────────── routes ─────────────── */

export function chapterHref(id: string): string {
  return "#report/" + id;
}

/* "#report/physics/electrostatics" arrives as "physics/electrostatics". */
export function reportFromArg(arg: string): ChapterReport | null {
  if (!arg) return null;
  return REPORT_BY_ID.get(arg.trim().toLowerCase()) ?? null;
}

/* Neighbouring chapters in weight order, for the footer of a report page.
   Keeps a reader moving through a subject instead of bouncing to the index. */
export function neighbours(r: ChapterReport): {
  prev: ChapterReport | null;
  next: ChapterReport | null;
} {
  const list = rowsForSubject(r.subject)
    .slice()
    .sort((a, b) => b.rate - a.rate || a.report.chapter.localeCompare(b.report.chapter));
  const at = list.findIndex((row) => row.report.id === r.id);
  return {
    prev: at > 0 ? list[at - 1].report : null,
    next: at >= 0 && at < list.length - 1 ? list[at + 1].report : null,
  };
}

/* ─────────────── search ─────────────── */

/* Matches the chapter name, its unit and every topic it contains, so typing
   "dipole" finds Electrostatics even though the chapter is not named that. */
export function chapterHaystack(r: ChapterReport): string {
  return [r.chapter, r.unit, ...r.topics.map((t) => t.name)]
    .join(" \u0001 ")
    .toLowerCase();
}

export function matchesQuery(r: ChapterReport, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = chapterHaystack(r);
  return q.split(/\s+/).every((word) => hay.includes(word));
}
