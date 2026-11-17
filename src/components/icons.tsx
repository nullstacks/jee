import type { SVGProps } from "react";

/* ───────────────────────────────────────────────────────────────────
   Icon set.

   Rules this set follows, so it stays coherent as icons are added:

   - One 24px grid, drawn on whole and half units where possible.
   - 1.75 stroke. At 15–16px, which is where most of these render, 1.5
     goes thin and 2.0 goes heavy; 1.75 reads as the same weight as
     500-weight text.
   - Solid shapes are reserved for filled states (a pinned star). Every
     outline glyph is drawn with currentColor so a theme flip or a hover
     costs no new asset.
   - Detail is capped at what survives 12px. Windows, ticks and inner
     decoration are dropped below the point where they stop resolving.
   - Round joins and caps throughout; no mitred corners.

   Navigation glyphs are chosen for meaning first and simplicity second:
   a target for "which seat is open", a building for institutes, ranked
   bars for cut-offs, a book for the syllabus. The earlier set used
   sliders for cut-offs, which reads as "settings" and meant nothing.
   ─────────────────────────────────────────────────────────────────── */

type IconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };

const BASE_STROKE = 1.75;

function base({ size = 16, strokeWidth = BASE_STROKE, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...rest,
  };
}

/* ═══════════════ navigation ═══════════════ */

/* A reticle, not a compass. The tab answers "where do I land", and a
   crosshair holds its shape down to 12px where a compass needle does not. */
export function TargetIcon(p: IconProps) {
  /* A marked bubble inside a reticle: the solid dot is "your rank". */
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />
      <path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3" />
    </svg>
  );
}

/* Two blocks, three windows, a shared plinth. The previous version carved
   six windows into two towers and turned to noise under 20px. */
export function BuildingIcon(p: IconProps) {
  /* A college facade: solid pediment, three columns, a plinth. */
  return (
    <svg {...base(p)}>
      <path d="M3.2 9.4 12 4l8.8 5.4Z" fill="currentColor" />
      <path d="M6.5 12.6v5.4M12 12.6v5.4M17.5 12.6v5.4" />
      <path d="M3.5 20.5h17" />
    </svg>
  );
}

/* Ranked bars. Cut-offs are a table of ranks, so the glyph is the shape of
   that table rather than a settings slider. */
export function RanksIcon(p: IconProps) {
  /* The logo's shape: rising bars crossed by a cut-off line. */
  return (
    <svg {...base(p)}>
      <path d="M2.8 11.2h18.4" opacity=".55" />
      <g fill="currentColor" stroke="none">
        <rect x="4.4" y="14.2" width="3.6" height="6.8" rx="1.8" />
        <rect x="10.2" y="8.6" width="3.6" height="12.4" rx="1.8" />
        <rect x="16" y="3.6" width="3.6" height="17.4" rx="1.8" />
      </g>
    </svg>
  );
}

/* An open book with a visible gutter. A closed rectangle reads as a card at
   16px; the centre rule is what says "book". */
export function BookIcon(p: IconProps) {
  /* An open book, one page read: the right page is solid. */
  return (
    <svg {...base(p)}>
      <path d="M12 6.4C10.5 5.2 8.4 4.7 5.9 4.7a1.4 1.4 0 0 0-1.4 1.4v10.3a1.4 1.4 0 0 0 1.4 1.4c2.5 0 4.6.5 6.1 1.7" />
      <path
        d="M12 6.4c1.5-1.2 3.6-1.7 6.1-1.7a1.4 1.4 0 0 1 1.4 1.4v10.3a1.4 1.4 0 0 1-1.4 1.4c-2.5 0-4.6.5-6.1 1.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ═══════════════ actions ═══════════════ */

export function StarIcon({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(p)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 3.3l2.72 5.6 6.13.88-4.44 4.3 1.06 6.1L12 17.3l-5.47 2.88 1.06-6.1-4.44-4.3 6.13-.88L12 3.3Z" />
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m15.9 15.9 4.4 4.4" />
    </svg>
  );
}

export function LinkIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.4 1.4" />
      <path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4" />
    </svg>
  );
}

export function ResetIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3.9 10.6a8.2 8.2 0 1 1 .8 4.6" />
      <path d="M3.4 4.9v5.5h5.5" />
    </svg>
  );
}

export function SortIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M7 4.5v14.2M3.6 15.3 7 18.9l3.4-3.6" />
      <path d="M17 19V5M13.6 8.7 17 5.1l3.4 3.6" />
    </svg>
  );
}

export function DownloadIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3.5v10.6M8 10.5l4 4 4-4" />
      <path d="M4.5 16.8v1.7a2.2 2.2 0 0 0 2.2 2.2h10.6a2.2 2.2 0 0 0 2.2-2.2v-1.7" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m4.6 12.5 4.7 4.7L19.4 7" />
    </svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/* ═══════════════ direction ═══════════════ */

export function ChevronRightIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m5.5 9 6.5 6.5L18.5 9" />
    </svg>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4.2 12h15.4M13.4 6.2 19.6 12l-6.2 5.8" />
    </svg>
  );
}

