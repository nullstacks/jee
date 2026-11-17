import { useMemo, useState } from "react";
import { SEATS, TYPES, buildInstituteSeries, buildSeason, type Row, type Series } from "../core";
import {
  BY_SLUG,
  INSTITUTE_COUNT,
  ROWS_BY_INST,
  YEARS_DESC,
  rowsForYear,
  roundsOf,
} from "../lib/dataset";
import { fm, plural } from "../lib/format";
import { navigate, useElementWidth } from "../lib/hooks";
import { CutoffChart, seriesStyle } from "../components/CutoffChart";
import {
  AlertIcon,
  ArrowRightIcon,
  BuildingIcon,
  ChevronLeftIcon,
  InfoIcon,
  SearchIcon,
  TrendIcon,
} from "../components/icons";
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  Field,
  Notice,
  SearchInput,
  Select,
} from "../components/ui";
import { StarButton } from "../components/StarButton";
import type { ViewProps } from "../App";

const MAX_LINES = 8;

export function InstituteView({ arg, favourites }: ViewProps) {
  const inst = BY_SLUG.get(arg);
  const [seat, setSeat] = useState("OPEN");
  const [gender, setGender] = useState(0);
  const [metric, setMetric] = useState<"cl" | "op">("cl");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Set<string> | null>(null);
  /* The season strip reads one branch across the rounds of one year. */
  const [seasonBranch, setSeasonBranch] = useState<string | null>(null);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>(760);

  const rows = useMemo(() => (inst ? ROWS_BY_INST.get(inst.name) ?? [] : []), [inst]);

  /* The season view needs every round, not just the final one. */
  const allRoundRows = useMemo(() => {
    if (!inst) return [];
    const out: Row[] = [];
    for (const year of YEARS_DESC) {
      for (const r of rowsForYear(year)) if (r.inst === inst.name) out.push(r);
    }
    return out;
  }, [inst]);

  const built = useMemo(
    () => buildInstituteSeries(rows, { seat, gender, metric }),
    [rows, seat, gender, metric],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? built.series.filter((s) => s.label.toLowerCase().includes(q)) : built.series;
  }, [built.series, query]);

  /* Eight lines is the most anyone can read at once, so the chart opens with
     the eight toughest branches and the legend toggles the rest in. */
  const plotted = useMemo(() => {
    if (!active) return visible.slice(0, MAX_LINES);
    return visible.filter((s) => active.has(s.label));
  }, [active, visible]);

  const allLabels = useMemo(() => visible.map((s) => s.label), [visible]);

  const toggleBranch = (label: string) => {
    setActive((prev) => {
      const base = prev ?? new Set(visible.slice(0, MAX_LINES).map((s) => s.label));
      const next = new Set(base);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (!inst) {
    return (
      <div className="shell view">
        <div className="backline">
          <a
            href="#institutes"
            onClick={(e) => {
              e.preventDefault();
              navigate("#institutes");
            }}
          >
            <ChevronLeftIcon size={14} /> All institutes
          </a>
        </div>
        <EmptyState
          icon={<SearchIcon size={20} />}
          title="Institute not found"
          action={
            <Button variant="primary" onClick={() => navigate("#institutes")}>
              Browse {INSTITUTE_COUNT} institutes
            </Button>
          }
        >
          Nothing matches <code>{arg}</code>. It may have been renamed, or the link is from an
          older build.
        </EmptyState>
      </div>
    );
  }

  const degrees = new Set(rows.map((r) => r.deg));
  const pinned = favourites.has(inst.name);

  /* Every branch the institute has ever offered, for the season selector. */
  const branches = [...new Set(allRoundRows.map((r) => r.prog))].sort();
  const seasonLabel =
    seasonBranch && branches.includes(seasonBranch)
      ? seasonBranch
      : (built.series[0]?.label ?? branches[0] ?? "");

  const seasonYear = YEARS_DESC[0];
  const season = buildSeason(allRoundRows, {
    branch: seasonLabel,
    seat,
    gender,
    year: seasonYear,
    metric,
  });

  return (
    <div className="shell view view-institute">
      <div className="backline">
        <a
          href="#institutes"
          onClick={(e) => {
            e.preventDefault();
            navigate("#institutes");
          }}
        >
          <ChevronLeftIcon size={14} /> All institutes
        </a>
      </div>

      <header className="inst-head">
        <div className="inst-head-text">
          <h1>{inst.name}</h1>
          <p className="page-meta">
            <BuildingIcon size={13} /> {TYPES[inst.type]}
          </p>
          <p className="inst-head-meta">
            {fm(rows.length)} {plural(rows.length, "row")} across {inst.years.length}{" "}
            {plural(inst.years.length, "year")} · {inst.programs.size}{" "}
            {plural(inst.programs.size, "branch", "branches")}
            {degrees.size > 1 ? " · degree title changed over time" : ""}
          </p>
        </div>
        <div className="inst-head-actions">
          <StarButton
            name={inst.name}
            pinned={pinned}
            onToggle={favourites.toggle}
            size="lg"
            className="star-hero"
          />
        </div>
      </header>

      <Notice tone="accent" icon={<InfoIcon size={15} />} title="How to read this.">
        Final round of each year, so the cut-offs are the widest of that cycle. A gap means JoSAA
        allocated nothing for that branch under this category that year — not that the branch does
        not exist.
      </Notice>

      <Card className="inst-controls-card">
        <div className="inst-controls">
          <Field label="Category" htmlFor="det-seat">
            <Select id="det-seat" value={seat} onChange={(e) => setSeat(e.target.value)}>
              {SEATS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gender pool" htmlFor="det-gender">
            <Select
              id="det-gender"
              value={gender}
              onChange={(e) => setGender(Number(e.target.value))}
            >
              <option value={0}>Gender-neutral</option>
              <option value={1}>Female-only</option>
            </Select>
          </Field>
          <Field label="Plot" htmlFor="det-metric">
            <Select
              id="det-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as "cl" | "op")}
            >
              <option value="cl">Closing rank</option>
              <option value="op">Opening rank</option>
            </Select>
          </Field>
          <Field label="Filter branches" htmlFor="det-query">
            <SearchInput
              id="det-query"
              label="Filter branches"
              placeholder="computer, electrical…"
              value={query}
              onValueChange={setQuery}
            />
          </Field>
        </div>
      </Card>

      {built.series.length === 0 ? (
        <EmptyState
          icon={<AlertIcon size={20} />}
          title={"No " + seat + " seats on record"}
          action={
            <Button
              onClick={() => {
                setSeat("OPEN");
                setGender(0);
              }}
            >
              Back to OPEN, gender-neutral
            </Button>
          }
        >
          JoSAA allocated nothing at this institute under that category and gender pool in the
          years this dataset covers.
        </EmptyState>
      ) : (
        <>
          <Card className="chart-card">
            <CardHead
              title={(metric === "cl" ? "Closing" : "Opening") + " rank by year"}
              note="Lower on the chart is a better rank. Hover or tap a point for exact values."
              trailing={
                <span className="chart-legend-key">
                  <span>{plotted.length} of {visible.length} branches</span>
                </span>
              }
            />
            <div className="chart-host" ref={chartRef}>
              {plotted.length ? (
                <CutoffChart
                  years={built.years}
                  series={plotted}
                  width={Math.max(280, chartWidth)}
                  metric={metric}
                  allLabels={allLabels}
                  ariaLabel={
                    (metric === "cl" ? "Closing" : "Opening") +
                    " rank by year for " +
                    plotted.length +
                    " branches at " +
                    inst.name
                  }
                />
              ) : (
                <EmptyState title="No branch plotted" icon={<TrendIcon size={20} up />}>
                  Turn a branch back on in the list below the chart.
                </EmptyState>
              )}
            </div>
            <div className="legend">
              <span className="legend-label">Branches — tap to plot</span>
              <div className="legend-chips">
                {visible.map((s) => (
                  <BranchChip
                    key={s.label}
                    series={s}
                    allLabels={allLabels}
                    on={plotted.some((p) => p.label === s.label)}
                    onClick={() => toggleBranch(s.label)}
                  />
                ))}
              </div>
            </div>
          </Card>

          {/* Within-season movement. This is the reason round data is kept:
              a cut-off that tightened by thousands of ranks between round 1
              and the final round is a different story from a flat one. */}
          {season.length > 1 ? (
            <Card>
              <CardHead
                title={"Round by round — " + seasonYear}
                note={
                  seasonLabel +
                  " · " +
                  seat +
                  " · " +
                  (gender ? "Female-only" : "Gender-neutral") +
                  " · " +
                  (metric === "cl" ? "closing" : "opening") +
                  " rank as each round was allocated"
                }
                trailing={
                  <select
                    className="round-branch-select"
                    aria-label="Branch to follow through the rounds"
                    value={seasonLabel}
                    onChange={(e) => setSeasonBranch(e.target.value)}
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                }
              />
              <SeasonStrip points={season} rounds={roundsOf(seasonYear)} />
            </Card>
          ) : null}

          <Card flush>
            <CardHead
              title="Every year, every branch"
              note={
                seat +
                " · " +
                (gender ? "Female-only" : "Gender-neutral") +
                " · opening → closing at the final round, with the move against the previous year"
              }
            />
            <DetailTable
              years={built.years}
              series={visible}
              rows={rows}
              seat={seat}
              gender={gender}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function SeasonStrip({
  points,
  rounds,
}: {
  points: { round: number; value: number; delta: number | null }[];
  rounds: number[];
}) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const last = points[points.length - 1];

  return (
    <div className="round-strip">
      {rounds.map((round) => {
        const p = points.find((x) => x.round === round);
        if (!p) {
          return (
            <div key={round} className="round-strip-row" data-empty="true">
              <span className="round-strip-label">R{round}</span>
              <span />
              <span />
              <span className="round-strip-value subtle">not allocated</span>
            </div>
          );
        }
        const width = 12 + ((p.value - lo) / span) * 88;
        return (
          <div
            key={round}
            className="round-strip-row"
            data-current={round === last.round || undefined}
          >
            <span className="round-strip-label">R{round}</span>
            <span className="round-strip-value num">{fm(p.value)}</span>
            <span className="round-strip-track">
              <i style={{ width: width + "%" }} />
            </span>
            <span
              className="round-strip-delta num"
              data-dir={
                p.delta == null ? undefined : p.delta > 0 ? "looser" : p.delta < 0 ? "tighter" : undefined
              }
            >
              {p.delta == null ? "first" : p.delta === 0 ? "—" : (p.delta > 0 ? "▲ " : "▼ ") + fm(Math.abs(p.delta))}
            </span>
          </div>
        );
      })}
      <p className="chart-note">
        A larger closing rank means the cut-off opened up, so ▲ marks a round that admitted
        candidates further down the list.
      </p>
    </div>
  );
}

function BranchChip({
  series,
  allLabels,
  on,
  onClick,
}: {
  series: Series;
  allLabels: string[];
  on: boolean;
  onClick: () => void;
}) {
  const style = seriesStyle(allLabels.indexOf(series.label));
  const values = series.points.filter((v): v is number => v != null);
  const latest = values.length ? fm(values[values.length - 1]) : "—";

  return (
    <button
      type="button"
      className="legend-chip"
      aria-pressed={on}
      onClick={onClick}
      style={{ ["--chip-hue" as string]: style.color }}
    >
      <i
        data-dash={style.dash ? "true" : undefined}
        style={{ background: on ? style.color : "transparent", borderColor: style.color }}
      />
      <span className="legend-name">{series.label}</span>
      <span className="legend-value num">{latest}</span>
    </button>
  );
}

function DetailTable({
  years,
  series,
  rows,
  seat,
  gender,
}: {
  years: number[];
  series: Series[];
  rows: Row[];
  seat: string;
  gender: number;
}) {
  const byProgYear = useMemo(() => {
    const map = new Map<string, { op: number; cl: number }>();
    for (const r of rows) {
      if (r.seat !== seat || r.g !== gender) continue;
      const key = r.prog + "|" + r.year;
      const prev = map.get(key);
      if (!prev || r.cl < prev.cl) map.set(key, { op: r.op, cl: r.cl });
    }
    return map;
  }, [rows, seat, gender]);

  const trendFor = (s: Series) => {
    const points = s.points.map((v, i) => ({ v, i })).filter((o) => o.v != null);
    if (points.length < 2) return null;
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const change = ((last.v! - prev.v!) / prev.v!) * 100;
    return {
      change,
      /* A rank that got numerically smaller is a tougher cut-off, so the
         arrow must be read against the rank, not against the sign. */
      tougher: last.v! < prev.v!,
      from: years[prev.i],
      to: years[last.i],
    };
  };

  if (!series.length) {
    return (
      <EmptyState title="No branches match" icon={<SearchIcon size={20} />}>
        Nothing in this institute's list contains that text.
      </EmptyState>
    );
  }

  return (
    <>
      {/* Scrolls in both axes with a max-height, so it must be a tab stop or
          a keyboard user can never see past the first screen of rows. */}
      <div
        className="detail-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Cut-off detail by branch and year"
      >
        <table className="detail-table">
          <thead>
            <tr>
              <th className="col-branch">Branch</th>
              {years.map((y) => (
                <th key={y} className="col-year">
                  {y}
                </th>
              ))}
              <th className="col-trend">Trend</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => {
              const trend = trendFor(s);
              return (
                <tr key={s.label}>
                  <th scope="row" className="col-branch">
                    {s.label}
                  </th>
                  {years.map((y) => {
                    const hit = byProgYear.get(s.label + "|" + y);
                    return (
                      <td key={y} className="col-year num">
                        {hit ? (
                          <>
                            <span className="cell-open">{hit.op ? fm(hit.op) : "—"}</span>
                            <ArrowRightIcon size={11} className="cell-arrow" />
                            <b>{fm(hit.cl)}</b>
                          </>
                        ) : (
                          <span className="cell-dash">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="col-trend num">
                    {trend ? (
                      <span className="trend" data-dir={trend.tougher ? "up" : "down"}>
                        <TrendIcon size={12} up={trend.tougher} />
                        {Math.abs(trend.change).toFixed(0)}%
                        <em className="trend-years">
                          {trend.from}→{trend.to}
                        </em>
                      </span>
                    ) : (
                      <span className="cell-dash">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone layout: each branch becomes a block with its years stacked. */}
      <ul className="detail-cards">
        {series.map((s) => {
          const trend = trendFor(s);
          return (
            <li key={s.label} className="detail-card">
              <div className="detail-card-head">
                <span>{s.label}</span>
                {trend ? (
                  <span className="trend" data-dir={trend.tougher ? "up" : "down"}>
                    <TrendIcon size={12} up={trend.tougher} />
                    {Math.abs(trend.change).toFixed(0)}%
                  </span>
                ) : null}
              </div>
              <dl className="detail-card-years">
                {years.map((y) => {
                  const hit = byProgYear.get(s.label + "|" + y);
                  return (
                    <div key={y}>
                      <dt>{y}</dt>
                      <dd className="num">
                        {hit ? (
                          <>
                            <span className="cell-open">{hit.op ? fm(hit.op) : "—"}</span>
                            <ArrowRightIcon size={11} className="cell-arrow" />
                            <b>{fm(hit.cl)}</b>
                          </>
                        ) : (
                          <span className="cell-dash">—</span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
