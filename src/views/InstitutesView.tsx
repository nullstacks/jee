import { useDeferredValue, useMemo, useState } from "react";
import { TYPES } from "../core";
import { INSTITUTE_COUNT, INSTITUTES, YEARS_DESC, instBest } from "../lib/dataset";
import { fm, plural } from "../lib/format";
import { navigate } from "../lib/hooks";
import {
  BuildingIcon,
  ChevronRightIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "../components/icons";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  PageHead,
  SearchInput,
} from "../components/ui";
import { StarButton } from "../components/StarButton";
import type { ViewProps } from "../App";

export function InstitutesView({ favourites }: ViewProps) {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<Set<number>>(() => new Set([0, 1, 2, 3]));
  const deferred = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    return INSTITUTES.filter(
      (i) => types.has(i.type) && (!q || i.name.toLowerCase().includes(q)),
    );
  }, [deferred, types]);

  const pinned = useMemo(
    () => favourites.list.map((f) => INSTITUTES.find((i) => i.name === f.name)).filter(Boolean),
    [favourites.list],
  );

  const toggleType = (i: number) => {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        if (next.size === 1) return prev;
        next.delete(i);
      } else next.add(i);
      return next;
    });
  };

  return (
    <div className="shell view view-institutes">
      <PageHead
        eyebrow={<><BuildingIcon size={13} /> {INSTITUTE_COUNT} institutes · {YEARS_DESC.length} years</>}
        title="Institutes"
        lede="Pin the institutes you are actually chasing, then open one to see how its cut-offs have moved since 2020."
      />

      <section className="pinned" aria-labelledby="pinned-heading">
        <div className="pinned-head">
          <h2 id="pinned-heading">
            Pinned
            {pinned.length > 0 ? <span className="pinned-count">{pinned.length}</span> : null}
          </h2>
          <span className="pinned-meta">
            {pinned.length
              ? favourites.full
                ? "At the " + favourites.cap + " pin limit"
                : (favourites.cap - pinned.length) + " of " + favourites.cap + " slots free"
              : "Star an institute from any list or from a predictor result"}
          </span>
        </div>

        {pinned.length ? (
          <ul className="pinned-grid">
            {(pinned as NonNullable<(typeof pinned)[number]>[]).map((inst) => {
              const { best, year } = instBest(inst);
              return (
                <li key={inst.name} className="pinned-card">
                  <a
                    className="pinned-main"
                    href={"#institute/" + encodeURIComponent(inst.slug)}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("#institute/" + encodeURIComponent(inst.slug));
                    }}
                  >
                    <span className="pinned-name">{inst.name}</span>
                    <span className="pinned-meta-line">
                      {TYPES[inst.type]} · {inst.programs.size}{" "}
                      {plural(inst.programs.size, "branch", "branches")}
                      {best ? " · closed " + fm(best) + " in " + year : ""}
                    </span>
                  </a>
                  <StarButton
                    name={inst.name}
                    pinned
                    onToggle={favourites.toggle}
                    size="sm"
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="pinned-empty">
            <StarIcon size={16} />
            <span>Nothing pinned yet. Tap the star beside any institute — up to {favourites.cap}.</span>
          </div>
        )}
      </section>

      <div className="inst-toolbar">
        <div className="inst-search">
          <SearchInput
            label="Find an institute"
            placeholder="bombay, trichy, iiit…"
            value={query}
            onValueChange={setQuery}
          />
        </div>
        <div className="filter-chips" role="group" aria-label="Filter by institute type">
          {TYPES.map((t, i) => (
            <Chip key={t} pressed={types.has(i)} onClick={() => toggleType(i)}>
              {t}
            </Chip>
          ))}
        </div>
        {(query || types.size < 4) && (
          <Button
            variant="quiet"
            size="sm"
            icon={<XIcon size={13} />}
            onClick={() => {
              setQuery("");
              setTypes(new Set([0, 1, 2, 3]));
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <Card flush className="inst-list-card">
        <div className="inst-list-head">
          <span>
            {filtered.length} of {INSTITUTE_COUNT} institutes
          </span>
          <span className="inst-list-range">
            {YEARS_DESC[YEARS_DESC.length - 1]}–{YEARS_DESC[0]}
          </span>
        </div>

        {filtered.length ? (
          <ul className="inst-list">
            {filtered.map((inst) => {
              const { best, year } = instBest(inst);
              const isPinned = favourites.has(inst.name);
              return (
                <li key={inst.name} className="inst-row">
                  <StarButton
                    name={inst.name}
                    pinned={isPinned}
                    onToggle={favourites.toggle}
                    size="sm"
                  />
                  <a
                    className="inst-row-main"
                    href={"#institute/" + encodeURIComponent(inst.slug)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                      e.preventDefault();
                      navigate("#institute/" + encodeURIComponent(inst.slug));
                    }}
                  >
                    <span className="inst-row-name">{inst.name}</span>
                    <span className="inst-row-meta">
                      <span className="type-tag" data-type={inst.type}>
                        {TYPES[inst.type]}
                      </span>
                      {inst.programs.size} {plural(inst.programs.size, "branch", "branches")}
                      {best ? " · best close " + fm(best) + " (" + year + ")" : ""}
                    </span>
                  </a>
                  <ChevronRightIcon size={16} className="inst-row-go" />
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<SearchIcon size={20} />}
            title={"No institute matches “" + query + "”"}
            action={
              <Button
                onClick={() => {
                  setQuery("");
                  setTypes(new Set([0, 1, 2, 3]));
                }}
              >
                Clear the filters
              </Button>
            }
          >
            Try a shorter word — the search matches anywhere in the institute's full name.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
