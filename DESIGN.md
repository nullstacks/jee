# DESIGN.md — jee

A reference for anyone (human or agent) changing this interface. It records
what the system *is*, not what it could be.

## Direction: answer sheet, with a results board

The look comes from the exam itself. **Answer sheet leads:** pale paper, pencil
ink (`--fg`), printed-orange rules and accent (`#c2410c`), a form-style
grotesque (Bricolage Grotesque) for headings, and an OMR timing track (the
dashed strip) along the header edge. *Selected means filled in*: chapter
checkboxes are bubbles, and a pressed chip is solid ink, like a marked answer.

**Results emphasis supports:** the predictor's result tiles and the percentile
instrument are the answer the reader came for, so they sit on a sunken surface
with a printed-orange rule along the top edge and oversized numerals. They
follow the theme — an earlier version forced them dark in light mode, which
read as a bug rather than as emphasis. Dark theme is the whole app as a board
(accent `#ff8a4c`).

Navigation icons follow the same rule: each glyph is an outline plus one solid
part (a marked bubble, a pediment, the cut-off bars, the page being read). The
current section's icon sits on a solid ink tile, like a marked answer, in both
the header and the mobile tab bar.

The logo is a pencil-ink tile; the bars that clear the cut-off line are orange.

## Register

An exam-reference tool that people open repeatedly during a stressful year:
check a cut-off, tick a chapter, look up a percentile. It should feel calm,
fast and precise — closer to a well-made almanac than to a dashboard.

Reading happens in two places that need different answers:

| Context | Distance | Needs |
|---|---|---|
| Desktop, evening, long session | ~70 cm | density, side-by-side comparison |
| Phone, in transit, one hand | ~30 cm | thumb-reachable nav, one card per screen |

## Page header

Every view opens with the heading, then the lede, then one quiet meta line
(counts, span, scope). The meta line used to sit above the heading as a label;
it now sits below (on chapter reports and institute pages too) so the first thing read is the sentence, not the tag. The
heading is the one large moment on each page (up to 3rem, -0.03em tracking);
on phones it is capped at 2.125rem so the controls stay on the first screen.

Alignment rule for list rows: columns of figures use **fixed tracks**, never
`auto`. An `auto` track is sized per row, so a row with "29.7/yr" and a row
with "9.3/yr" put their sparklines at different x. Polish rules live in
`src/styles/polish.css`.

## Typography

Three faces, each with one job.

| Token | Face | Used for |
|---|---|---|
| `--font-display` | Bricolage Grotesque Variable | `h1`, the hero line of every view, the brand name |
| `--font-ui` | Inter Variable | all UI chrome and body copy |
| `--font-mono` | JetBrains Mono Variable | every rank, count and axis label |

- The display face carries voice; the sans carries instructions. A heading is
  never set in the UI face and body copy is never set in the display face.
  The heading is a form-style grotesque, heavy and tight (-0.035em), because
  the whole surface reads as an answer sheet.
- **All numerals that change are monospace with `tabular-nums`** (`.num`).
  Ranks are compared vertically; proportional digits make that impossible.
- `-webkit-font-smoothing: antialiased` is applied once, at the root.
- Headings use `text-wrap: balance`; body copy uses `text-wrap: pretty`.
- Latin + latin-ext subsets only — the data never leaves Latin-1, and the
  whole app ships as one file.

## Colour

Warm paper neutrals, one printed-orange accent (`#c2410c`, lightening to
`#ff8a4c` in dark), four semantic pairs. Every value is a token in
`src/styles/tokens.css`; no component hard-codes a hex.

**Every text colour clears 4.5:1 against the darkest surface it can land on.**
`--fg-subtle` is the one to watch: it carries every meta line, axis label and
unit suffix, and it is checked against `--surface-inset`, not just white —
a `.seg-count` sits on the inset chip, which is where the weakest pair lives.
`--fg-subtle` is `#67646c` (4.78:1 there, 5.15:1 on white) and `#8a8890` in
dark (5.18:1 on the dark surface). Do not lighten it back toward the canvas.

| Token | Role |
|---|---|
| `--canvas` / `--surface` | page vs card. Cards sit *above* the canvas |
| `--accent` | the single interactive colour: links, primary buttons, selected nav |
| `--accent-soft` | every pressed/selected fill, app-wide |
| `--safe` / `--caution` / `--reach` | the three admission chances |
| `--c1`…`--c8` | chart series, one per branch |

**Chance is never carried by colour alone.** Every badge and stat also states
its label in words ("Comfortably in", "A stretch"), and the ninth chart
series switches to a dashed stroke so hue is never the only channel.

Dark mode is not an inversion: the canvas goes to a warm near-black
(`#14130f`), accents lighten rather than invert, and the depth shadows
collapse to a single white ring because layered shadows read as dirt on dark.

## Logo and icons

The mark is three rising bars crossed by a cut-off line; the bars that clear
the line turn amber. It is the product in one glyph: ranks against a cut-off.
In the header the tile takes `currentColor` and the bars take `--brand-bar`, so
it inverts with the theme (amber deepens in dark so it keeps contrast against
the lighter tile). `tools/build-icons.py` writes every SVG and PNG in
`public/icons/` from one geometry; edit it there, never the output.

## Charts

One mark carries the answer. In the year bars the peak season is solid accent
and the rest are a tint of it; hover brings any bar forward. Every bar is
still labelled with its count, so colour is a second channel, never the only
one. Line charts use a 2.25px stroke with surface-filled point markers.

Headings and the brand name use Bricolage's optical-size axis
(`font-optical-sizing: auto`): the display cut at large sizes, the text cut
when small.