export function ArrowUpRightIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M7 17 17 7M8.6 7h8.4v8.4" />
    </svg>
  );
}

/* A solid arrowhead on a short stem. An open "^" over a stem collapses into
   a diamond below 16px because the two diagonals meet the stem at the same
   point; a filled head keeps its silhouette at 12px. */
export function TrendIcon({ up, ...p }: IconProps & { up: boolean }) {
  return (
    <svg {...base(p)}>
      {up ? (
        <>
          <path d="M12 20V9" />
          <path d="M12 3.4 18.2 10.6H5.8L12 3.4Z" fill="currentColor" strokeWidth={0.5} />
        </>
      ) : (
        <>
          <path d="M12 4v11" />
          <path d="M12 20.6 5.8 13.4h12.4L12 20.6Z" fill="currentColor" strokeWidth={0.5} />
        </>
      )}
    </svg>
  );
}

/* ═══════════════ status ═══════════════ */

export function AlertIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10.3 4.2 2.75 17.4a1.75 1.75 0 0 0 1.5 2.6h15.5a1.75 1.75 0 0 0 1.5-2.6L13.7 4.2a1.75 1.75 0 0 0-3.4 0Z" />
      <path d="M12 9.4v4.1" />
      <circle cx="12" cy="16.7" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11.2v5.4" />
      <circle cx="12" cy="7.9" r="0.45" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChartIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3.6 3.8v14.5a2.1 2.1 0 0 0 2.1 2.1h14.5" />
      <path d="m7.3 14.9 3.9-4.4 3.1 2.6 4.4-5.6" />
    </svg>
  );
}

export function LayersIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m12 3.3 8.6 4.6-8.6 4.6L3.4 7.9 12 3.3Z" />
      <path d="m3.4 12.2 8.6 4.6 8.6-4.6" />
      <path d="m3.4 16.4 8.6 4.6 8.6-4.6" />
    </svg>
  );
}

export function SparkIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3.2c.5 3.9 1.7 5.1 5.6 5.6-3.9.5-5.1 1.7-5.6 5.6-.5-3.9-1.7-5.1-5.6-5.6 3.9-.5 5.1-1.7 5.6-5.6Z" />
      <path d="M17.8 15.2c.25 1.95.85 2.55 2.8 2.8-1.95.25-2.55.85-2.8 2.8-.25-1.95-.85-2.55-2.8-2.8 1.95-.25 2.55-.85 2.8-2.8Z" />
    </svg>
  );
}

export function TrophyIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M8 3.5h8v5.2a4 4 0 0 1-8 0V3.5Z" />
      <path d="M8 5.2H5.6a2.1 2.1 0 0 0 0 4.2H6M16 5.2h2.4a2.1 2.1 0 0 1 0 4.2H18" />
      <path d="M12 12.9v3.6M9.2 16.5h5.6l.5 4H8.7l.5-4Z" />
    </svg>
  );
}

export function ListIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 6.2h11.4M9 12h11.4M9 17.8h11.4" />
      <circle cx="4.6" cy="6.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="17.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ═══════════════ theme ═══════════════ */

export function SunIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2.2M12 19.2v2.2M4.35 4.35l1.56 1.56M18.09 18.09l1.56 1.56M2.6 12h2.2M19.2 12h2.2M4.35 19.65l1.56-1.56M18.09 5.91l1.56-1.56" />
    </svg>
  );
}

export function MoonIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M20.5 14.6A8.7 8.7 0 0 1 9.4 3.5a8.7 8.7 0 1 0 11.1 11.1Z" />
    </svg>
  );
}

/* ═══════════════ brand ═══════════════ */

/* The app mark. Three rising bars on a rounded tile: it is the same shape as
   the ranks glyph in the nav, so the logo and the product agree about what
   this thing is. Drawn at 28px with a 2px outer radius offset so the tile and
   the bars stay concentric (outer radius = inner + padding). */
export function BrandMark({ size = 28, ...p }: IconProps) {
  /* Three rising bars crossed by a cut-off line; the bars that clear the line
     turn amber. The tile takes currentColor and the bars take the page
     colour, so the mark inverts with the theme without a second asset. */
  const bar = "var(--brand-bar, #ffffff)";
  const hot = "var(--brand-hot, #ffc857)";
  const bars: [number, number][] = [
    [8.5, 15],
    [14, 10],
    [19.5, 6],
  ];
  const line = 12.8;
  const bottom = 21;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      focusable={false}
      {...p}
    >
      <rect width="28" height="28" rx="8" fill="currentColor" />
      <path d={"M5.5 " + line + "H22.5"} stroke={bar} strokeOpacity=".5" strokeWidth="1.2" strokeLinecap="round" />
      {bars.map(([cx, top]) => (
        <g key={cx}>
          <rect x={cx - 1.7} y={top} width="3.4" height={bottom - top} rx="1.7" fill={bar} />
          {top < line ? (
            <path
              d={"M" + (cx - 1.7) + " " + line + "V" + (top + 1.7) + "a1.7 1.7 0 0 1 3.4 0V" + line + "Z"}
              fill={hot}
            />
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export type IconComponent = (p: IconProps) => React.ReactElement;
