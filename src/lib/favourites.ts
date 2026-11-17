import { useCallback, useMemo } from "react";
import {
  FAV_CAP,
  pruneFavourites,
  toggleFavourite,
  type Favourite,
} from "../core";
import { KNOWN_INSTITUTE_NAMES } from "./dataset";
import { readJSON, writeJSON } from "./storage";
import { usePersistentState } from "./hooks";

const KEY = "jee.favourites";

function read(key: string, fallback: Favourite[]): Favourite[] {
  const raw = readJSON<unknown>(key, fallback);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (f): f is { name: string; addedAt?: unknown } =>
        !!f && typeof (f as { name?: unknown }).name === "string",
    )
    .map((f) => ({ name: f.name, addedAt: Number(f.addedAt) || 0 }));
}

function write(key: string, value: Favourite[]): void {
  writeJSON(key, value);
}

export interface FavouritesApi {
  list: Favourite[];
  cap: number;
  full: boolean;
  has: (name: string) => boolean;
  toggle: (name: string) => { added: boolean; rejected: boolean };
  clear: () => void;
}

export function useFavourites(): FavouritesApi {
  const [raw, setList] = usePersistentState<Favourite[]>(KEY, [], read, write);

  /* An institute can disappear between releases. Prune lazily at read time
     so a stale record never renders as a blank card. */
  const list = useMemo(
    () => pruneFavourites(raw, KNOWN_INSTITUTE_NAMES).kept,
    [raw],
  );

  const has = useCallback(
    (name: string) => list.some((f) => f.name === name),
    [list],
  );

  const toggle = useCallback(
    (name: string) => {
      const wasPinned = list.some((f) => f.name === name);
      if (!wasPinned && list.length >= FAV_CAP) {
        return { added: false, rejected: true };
      }
      setList((prev) => toggleFavourite(pruneFavourites(prev, KNOWN_INSTITUTE_NAMES).kept, name));
      return { added: !wasPinned, rejected: false };
    },
    [list, setList],
  );

  const clear = useCallback(() => setList([]), [setList]);

  return { list, cap: FAV_CAP, full: list.length >= FAV_CAP, has, toggle, clear };
}
