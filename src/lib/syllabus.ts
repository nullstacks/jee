/* ═══════════════════════════════════════════════════════════════════
   Chapter list — one row per PYQ report, grouped by the unit the report
   itself declares.

   This module used to hold a hand-written syllabus. It drifted from the
   report archive the moment a chapter was split (Capacitor, Wave Optics,
   Solid State, Salt Analysis) and it quietly lost chapters the syllabus
   folds together. Nothing here is authored any more: names, units, counts
   and priorities all come from report/*.md via src/lib/reports.ts.

   The only hand-written thing left is the ORDER of the unit groups, which
   is what makes the page read like a syllabus rather than an alphabet.
   ═══════════════════════════════════════════════════════════════════ */
import {
  PRIO_ORDER,
  type Prio,
  type ChapterReport,
  type SubjectKey,
} from "./reports.ts";

export { PRIO_LABEL, PRIO_NOTE, PRIO_ORDER } from "./reports.ts";
export type { Prio, SubjectKey, ChapterReport };

/* The unit groups read in this order. Anything the archive adds that is not
   listed lands at the end of its subject instead of vanishing. */
const UNIT_ORDER: Record<SubjectKey, string[]> = {
  physics: ["Mechanics", "Electricity", "Optics", "Modern Physics"],
  chemistry: ["Physical Chemistry", "Inorganic Chemistry", "Organic Chemistry"],
  mathematics: ["Algebra", "Trigonometry", "Coordinate Geometry", "Vector & 3D", "Calculus"],
};

/* Some reports tag their unit by the syllabus heading it sits under rather
   than the strand a reader would group it with (Vectors and 3D Geometry are
   filed under Algebra). This maps the stragglers onto the strand they belong
   to; a value that is already correct is left alone. */
const UNIT_OVERRIDE: Record<string, string> = {
  "mathematics/vector-algebra": "Vector & 3D",
  "mathematics/3d-geometry": "Vector & 3D",
};

/* The order a chapter should actually be studied in.

   Sorting by weight inside a unit puts Heat and Thermodynamics before Units
   and Measurements, which is backwards: the heavy chapter is heavy because it
   borrows from the light ones. So the sequence is authored here, once, in the
   order a syllabus is taught. Any chapter the archive grows that is missing
   from this list falls to the end of its unit rather than disappearing. */
const SEQUENCE: string[] = [
  /* Physics — mechanics first, because everything downstream reuses it. */
  "physics/units-and-measurements",
  "physics/motion-in-a-straight-line",
  "physics/motion-in-a-plane",
  "physics/vector-algebra",
  "physics/laws-of-motion",
  "physics/circular-motion",
  "physics/work-power-and-energy",
  "physics/center-of-mass",
  "physics/rotational-motion",
  "physics/gravitation",
  "physics/properties-of-matter",
  "physics/heat-and-thermodynamics",
  "physics/simple-harmonic-motion",
  "physics/waves",
  /* Electricity */
  "physics/electrostatics",
  "physics/capacitor",
  "physics/current-electricity",
  "physics/magnetics",
  "physics/magnetic-properties-of-matter",
  "physics/electromagnetic-induction",
  "physics/alternating-current",
  "physics/electromagnetic-waves",
  /* Optics */
  "physics/geometrical-optics",
  "physics/wave-optics",
  /* Modern */
  "physics/dual-nature-of-radiation",
  "physics/atoms-and-nuclei",
  "physics/electronic-devices",
  "physics/communication-systems",

  /* Chemistry — physical builds the tools, inorganic uses them, organic last. */
  "chemistry/some-basic-concepts-of-chemistry",
  "chemistry/structure-of-atom",
  "chemistry/gaseous-state",
  "chemistry/thermodynamics",
  "chemistry/chemical-equilibrium",
  "chemistry/ionic-equilibrium",
  "chemistry/solutions",
  "chemistry/electrochemistry",
  "chemistry/chemical-kinetics-and-nuclear-chemistry",
  "chemistry/solid-state",
  "chemistry/surface-chemistry",
  "chemistry/redox-reactions",
  "chemistry/periodic-table-and-periodicity",
  "chemistry/chemical-bonding-and-molecular-structure",
  "chemistry/hydrogen",
  "chemistry/s-block-elements",
  "chemistry/p-block-elements",
  "chemistry/d-and-f-block-elements",
  "chemistry/coordination-compounds",
  "chemistry/isolation-of-elements",
  "chemistry/environmental-chemistry",
  "chemistry/salt-analysis",
  "chemistry/basics-of-organic-chemistry",
  "chemistry/hydrocarbons",
  "chemistry/haloalkanes-and-haloarenes",
  "chemistry/alcohols-phenols-and-ethers",
  "chemistry/aldehydes-ketones-and-carboxylic-acids",
  "chemistry/compounds-containing-nitrogen",
  "chemistry/biomolecules",
  "chemistry/polymers",
  "chemistry/chemistry-in-everyday-life",
  "chemistry/practical-organic-chemistry",

  /* Mathematics — algebra and trigonometry feed calculus and coordinate geometry. */
  "mathematics/sets-and-relations",
  "mathematics/complex-numbers",
  "mathematics/quadratic-equation-and-inequalities",
  "mathematics/sequences-and-series",
  "mathematics/binomial-theorem",
  "mathematics/permutations-and-combinations",
  "mathematics/mathematical-induction",
  "mathematics/mathematical-reasoning",
  "mathematics/logarithm",
  "mathematics/functions",
  "mathematics/matrices-and-determinants",
  "mathematics/trigonometric-ratio-and-identites",
  "mathematics/trigonometric-functions-and-equations",
  "mathematics/inverse-trigonometric-functions",
  "mathematics/properties-of-triangle",
  "mathematics/height-and-distance",
  "mathematics/straight-lines-and-pair-of-straight-lines",
  "mathematics/circle",
  "mathematics/parabola",
  "mathematics/ellipse",
  "mathematics/hyperbola",
  "mathematics/vector-algebra",
  "mathematics/3d-geometry",
  "mathematics/limits-continuity-and-differentiability",
  "mathematics/differentiation",
  "mathematics/application-of-derivatives",
  "mathematics/indefinite-integrals",
  "mathematics/definite-integration",
  "mathematics/area-under-the-curves",
  "mathematics/differential-equations",
  "mathematics/statistics",
  "mathematics/probability",
];

