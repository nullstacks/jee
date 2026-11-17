import { useMemo } from "react";
import type { Pair } from "../lib/percentile";

/* A single log-scale curve with an optional "you are here" marker.
   Kept deliberately separate from CutoffChart: that one plots several
   ranked series per year, this one plots one percentile → rank function. */
export function SeriesChart({
  data,
  width,
  color,
  yMax,
  yLabel,
  formatY,
  formatX,
  marker,
  markerLabel,
  ariaLabel,
}: {
  data: Pair[];
  width: number;
  color: string;
  yMax: number;
  yLabel: string;
  locale?: string;
  formatY: (v: number) => string;
  formatX: (v: number) => string;
  marker?: number;
  markerLabel?: string;
  ariaLabel: string;
}) {
  const narrow = width < 520;
  const height = narrow ? 250 : 320;
  const pad = { top: 16, right: 14, bottom: 36, left: narrow ? 44 : 56 };
  const plotW = Math.max(120, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const geo = useMemo(() => {
    const lmax = Math.log10(Math.max(yMax, 10));
    const X = (p: number) => pad.left + ((100 - p) / 100) * plotW;
    const Y = (v: number) => pad.top + plotH - (Math.log10(Math.max(v, 1)) / lmax) * plotH;
    const sorted = [...data].sort((a, b) => b[0] - a[0]);
    return { X, Y, sorted };
  }, [data, plotW, plotH, yMax, pad.left, pad.top]);

  const { X, Y, sorted } = geo;

  const line = sorted
    .map((pt, i) => (i ? "L" : "M") + X(pt[0]).toFixed(1) + " " + Y(pt[1]).toFixed(1))
    .join(" ");

  const area =
    "M " +
    X(sorted[0][0]).toFixed(1) +
    " " +
    (pad.top + plotH) +
    " " +
    sorted
      .map((pt) => "L " + X(pt[0]).toFixed(1) + " " + Y(pt[1]).toFixed(1))
      .join(" ") +
    " L " +
    X(sorted[sorted.length - 1][0]).toFixed(1) +
    " " +
    (pad.top + plotH) +
    " Z";

  const yTicks = [1, 10, 100, 1000, 10_000, 100_000, 1_000_000].filter((t) => t <= yMax);
  const xTicks = narrow ? [100, 75, 50, 25, 0] : [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];
  const gid = "grad-" + ariaLabel.replace(/\W+/g, "");

  return (
    <svg
      viewBox={"0 0 " + width + " " + height}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      className="series-chart"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={Y(t)}
            y2={Y(t)}
            className="chart-grid"
          />
          <text x={pad.left - 8} y={Y(t) + 3.5} textAnchor="end" className="chart-tick">
            {formatY(t)}
          </text>
        </g>
      ))}

      {xTicks.map((t) => (
        <text
          key={t}
          x={X(t)}
          y={pad.top + plotH + 18}
          textAnchor="middle"
          className="chart-tick"
        >
          {formatX(t)}
        </text>
      ))}

      <line
        x1={pad.left}
        x2={pad.left}
        y1={pad.top}
        y2={pad.top + plotH}
        className="chart-axis"
      />
      <line
        x1={pad.left}
        x2={width - pad.right}
        y1={pad.top + plotH}
        y2={pad.top + plotH}
        className="chart-axis"
      />

      <path d={area} fill={"url(#" + gid + ")"} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {sorted.map((pt) => (
        <circle
          key={pt[0]}
          cx={X(pt[0])}
          cy={Y(pt[1])}
          r={narrow ? 2.3 : 2.8}
          fill="var(--surface)"
          stroke={color}
          strokeWidth={1.6}
        >
          <title>
            {pt[0].toFixed(2)} percentile → rank {formatY(pt[1])}
          </title>
        </circle>
      ))}

      {marker != null && (
        <g>
          <line
            x1={X(marker)}
            x2={X(marker)}
            y1={pad.top}
            y2={pad.top + plotH}
            className="chart-marker"
          />
          <g transform={"translate(" + X(marker) + "," + (pad.top - 4) + ")"}>
            <rect
              x={-26}
              y={-14}
              width={52}
              height={17}
              rx={5}
              fill="var(--surface)"
              stroke="var(--accent-line)"
            />
            <text
              x={0}
              y={-2}
              textAnchor="middle"
              className="chart-marker-label"
            >
              {markerLabel}
            </text>
          </g>
        </g>
      )}

      <text
        x={12}
        y={pad.top + plotH / 2}
        textAnchor="middle"
        className="chart-axis-label"
        transform={"rotate(-90 12 " + (pad.top + plotH / 2) + ")"}
      >
        {yLabel}
      </text>
    </svg>
  );
}
