/* Query-string plumbing for the predictor.

   Filter state lives in the hash, not in component memory, for three reasons:
   a result is worth sending to someone; going into an institute and coming
   back should not throw the filters away; and a reload should land where the
   reader left off. The hash is the single source of truth and React reads it.

   Route shape:  #predict?rank=42000&seat=OBC-NCL&year=2023&round=2 */

import { useCallback, useMemo } from "react";
import type { Chance, SortKey } from "../core";
import { LATEST_YEAR, lastRoundOf, roundsOf } from "./dataset";
import { takePendingRank as consumeRankHandoff } from "./handoff";

export interface PredictParams {
  rank: number;
  seat: string;
  gender: number;
  quota: string;
  year: number;
  round: number;
  deg: string;
  sort: SortKey;
  query: string;
  types: number[];
  chances: Chance[];
}

export const PREDICT_DEFAULTS: PredictParams = {
  rank: 15000,
  seat: "OPEN",
  gender: 0,
  quota: "",
  year: LATEST_YEAR,
  round: lastRoundOf(LATEST_YEAR),
  deg: "",
  sort: "best",
  query: "",
  types: [0, 1, 2, 3],
  chances: ["safe", "mod", "reach"],
};

const SORTS: SortKey[] = ["best", "worst", "inst", "prog"];
const CHANCES: Chance[] = ["safe", "mod", "reach"];

function int(raw: string | null, fallback: number, lo: number, hi: number): number {
  /* Number(null) is 0, not NaN, so a missing parameter has to be rejected
     before the numeric check or it silently clamps to the lower bound. */
  if (raw === null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function oneOf<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/* Parse "a=1&b=2" out of the hash. Unknown keys are ignored, and every value
   is clamped, so a hand-edited or truncated link still renders something. */
export function parsePredictQuery(search: string): PredictParams {
  const q = new URLSearchParams(search.replace(/^\?/, ""));
  const d = PREDICT_DEFAULTS;

  const year = int(q.get("year"), d.year, 2020, LATEST_YEAR);
  const yearRounds = roundsOf(year);
  const round =
    yearRounds.length && q.get("round")
      ? yearRounds.includes(Number(q.get("round")))
        ? Number(q.get("round"))
        : yearRounds[yearRounds.length - 1]
      : lastRoundOf(year);

  const types = q.get("types");
  const chances = q.get("chances");

  return {
    rank: q.has("rank") ? int(q.get("rank"), d.rank, 0, 3_000_000) : d.rank,
    seat: q.get("seat") || d.seat,
    gender: int(q.get("gender"), d.gender, -1, 1),
    quota: q.get("quota") ?? d.quota,
    year,
    round,
    deg: q.get("deg") ?? d.deg,
    sort: oneOf(q.get("sort"), SORTS, d.sort),
    query: q.get("q") ?? d.query,
    types: types
      ? types.split("").map(Number).filter((n) => n >= 0 && n <= 3)
      : d.types,
    chances: chances
      ? (chances.split(",").filter((c) => CHANCES.includes(c as Chance)) as Chance[])
      : d.chances,
  };
}

/* Only non-default values are written, so a shared link stays short and the
   common case stays readable. */
export function buildPredictQuery(p: PredictParams): string {
  const d = PREDICT_DEFAULTS;
  const q = new URLSearchParams();
  if (p.rank !== d.rank) q.set("rank", String(p.rank));
  if (p.seat !== d.seat) q.set("seat", p.seat);
  if (p.gender !== d.gender) q.set("gender", String(p.gender));
  if (p.quota !== d.quota) q.set("quota", p.quota);
  if (p.year !== d.year) q.set("year", String(p.year));
  if (p.round !== lastRoundOf(p.year)) q.set("round", String(p.round));
  if (p.deg !== d.deg) q.set("deg", p.deg);
  if (p.sort !== d.sort) q.set("sort", p.sort);
  if (p.query) q.set("q", p.query);
  if (p.types.length !== 4) q.set("types", p.types.slice().sort().join(""));
  if (p.chances.length !== 3) q.set("chances", p.chances.join(","));
  const s = q.toString();
  return s ? "?" + s : "";
}

export function usePredictState(hash: string): {
  params: PredictParams;
  update: (patch: Partial<PredictParams>) => void;
  reset: () => void;
  shareUrl: string;
} {
  const search = useMemo(() => {
    const i = hash.indexOf("?");
    return i === -1 ? "" : hash.slice(i);
  }, [hash]);

  /* A rank handed over from the Cut-offs page arrives in the query string.
     consumeRankHandoff() is the fallback for any caller that navigates to a
     bare #predict: it reads the one-shot slot that setPendingRank fills.
     Read once per mount and cleared, so it can never re-apply later. */
  const params = useMemo(() => {
    const parsed = parsePredictQuery(search);
    if (search.includes("rank=")) return parsed;
    const carried = consumeRankHandoff();
    return carried == null ? parsed : { ...parsed, rank: carried };
  }, [search]);

  const update = useCallback(
    (patch: Partial<PredictParams>) => {
      const next = { ...parsePredictQuery(search), ...patch };

      /* Switching to a year with fewer rounds must not leave a round
         selected that this year never ran. */
      const yearRounds = roundsOf(next.year);
      if (!yearRounds.includes(next.round)) {
        next.round = yearRounds[yearRounds.length - 1];
      }

      const qs = buildPredictQuery(next);
      const target = "#predict" + qs;
      if (window.location.hash === target) return;
      history.replaceState(null, "", target);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    },
    [search],
  );

  const reset = useCallback(() => update(PREDICT_DEFAULTS), [update]);

  const shareUrl = useMemo(() => {
    const base = window.location.href.split("#")[0];
    return base + "#predict" + buildPredictQuery(params);
  }, [params]);

  return { params, update, reset, shareUrl };
}
