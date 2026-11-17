# JoSAA Multi-Year Data, Favourites and Institute Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship all seven years of JoSAA opening/closing ranks in the single-file PWA, add institute favourites, and give every institute a detail page with a multi-year cut-off graph.

**Architecture:** Pure data and query logic moves into `src/core.js`, an ES module that runs unchanged in both Node and the browser. A zero-dependency build script (`tools/build.mjs`) packs the seven CSVs into base-36 strings, strips the `export` keywords from `core.js`, and rewrites two marked blocks inside `index.html`. The shipped artifact stays one hand-editable HTML file with no runtime dependencies.

**Tech Stack:** Plain HTML/CSS/ES2020, inline SVG. Node 26 `node --test` for tests and `node tools/build.mjs` for the build. No npm packages, no bundler.

**Spec:** `docs/superpowers/specs/2026-11-06-josaa-multiyear-design.md`

## Global Constraints

- The shipped artifact is exactly one file: `index.html`. No runtime fetch of application data, no CDN, no npm dependency.
- Node built-ins only (`node:fs`, `node:test`, `node:assert`). Adding a dependency to `package.json` is a failure.
- Data ships as **final-round rows only**, one set per year, 2020–2026.
- The packed row layout stays byte-compatible with the current decoder: `II PPT D QQQ OOOO CCCC`, 16 base-36 chars.
- Quota default is the empty string, rendered "Any quota". Seat default stays `OPEN`, gender default stays `0`, year default stays `2026`.
- All new colours come from existing CSS custom properties. Both `data-theme="light"` and `data-theme="dark"` must be verified.
- `localStorage` access is wrapped in `try/catch`, matching the existing `storedTheme`/`saveDone` pattern.
- Favourites are keyed by exact institute name; the cap is 20.
- Bump `VERSION` in `sw.js` so the old cache is evicted.

## Review Focus

- **A key that exists in one year but not another.** A branch added in 2023 must show a gap for 2020–2022, not a zero, not a dropped row. Tested in Task 3 (`buildInstituteSeries`).
- **Quota "Any" with genuinely different ranks per quota.** Must collapse to the best (smallest) closing rank and report which quota won — never list the same seat twice. Tested in Task 2 (`mergeQuotas`).
- **A rank larger than 1,497,038 cannot exist in the data, but a *user-supplied CSV* can exceed the 4-char base-36 field.** Import must not corrupt or silently truncate; it is rejected with a visible message. Tested in Task 4.
- **A favourite whose institute disappears from a refreshed dataset.** Pruned on load, never rendered as a broken row. Tested in Task 5 (`pruneFavourites`).
- **A 2024 graph.** 2024 ran five rounds, not six, and some keys skip a year inside the range. The x-axis must be year values, not array indices. Tested in Task 6 (`seriesToPoints`).

---

### Task 1: Data pipeline and packed codec

**Files:**
- Create: `src/core.js`
- Create: `tools/build.mjs`
- Create: `test/codec.test.mjs`
- Create: `package.json`

**Interfaces:**
- Consumes: the CSVs in the parent directory (`../josaa_<year>.csv`).
- Produces: `decodeAll(data) -> Row[]` and `classifyInst(name) -> 0|1|2|3` from `src/core.js`; the shape `{I: string[], P: string[], D: string[], T: string[], Y: {[year]: string}}`; the file `src/data.generated.js` exporting `JOSAA_DATA`.

- [ ] **Step 1: Create `package.json`**

```json
{ "name": "jee-site", "private": true, "type": "module",
  "scripts": { "build": "node tools/build.mjs", "test": "node --test test/" } }
```

