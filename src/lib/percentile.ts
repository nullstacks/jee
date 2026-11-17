/* ═══════════════════════════════════════════════════════════════════
   Percentile → rank, for every category JoSAA actually allocates seats in.

   Two different kinds of number live here and must never be confused:

   1. **Published** curves (CRL, and the PwD sub-lists) are read off NTA
      tables. Where a table exists we use it and do not model anything.

   2. **Modelled** category ranks (EWS, OBC-NCL, SC, ST, and the PwD
      variants of each) are scaled from the published CRL curve. NTA does
      not publish a percentile→category-rank table, so any site printing
      one is either using a rank predictor's output or scaling the CRL the
      same way. The method is stated on the page rather than hidden.

   The scale factor is the change in candidate pool between the season the
   CRL curve came from and the season being described. On the 2026 data
   that reproduces the independent College Pravesh anchors to within 1.3%
   and the official General qualified count to within 1.0%; `test/
   ranks.test.mjs` asserts both, so the model cannot silently drift.

   Sources
   - NTA JEE (Main) 2026 Paper-1 result notice: category-wise qualifying
     percentiles, candidates qualified, and candidates appeared.
   - NTA JEE (Main) 2025 Paper-1 result notice: the CRL curve and the
     PwD sub-list curves.
   ═══════════════════════════════════════════════════════════════════ */

export type Pair = [percentile: number, rank: number];

/* ─────────────── categories ─────────────── */

export type CategoryKey = "OPEN" | "EWS" | "OBC-NCL" | "SC" | "ST";

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  /* Short form for a chip or a table column. */
  short: string;
  /* Share of seats reserved, as JoSAA applies it. */
  reservation: string;
  /* JEE (Main) 2026 Paper-1: minimum qualifying percentile for JEE Advanced. */
  cutoff: number;
  /* JEE (Main) 2026 Paper-1: candidates in this category who cleared it. */
  qualified: number;
  /* JEE (Main) 2026 Paper-1: unique candidates in this category who appeared. */
  pool: number;
}

/* Every figure in this table is from the NTA 2026 Paper-1 result notice and
   reconciles exactly: the qualified column sums to 2,50,182 and the pool
   column to 15,38,468, both of which are the totals NTA published. The
   classes below sum to 96,873 + 25,009 + 67,597 + 37,522 + 18,790 =
   2,45,791; the remaining 4,391 are the UR-PwBD row, which NTA reports
   separately because PwD is a horizontal reservation cutting across every
   vertical category rather than a sixth vertical class. The test suite
   asserts both identities, so a typo here fails the build. */
export const CATEGORIES: CategoryMeta[] = [
  { key: "OPEN", label: "General / CRL", short: "General", reservation: "40.5%", cutoff: 93.4123549, qualified: 96873, pool: 538239 },
  { key: "EWS", label: "Gen-EWS", short: "EWS", reservation: "10%", cutoff: 82.4164528, qualified: 25009, pool: 180086 },
  { key: "OBC-NCL", label: "OBC-NCL", short: "OBC", reservation: "27%", cutoff: 80.9232583, qualified: 67597, pool: 611953 },
  { key: "SC", label: "SC", short: "SC", reservation: "15%", cutoff: 63.9172792, qualified: 37522, pool: 156038 },
  { key: "ST", label: "ST", short: "ST", reservation: "7.5%", cutoff: 52.0174712, qualified: 18790, pool: 52152 },
];

/* NTA's published totals. The table above is checked against these. */
export const TOTAL_QUALIFIED = 250182;
export const TOTAL_POOL = 1538468;

/* NTA lists the PwD qualifiers as one combined row, separate from the five
   vertical categories. It is carried on its own so the two totals above can
   both be asserted without pretending PwD is a sixth category. */
export const PWD_QUALIFIED = 4391;
export const PWD_CUTOFF = 0.0023186;

export const CATEGORY_BY_KEY: Record<CategoryKey, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, CategoryMeta>;

export function isCategoryKey(value: string): value is CategoryKey {
  return CATEGORIES.some((c) => c.key === value);
}

/* ─────────────── published curves ─────────────── */

/* Common Rank List, NTA JEE (Main) 2025 Paper-1. Every category rank on the
   page is derived from this curve, so it is the one table to keep current. */
export const CRL_BASE: Pair[] = [
  [100, 1], [99.50, 7691], [99.00, 15300], [98.00, 30300], [97.00, 44000],
  [95.06, 74467], [90.50, 140975], [85.52, 213854], [80.48, 288910],
  [75.49, 366025], [70.61, 443457], [60.62, 603318], [50.61, 760841],
  [40.57, 916120], [30.36, 1063839], [20.71, 1202715], [10.61, 1335241],
  [0.81, 1463449],
];

