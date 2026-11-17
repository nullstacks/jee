import { useCallback, useMemo } from "react";
import { CHAPTER_ROWS, REPORTS, type SubjectKey } from "./reports";
import { readJSON, writeJSON } from "./storage";
import { usePersistentState } from "./hooks";

const KEY = "jee.chapters.done";
const LEGACY_KEY = "jee2027.done";
const OLDEST_KEY = "jee27";

type DoneMap = Record<string, true>;

/* Ticks are keyed by report id ("physics/electrostatics"), not by list index.
   The previous build keyed them by position, so adding or reordering a
   chapter silently moved every tick onto its neighbour. */

/* The pre-report site stored "Physics|4" keys; the one before that stored
   "Physics4". Both are mapped back onto the nearest chapter name so a reader
   upgrading the app does not lose a year of ticks. */
function migrateLegacy(): DoneMap {
  const out: DoneMap = {};
  const byIndex: Record<string, SubjectKey> = {
    Physics: "physics", Chemistry: "chemistry", Mathematics: "mathematics",
  };

  const older = readJSON<Record<string, unknown> | null>(OLDEST_KEY, null);
  if (older && typeof older === "object") {
    for (const [k, v] of Object.entries(older)) {
      if (!v) continue;
      const m = /^(.+?)(\d+)$/.exec(k);
      const subject = m ? byIndex[m[1]] : undefined;
      if (!m || !subject) continue;
      const rows = CHAPTER_ROWS.filter((row) => row.report.subject === subject);
      const hit = rows[Number(m[2])];
      if (hit) out[hit.report.id] = true;
    }
  }

  const previous = readJSON<Record<string, unknown> | null>(LEGACY_KEY, null);
  if (previous && typeof previous === "object") {
    for (const [k, v] of Object.entries(previous)) {
      if (!v) continue;
      const [subject, index] = k.split("|");
      const key = byIndex[subject];
      if (!key) continue;
      const rows = CHAPTER_ROWS.filter((row) => row.report.subject === key);
      const hit = rows[Number(index)];
      if (hit) out[hit.report.id] = true;
    }
  }

  return out;
}

function knownIds(): Set<string> {
  return new Set(REPORTS.map((r) => r.id));
}

function read(key: string, fallback: DoneMap): DoneMap {
  const raw = readJSON<Record<string, unknown> | null>(key, null);
  if (raw && typeof raw === "object" && Object.keys(raw).length) {
    const ids = knownIds();
    const out: DoneMap = {};
    for (const [k, v] of Object.entries(raw)) if (v && ids.has(k)) out[k] = true;
    return out;
  }
  return Object.keys(fallback).length ? fallback : migrateLegacy();
}

function write(key: string, value: DoneMap): void {
  writeJSON(key, value);
}

export interface ProgressApi {
  total: number;
  doneTotal: number;
  percent: number;
  doneIn: (subject: SubjectKey) => number;
  totalIn: (subject: SubjectKey) => number;
  isDone: (id: string) => boolean;
  setDone: (id: string, done: boolean) => void;
  toggle: (id: string) => boolean;
  reset: (subject: SubjectKey) => void;
  bySubject: Record<SubjectKey, number>;
}

export function useProgress(): ProgressApi {
  const [map, setMap] = usePersistentState<DoneMap>(KEY, {}, read, write);

  const isDone = useCallback((id: string) => map[id] === true, [map]);

  const setDone = useCallback(
    (id: string, done: boolean) => {
      setMap((prev) => {
        const next = { ...prev };
        if (done) next[id] = true;
        else delete next[id];
        return next;
      });
    },
    [setMap],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = !isDone(id);
      setDone(id, next);
      return next;
    },
    [isDone, setDone],
  );

  const reset = useCallback(
    (subject: SubjectKey) => {
      setMap((prev) => {
        const next = { ...prev };
        for (const report of REPORTS) if (report.subject === subject) delete next[report.id];
        return next;
      });
    },
    [setMap],
  );

  const bySubject = useMemo(
    () =>
      Object.fromEntries(
        (["physics", "chemistry", "mathematics"] as SubjectKey[]).map((s) => [
          s,
          REPORTS.filter((r) => r.subject === s && map[r.id]).length,
        ]),
      ) as Record<SubjectKey, number>,
    [map],
  );

  const totalIn = useCallback(
    (subject: SubjectKey) => REPORTS.filter((r) => r.subject === subject).length,
    [],
  );

  const doneIn = useCallback((subject: SubjectKey) => bySubject[subject], [bySubject]);

  const doneTotal = useMemo(
    () => Object.values(bySubject).reduce((a, b) => a + b, 0),
    [bySubject],
  );

  return {
    total: REPORTS.length,
    doneTotal,
    percent: REPORTS.length ? Math.round((doneTotal / REPORTS.length) * 100) : 0,
    doneIn,
    totalIn,
    isDone,
    setDone,
    toggle,
    reset,
    bySubject,
  };
}
