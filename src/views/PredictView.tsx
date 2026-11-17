import { useDeferredValue, useMemo, useState } from "react";
import {
  QUOTA_LONG,
  QUOTAS,
  SEATS,
  TYPES,
  predict,
  type Chance,
  type PredictHit,
  type SortKey,
} from "../core";
import { DEGREES, ROW_COUNT, YEARS_DESC, lastRoundOf, rowsForRound, roundsOf } from "../lib/dataset";
import { fm, plural } from "../lib/format";
import { navigate } from "../lib/hooks";
import { usePredictState } from "../lib/predict-query";
import {
  AlertIcon,
  CheckIcon,
  LayersIcon,
  LinkIcon,
  ResetIcon,
  SearchIcon,
  SparkIcon,
} from "../components/icons";
import {
  Badge,
  Button,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Field,
  PageHead,
  SearchInput,
  Select,
  Stat,
} from "../components/ui";
import { StarButton } from "../components/StarButton";
import type { ViewProps } from "../App";

const PAGE = 60;

const CHANCE_LABEL: Record<Chance, string> = {
  safe: "Safe",
  mod: "Borderline",
  reach: "A stretch",
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "best", label: "Toughest first" },
  { value: "worst", label: "Safest first" },
  { value: "inst", label: "Institute name" },
  { value: "prog", label: "Branch name" },
];