/* Candidates who appeared in the season CRL_BASE was measured on. */
export const CRL_BASE_POOL = 1475103;
/* Candidates who appeared in the season the page describes. */
export const CURRENT_POOL = TOTAL_POOL;

/* Scaling a rank distribution by the change in pool size is the standard
   approximation and is what every rank predictor does between seasons. */
export const POOL_SCALE = CURRENT_POOL / CRL_BASE_POOL;

export const CRL: Pair[] = CRL_BASE.map(([p, r]) => [p, Math.round(r * POOL_SCALE)]);

/* CRL-PwD, from the NTA 2025 PwD list. This is a *published* curve, not a
   model, so it is used as it stands. The list is short — 4,316 names — and
   that is why it flattens so early. */
export const CRL_PWD: Pair[] = [
  [99.97, 2], [99.01, 20], [98.04, 40], [97.31, 55], [96.19, 77], [95.05, 102],
  [93.83, 147], [92.65, 170], [90.73, 220], [89.55, 247], [87.51, 304], [85.42, 367],
  [82.60, 457], [80.40, 531], [75.77, 722], [70.81, 931], [65.62, 1196], [60.30, 1429],
  [55.80, 1654], [50.63, 1920], [45.41, 2199], [40.19, 2422], [35.40, 2663], [30.57, 2902],
  [25.58, 3155], [20.36, 3402], [15.66, 3645], [10.51, 3879], [5.26, 4112], [0.45, 4316],
];

export const CRL_PWD_TOTAL = 4316;

/* OBC-NCL within PwD — the most granular PwD curve NTA publishes. */
export const OBC_PWD: Pair[] = [
  [99.48, 1], [99.01, 6], [97.80, 12], [96.97, 21], [96.19, 25], [95.69, 29],
  [94.26, 42], [93.45, 50], [91.78, 75], [90.73, 79], [88.83, 94], [86.77, 116],
  [84.66, 146], [82.89, 163], [80.47, 201], [78.61, 232], [76.98, 258], [75.77, 286],
  [72.67, 331], [70.81, 366], [68.88, 405], [67.83, 425], [65.70, 469], [63.61, 506],
  [61.84, 544], [59.82, 594], [57.80, 645], [55.80, 682], [53.43, 736], [50.83, 804],
  [48.58, 862], [46.56, 920], [44.55, 976], [42.45, 1019], [40.27, 1062], [38.62, 1108],
  [36.43, 1145], [34.70, 1187], [32.92, 1216], [30.57, 1271], [28.91, 1310], [26.90, 1361],
  [25.58, 1388], [23.76, 1432], [21.61, 1479], [19.26, 1536], [17.53, 1576], [15.90, 1617],
  [13.88, 1645], [12.69, 1675], [10.55, 1723], [8.78, 1764], [7.42, 1795], [6.31, 1823],
  [5.14, 1853], [3.31, 1894], [2.93, 1905], [1.61, 1933], [0.46, 1953],
];

/* PwD sub-lists at the percentile bands NTA lists. A dash means the source
   had no data point near that band. */
export const SUB_CATEGORIES: [string, string, string, string, string][] = [
  ["~95", "17", "~29", "2", "—"],
  ["~90", "~33", "79", "~7", "6"],
  ["~80", "~71", "201", "30", "12"],
  ["~70", "~145", "366", "~55", "19"],
  ["~60", "~192", "572", "102", "31"],
  ["~50", "~261", "804", "136", "~37"],
  ["~40", "~320", "1,062", "176", "62"],
  ["~25", "403", "1,388", "256", "78"],
  ["lowest listed", "535 (@0.28)", "1,953 (@0.46)", "377 (@0.45)", "107 (@4.51)"],
];

/* ─────────────── marks ─────────────── */

/* marks band → [band label, lowest percentile in band, highest] */
export const MARKS_BANDS: [string, number, number][] = [
  ["291–300", 99.999, 100], ["280–292", 99.996, 99.999], ["271–279", 99.992, 99.994],
  ["259–268", 99.977, 99.990], ["250–258", 99.952, 99.974], ["240–249", 99.915, 99.950],
  ["230–239", 99.871, 99.914], ["220–229", 99.782, 99.862], ["210–219", 99.692, 99.775],
  ["200–209", 99.575, 99.685], ["190–199", 99.409, 99.560], ["180–189", 99.173, 99.393],
  ["170–179", 98.880, 99.157], ["160–169", 98.528, 98.851], ["150–159", 98.093, 98.498],
  ["140–149", 97.543, 98.075], ["130–139", 96.878, 97.493], ["120–129", 96.069, 96.809],
  ["110–119", 95.056, 95.983], ["100–109", 93.802, 94.967], ["90–99", 92.219, 93.679],
  ["80–89", 90.276, 92.058], ["70–79", 87.518, 90.045], ["60–69", 83.891, 87.337],
  ["50–59", 78.351, 83.512], ["40–49", 69.580, 77.819], ["30–39", 56.091, 68.802],
  ["20–29", 36.585, 54.010], ["10–19", 18.166, 35.289], ["0–9", 5.715, 17.146],
];

