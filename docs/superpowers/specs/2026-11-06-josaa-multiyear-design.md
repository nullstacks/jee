# JoSAA multi-year data, favourites and institute pages — design

Date: 2026-11-06
Repo: https://github.com/truepushkar/jee (single-file PWA, `index.html`)
Status: approved 2026-11-06 (approach A, inline data)

## 1. What is being asked

The site today is a JEE reference: a syllabus checklist and a set of
percentile→rank tables, plus a college predictor that ships **one** JoSAA
snapshot baked in as a base-36 packed string (2026, Round 5, 12,763 rows).

Five changes:

1. Ship **all seven years** (2020–2026) of JoSAA opening/closing ranks.
2. Let a student **favourite** institutes, and see the ones they care about.
3. Tapping an institute opens a **detail page**: its past-year opening and
   closing ranks.
4. Make that detail page **visual** with a graph, not just a table.
5. Default the quota selector to **Any quota** instead of All India.

"2026 is already in the site" is correct — the existing built-in data is 2026
Round 5. The new work is the 2020–2025 back-history plus everything that
reads it.

## 2. What the data actually is

The working directory holds the source CSVs. Measured:

| | |
|---|---|
| Files | `josaa_<year>.csv`, 2020–2026, plus a combined `josaa_or_cr_2020_2026.csv` |
| Raw rows | 426,255 (every round, every year) |
| Rounds per year | 2020–2023, 2025, 2026: 6 · 2024: 5 |
| Final-round rows | 74,406 total (8,990 in 2020 → 12,936 in 2026) |
| Institutes | 147 distinct |
| Programmes | 300 distinct |
| Degree labels | 18 distinct |
| Quotas | AI, HS, OS, GO, JK, LA |
| Seat types | OPEN, EWS, OBC-NCL, SC, ST + the four PwD variants |
| Gender pools | Gender-Neutral, Female-only (incl. supernumerary) |
| Largest rank | 1,497,038 (fits 4 base-36 chars) |
| Data integrity | 0 rows with opening > closing, 0 blank openings |

Two consequences that shape the build:

- **Quota is redundant in most rows.** 3,011 of 9,894 target combinations in
  2026 carry more than one quota with different ranks. So "quota = Any" must
  merge by *best closing rank*, not list everything twice.
- **Round must be pinned.** Comparing 2020 Round 1 against 2026 Round 5 would
  be nonsense. Every year ships its **final round only**; the UI states this.

## 3. Goals

- A student can see, for any institute and branch, how the cut-off has moved
  year over year, with the shape of that movement visible at a glance.
- A student can pin the handful of institutes they are actually chasing and
  get back to them in one tap.
- The predictor's numbers get better because it can report a multi-year
  range, not a single-year coin flip.
- Nothing that exists today gets worse: same zero-dependency single file, same
  offline behaviour, same light/dark themes.

## 4. Non-goals

- No build step, no bundler, no framework, no npm dependency. The site stays
  one `index.html` that works from `file://` and installs as a PWA.
- No server. Favourites live in `localStorage`.
- No account, no sync, no analytics.
- Not adding the syllabus or percentile-table content changes.
- Not fetching data at runtime from JoSAA — the data ships in the file.

## 5. Anti-goals

- A file so large that a mid-range phone stalls parsing it.
- Charts that decorate rather than inform; the graph must answer "is this
  branch getting harder?" without needing the table.
- A favourites list that is a dead end — it has to lead somewhere useful.

## 6. Approaches considered

### A. Ship all seven years inline, packed (chosen)

Reuse the existing base-36 scheme: two dictionaries (institute, programme)
plus a small degree dictionary, and 16 characters per row. 74,406 rows →
**1.14 MB** of packed text, which gzips to roughly 300 KB over the wire and is
parsed in ~54 ms.

*Trades:* the file grows from 300 KB to about 1.45 MB raw. That is the honest
cost of seven years offline, and it is the same thing the site already does
for one year.

### B. Ship years 2020–2025 as separate JSON, fetched on demand

Keeps first paint small; institute pages load their history lazily.

*Trades:* breaks the "open the file from disk and it works" property, adds a
loading state to the single most important interaction (tapping an
institute), and needs the service worker to learn about five new cacheable
resources. The site is a static single file by deliberate design; this is the
first crack in that.

### C. Ship the year-by-year history only, drop per-round data

Smallest payload: for each institute/branch/category, one row per year.

*Trades:* loses the opening rank the user explicitly asked to see, and loses
the ability to show the intra-year spread. Also has to be recomputed from the
CSVs anyway, so it saves nothing in build complexity — only in bytes we can
afford.

**Decision: A, chosen by the user on 2026-11-06** — "one 1.45 MB file that
works offline out of the box." The size cost is accepted; approaches B and C
are closed.

### Charting approach

- **Inline SVG** (chosen). The site already has a hand-rolled `lineChart`
  built on `createElementNS`. Extending it means zero dependencies, exact
  theme-token fidelity in both light and dark, and full control of the rank
  axis. Trades: we write the axes ourselves.
- **Canvas** — better for thousands of points, worse for text, hit-testing and
  crispness on the scales involved here (7 points per line).
- **A chart library from a CDN** — breaks offline, breaks the zero-dependency
  rule, and the existing PWA cache would need to learn a third-party origin.

## 7. The design

### 7.1 Data format

Extend the existing `JD` object with parallel year arrays. Per year, one
packed string using the current 16-character layout, unchanged:

