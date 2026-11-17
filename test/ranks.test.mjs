import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES,
  CATEGORY_BY_KEY,
  CRL,
  PWD_QUALIFIED,
  TOTAL_POOL,
  TOTAL_QUALIFIED,
  categoryRank,
  convert,
  interpRank,
  isCategoryKey,
} from "../src/lib/percentile.ts";

/* The figures in CATEGORIES are transcribed from the NTA JEE (Main) 2026
   Paper-1 result notice. These two identities are the whole reason the table
   can be trusted: NTA published the category rows AND the totals, so if a
   number is mistyped the sums stop matching. A wrong rank here is something
   a reader plans a year of study around, so it should fail the build. */

test("category qualifiers sum to the official JEE Advanced total", () => {
  const sum = CATEGORIES.reduce((n, c) => n + c.qualified, 0) + PWD_QUALIFIED;
  assert.equal(sum, TOTAL_QUALIFIED);
});

test("category pools sum to the official appeared total", () => {
  const sum = CATEGORIES.reduce((n, c) => n + c.pool, 0);
  assert.equal(sum, TOTAL_POOL);
});

test("every category is a key the picker can select", () => {
  for (const c of CATEGORIES) assert.ok(isCategoryKey(c.key), c.key);
  assert.equal(isCategoryKey("OPEN (PwD)"), false);
  assert.equal(isCategoryKey(""), false);
});

test("a percentile ranking on a category's own cutoff is that category's qualifier count", () => {
  /* The one hard anchor NTA gives: `qualified` people cleared the cutoff, so
     the last of them is rank `qualified`. General is exempt because it is the
     raw CRL and is scaled by the pool, not by the qualifier count. */
  for (const c of CATEGORIES) {
    if (c.key === "OPEN") continue;
    const rank = categoryRank(c.key, c.cutoff);
    assert.equal(rank, c.qualified, c.key);
  }
  const general = categoryRank("OPEN", CATEGORY_BY_KEY.OPEN.cutoff);
  assert.ok(Math.abs(general - CATEGORY_BY_KEY.OPEN.qualified) / CATEGORY_BY_KEY.OPEN.qualified < 0.05);
});

test("rank never falls as percentile rises, and never leaves the pool", () => {
  for (const c of CATEGORIES) {
    const cap = c.key === "OPEN" ? TOTAL_POOL : c.pool;
    let prev = null;
    for (let p = 100; p >= 0; p -= 0.25) {
      const rank = categoryRank(c.key, p);
      assert.ok(rank >= 1, c.key + " rank below 1 at " + p);
      assert.ok(rank <= cap, c.key + " rank " + rank + " past pool " + cap + " at " + p);
      /* Walking percentiles downward, the rank must never shrink. Seed with
         null rather than Infinity so the first sample has nothing to beat. */
      if (prev !== null) {
        assert.ok(rank >= prev, c.key + " rank fell from " + prev + " to " + rank + " at " + p);
      }
      prev = rank;
    }
  }
});

test("reserved categories order by pool size at every percentile", () => {
  /* The invariant is the pool, not the reservation percentage: a shorter list
     means a better rank. OBC-NCL therefore ranks worse than EWS despite a
     nearly identical cutoff, because 6.1 lakh OBC candidates chase their list
     while only 1.8 lakh chase the EWS one.

     General is deliberately excluded. Its rank is the raw CRL over every
     candidate who appeared, not a rank inside the 5.38 lakh General pool, so
     against the reserved lists it is not comparable point-for-point — at 99
     percentile a General candidate is CRL 15,957 while the OBC list only runs
     to rank 3,676. Asserting General is always worst was wrong; asserting the
     reserved lists among themselves order by pool is the true invariant. */
  const reserved = CATEGORIES.filter((c) => c.key !== "OPEN").sort((a, b) => b.pool - a.pool);
  for (let p = 99; p >= 1; p -= 1) {
    for (let i = 1; i < reserved.length; i++) {
      const worse = categoryRank(reserved[i - 1].key, p);
      const better = categoryRank(reserved[i].key, p);
      assert.ok(
        worse >= better,
        "pool order broke at " + p + ": " + reserved[i - 1].key + " " + worse + " < " + reserved[i].key + " " + better,
      );
    }
  }
});

test("General is never a better rank than the whole population allows", () => {
  /* The CRL is the unfiltered list, so it must be the worst rank available
     once the category lists are shorter than it. Above 90 percentile the
     reserved lists are all shorter, so General is worst there. */
  for (let p = 90; p >= 1; p -= 1) {
    const general = categoryRank("OPEN", p);
    for (const c of CATEGORIES) {
      if (c.key === "OPEN") continue;
      assert.ok(general >= categoryRank(c.key, p), "General beat " + c.key + " at " + p);
    }
  }
});

test("the CRL curve is monotonic and keeps every published point", () => {
  assert.equal(CRL.length, 18);
  for (let i = 1; i < CRL.length; i++) {
    assert.ok(CRL[i][0] < CRL[i - 1][0], "percentiles must fall: " + i);
    assert.ok(CRL[i][1] > CRL[i - 1][1], "ranks must rise: " + i);
  }
  /* The tail of the curve is the whole candidate population. */
  assert.ok(Math.abs(CRL[CRL.length - 1][1] - TOTAL_POOL) / TOTAL_POOL < 0.02);
});

test("scaling the CRL to 2026 still lands on the independent reference ranks", () => {
  /* College Pravesh publishes a 2026 CRL at 99/95/90 percentile. The curve is
     scaled from 2025 by the change in pool, so these are a genuine outside
     check on that scaling rather than a restatement of it. */
  const anchors = [
    [99, 16015],
    [95, 78356],
    [90.02, 155011],
  ];
  for (const [p, expected] of anchors) {
    const got = interpRank(CRL, p);
    assert.ok(
      Math.abs(got - expected) / expected < 0.03,
      "CRL at " + p + " was " + got + ", reference " + expected,
    );
  }
});

test("convert() exposes one standing per category and a consistent CRL", () => {
  const c = convert(90);
  assert.equal(c.categories.length, CATEGORIES.length);
  assert.equal(c.crl, categoryRank("OPEN" , 90));
  for (const s of c.categories) {
    assert.equal(s.qualified, 90 >= s.meta.cutoff, s.meta.key + " eligibility flag");
  }
});

test("the cutoff flag flips exactly at each category's cutoff", () => {
  for (const c of CATEGORIES) {
    const justBelow = convert(c.cutoff - 0.01).categories.find((s) => s.meta.key === c.key);
    const atCutoff = convert(c.cutoff).categories.find((s) => s.meta.key === c.key);
    assert.equal(justBelow.qualified, false, c.key);
    assert.equal(atCutoff.qualified, true, c.key);
  }
});