## Space and shape

- 4px base scale (`--s-1`…`--s-10`).
- Radii nests concentrically: **outer = inner + padding.** A `--r-lg` card
  with `--s-3` padding holds a `--r-md` control, never another `--r-lg`.
- Content column is 1160px; prose is capped at 68ch so a line never runs
  past the point where the eye loses its place.

## Elevation

Shadows for depth, hairline borders for structure.

- Cards, buttons, popovers: layered transparent `box-shadow` (`--shadow-1`…3).
- Dividers, table rules, input outlines: real 1px borders — they separate,
  not elevate.
- Hover raises by one step, never two. Nothing moves on hover except a 2px
  nudge on the institute-row chevron.

## Motion

Custom curves only; the CSS defaults are too weak to read as intentional.

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | everything entering or responding |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen movement |
| `--dur-fast` | 160ms | hover, colour, small state |
| `--dur-base` | 200ms | headers, cards |
| `--dur-slow` | 280ms | view enter |

Rules the codebase follows:

- **`transition-property` is always named.** No `transition: all`.
- **Nothing animates on a high-frequency action.** The tab bar, chips and
  segmented controls change state instantly; only colour and shadow move.
- **Nav indicators are static.** The active tab is weight + colour, not a
  sliding pill that re-animates on every tap.
- **Press always lands at `scale(0.97)`** — buttons, chips, legend items, stats.
- **Hover only behind `(hover: hover) and (pointer: fine)`** so a tap on a
  phone never triggers a stuck hover state.
- View entry is a 6px rise + fade, 280ms, once per route change.
- `prefers-reduced-motion` collapses every transition; no motion is load-bearing.

## Interaction targets

- 40px minimum on touch (`pointer: coarse`); 30px minimum with a mouse.
- Checkboxes draw a 17px box but carry a 40px transparent hit area.
- Star buttons are 30px dense / 40px on touch — the most-tapped control in
  every list.
- Two hit areas never overlap.

## Icons

One hand-drawn set (`src/components/icons.tsx`), 24px grid, 1.5px stroke to
match regular text weight.

- Every glyph is drawn in `currentColor`; states come from CSS colour.
- Outline is the default; **fill marks the active state** (a pinned star).
- No mixed icon libraries on one surface.

## Responsive behaviour

One breakpoint system, three layouts.

| Range | Navigation | Tables |
|---|---|---|
| ≥ 761px | inline header nav | full grid, sticky headers |
| ≤ 760px | fixed bottom tab bar | each row becomes a card |
| ≤ 560px | same | tighter padding, hidden hints |

Below 760px the four sections move to a thumb-reachable bar at the bottom of
the viewport. Both the predictor result table and the institute cut-off table
restack into cards, because a seven-column table in 390px means the column
people came for is the one that scrolls away.

## States

Every async or empty surface answers three questions:

1. **What happened** — a specific title. "No seat matches 'kanpur'" is not
   "Nothing closed near that rank"; they have different causes and different fixes.
2. **Why** — one line of plain language, no error codes.
3. **What to do next** — a named action ("Clear the search", "Reset the filters").

## Round data

Every round of every year is in the bundle, so the tool can answer a
question the final-round view cannot: **how the cut-off moved while the
season was running.**

Two places surface it.

- **Predictor, round selector.** A labelled row of round chips under the
  filters. It is not buried in the filter grid because it is the control
  that changes the answer, not a refinement of it.
- **Institute page, season strip.** One branch, every round, with the
  movement against the previous round shown as a signed number. A larger
  closing rank means the cut-off opened up, so the arrow follows the rank,
  not the intuition.

Copy rule that came out of checking the data: later rounds **widen** the
cut-off (a later round admits candidates further down the list). The first
version of this copy said the opposite. Any claim about direction in this
app should be verified against `test/codec.test.mjs`, which asserts that
widening dominates by more than 10:1 across the shipped dataset.

## Chapter reports

The syllabus list and a chapter page are the same object at two zoom levels, so
they share one vocabulary: a danger/caution/neutral `prio` pill, monospace
figures with tabular digits, and one sparkline component whose viewBox stretches
to its host.

Three rules came out of building them:

- **A figure appears once.** The chapter row's "31.7/yr" and the report's stat
  tile are the same number from the same function (`recentRate`). Nothing on
  the report page re-states a total the tables already carry.
- **The reading order is authored, the weights are computed.** They disagree,
  and the page says so: the hint line tells the reader the number is a plan and
  offers the switch to the weight ranking. A list that silently claims to be
  both would be lying about one of them.
- **Charts carry the number they encode.** The year bars label every bar, the
  topic bars print the count and the share, and the matrix prints a value in
  every cell — colour is a second channel, never the only one.

## Shareable state

Predictor filters live in the hash, not in component state:

`#predict?rank=42000&seat=OBC-NCL&year=2023&round=1`

Only non-default values are written, so a shared link stays short. Three
things fall out of this for free: a result can be sent to someone, going
into an institute and coming back keeps the filters, and a reload lands
where the reader left off.

The parser clamps every value and ignores unknown keys, so a truncated or
hand-edited link still renders.
## Accessibility

- One skip link, real landmarks, one `h1` per view.
- `aria-pressed` on every toggle, `aria-current="page"` on every nav item.
- A polite live region announces pin/unpin and filter results.
- Focus is always visible: a 2px accent ring with a canvas-coloured gap.
- Charts carry a descriptive `aria-label` and every value also appears in a table.

## Known exceptions

- `.inst-link` and inline body links measure ~22px tall. They are text
  links inside a text flow; enlarging them would break the line rhythm.
  Their width is the full column, so the horizontal target is generous.