```
II PPT D QQQ OOOO CCCC
│  │   │ │   │    └── closing rank, base36, 4 chars
│  │   │ │   └─────── opening rank, base36, 4 chars
│  │   │ └─────────── quota(×20) + seat(×2) + gender, base36, 3 chars
│  │   └───────────── degree index, base36, 1 char
│  └───────────────── programme index, base36, 2 chars
└──────────────────── institute index, base36, 2 chars
```

Kept byte-compatible with the current decoder so 2026 needs no new code path.
Rows carry a `year` field; the decoded table is indexed once at load into
`byKey` (institute+programme+degree+seat+gender → rows by year).

### 7.2 Navigation

Hash routing, so every view is linkable and the back button works:

| Route | Screen |
|---|---|
| `#predict` | College predictor (primary tab) |
| `#institutes` | Institute browser + favourites (primary tab) |
| `#institute/<slug>` | One institute's detail page |
| `#ranks/<section>` | Percentile/rank tables (primary tab, existing sub-nav) |
| `#syllabus` | Syllabus checklist (primary tab) |

The predictor stops being a sub-tab of "Rank tables" and becomes a top-level
tab of its own, because it is now the front door.

### 7.3 Predictor changes

- **Default quota: Any.** `quotaSel` starts empty. With "Any", a key is
  shown once, at its best closing rank, and the row notes that it is the best
  of several quota pools.
- **Default year: 2026**, with a year selector (2020–2026) and a fifth sort
  option, "Best trend", that ranks a result by how the same key closed over
  the last three years rather than by one year.
- Each result row gains: a **star** (favourite the institute), the institute
  name as a **link** to `#institute/<slug>`, and a **sparkline** of its
  closing rank by year.
- The file-import path is kept and now records the year it was loaded from,
  so a user-supplied CSV joins the history instead of replacing it.
- Copy that hard-codes "12,763 rows" or "2026 Round 5" is replaced with
  values computed from the loaded data.

### 7.4 Institute browser (`#institutes`)

- Favourites first, as a grid of compact cards: name, type, count of
  branches, latest-year best closing rank, and an unstar button. Empty state
  names the next action ("Search below, then tap the star").
- Below it, the full 147-institute list with a search box and type chips
  (IIT/NIT/IIIT/GFTI), each with a star.
- Tapping anywhere else on a row opens its detail page.

### 7.5 Institute detail page (`#institute/<slug>`)

Header: institute name, type, city if derivable, star toggle, and the count
of branches it offers.

**Controls:** seat type (category), gender pool, a branch search, and a
metric switch — Closing / Opening.

**The graph.** One line per branch, x = 2020…2026, y = closing rank on an
inverted axis (rank 1 at the top, because a smaller number is a better
outcome). Up to eight branches are drawn at once, defaulting to the eight most
competitive in the latest year; a legend toggles each on and off, and hovering
or tapping a point shows the exact rank for that year. Branch families (CS,
Electrical, Mechanical, Civil, Chemical, …) get a stable hue from a small
categorical palette so the same branch reads the same across every institute.

Why a line chart and not bars: the question is *direction of travel* — did
this branch get harder or easier — and seven discrete years encode that far
better as a slope than as seven bars the eye has to compare.

**The table.** Every branch, one row, with a column per year showing
opening / closing, a delta arrow against the previous year, and a
"never offered" dash where the institute did not run that branch that year.
Rows expand to per-year detail.

**Limits stated in the UI:** final round of each year only; a missing year
means JoSAA did not allocate that combination that year, not that the branch
does not exist; ranks are JOSAA All India rank, not JEE percentile.

### 7.6 Favourites

- Stored as `{name, type, addedAt}` under `jee.favourites`, keyed by
  institute name, capped at 20 with a plain message when full.
- Written through the same defensive `try/catch` the theme and syllabus
  ticks already use, so private-browsing storage failures degrade quietly.
- Unstarring from anywhere updates every star on screen.

### 7.7 Craft and accessibility

- Both themes must be checked, not just light.
- Keyboard: stars are buttons with `aria-pressed`, the legend is a group of
  toggle buttons, the graph carries a text summary for screen readers, the
  table remains the accessible source of truth.
- Touch: 44 px minimum targets, no hover-only affordances, chart points
  tappable.
- Reduced motion respected for any transition added.
- No new colours beyond tokens that already exist; the chart palette is
  derived from the existing accents so both themes keep contrast.

### 7.8 Offline

Bump the service worker `VERSION` so the new build lands and the old cache is
evicted. `index.html` stays the only cacheable page.

## 8. What is left to the builder

- The exact categorical hue set for branch families, checked against both
  themes.
- Whether the institute graph gets a horizontal zoom or stays at seven fixed
  points (recommended: fixed; seven is not too many to read).
- Slug format for institute names.
- Where the star sits inside a predictor row without crowding the table.

## 9. Risks

| Risk | Mitigation |
|---|---|
| 1.45 MB file is slow on a low-end phone | Measure decode in the browser; if it hurts, split the history behind approach B as a follow-up |
| The predictor table gets crowded with a sparkline per row | Sparklines are opt-in via a "Show trends" chip |
| Favourites diverge from institute names after a data refresh | Key on exact name; a rename shows as a new institute and the old favourite is pruned on load |
| Hash routing breaks the existing sub-nav | The router wraps the current `showView`/`showSection` functions rather than replacing them |