const SEQUENCE_INDEX: Map<string, number> = new Map(
  SEQUENCE.map((id, i) => [id, i] as const),
);

export function sequenceIndex(id: string): number {
  const at = SEQUENCE_INDEX.get(id);
  return at == null ? Number.MAX_SAFE_INTEGER : at;
}

export function unitOf(report: ChapterReport): string {
  return UNIT_OVERRIDE[report.id] ?? report.unit ?? "Other";
}

export interface ChapterUnit {
  title: string;
  chapters: ChapterReport[];
}

/* Grouped, ordered chapters for one subject. */
export function chaptersByUnit(subject: SubjectKey, reports: ChapterReport[]): ChapterUnit[] {
  const order = UNIT_ORDER[subject];
  const groups = new Map<string, ChapterReport[]>();
  for (const report of reports) {
    const unit = unitOf(report);
    const list = groups.get(unit);
    if (list) list.push(report);
    else groups.set(unit, [report]);
  }

  const titles = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

  return titles.map((title) => ({ title, chapters: groups.get(title) ?? [] }));
}

/* The one-line scope under a chapter name: its two heaviest topics, which is
   what the report itself leads with in its summary paragraph. */
export function scopeLine(report: ChapterReport, count = 2): string {
  const top = [...report.topics].sort((a, b) => b.q - a.q).slice(0, count);
  if (!top.length) return "No topic split published for this chapter yet.";
  return top.map((t) => t.name).join(" · ");
}

/* The order to actually work through a subject: the authored SEQUENCE above,
   not a weight ranking. Weight says what pays; sequence says what to learn
   first, and the two are not the same list. */
export function readingOrder(
  _subject: SubjectKey,
  reports: ChapterReport[],
): ChapterReport[] {
  return reports
    .slice()
    .sort(
      (a, b) =>
        sequenceIndex(a.id) - sequenceIndex(b.id) || a.chapter.localeCompare(b.chapter),
    );
}

/* Position of a chapter in that sequence, 1-based. */
export function readingPosition(report: ChapterReport, reports: ChapterReport[]): number {
  const order = readingOrder(report.subject, reports);
  const at = order.findIndex((r) => r.id === report.id);
  return at < 0 ? 0 : at + 1;
}

/* Chapters bucketed by unit.

   Two rules, both learned from getting them wrong:

   1. A unit is ONE heading. Cutting the list wherever the unit changes split
      Algebra into two headings whenever Calculus sat in the middle of the
      sequence, which gave two headings the same React key — and that stale
      key is what left the previous subject's rows on screen after a switch.

   2. Heading order is the syllabus strand order, not the order the sequence
      happens to reach a unit in. Reading order is about prerequisites inside
      a strand; the headings are the strand list. */
export function groupByUnit(subject: SubjectKey, reports: ChapterReport[]): ChapterUnit[] {
  const buckets = new Map<string, ChapterReport[]>();
  for (const report of reports) {
    const title = unitOf(report);
    const rows = buckets.get(title);
    if (rows) rows.push(report);
    else buckets.set(title, [report]);
  }

  const order = UNIT_ORDER[subject];
  const rank = (title: string) => {
    const at = order.indexOf(title);
    return at < 0 ? order.length : at;
  };

  return [...buckets.entries()]
    .map(([title, chapters]) => ({ title, chapters }))
    .sort((a, b) => rank(a.title) - rank(b.title) || a.title.localeCompare(b.title));
}

export function sortChapters(
  rows: ChapterReport[],
  mode: "weight" | "unit" | "name",
  rateOf: (r: ChapterReport) => number,
  prioOf: (r: ChapterReport) => Prio,
): ChapterReport[] {
  const copy = [...rows];
  if (mode === "name") copy.sort((a, b) => a.chapter.localeCompare(b.chapter));
  else if (mode === "weight") {
    copy.sort(
      (a, b) =>
        PRIO_ORDER[prioOf(a)] - PRIO_ORDER[prioOf(b)] ||
        rateOf(b) - rateOf(a) ||
        a.chapter.localeCompare(b.chapter),
    );
  }
  return copy;
}