import { useMemo, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_BY_KEY,
  CRL,
  CRL_PWD,
  MARKS_BANDS,
  OBC_PWD,
  PWD_CUTOFF,
  TOTAL_POOL,
  SUB_CATEGORIES,
  categoryRank,
  convert,
  interpRank,
  type CategoryKey,
} from "../lib/percentile";
import { fm } from "../lib/format";
import { setPendingRank } from "../lib/handoff";
import { navigate, useElementWidth } from "../lib/hooks";
import { ArrowRightIcon, InfoIcon, RanksIcon } from "../components/icons";
import { Button, Card, CardHead, PageHead, Segmented, TableScroll } from "../components/ui";
import { SeriesChart } from "../components/SeriesChart";
import type { ViewProps } from "../App";

const SECTIONS = [
  { value: "all", label: "All categories" },
  { value: "crl", label: "CRL curve" },
  { value: "marks", label: "Marks → percentile" },
  { value: "pwd", label: "PwD lists" },
] as const;

type SectionId = (typeof SECTIONS)[number]["value"];

/* Which JoSAA seat type a vertical category maps onto. Pushing this with the
   rank means the predictor opens on the list the reader was just looking at,
   instead of comparing a reserved-category rank against OPEN seats — which
   would have shown them a wall of "out of reach" for seats they can never be
   allotted anyway. General has no PwD/vertical seat of its own beyond OPEN. */
const CATEGORY_SEAT: Record<CategoryKey, string> = {
  OPEN: "OPEN",
  EWS: "EWS",
  "OBC-NCL": "OBC-NCL",
  SC: "SC",
  ST: "ST",
};