- [ ] **Step 2: Write the failing test** in `test/codec.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { decodeAll, classifyInst } from "../src/core.js";

const fixture = { I: ["B Institute", "A Institute"], P: ["Civil", "Computer Science"],
  D: ["4 Years, Bachelor of Technology"], T: [1, 0], Y: { 2026: "" } };

function packRow(inst, prog, deg, quotaIdx, seatIdx, g, op, cl) {
  const c = quotaIdx * 20 + seatIdx * 2 + g;
  return inst.toString(36).padStart(2, "0") + prog.toString(36).padStart(2, "0")
    + deg.toString(36) + c.toString(36).padStart(3, "0")
    + op.toString(36).padStart(4, "0") + cl.toString(36).padStart(4, "0");
}

test("decodeAll round-trips a packed row", () => {
  const data = { ...fixture, Y: { 2026: packRow(1, 1, 0, 0, 0, 0, 10890, 11172) } };
  const rows = decodeAll(data);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    year: 2026, inst: "A Institute", type: 0, prog: "Computer Science",
    deg: "4 Years, Bachelor of Technology", q: "AI", seat: "OPEN", g: 0,
    op: 10890, cl: 11172 });
});

test("decodeAll reads every year in ascending order", () => {
  const data = { ...fixture, Y: { 2026: packRow(1, 1, 0, 0, 0, 0, 10, 20),
    2025: packRow(1, 1, 0, 0, 0, 0, 30, 40) } };
  assert.deepEqual(decodeAll(data).map(r => r.year), [2025, 2026]);
});

test("decodeAll marks the row with the institute type from the dictionary", () => {
  const data = { ...fixture, Y: { 2026: packRow(0, 0, 0, 0, 0, 0, 1, 2) } };
  assert.equal(decodeAll(data)[0].type, 1);
});

test("classifyInst sorts the four kinds", () => {
  assert.equal(classifyInst("Indian Institute of Technology Bombay"), 0);
  assert.equal(classifyInst("National Institute of Technology Trichy"), 1);
  assert.equal(classifyInst("International Institute of Information Technology Hyderabad"), 2);
  assert.equal(classifyInst("Birla Institute of Technology, Mesra"), 3);
});
```

- [ ] **Step 3: Run the test to watch it fail**

Run: `node --test test/codec.test.mjs`
Expected: FAIL — cannot find module `../src/core.js`.

- [ ] **Step 4: Implement the codec in `src/core.js`**

Header constants first, then the two functions. `decodeAll` must iterate `Object.keys(data.Y)` numerically sorted, read 16 characters per row, and use `parseInt(s, 36)` throughout. It derives `type` from `data.T[instIdx]` rather than calling `classifyInst`, so the shipped file needs no name heuristics at load time; `classifyInst` stays for the CSV-import path. `decodeAll` must throw `new Error("row length is not a multiple of 16")` when a year string's length is wrong.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/codec.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 6: Implement `tools/build.mjs`**

It must, in order: read `../josaa_<year>.csv` for 2020–2026; parse RFC-4180 CSV (the existing `parseCSV` in `index.html` is a correct reference); select only rows whose `round` equals the maximum round present in that year's file; normalise institute and programme whitespace; split `"<prog> (<degree>)"` on the trailing parenthesised group; collect sorted dictionaries for institute, programme and degree; compute the type index per institute with the same prefix rules as `classifyInst`; pack each row; and write `src/data.generated.js` as `export const JOSAA_DATA = {...};`. It must print one line per year: `2020  round 6  8990 rows`, then `total 74406 rows`, then the packed size in KB.

- [ ] **Step 7: Run the build and check the output**

Run: `node tools/build.mjs`
Expected: seven per-year lines matching the measured counts (2020: 8990 … 2026: 12936), `total 74406 rows`, packed size ≈ 1163 KB.

- [ ] **Step 8: Add a data-integrity test** to `test/codec.test.mjs`

```js
import { JOSAA_DATA } from "../src/data.generated.js";
import { decodeAll } from "../src/core.js";

test("shipped data decodes to every year with plausible ranks", () => {
  const rows = decodeAll(JOSAA_DATA);
  assert.equal(rows.length, 74406);
  assert.deepEqual([...new Set(rows.map(r => r.year))], [2020,2021,2022,2023,2024,2025,2026]);
  assert.equal(rows.filter(r => r.op > r.cl).length, 0);
  assert.equal(rows.filter(r => !r.cl).length, 0);
  assert.equal(new Set(rows.map(r => r.inst)).size, 147);
});
```

- [ ] **Step 9: Run the full suite, then commit**

Run: `node --test test/`
Expected: PASS, 5 tests.
```bash
git add package.json src/core.js src/data.generated.js tools/build.mjs test/codec.test.mjs
git commit -m "Pack seven years of JoSAA data behind a tested codec"
```