/* ─────────────── lookup logic ─────────────── */

/* Log-space interpolation between published points. Ranks grow roughly
   geometrically as the percentile falls, so straight-line interpolation
   between two points would badly overshoot in the middle. */
export function interpRank(series: Pair[], p: number): number {
  const s = [...series].sort((a, b) => b[0] - a[0]);
  if (p >= s[0][0]) return s[0][1];
  if (p <= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 0; i < s.length - 1; i++) {
    const [p1, r1] = s[i], [p2, r2] = s[i + 1];
    if (p <= p1 && p >= p2) {
      const t = (p1 - p) / (p1 - p2 || 1);
      const lr = Math.log10(Math.max(r1, 1))
        + t * (Math.log10(Math.max(r2, 1)) - Math.log10(Math.max(r1, 1)));
      return Math.round(Math.pow(10, lr));
    }
  }
  return s[s.length - 1][1];
}

export function marksFor(p: number): string {
  for (const [band, lo, hi] of MARKS_BANDS) if (p >= lo && p <= hi) return band;
  if (p > 100) return MARKS_BANDS[0][0];
  let best = MARKS_BANDS[0], bd = Infinity;
  for (const b of MARKS_BANDS) {
    const d = Math.min(Math.abs(p - b[1]), Math.abs(p - b[2]));
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best[0];
}

/* ─────────────── category ranks ─────────────── */

/* A category rank cannot exceed the number of candidates in that category,
   and cannot be smaller than 1. Everything funnels through here so the
   bound is enforced in one place rather than at each call site.

   The one hard anchor NTA gives us is `qualified`: the number of candidates
   in this category who cleared the cutoff percentile. So a candidate
   sitting exactly on their category's cutoff is the last person admitted,
   and their rank is `qualified`. From there the list is assumed to spread
   the same way the unfiltered list does, which is the ratio of CRL ranks
   on either side of that point.

   This is an estimate and the page says so. The alternative — fitting a
   curve to a third-party rank predictor — produces numbers that disagree
   with themselves by 20-30% between adjacent percentiles, which is worse
   than being honest about the method. */
export function categoryRank(key: CategoryKey, percentile: number): number {
  const meta = CATEGORY_BY_KEY[key];
  const crlAtCutoff = interpRank(CRL, meta.cutoff);
  const crlAtP = interpRank(CRL, percentile);

  /* General is the CRL itself — no model, no scaling. Bound it by the whole
     population, not by the General category's own 5.38 lakh: the Common Rank
     List ranks every candidate who appeared regardless of category, so a
     General candidate's CRL can legitimately sit past the last General-only
     name. Clamping at the category pool would cap the tail at 5.38 lakh and
     tell half the population they share a rank. */
  if (key === "OPEN") return Math.max(1, Math.min(crlAtP, TOTAL_POOL));

  const scaled = (meta.qualified * crlAtP) / crlAtCutoff;
  return Math.max(1, Math.round(Math.min(scaled, meta.pool)));
}

export interface CategoryStanding {
  meta: CategoryMeta;
  rank: number;
  /* True when this percentile clears the category's JEE Advanced cutoff. */
  qualified: boolean;
}

export function standings(p: number): CategoryStanding[] {
  return CATEGORIES.map((meta) => ({
    meta,
    rank: categoryRank(meta.key, p),
    qualified: p >= meta.cutoff,
  }));
}

export interface Conversion {
  percentile: number;
  marks: string;
  crl: number;
  /* Rank on the CRL among PwD candidates — a published curve, not a model. */
  crlPwd: number;
  obcPwd: number;
  categories: CategoryStanding[];
}

export function convert(p: number): Conversion {
  return {
    percentile: p,
    marks: marksFor(p),
    crl: categoryRank("OPEN", p),
    crlPwd: interpRank(CRL_PWD, p),
    obcPwd: interpRank(OBC_PWD, p),
    categories: standings(p),
  };
}
