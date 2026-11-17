const inr = new Intl.NumberFormat("en-IN");

/* JoSAA ranks are read as Indian numbers (1,23,456), never as Western ones. */
export function fm(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return inr.format(Math.round(n));
}

export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits) + "%";
}

/* "2020 → 2026" reads better than "2020-2026" in a column header. */
export function yearSpan(years: number[]): string {
  if (!years.length) return "—";
  if (years.length === 1) return String(years[0]);
  return years[0] + "–" + years[years.length - 1];
}

export function plural(n: number, one: string, many = one + "s"): string {
  return n === 1 ? one : many;
}

/* Compact axis labels: 1,46,344 → "1.46L", 7,691 → "7.7k". */
export function compact(n: number): string {
  if (n >= 1_00_000) return (n / 1_00_000).toFixed(n >= 10_00_000 ? 1 : 2) + "L";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return String(n);
}