---

### Task 2: Prediction, quota merge and chance

**Files:**
- Modify: `src/core.js`
- Create: `test/predict.test.mjs`

**Interfaces:**
- Consumes: `Row` from Task 1.
- Produces: `keyOf(row) -> string`; `mergeQuotas(rows) -> ({row, quotas}[])`; `chanceOf(rank, cl) -> "safe"|"mod"|"reach"|null`; `predict(opts) -> {results, counts}` where `opts` is `{rows, rank, seat, quota, gender, deg, types, terms, sort, year}` and `results` is `({row, quotas, chance})[]`.

- [ ] **Step 1: Write the failing tests** in `test/predict.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { keyOf, mergeQuotas, chanceOf, predict } from "../src/core.js";

const row = (o) => ({ year: 2026, inst: "IIT Bombay", type: 0, prog: "CS",
  deg: "4 Years, Bachelor of Technology", q: "AI", seat: "OPEN", g: 0,
  op: 100, cl: 200, ...o });

test("keyOf ignores quota and year but not gender or seat", () => {
  assert.equal(keyOf(row({ q: "AI" })), keyOf(row({ q: "HS" })));
  assert.notEqual(keyOf(row({ g: 1 })), keyOf(row({ g: 0 })));
  assert.notEqual(keyOf(row({ seat: "EWS" })), keyOf(row({ seat: "OPEN" })));
});

test("mergeQuotas keeps the best closing rank and names the winning quota", () => {
  const merged = mergeQuotas([row({ q: "AI", op: 14576, cl: 16001 }),
                              row({ q: "HS", op: 33757, cl: 35618 })]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].row.cl, 16001);
  assert.equal(merged[0].row.q, "AI");
  assert.deepEqual(merged[0].quotas.sort(), ["AI", "HS"]);
});

test("mergeQuotas leaves a single-quota row alone", () => {
  const merged = mergeQuotas([row({ q: "OS", cl: 500 })]);
  assert.deepEqual(merged[0].quotas, ["OS"]);
});

test("chanceOf buckets at 10% below, at the line, and 15% above", () => {
  assert.equal(chanceOf(900, 1000), "safe");
  assert.equal(chanceOf(1000, 1000), "mod");
  assert.equal(chanceOf(1100, 1000), "reach");
  assert.equal(chanceOf(1200, 1000), null);
});

test("predict with an empty quota compares against the best quota", () => {
  const rows = [row({ q: "AI", cl: 16001 }), row({ q: "HS", cl: 35618 })];
  const { results } = predict({ rows, rank: 20000, seat: "OPEN", quota: "",
    gender: 0, deg: "", types: new Set([0,1,2,3]), terms: [], sort: "best", year: 2026 });
  assert.equal(results.length, 1);
  assert.equal(results[0].row.cl, 16001);
});

test("predict filters by explicit quota, year and gender", () => {
  const rows = [row({ q: "AI", cl: 100 }), row({ q: "HS", cl: 100 }),
                row({ q: "AI", cl: 100, year: 2025 }), row({ q: "AI", cl: 100, g: 1 })];
  const { results } = predict({ rows, rank: 50, seat: "OPEN", quota: "AI",
    gender: 0, deg: "", types: new Set([0]), terms: [], sort: "best", year: 2026 });
  assert.equal(results.length, 1);
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `node --test test/predict.test.mjs`
Expected: FAIL — `keyOf` is not exported.

- [ ] **Step 3: Implement the four functions in `src/core.js`**

`keyOf` joins institute, programme, degree, seat and gender with `"|""`. `mergeQuotas` groups by `keyOf`, keeps the first row but replaces it whenever a later row has a smaller `cl`, and collects every quota seen into `quotas` sorted. `chanceOf` keeps the existing thresholds exactly: `<=cl*0.9` safe, `<=cl` mod, `<=cl*1.15` reach, else `null`. `predict` filters by year, seat, gender (`-1` means both), type set, degree, then calls `mergeQuotas` when `quota` is empty, then applies `chanceOf` and the term filter, sorts per `sort` (`best`|`worst`|`inst`|`prog`), and returns `{results, counts:{safe,mod,reach,all}}`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/predict.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core.js test/predict.test.mjs
git commit -m "Add quota merge and prediction core"
```

---

### Task 3: Institute index, series, slugs and sparklines

**Files:**
- Modify: `src/core.js`
- Create: `test/institute.test.mjs`

**Interfaces:**
- Consumes: `Row`, `keyOf` from Tasks 1–2.
- Produces: `classifyInst`; `slugify(name) -> string`; `buildIndex(rows) -> {institutes: {name,type,slug,programs:Set}[], byInst: Map<string, Row[]>}`; `buildInstituteSeries(rows, {seat, gender, metric}) -> {years:number[], series:{label:string, points:(number|null)[]}[]}`; `seriesToPoints(years, values, yMax) -> {x,y}[]`; `sparkPath(values, w, h) -> string`.

- [ ] **Step 1: Write the failing tests** in `test/institute.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { slugify, buildIndex, buildInstituteSeries, seriesToPoints } from "../src/core.js";

