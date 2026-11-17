import { useMemo, useState, type PointerEvent } from "react";
import { fm } from "../lib/format";
import type { Series } from "../core";

/* Eight hues that stay distinguishable side by side, plus a dash pattern for
   the ninth onwards so colour is never the only channel. */
export const SERIES_COLORS = [
  "var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)",
  "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)",
];

export function seriesStyle(index: number): { color: string; dash?: string } {
  return {
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    dash: Math.floor(index / SERIES_COLORS.length) % 2 === 1 ? "5 3" : undefined,
  };
}

interface Props {
  years: number[];
  series: Series[];
  width: number;
  metric: "cl" | "op";
  allLabels: string[];
  ariaLabel: string;
}

const PAD = { top: 18, right: 16, bottom: 34, left: 54 };

export function CutoffChart({ years, series, width, metric, allLabels, ariaLabel }: Props) {
  const [hover, setHover] = useState<{ x: number; yearIndex: number } | null>(null);

  const compact = width < 560;
  const height = compact ? 268 : 340;
  const plotW = Math.max(120, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;

  const geometry = useMemo(() => {
    const all = series.flatMap((s) => s.points).filter((v): v is number => v != null);
    if (!all.length) return null;

    /* Fit the axis to the data. Starting at rank 1 would leave most of the
       plot empty and flatten every real difference. */
    const lo = Math.log10(Math.max(1, Math.min(...all) * 0.85));
    const hi = Math.log10(Math.max(10, Math.max(...all) * 1.12));
    const span = hi - lo || 1;

    const first = years[0];
    const last = years[years.length - 1];
    const yearSpan = last - first || 1;

    const x = (yearIndex: number) =>
      PAD.left + (years.length === 1 ? 0.5 : (years[yearIndex] - first) / yearSpan) * plotW;
    const y = (rank: number) =>
      PAD.top + plotH - ((Math.log10(Math.max(rank, 1)) - lo) / span) * plotH;

    const ticks: number[] = [];
    for (let p = 0; p < 8; p++) {
      const t = Math.pow(10, p);
      if (t >= Math.pow(10, lo) && t <= Math.pow(10, hi)) ticks.push(t);
    }

    return { x, y, ticks, lo, hi };
  }, [series, years, plotW, plotH]);

  if (!geometry) return null;

  const { x, y, ticks } = geometry;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < years.length; i++) {
      const d = Math.abs(x(i) - px);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover({ x: x(best), yearIndex: best });
  };

  const hoverRows =
    hover == null
      ? []
      : series
          .map((s, i) => ({ label: s.label, value: s.points[hover.yearIndex], index: i }))
          .filter((r): r is { label: string; value: number; index: number } => r.value != null)
          .sort((a, b) => a.value - b.value);

  const tooltipW = 208;
  const tooltipX =
    hover == null
      ? 0
      : Math.min(Math.max(hover.x - tooltipW / 2, 4), width - tooltipW - 4);

  return (
    <div className="chart" style={{ height }}>
      <svg
        viewBox={"0 0 " + width + " " + height}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        {/* horizontal grid at each power of ten inside the visible range */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className="chart-grid"
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              className="chart-tick"
            >
              {t >= 1_00_000 ? t / 1_00_000 + "L" : t >= 1000 ? t / 1000 + "k" : t}
            </text>
          </g>
        ))}

        {/* one vertical hairline per year */}
        {years.map((yr, i) => (
          <line
            key={yr}
            x1={x(i)}
            x2={x(i)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            className="chart-grid"
          />
        ))}

        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          className="chart-axis"
        />

        {hover ? (
          <line
            x1={hover.x}
            x2={hover.x}
            y1={PAD.top}
            y2={PAD.top + plotH}
            className="chart-crosshair"
          />
        ) : null}

        {series.map((s, i) => {
          const style = seriesStyle(allLabels.indexOf(s.label));
          let d = "";
          let pen = false;
          s.points.forEach((v, idx) => {
            if (v == null) {
              pen = false;
              return;
            }
            d += (pen ? "L" : "M") + x(idx).toFixed(1) + " " + y(v).toFixed(1) + " ";
            pen = true;
          });
          return d ? (
            <path
              key={s.label + i}
              d={d}
              fill="none"
              stroke={style.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={style.dash}
            />
          ) : null;
        })}

        {series.map((s, i) =>
          s.points.map((v, idx) => {
            if (v == null) return null;
            const style = seriesStyle(allLabels.indexOf(s.label));
            const isHover = hover?.yearIndex === idx;
            return (
              <circle
                key={s.label + i + "-" + idx}
                cx={x(idx)}
                cy={y(v)}
                r={isHover ? 4.4 : 3}
                fill="var(--surface)"
                stroke={style.color}
                strokeWidth={1.8}
                className="chart-dot"
              />
            );
          }),
        )}

        {years.map((yr, i) => (
          <text
            key={yr}
            x={x(i)}
            y={PAD.top + plotH + 18}
            textAnchor="middle"
            className="chart-tick"
          >
            {compact ? String(yr).slice(2) : yr}
          </text>
        ))}

        <text
          x={12}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          className="chart-axis-label"
          transform={"rotate(-90 12 " + (PAD.top + plotH / 2) + ")"}
        >
          {metric === "cl" ? "Closing rank" : "Opening rank"}
        </text>
      </svg>

      {hover && hoverRows.length ? (
        <div
          className="chart-tooltip"
          style={{ left: tooltipX, width: tooltipW, top: 0 }}
          role="presentation"
        >
          <p className="chart-tooltip-year">{years[hover.yearIndex]}</p>
          <ul>
            {hoverRows.slice(0, 6).map((r) => (
              <li key={r.label}>
                <i style={{ background: seriesStyle(allLabels.indexOf(r.label)).color }} />
                <span className="chart-tooltip-name">{r.label}</span>
                <span className="chart-tooltip-val num">{fm(r.value)}</span>
              </li>
            ))}
          </ul>
          {hoverRows.length > 6 ? (
            <p className="chart-tooltip-more">+{hoverRows.length - 6} more</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