export function PredictView({ favourites, arg }: ViewProps) {
  /* Filters live in the hash so a result can be shared and survives a trip
     into an institute and back. App hands down the full hash without the
     leading "#", which is exactly what the parser wants. */
  const { params, update, reset, shareUrl } = usePredictState(arg);
  const [shown, setShown] = useState(PAGE);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof typeof params>(key: K, value: (typeof params)[K]) => {
    update({ [key]: value } as Partial<typeof params>);
    setShown(PAGE);
  };

  const types = useMemo(() => new Set(params.types), [params.types]);
  const chances = useMemo(() => new Set(params.chances), [params.chances]);

  /* Typing re-runs the scan; deferring keeps every keystroke responsive. */
  const deferredQuery = useDeferredValue(params.query);

  const rows = useMemo(
    () => rowsForRound(params.year, params.round),
    [params.year, params.round],
  );

  const result = useMemo(() => {
    const terms = deferredQuery.toLowerCase().split(/[,\s]+/).filter(Boolean);
    return predict({
      rows,
      rank: params.rank,
      seat: params.seat,
      quota: params.quota,
      gender: params.gender,
      deg: params.deg,
      types,
      terms,
      sort: params.sort,
      year: params.year,
      round: params.round,
    });
  }, [rows, params, deferredQuery, types]);

  const visible = useMemo(
    () => result.results.filter((r) => chances.has(r.chance)),
    [result.results, chances],
  );

  const shownRows = visible.slice(0, shown);
  const hasResults = visible.length > 0;
    /* "Nothing closed near your rank" and "your search matched nothing" are
     different problems with different fixes, so the empty state names the
     one that actually happened. */
  const emptyReason = useMemo((): { title: string; body: string; action: "reset" | "clearSearch" } => {
    const terms = deferredQuery.trim();
    if (terms && result.counts.all > 0) {
      return {
        title: "No seat matches \u201c" + terms + "\u201d",
        body:
          "There are " + fm(result.counts.all) + " seats at your rank under these filters, " +
          "but none of their institute or branch names contain that text.",
        action: "clearSearch",
      };
    }
    if (terms && result.counts.all === 0) {
      return {
        title: "Nothing at that rank, and nothing matching \u201c" + terms + "\u201d",
        body:
          "No seat in the " + params.year + " round " + params.round + " " + params.seat +
          " pool closed within 15% of rank " + fm(params.rank) +
          ". Widen the category, quota or year first, then search.",
        action: "reset",
      };
    }
    return {
      title: "No seat closed near that rank in round " + params.round,
      body:
        "Nothing in the " + params.year + " " + params.seat + " pool closed within 15% of rank " +
        fm(params.rank) + " by round " + params.round +
        ". Later rounds admit further down the list, so try the final round, or another category or year.",
      action: "reset",
    };
  }, [deferredQuery, result.counts.all, params.year, params.seat, params.rank, params.round]);

  const toggleType = (i: number) => {
    const next = new Set(params.types);
    if (next.has(i)) {
      if (next.size === 1) return; // never leave zero types on
      next.delete(i);
    } else {
      next.add(i);
    }
    set("types", [...next].sort());
  };

  const toggleChance = (c: Chance) => {
    const next = new Set(params.chances);
    if (next.has(c)) {
      if (next.size === 1) return;
      next.delete(c);
    } else next.add(c);
    set("chances", [...next]);
  };

  const yearRounds = roundsOf(params.year);
  const isFinalRound = params.round === lastRoundOf(params.year);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked - the URL bar still shows the same link */
    }
  };
  return (
    <div className="shell view view-predict">
      <PageHead
        eyebrow={<><SparkIcon size={13} /> {YEARS_DESC.length} years · every round</>}
        title="Which seat is still open at your rank"
        lede="JoSAA closing ranks from 2020 to 2026, round by round. Each later round admits candidates further down the list, so the closing rank grows: a seat that was out of reach in round 1 can be open by the final round."
      />

      <Card className="filter-card">
        <div className="filter-head">
          <span className="filter-head-title">Your seat</span>
          <div className="filter-head-actions">
            <button type="button" className="filter-reset" onClick={copyLink}>
              {copied ? <CheckIcon size={13} /> : <LinkIcon size={13} />}
              {copied ? "Link copied" : "Copy link"}
            </button>
            <button type="button" className="filter-reset" onClick={() => { reset(); setShown(PAGE); }}>
              <ResetIcon size={13} /> Reset
            </button>
          </div>
        </div>

        <div className="filter-grid">
          <Field label="Your rank" hint="JoSAA All-India rank" htmlFor="rank-input">
            <input
              id="rank-input"
              className="input input-rank num"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={params.rank || ""}
              placeholder="e.g. 15000"
              onChange={(e) => set("rank", e.target.valueAsNumber || 0)}
            />
          </Field>

          <Field label="Category" htmlFor="seat-select">
            <Select
              id="seat-select"
              value={params.seat}
              onChange={(e) => set("seat", e.target.value)}
            >
              {SEATS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Gender pool" htmlFor="gender-select">
            <Select
              id="gender-select"
              value={params.gender}
              onChange={(e) => set("gender", Number(e.target.value))}
            >
              <option value={0}>Gender-neutral</option>
              <option value={1}>Female-only</option>
              <option value={-1}>Both</option>
            </Select>
          </Field>

          <Field label="Quota" htmlFor="quota-select">
            <Select
              id="quota-select"
              value={params.quota}
              onChange={(e) => set("quota", e.target.value)}
            >
              <option value="">Any quota (best of each)</option>
              {QUOTAS.map((q) => (
                <option key={q} value={q}>
                  {q} — {QUOTA_LONG[q]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Year" htmlFor="year-select">
            <Select
              id="year-select"
              value={params.year}
              onChange={(e) => set("year", Number(e.target.value))}
            >
              {YEARS_DESC.map((y) => (
                <option key={y} value={y}>
                  {y}
                  {y === YEARS_DESC[0] ? " — latest" : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Degree" htmlFor="degree-select">
            <Select id="degree-select" value={params.deg} onChange={(e) => set("deg", e.target.value)}>
              <option value="">Any degree</option>
              {DEGREES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Sort by" htmlFor="sort-select">
            <Select
              id="sort-select"
              value={params.sort}
              onChange={(e) => set("sort", e.target.value as SortKey)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Filter" htmlFor="query-input" wide>
            <SearchInput
              id="query-input"
              label="Filter by institute or branch"
              placeholder="kanpur, computer science, civil…"
              value={params.query}
              onValueChange={(v) => set("query", v)}
            />
          </Field>
        </div>

        {/* Round is the control that makes this data worth having, so it gets
            its own labelled row rather than hiding in the grid. */}
        <div className="filter-row round-row">
          <span className="filter-label" id="round-label">
            Round
          </span>
          <div className="round-chips" role="group" aria-labelledby="round-label">
            {yearRounds.map((r) => (
              <Chip key={r} pressed={params.round === r} onClick={() => set("round", r)}>
                {r}
                {r === lastRoundOf(params.year) ? " · final" : ""}
              </Chip>
            ))}
          </div>
          <span className="round-note">
            {isFinalRound
              ? "The widest cut-off of the cycle."
              : "Round " + params.round + " of " + yearRounds[yearRounds.length - 1] + " — later rounds admit further down the list."}
          </span>
        </div>

        <div className="filter-row">
          <span className="filter-label" id="type-label">
            Institute type
          </span>
          <div className="filter-chips" role="group" aria-labelledby="type-label">
            {TYPES.map((t, i) => (
              <Chip key={t} pressed={types.has(i)} onClick={() => toggleType(i)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label" id="chance-label">
            Show
          </span>
          <div className="filter-chips" role="group" aria-labelledby="chance-label">
            {(Object.keys(CHANCE_LABEL) as Chance[]).map((c) => (
              <Chip key={c} pressed={chances.has(c)} onClick={() => toggleChance(c)}>
                {CHANCE_LABEL[c]}
              </Chip>
            ))}
          </div>
        </div>

        <p className="filter-note">
          <AlertIcon size={14} />
          <span>
            <strong>These are JoSAA All-India ranks, not JEE percentiles.</strong> Convert a
            percentile on the Cut-offs tab first. “Any quota” compares you against the friendliest
            quota pool for each seat.
          </span>
        </p>
      </Card>

      <div className="stat-row">
        <Stat
          label="Comfortably in"
          hint="closed 10%+ below your rank"
          tone="safe"
          value={params.rank ? fm(result.counts.safe) : "—"}
        />
        <Stat
          label="Around your rank"
          hint="closed within 10% either way"
          tone="mod"
          value={params.rank ? fm(result.counts.mod) : "—"}
        />
        <Stat
          label="Just out of reach"
          hint="closed up to 15% above you"
          tone="reach"
          value={params.rank ? fm(result.counts.reach) : "—"}
        />
        <Stat label="Rows shown" hint="after every filter" value={fm(visible.length)} />
      </div>

      <Card flush className="results-card">
        <CardHead
          title={hasResults ? "Matching seats" : "No matches"}
          note={
            hasResults
              ? visible.length +
                " " +
                plural(visible.length, "seat") +
                " · showing " +
                Math.min(shown, visible.length) +
                " · " +
                params.seat +
                " · " +
                params.year +
                " round " +
                params.round
              : emptyReason.title
          }
          trailing={
            hasResults ? (
              <span className="results-sorted">
                <LayersIcon size={13} /> {SORT_OPTIONS.find((o) => o.value === params.sort)?.label}
              </span>
            ) : null
          }
        />

        {hasResults ? (
          <>
            {/* Scrolls vertically with a max-height; focusable so the keyboard
                can reach the rows below the fold. */}
            <div
              className="results-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Matching seats"
            >
              <table className="results-table">
                <thead>
                  <tr>
                    <th className="col-star">
                      <span className="sr-only">Pinned</span>
                    </th>
                    <th>Institute</th>
                    <th>Branch</th>
                    <th className="col-seat">Seat</th>
                    <th className="col-num">Opening</th>
                    <th className="col-num">Closing</th>
                    <th className="col-chance">Chance</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((hit) => (
                    <ResultRow
                      key={hit.row.inst + hit.row.prog + hit.row.deg + hit.row.seat}
                      hit={hit}
                      pinned={favourites.has(hit.row.inst)}
                      onTogglePin={favourites.toggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="results-cards">
              {shownRows.map((hit) => (
                <ResultCard
                  key={hit.row.inst + hit.row.prog + hit.row.deg + hit.row.seat}
                  hit={hit}
                  pinned={favourites.has(hit.row.inst)}
                  onTogglePin={favourites.toggle}
                />
              ))}
            </ul>

            {visible.length > shown ? (
              <div className="results-more">
                <Button onClick={() => setShown((n) => n + PAGE)}>
                  Show {Math.min(PAGE, visible.length - shown)} more of {fm(visible.length)}
                </Button>
              </div>
            ) : (
              <p className="results-end">
                End of {fm(visible.length)} {plural(visible.length, "match", "matches")}.
              </p>
            )}
          </>
        ) : (
          <EmptyState
            icon={<SearchIcon size={20} />}
            title={emptyReason.title}
            action={
              emptyReason.action === "clearSearch" ? (
                <Button variant="secondary" onClick={() => set("query", "")}>
                  Clear the search
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => { reset(); setShown(PAGE); }}>
                  Reset the filters
                </Button>
              )
            }
          >
            {emptyReason.body}
          </EmptyState>
        )}
      </Card>

      <p className="view-foot">
        {fm(rows.length)} seats allocated in {params.year} round {params.round}, out of{" "}
        {fm(ROW_COUNT)} across every year and every round. Later rounds admit further down the
        list, so the final round is the widest cut-off of a cycle.
      </p>
    </div>
  );
}

function ResultRow({
  hit,
  pinned,
  onTogglePin,
}: {
  hit: PredictHit;
  pinned: boolean;
  onTogglePin: (name: string) => void;
}) {
  const { row, quotas, chance } = hit;
  return (
    <tr>
      <td className="col-star">
        <StarButton name={row.inst} pinned={pinned} onToggle={onTogglePin} size="sm" />
      </td>
      <td className="col-inst">
        <a
          className="inst-link"
          href={"#institute/" + encodeURIComponent(slug(row.inst))}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            navigate("#institute/" + encodeURIComponent(slug(row.inst)));
          }}
        >
          {row.inst}
        </a>
        <span className="row-sub">{TYPES[row.type]}</span>
      </td>
      <td className="col-branch">
        {row.prog}
        <span className="row-sub">{row.deg}</span>
      </td>
      <td className="col-seat">
        <span className="seat-tag">
          {row.q} · {row.seat}
        </span>
        <span className="row-sub">
          {row.g ? "Female-only" : "Gender-neutral"}
          {quotas.length > 1 ? " · best of " + quotas.join(", ") : ""}
        </span>
      </td>
      <td className="col-num num">{row.op ? fm(row.op) : "—"}</td>
      <td className="col-num num col-closing">{fm(row.cl)}</td>
      <td className="col-chance">
        <Badge tone={chance}>{CHANCE_LABEL[chance]}</Badge>
      </td>
    </tr>
  );
}

function ResultCard({
  hit,
  pinned,
  onTogglePin,
}: {
  hit: PredictHit;
  pinned: boolean;
  onTogglePin: (name: string) => void;
}) {
  const { row, quotas, chance } = hit;
  return (
    <li className="result-card">
      <div className="result-card-top">
        <div className="result-card-titles">
          <a
            className="inst-link"
            href={"#institute/" + encodeURIComponent(slug(row.inst))}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              navigate("#institute/" + encodeURIComponent(slug(row.inst)));
            }}
          >
            {row.inst}
          </a>
          <span className="row-sub">{TYPES[row.type]}</span>
        </div>
        <StarButton name={row.inst} pinned={pinned} onToggle={onTogglePin} />
      </div>

      <p className="result-card-branch">{row.prog}</p>
      <p className="result-card-meta">
        {row.q} · {row.seat} · {row.g ? "Female-only" : "Gender-neutral"}
        {quotas.length > 1 ? " · best of " + quotas.join(", ") : ""}
      </p>

      <div className="result-card-foot">
        <div className="result-card-nums">
          <span>
            <em>Open</em>
            <b className="num">{row.op ? fm(row.op) : "—"}</b>
          </span>
          <span>
            <em>Close</em>
            <b className="num">{fm(row.cl)}</b>
          </span>
        </div>
        <Badge tone={chance}>{CHANCE_LABEL[chance]}</Badge>
      </div>
    </li>
  );
}

/* Route slugs mirror core.slugify; duplicated here so a row never has to
   import the whole core module into a hot render path. */
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