const row = (o) => ({ year: 2026, inst: "IIT Bombay", type: 0, prog: "CS",
  deg: "4 Years, Bachelor of Technology", q: "AI", seat: "OPEN", g: 0,
  op: 100, cl: 200, ...o });

test("slugify is lowercase, hyphenated and unique-ish", () => {
  assert.equal(slugify("Indian Institute of Technology Bombay"), "indian-institute-of-technology-bombay");
  assert.equal(slugify("Birla Institute of Technology, Mesra, Ranchi"),
               "birla-institute-of-technology-mesra-ranchi");
});

test("buildIndex collects institutes with their branch count", () => {
  const idx = buildIndex([row({}), row({ prog: "EE" })]);
  assert.equal(idx.institutes.length, 1);
  assert.equal(idx.institutes[0].programs.size, 2);
  assert.equal(idx.institutes[0].slug, "iit-bombay");
});

test("buildInstituteSeries gaps a branch that did not exist in a year", () => {
  const rows = [row({ year: 2025, prog: "CS", cl: 100 }),
                row({ year: 2026, prog: "CS", cl: 90 }),
                row({ year: 2026, prog: "AI", cl: 300 })];
  const { years, series } = buildInstituteSeries(rows, { seat: "OPEN", gender: 0, metric: "cl" });
  assert.deepEqual(years, [2025, 2026]);
  assert.deepEqual(series.find(s => s.label === "AI").points, [null, 300]);
});

test("seriesToPoints places a missing year at that year's x, not at an index", () => {
  const pts = seriesToPoints([2020, 2024, 2026], [100, null, 50], 1000);
  assert.equal(pts.length, 3);
  assert.equal(pts[0].x, 0);
  assert.equal(pts[2].x, 1);
  assert.equal(pts[1].y, null);
});

