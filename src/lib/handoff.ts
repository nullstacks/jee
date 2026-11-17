/* A one-shot handoff between two views.
   The Cut-offs panel offers "take this rank to the predictor", so the number
   has to survive the route change. A module-level slot is enough: it is read
   exactly once, on the next mount of the predictor, and cleared. Nothing
   persists and nothing leaks across reloads. */

let pendingRank: number | null = null;

export function setPendingRank(rank: number): void {
  pendingRank = Number.isFinite(rank) && rank > 0 ? Math.round(rank) : null;
}

export function takePendingRank(): number | null {
  const value = pendingRank;
  pendingRank = null;
  return value;
}