export function RanksView({ arg, progress, favourites }: ViewProps) {
  void progress;
  void favourites;
  const section = (SECTIONS.some((s) => s.value === arg) ? arg : "all") as SectionId;
  const [percentile, setPercentile] = useState(90);
  /* The category a reader identifies with. General is the default because it
     is the largest single pool, not because the page is a General page — every
     number below switches with it. */
  const [category, setCategory] = useState<CategoryKey>("OPEN");

  const conversion = useMemo(() => convert(percentile), [percentile]);
  const rank = categoryRank(category, percentile);

  return (
    <div className="shell view view-ranks">
      <PageHead
        eyebrow={<><RanksIcon size={13} /> Percentile → rank</>}
        title="What your percentile is worth"
        lede="Percentiles are computed across every candidate, so the same score gives a very different rank depending on which list you are ranked in. Pick your category; the numbers, the marks estimate and the chart all follow."
      />

      <PercentileInstrument
        percentile={percentile}
        onPercentile={setPercentile}
        conversion={conversion}
        category={category}
        onCategory={setCategory}
        rank={rank}
      />

      <nav className="section-tabs" aria-label="Reference tables">
        {SECTIONS.map((s) => (
          <a
            key={s.value}
            href={"#ranks/" + s.value}
            className="section-tab"
            aria-current={s.value === section ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              navigate("#ranks/" + s.value);
            }}
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="section-body">
        {section === "all" && (
          <AllCategoriesSection percentile={percentile} category={category} onCategory={setCategory} />
        )}
        {section === "crl" && <CrlSection percentile={percentile} />}
        {section === "marks" && <MarksSection percentile={percentile} />}
        {section === "pwd" && <PwdSection percentile={percentile} />}
      </div>
    </div>
  );
}

/* ─────────────── the instrument ─────────────── */

function PercentileInstrument({
  percentile,
  onPercentile,
  conversion,
  category,
  onCategory,
  rank,
}: {
  percentile: number;
  onPercentile: (next: number) => void;
  conversion: ReturnType<typeof convert>;
  category: CategoryKey;
  onCategory: (next: CategoryKey) => void;
  rank: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const meta = CATEGORY_BY_KEY[category];

  const clamped = (v: number) => Math.max(0, Math.min(100, v));
  const clears = percentile >= meta.cutoff;

  return (
    <Card className="instrument">
      <div className="instrument-head">
        <div>
          <h2>Your percentile</h2>
          <p>Drag the scale or type a value. Everything below is interpolated between published data points.</p>
        </div>
        <div className="readout">
          <input
            className="readout-input num"
            type="number"
            min={0}
            max={100}
            step={0.01}
            inputMode="decimal"
            aria-label="Percentile"
            value={draft ?? percentile.toFixed(2)}
            onChange={(e) => {
              setDraft(e.target.value);
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onPercentile(clamped(v));
            }}
            onBlur={() => setDraft(null)}
          />
          <span className="readout-sign">%</span>
        </div>
      </div>

      <div className="scale">
        <input
          type="range"
          className="scale-input"
          min={0}
          max={100}
          step={0.01}
          value={percentile}
          aria-label="Percentile slider"
          style={{ ["--fill" as string]: percentile + "%" }}
          onChange={(e) => onPercentile(Number(e.target.value))}
        />
        <div className="scale-ticks" aria-hidden="true">
          {[0, 25, 50, 75, 90, 100].map((t) => (
            <span
              key={t}
              data-on={Math.abs(percentile - t) < 0.75 || undefined}
              style={{ left: t + "%" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="cat-picker">
        <Segmented
          label="Category"
          value={category}
          onChange={onCategory}
          options={CATEGORIES.map((c) => ({ value: c.key, label: c.short }))}
        />
      </div>

      <dl className="conversions">
        <div>
          <dt>
            Marks needed<span>2026 · out of 300</span>
          </dt>
          <dd className="num">{conversion.marks}</dd>
        </div>
        {category === "OPEN" ? (
          /* For General the category rank IS the Common Rank List rank, so
             printing both twice is noise. Show the CRL once and spend the
             saved column on the cutoff instead. */
          <div className="key">
            <dt>
              All-India Rank<span>CRL · all categories</span>
            </dt>
            <dd className="num">{fm(rank)}</dd>
          </div>
        ) : (
          <div className="key">
            <dt>
              {meta.short} category rank<span>{meta.reservation} reserved</span>
            </dt>
            <dd className="num">{fm(rank)}</dd>
          </div>
        )}
        {category === "OPEN" ? (
          <div>
            <dt>
              Qualifiers<span>cleared the General cutoff</span>
            </dt>
            <dd className="num">{fm(meta.qualified)}</dd>
          </div>
        ) : (
          <div>
            <dt>
              General All-India Rank<span>CRL, all categories</span>
            </dt>
            <dd className="num">{fm(conversion.crl)}</dd>
          </div>
        )}
        <div>
          <dt>
            JEE Advanced cutoff<span>{meta.short} · 2026</span>
          </dt>
          <dd className="num" data-tone={clears ? "safe" : undefined}>
            {meta.cutoff.toFixed(2)}
          </dd>
        </div>
      </dl>

      <div className="instrument-foot">
        <Button
          variant="primary"
          size="sm"
          trailing={<ArrowRightIcon size={14} />}
          onClick={() => {
            /* The predictor ranks seats by comparing your rank against a
               closing rank, and it filters on a seat type, so what it needs is
               the CATEGORY rank, not the CRL.

               The rank travels in the URL. It used to go through a module-level
               slot that nothing ever read, so the button appeared to work and
               then silently left the predictor on its default 15,000. Putting
               it in the query string also makes the landing state shareable and
               survive a reload, which the slot never did. */
            setPendingRank(rank);
            const seat = CATEGORY_SEAT[category];
            const qs = new URLSearchParams({ rank: String(rank) });
            if (seat) qs.set("seat", seat);
            navigate("#predict?" + qs.toString());
          }}
        >
          Take rank {fm(rank)} to the predictor
        </Button>
        <span className="instrument-note">
          {clears
            ? "Clears the " + meta.short + " cutoff for JEE Advanced 2026."
            : "Below the " + meta.short + " cutoff of " + meta.cutoff.toFixed(2) + " — not eligible for JEE Advanced. The rank still applies to JoSAA seat lists."}
        </span>
      </div>
    </Card>
  );
}

/* ─────────────── all categories ─────────────── */

function AllCategoriesSection({
  percentile,
  category,
  onCategory,
}: {
  percentile: number;
  category: CategoryKey;
  onCategory: (next: CategoryKey) => void;
}) {
  const rows = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        meta: c,
        rank: categoryRank(c.key, percentile),
        clears: percentile >= c.cutoff,
      })),
    [percentile],
  );

  /* Percentile against every category curve at once, so the gap between them
     is the point of the chart rather than a footnote. */
  return (
    <section className="section-block">
      <h2>Rank in every category, at {percentile.toFixed(2)} percentile</h2>
      <p className="section-lede">
        One percentile, five merit lists. A percentile is computed across every candidate, so it
        stays the same whoever you are — the rank it buys does not.
      </p>

      <Card flush>
        <TableScroll label="Category rank for each vertical category at your percentile">
          <table className="ref-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Category rank</th>
                <th className="num">Cutoff 2026</th>
                <th className="num">Clears?</th>
                <th className="num">Candidates</th>
                <th className="num">Reserved</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ meta, rank, clears }) => (
                <tr
                  key={meta.key}
                  data-active={meta.key === category || undefined}
                  data-pick
                  role="button"
                  tabIndex={0}
                  aria-pressed={meta.key === category}
                  onClick={() => onCategory(meta.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCategory(meta.key);
                    }
                  }}
                >
                  <th scope="row">{meta.label}</th>
                  <td className="num">{fm(rank)}</td>
                  <td className="num">{meta.cutoff.toFixed(2)}</td>
                  <td className="col-clears">
                    <span className="clears" data-yes={clears || undefined}>
                      {clears ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="num">{fm(meta.pool)}</td>
                  <td className="num">{meta.reservation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      <Card>
        <CardHead
          title="Percentile vs. rank, every category"
          note="Log scale. Lower on the chart is a better rank. All five lists on one axis, so the gap between them is the point."
          level={3}
        />
        <MultiCurveChart percentile={percentile} category={category} />
      </Card>
    </section>
  );
}

/* One log-scale curve per category, sampled off the same model the tiles use
   so the chart and the table can never disagree. */
function MultiCurveChart({
  percentile,
  category,
}: {
  percentile: number;
  category: CategoryKey;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(680);
  const w = Math.max(300, width);
  const narrow = w < 520;
  const height = narrow ? 250 : 320;
  const pad = { top: 16, right: 14, bottom: 36, left: narrow ? 46 : 58 };
  const plotW = Math.max(120, w - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const yMax = TOTAL_POOL;

  const series = useMemo(
    () =>
      CATEGORIES.map((c, i) => {
        const pts: [number, number][] = [];
        for (let p = 100; p >= 0; p -= 2) pts.push([p, categoryRank(c.key, p)]);
        pts.push([percentile, categoryRank(c.key, percentile)]);
        return { meta: c, color: "var(--c" + (i + 1) + ")", pts: pts.sort((a, b) => b[0] - a[0]) };
      }),
    [percentile],
  );

  const lmax = Math.log10(Math.max(yMax, 10));
  const X = (p: number) => pad.left + ((100 - p) / 100) * plotW;
  const Y = (v: number) => pad.top + plotH - (Math.log10(Math.max(v, 1)) / lmax) * plotH;

  const yTicks = [1, 10, 100, 1000, 10_000, 100_000, 1_000_000].filter((t) => t <= yMax);
  const xTicks = narrow ? [100, 75, 50, 25, 0] : [100, 80, 60, 40, 20, 0];

  return (
    <div className="chart-host multi-chart" ref={ref}>
      <svg
        viewBox={"0 0 " + w + " " + height}
        width={w}
        height={height}
        role="img"
        aria-label="Percentile versus rank for General, EWS, OBC-NCL, SC and ST"
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={w - pad.right} y1={Y(t)} y2={Y(t)} className="chart-grid" />
            <text x={pad.left - 8} y={Y(t) + 3.5} textAnchor="end" className="chart-tick">
              {t >= 1_00_000 ? t / 1_00_000 + "L" : t >= 1000 ? t / 1000 + "k" : String(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={X(t)} y={pad.top + plotH + 18} textAnchor="middle" className="chart-tick">
            {t}
          </text>
        ))}
        <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} className="chart-axis" />
        <line
          x1={pad.left}
          x2={w - pad.right}
          y1={pad.top + plotH}
          y2={pad.top + plotH}
          className="chart-axis"
        />
        {series.map((s) => (
          <path
            key={s.meta.key}
            d={s.pts.map((pt, i) => (i ? "L" : "M") + X(pt[0]).toFixed(1) + " " + Y(pt[1]).toFixed(1)).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={s.meta.key === category ? 2.6 : 1.5}
            strokeOpacity={s.meta.key === category ? 1 : 0.55}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <line
          x1={X(percentile)}
          x2={X(percentile)}
          y1={pad.top}
          y2={pad.top + plotH}
          className="chart-marker"
        />
        <text
          x={12}
          y={pad.top + plotH / 2}
          textAnchor="middle"
          className="chart-axis-label"
          transform={"rotate(-90 12 " + (pad.top + plotH / 2) + ")"}
        >
          Rank
        </text>
      </svg>
      <ul className="multi-legend">
        {series.map((s) => (
          <li key={s.meta.key} data-on={s.meta.key === category || undefined}>
            <i style={{ background: s.color }} aria-hidden="true" />
            <span className="ml-name">{s.meta.label}</span>
            <span className="ml-lead" aria-hidden="true" />
            <b className="num">{fm(categoryRank(s.meta.key, percentile))}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────── CRL curve ─────────────── */

function CrlSection({ percentile }: { percentile: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(680);

  return (
    <section className="section-block">
      <h2>Common Rank List — full curve</h2>
      <p className="section-lede">
        The General list, which is also the rank JoSAA compares every open seat against. Published
        points from NTA, scaled to the 2026 candidate pool; every other category rank on this page
        is derived from this curve.
      </p>

      <Card>
        <CardHead
          title="Percentile vs. All-India Rank"
          note="Log scale from rank 1 to about 15.4 lakh."
          level={3}
        />
        <div className="chart-host" ref={ref}>
          <SeriesChart
            data={CRL}
            width={Math.max(280, width)}
            color="var(--c4)"
            yMax={1538468}
            yLabel="All-India Rank"
            locale="en-IN"
            formatY={(v) => (v >= 1_00_000 ? (v / 1_00_000).toFixed(1) + "L" : fm(v))}
            formatX={(v) => String(v)}
            marker={percentile}
            markerLabel={percentile.toFixed(2)}
            ariaLabel="Percentile vs All-India Rank"
          />
        </div>
      </Card>

      <Card flush>
        <TableScroll label="CRL rank at each published percentile">
          <table className="ref-table">
            <thead>
              <tr>
                <th>NTA percentile</th>
                <th className="num">Approx. All-India Rank</th>
              </tr>
            </thead>
            <tbody>
              {CRL.map(([p, r]) => (
                <tr key={p}>
                  <td className="num">{p.toFixed(2)}</td>
                  <td className="num">{fm(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      <p className="section-foot">
        <InfoIcon size={14} /> General is the CRL itself and needs no model. The reserved-category
        ranks are estimates: NTA does not publish a percentile → category-rank table.
      </p>
    </section>
  );
}

/* ─────────────── marks ─────────────── */

function MarksSection({ percentile }: { percentile: number }) {
  const activeBand = MARKS_BANDS.find(([, lo, hi]) => percentile >= lo && percentile <= hi);

  return (
    <section className="section-block">
      <h2>Marks → percentile (2026)</h2>
      <p className="section-lede">
        Both sessions combined, approximate. The scale compresses hard at the top: the last ten
        marks out of 300 are worth as much movement as the first hundred.
      </p>

      <Card flush>
        <TableScroll label="Approx. percentile by marks band, 2026">
          <table className="ref-table">
            <thead>
              <tr>
                <th>Marks (out of 300)</th>
                <th className="num">Approx. percentile</th>
                <th className="col-flag">
                  <span className="sr-only">In your band</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {MARKS_BANDS.map(([band, lo, hi]) => {
                const isActive = activeBand?.[0] === band;
                return (
                  <tr key={band} data-active={isActive || undefined}>
                    <td className="num">{band}</td>
                    <td className="num">
                      {lo.toFixed(3)} – {hi.toFixed(3)}
                    </td>
                    <td className="col-flag">
                      {isActive ? <span className="band-pip" title="Your band" /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      <p className="section-foot">
        <InfoIcon size={14} /> Percentiles are truncated in the source, not rounded, so a band edge
        can look off by 0.001.
      </p>
    </section>
  );
}

/* ─────────────── PwD lists ─────────────── */

function PwdSection({ percentile }: { percentile: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(680);

  return (
    <section className="section-block">
      <h2>PwD lists</h2>
      <p className="section-lede">
        PwD is a 5% horizontal reservation cutting across every category, so it has its own lists
        rather than a seat type of its own. These are the only PwD tables NTA publishes, which is
        why this section is smaller than the categories above.
      </p>

      <div className="stat-row report-stats">
        <div className="stat">
          <span className="stat-label">
            CRL-PwD rank
            <span className="stat-hint">at {percentile.toFixed(2)} percentile</span>
          </span>
          <span className="stat-value num">{fm(interpRank(CRL_PWD, percentile))}</span>
        </div>
        <div className="stat">
          <span className="stat-label">
            OBC-NCL PwD rank
            <span className="stat-hint">the most granular PwD list</span>
          </span>
          <span className="stat-value num">{fm(interpRank(OBC_PWD, percentile))}</span>
        </div>
        <div className="stat">
          <span className="stat-label">
            CRL-PwD qualifiers
            <span className="stat-hint">cleared the PwD cutoff</span>
          </span>
          <span className="stat-value num">{fm(4391)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">
            PwD cutoff
            <span className="stat-hint">2026 · percentile</span>
          </span>
          <span className="stat-value num">{PWD_CUTOFF.toFixed(4)}</span>
        </div>
      </div>

      <Card>
        <CardHead
          title="Percentile vs. CRL-PwD rank"
          note="Log scale. The list runs to just 4,316 names, which is why it flattens so early."
          level={3}
        />
        <div className="chart-host" ref={ref}>
          <SeriesChart
            data={CRL_PWD}
            width={Math.max(280, width)}
            color="var(--c3)"
            yMax={4600}
            yLabel="CRL-PwD rank"
            locale="en-IN"
            formatY={(v) => fm(v)}
            formatX={(v) => String(v)}
            marker={percentile}
            markerLabel={percentile.toFixed(2)}
            ariaLabel="Percentile vs CRL-PwD rank"
          />
        </div>
      </Card>

      <Card flush>
        <TableScroll label="PwD sub-list rank at each percentile band">
          <table className="ref-table">
            <thead>
              <tr>
                <th>Percentile band</th>
                <th className="num">EWS-PwD</th>
                <th className="num">OBC-NCL-PwD</th>
                <th className="num">SC-PwD</th>
                <th className="num">ST-PwD</th>
              </tr>
            </thead>
            <tbody>
              {SUB_CATEGORIES.map((row) => (
                <tr key={row[0]}>
                  <td className="num">{row[0]}</td>
                  <td className="num">{row[1]}</td>
                  <td className="num">{row[2]}</td>
                  <td className="num">{row[3]}</td>
                  <td className="num">{row[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      <p className="section-foot">
        <InfoIcon size={14} /> A dash means the source had no data point near that band.
      </p>
    </section>
  );
}