test("seriesToPoints inverts the rank axis so rank 1 sits at the top", () => {
  const [top, bottom] = seriesToPoints([2020, 2021], [1, 1000], 1000);
  assert.ok(top.y < bottom.y);
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `node --test test/institute.test.mjs`
Expected: FAIL — `slugify` is not exported.

- [ ] **Step 3: Implement in `src/core.js`**

`slugify` lowercases, replaces runs of non-alphanumerics with `-`, and trims hyphens. `buildIndex` walks rows once building an `inst -> Row[]` map plus a sorted `institutes` array carrying `name`, `type`, `slug`, and a `programs` Set of `prog`. `buildInstituteSeries` filters by seat and gender, collects the sorted distinct years present, groups rows by `prog`, and emits one `{label, points}` per programme with `points` aligned to `years` and `null` where absent; `metric` selects ``cl`` or ``op``. It sorts series by the latest non-null value ascending (toughest first). `seriesToPoints` returns `{x, y}` normalised to 0..1 with `x = (year - years[0]) / (years.at(-1) - years[0])` (or `0.5` when the span is zero) and `y = log10(max(v,1)) / log10(yMax)`, which puts rank 1 at the top. `null` stays `null`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/institute.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core.js test/institute.test.mjs
git commit -m "Add institute index and multi-year series"
```

---

### Task 4: Ship the data and rewrite the predictor

**Files:**
- Modify: `src/core.js` (add `pruneFavourites` here, used in Task 5)
- Modify: `tools/build.mjs`
- Modify: `index.html` (lines 796–1123, the predictor block)
- Modify: `index.html` (lines 588–590, the `<script>` opening)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: `window.JOSAA` — the browser-bound namespace `{decodeAll, keyOf, mergeQuotas, chanceOf, predict, slugify, buildIndex, buildInstituteSeries, seriesToPoints, sparkPath, classifyInst}`; a global `ROWS` array; `window.SITE_DATA = {rows, index}`.

- [ ] **Step 1: Extend `tools/build.mjs` to rewrite `index.html`**

Add two marker blocks to `index.html` and have the build replace their contents:
```html
<script>
/*<CORE>*/
/*</CORE>*/
/*<DATA>*/
/*</DATA>*/
</script>
```
The build strips `^export ` from every line of `src/core.js` and writes it between `/*<CORE>*/` and `/*</CORE>*/`; it writes `const JOSAA_DATA = {...};` between the DATA markers. Both replacements are idempotent — running the build twice produces an identical file. Assert that exactly one occurrence of each marker pair exists and exit non-zero otherwise.

- [ ] **Step 2: Replace the predictor block in `index.html`**

Delete the inline `const JD={...}`, `b36`, `decodeBuiltin`, `QUOTAS` and `SEATS` literals (lines ~797–831). Keep `parseCSV`, `colIndex`, `rowsFromTable`, `loadSheetJS`. After the CORE/DATA blocks, initialise:
```js
const ROWS = decodeAll(JOSAA_DATA);
const INDEX = buildIndex(ROWS);
window.SITE_DATA = { rows: ROWS, index: INDEX };
```

- [ ] **Step 3: Change the quota default and add a year selector**

In the section markup, add `<select id="yearSel"></select>` labelled "Year", populated from `[...new Set(ROWS.map(r=>r.year))]` descending, value `2026`. Set `quotaSel.value = ""` — remove the line `quotaSel.value="AI"`. Relabel the empty option's text from `Any quota` to `Any quota (best of)`. Do the same in the file-import handler, which currently sets `quotaSel.value=qs.includes("AI")?"AI":""`.

- [ ] **Step 4: Rebuild the render path onto `predict()`**

Replace `compute()` with a call to `predict({rows:ROWS, rank, seat, quota, gender, deg, types:typeOn, terms, sort, year})` and drop the hand-written loop. In the result row, render the institute name inside `<a href="#institute/' + slug + '" class="instlink">`, add `<button class="star" aria-pressed="false" data-inst="...">` before the name, and append a `<span class="spark">` whose `innerHTML` is an inline SVG built from `sparkPath` of that institute's closing ranks across years. Show the winning quota under the seat cell when more than one quota contributed.

- [ ] **Step 5: Guard the CSV import**

In `rowsFromTable`, add a check: if any parsed closing rank exceeds `1679615` (`36**4 - 1`), throw `new Error("a rank in this file is above 1,679,615 — too large to compare")`. Change the success handler so imported rows are tagged with `year: 0` and merged into a separate `IMPORTED` array used when non-empty, rather than overwriting `ROWS`.

- [ ] **Step 6: Verify in the browser**

Run: `node tools/build.mjs` then open `index.html`.
Expected: predictor loads with "Any quota" and "2026" selected, the row-count line shows a computed count (not the hard-coded 12,763), switching year changes the results, and typing a rank still filters.

- [ ] **Step 7: Commit**

```bash
git add index.html tools/build.mjs
git commit -m "Ship multi-year data and rebuild the predictor on it"
```

---

### Task 5: Router and favourites

**Files:**
- Modify: `src/core.js` (add `pruneFavourites`)
- Create: `test/favourites.test.mjs`
- Modify: `index.html` (navigation block)

**Interfaces:**
- Consumes: `buildIndex` from Task 3.
- Produces: `parseRoute(hash) -> {view, arg}`; `pruneFavourites(list, knownNames) -> {kept, removed}`; `toggleFavourite(list, name) -> list`; on the page, `FAV` (an array of `{name, type, addedAt}`) persisted at `jee.favourites`, and `window.renderStars()`.

- [ ] **Step 1: Write the failing tests** in `test/favourites.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute, pruneFavourites, toggleFavourite } from "../src/core.js";

test("parseRoute reads the four view kinds", () => {
  assert.deepEqual(parseRoute("#predict"), { view: "predict", arg: "" });
  assert.deepEqual(parseRoute("#institutes"), { view: "institutes", arg: "" });
  assert.deepEqual(parseRoute("#institute/iit-bombay"), { view: "institute", arg: "iit-bombay" });
  assert.deepEqual(parseRoute(""), { view: "predict", arg: "" });
});

test("parseRoute decodes a slug with percent escapes", () => {
  assert.deepEqual(parseRoute("#institute/a%20b"), { view: "institute", arg: "a b" });
});

test("toggleFavourite adds, then removes, without touching other entries", () => {
  const one = toggleFavourite([], "IIT Bombay");
  assert.deepEqual(one.map(f => f.name), ["IIT Bombay"]);
  const two = toggleFavourite(one, "NIT Trichy");
  assert.deepEqual(two.map(f => f.name), ["IIT Bombay", "NIT Trichy"]);
  assert.deepEqual(toggleFavourite(two, "IIT Bombay").map(f => f.name), ["NIT Trichy"]);
});

test("toggleFavourite refuses past the cap of 20", () => {
  const full = Array.from({ length: 20 }, (_, i) => ({ name: "I" + i, addedAt: i }));
  assert.equal(toggleFavourite(full, "one more").length, 20);
});

test("pruneFavourites drops names the dataset no longer has", () => {
  const { kept, removed } = pruneFavourites(
    [{ name: "Gone Institute" }, { name: "IIT Bombay" }], new Set(["IIT Bombay"]));
  assert.deepEqual(kept.map(f => f.name), ["IIT Bombay"]);
  assert.deepEqual(removed, ["Gone Institute"]);
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `node --test test/favourites.test.mjs`
Expected: FAIL — `parseRoute` is not exported.

- [ ] **Step 3: Implement the three functions in `src/core.js`**

`parseRoute` strips the leading `#`, splits on `/`, and returns `{view:"predict",arg:""}` for an empty or unknown hash. `toggleFavourite` returns the same array unchanged when adding would exceed 20. `pruneFavourites` partitions on a `Set` of known names.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/favourites.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Build the institute browser view**

Add a third primary tab `Institutes` with `data-view="institutes"`. Inside `#institutesView`: a `<div id="favGrid">` and a search input `#instSearch` plus type chips, then `<div id="instList">`. Render `favGrid` from `FAV`; when empty show one line — "No favourites yet. Search below, then tap the star." — as an empty state with no other action. Render `instList` from `INDEX.institutes` filtered by search and type, each row a `<a href="#institute/<slug>">` containing a star button. Wire both `renderStars()` and the grid to the same `toggleFavourite` call, then persist and re-render.

- [ ] **Step 6: Wire the router**

Add a `hashchange` listener plus one call on load. `parseRoute` decides the view; `institute` sets `location.hash` targets that Task 6 renders — until Task 6 lands, render a placeholder heading with the institution name so the route is provably reachable. Keep the existing `showView`/`showSection` functions and call them from the router; do not rewrite them.

- [ ] **Step 7: Prune on load and verify**

After `buildIndex`, call `pruneFavourites(FAV, new Set(INDEX.institutes.map(i=>i.name)))` and persist if anything was removed.

Run: `node --test test/` then open the page.
Expected: all tests pass; starring survives a reload; `#institute/iit-bombay` shows a heading; back button returns to the previous view.

- [ ] **Step 8: Commit**

```bash
git add src/core.js test/favourites.test.mjs index.html
git commit -m "Add favourites and hash routing"
```

---

### Task 6: Institute detail page with the cut-off graph

**Files:**
- Create: `test/chart.test.mjs`
- Modify: `index.html` (new section after the predictor)

**Interfaces:**
- Consumes: `buildInstituteSeries`, `seriesToPoints`, `sparkPath`.
- Produces: `renderInstitutePage(slug)` and `multiLineChart(box, {years, series, metric})`.

- [ ] **Step 1: Write the failing test** in `test/chart.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { sparkPath, seriesToPoints } from "../src/core.js";

test("sparkPath skips nulls without breaking the path", () => {
  const d = sparkPath([100, null, 50], 100, 20);
  assert.equal(d.split("M").length - 1, 2, "two spans either side of the gap");
  assert.ok(!d.includes("NaN"));
});

test("sparkPath of an all-null series is empty", () => {
  assert.equal(sparkPath([null, null], 100, 20), "");
});

test("seriesToPoints with one year centres the point", () => {
  assert.equal(seriesToPoints([2026], [500], 1000)[0].x, 0.5);
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `node --test test/chart.test.mjs`
Expected: FAIL — `sparkPath` is not exported.

- [ ] **Step 3: Implement `sparkPath` in `src/core.js`**

Splits the value list into runs of consecutive non-null values, emits one `M…L…` subpath per run, and returns `""` when there is nothing to draw. Coordinates are normalised then scaled by `w` and `h` with the same inverted log axis as `seriesToPoints`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/chart.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Build the detail page**

`renderInstitutePage(slug)` finds the institute in `INDEX`, sets the heading, the star toggle, the branch count, and renders: a control row (seat select, gender select, Closing/Opening toggle, branch search); the chart card; and the table card. The chart is a new `multiLineChart` built like the existing `lineChart` — `createElementNS`, theme tokens from `cssv`, hover `<title>` per point — but with a categorical x-axis of years, an inverted log y-axis, and one `<path>` per series. Each legend chip toggles its series with `aria-pressed`. Re-render the chart when the seat, gender or metric control changes.

- [ ] **Step 6: Build the table**

One row per branch, columns `Branch | 2020 … 2026`, each year cell showing `opening → closing` with a `▲`/`▼` and the delta against the previous non-null year, and `—` for a missing year. Cap the initial render at 12 branches with a "Show all N" button. Add the limit note: final round only; a dash means JoSAA allocated nothing for that combination that year.

- [ ] **Step 7: Verify against a real institute**

Run: `node tools/build.mjs`, open `#institute/indian-institute-of-technology-bombay`.
Expected: eight lines, distinct hues, hovering a point shows the year and rank, deselecting a legend chip removes exactly that line, switching to Opening moves the curves, and the table dashes line up with the gaps in the graph.

- [ ] **Step 8: Commit**

```bash
git add src/core.js index.html test/chart.test.mjs
git commit -m "Add institute detail page with multi-year cut-off graph"
```

---

### Task 7: Shell, metadata and craft pass

**Files:**
- Modify: `index.html` (CSS block, footer, `.primarynav`)
- Modify: `sw.js`
- Modify: `manifest.json`
- Create: `README.md`

- [ ] **Step 1: Add the styles**

Add `.star`, `.star[aria-pressed="true"]`, `.instlink`, `.spark`, `.favgrid`, `.favcard`, `.legendchip`, `.multi` blocks using only existing tokens. Star targets are at least `44px` tall on `pointer:coarse`. No gradients, no new hues outside the existing `--accent`/`--success`/`--attention`/`--done` family.

- [ ] **Step 2: Update the shell**

Set `#metaLine` from the decoded data. Update the footer to state the new data facts: seven years, final round each, 74,406 rows, ranks are JoSAA All India ranks not percentiles. Bump `VERSION` in `sw.js` to `jee-2027-v2`. Update `manifest.json` `description` to mention seven years of cut-offs.

- [ ] **Step 3: Write `README.md`**

State the one build command, the one test command, and that `index.html` is generated between the CORE/DATA markers and must not be hand-edited inside them.

- [ ] **Step 4: Verify both themes and keyboard**

Toggle dark mode and confirm the chart lines, legend chips and stars meet contrast against `#0d1117`. Tab through the predictor: star, institute link, year select, quota select and every legend chip must be reachable and operable with Enter/Space.

- [ ] **Step 5: Run the full suite and commit**

Run: `node --test test/`
Expected: PASS, all tests.
```bash
git add index.html sw.js manifest.json README.md
git commit -m "Polish shell, metadata and offline cache for the new build"
```
