import { useMemo, useState } from "react";
import type { MatrixRow, TopicRow, YearRow } from "../lib/reports";

/* ═══════════════════════════════════════════════════════════════════
   Report charts.

   Three shapes, each answering one question the tables answer badly:

     YearBars      — how has the chapter's weight moved season to season?
     TopicBars     — which topics carry it, and how concentrated is it?
     TopicMatrix   — did a topic move, or is the ranking just noise?

   All three are plain SVG on the token palette, so they follow the theme
   and every value is also printed as text somewhere on the page.
   ═══════════════════════════════════════════════════════════════════ */

const PAD = { top: 14, right: 6, bottom: 26, left: 6 };

/* ─────────────── questions per year ─────────────── */
export function YearBars({
  years,
  width,
  height = 150,
  label,
  readout = true,
}: {
  years: YearRow[];
  width: number;
  height?: number;
  label: string;
  /** The compact card embeds its own caption and does not need the hover line. */
  readout?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...years.map((y) => y.q));
  const plotW = Math.max(60, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, years.length);
  const barW = Math.min(38, slot * 0.62);

  const active = hover === null ? null : years[hover];

  return (
    <div className="rchart" style={{ height }}>
      {readout ? (
        <p className="rchart-readout num" aria-live="polite">
          {active
            ? active.year + " — " + active.q + " question" + (active.q === 1 ? "" : "s") +
              " (" + active.mcq + " MCQ, " + active.num + " numerical)"
            : "Hover a bar for the MCQ / numerical split"}
        </p>
      ) : null}
      <svg viewBox={"0 0 " + width + " " + height} width={width} height={height} role="img" aria-label={label}>
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + plotH / 2}
          y2={PAD.top + plotH / 2}
          className="chart-grid"
          strokeDasharray="2 4"
        />
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          className="chart-axis"
        />
        {years.map((y, i) => {
          const h = y.q ? Math.max(2, (y.q / max) * plotH) : 0;
          const x = PAD.left + slot * i + (slot - barW) / 2;
          const isActive = hover === i;
          return (
            <g
              key={y.year}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onPointerDown={() => setHover(i)}
            >
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
              />
              {y.q ? (
                <rect
                  x={x}
                  y={PAD.top + plotH - h}
                  width={barW}
                  height={h}
                  rx={Math.min(4, barW / 3)}
                  className="rchart-bar"
                  data-peak={y.q === max || undefined}
                  data-active={isActive || undefined}
                />
              ) : (
                <line
                  x1={x}
                  x2={x + barW}
                  y1={PAD.top + plotH}
                  y2={PAD.top + plotH}
                  className="rchart-zero"
                />
              )}
              <text
                x={PAD.left + slot * i + slot / 2}
                y={PAD.top + plotH + 15}
                textAnchor="middle"
                className="chart-tick"
                data-active={isActive || undefined}
              >
                {String(y.year).slice(2)}
              </text>
              {y.q ? (
                <text
                  x={PAD.left + slot * i + slot / 2}
                  y={PAD.top + plotH - h - 5}
                  textAnchor="middle"
                  className="rchart-count num"
                  data-active={isActive || undefined}
                >
                  {y.q}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─────────────── topic share ─────────────── */
export function TopicBars({
  topics,
  total,
}: {
  topics: TopicRow[];
  total: number;
}) {
  const top = Math.max(1, ...topics.map((t) => t.share));
  return (
    <ol className="topicbars">
      {topics.map((t, i) => (
        <li key={t.name} className="topicbars-row">
          <div className="topicbars-head">
            <span className="topicbars-name">
              <span className="topicbars-rank num">{i + 1}</span>
              {t.name}
            </span>
            <span className="topicbars-value num">
              {t.q}
              <span className="topicbars-pct">{t.share.toFixed(1)}%</span>
            </span>
          </div>
          <span className="topicbars-track" aria-hidden="true">
            <i style={{ width: Math.max(1.5, (t.share / top) * 100) + "%" }} />
          </span>
          <span className="topicbars-meta num">
            MCQ {t.mcq} · Numerical {t.num} · {t.span}
          </span>
        </li>
      ))}
      <li className="topicbars-foot num">
        {total} questions across {topics.length} topics
      </li>
    </ol>
  );
}

/* ─────────────── year × topic heat map ─────────────── */
export function TopicMatrix({
  years,
  topics,
  matrix,
  metric,
}: {
  years: number[];
  topics: TopicRow[];
  matrix: MatrixRow[];
  metric: "count" | "share";
}) {
  const byYear = useMemo(() => new Map(matrix.map((row) => [row.year, row])), [matrix]);
  const max = useMemo(() => {
    let peak = 1;
    for (const row of matrix) for (const n of row.counts) if (n > peak) peak = n;
    return peak;
  }, [matrix]);

  return (
    <div
      className="matrix-scroll"
      tabIndex={0}
      role="region"
      aria-label="Year by topic matrix"
    >
      <table className="matrix">
        <thead>
          <tr>
            <th scope="col" className="matrix-corner">
              Topic
            </th>
            {years.map((year) => (
              <th key={year} scope="col" className="num">
                {String(year).slice(2)}
              </th>
            ))}
            <th scope="col" className="num matrix-total">
              All
            </th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic, column) => {
            const rowTotal = matrix.reduce((n, row) => n + (row.counts[column] ?? 0), 0);
            return (
              <tr key={topic.name}>
                <th scope="row" className="matrix-name" title={topic.name}>
                  {topic.name}
                </th>
                {years.map((year) => {
                  const row = byYear.get(year);
                  const count = row ? (row.counts[column] ?? 0) : 0;
                  const share = row && row.total ? (count / row.total) * 100 : 0;
                  const level = count ? Math.max(0.16, count / max) : 0;
                  return (
                    <td
                      key={year}
                      className="num matrix-cell"
                      style={level ? { "--fill": String(level) } as React.CSSProperties : undefined}
                      data-empty={count ? undefined : true}
                      aria-label={
                        topic.name + ", " + year + ": " + count + " question" + (count === 1 ? "" : "s")
                      }
                    >
                      <span>{metric === "count" ? count : count ? share.toFixed(0) + "%" : "—"}</span>
                    </td>
                  );
                })}
                <td className="num matrix-total">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">All topics</th>
            {years.map((year) => {
              const row = byYear.get(year);
              return (
                <td key={year} className="num">
                  {row ? row.total : 0}
                </td>
              );
            })}
            <td className="num matrix-total">{matrix.reduce((n, r) => n + r.total, 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ─────────────── sparkline for the chapter list ─────────────── */
/* Each row carries its own tiny year series, all on one shared scale per
   subject, because the list is read down a column and a chart per row on
   its own scale would make a 4-question chapter look like a 40-question one. */
/* The sparkline keeps a fixed viewBox but stretches to whatever box it is put
   in, so the same component serves the 88px column in the chapter list and the
   full-width card on a report. `width` only sets the coordinate system. */
export function ChapterSpark({
  series,
  scale,
  width = 88,
  height = 26,
}: {
  series: YearRow[];
  scale: number;
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, scale);
  const step = series.length > 1 ? width / (series.length - 1) : width;
  const y = (v: number) => height - 3 - (v / max) * (height - 6);
  const points = series
    .map((row, i) => (i ? "L" : "M") + (i * step).toFixed(1) + " " + y(row.q).toFixed(1))
    .join(" ");

  return (
    <svg
      className="spark"
      viewBox={"0 0 " + width + " " + height}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {series.map((row, i) =>
        row.q ? (
          <circle
            key={row.year}
            cx={(i * step).toFixed(1)}
            cy={y(row.q).toFixed(1)}
            r={1.9}
            fill="currentColor"
            vectorEffect="non-scaling-stroke"
          />
        ) : null,
      )}
    </svg>
  );
}