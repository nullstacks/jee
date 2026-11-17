import test from "node:test";
import assert from "node:assert/strict";
import { sectionForView, NAV_ITEMS, tabItems } from "../src/lib/nav.ts";
import { parseRoute } from "../src/core.ts";

/* The nav highlight is derived from the resolved route, so these cases go
   through parseRoute the way the app does rather than assuming view names. */

test("the institutes list highlights Institutes, not Syllabus", () => {
  /* Regression: activeKey checked only "institute" (singular), so #institutes
     fell through to the default and the highlight stayed on Syllabus. */
  assert.equal(sectionForView(parseRoute("#institutes").view), "institutes");
});

test("an institute detail page highlights Institutes", () => {
  assert.equal(
    sectionForView(parseRoute("#institute/indian-institute-of-technology-bombay").view),
    "institutes",
  );
});

test("every top-level route highlights its own section", () => {
  assert.equal(sectionForView(parseRoute("#predict").view), "predict");
  assert.equal(sectionForView(parseRoute("#ranks/pwd").view), "ranks");
  assert.equal(sectionForView(parseRoute("#syllabus").view), "syllabus");
});

test("the short forms the tabs write resolve to the right section", () => {
  assert.equal(sectionForView(parseRoute("#syl").view), "syllabus");
  assert.equal(sectionForView(parseRoute("#inst").view), "institutes");
  assert.equal(sectionForView(parseRoute("#rank").view), "ranks");
});

test("a predictor URL carrying a query string still resolves to predict", () => {
  assert.equal(sectionForView(parseRoute("#predict?rank=42000&round=1").view), "predict");
});

test("an empty or unknown hash lands on the syllabus, same as the router", () => {
  assert.equal(sectionForView(parseRoute("").view), "syllabus");
  assert.equal(sectionForView(parseRoute("#nonsense").view), "syllabus");
});

test("every nav item's own hash round-trips to its own section", () => {
  /* Catches a nav entry pointing at a route that belongs somewhere else. */
  for (const item of NAV_ITEMS) {
    const view = parseRoute(item.hash).view;
    assert.equal(
      sectionForView(view),
      item.key,
      item.label + " (" + item.hash + ") resolved to " + sectionForView(view),
    );
  }
});

test("every route the router can resolve has a section", () => {
  const views = ["predict", "institutes", "institute", "ranks", "syllabus"];
  for (const v of views) {
    const s = sectionForView(v);
    assert.ok(
      NAV_ITEMS.some((i) => i.key === s),
      v + " resolved to " + s + ", which is not a nav item",
    );
  }
});

test("Cut-offs lands on the all-category view, not a PwD sub-tab", () => {
  /* The nav hash is what every "Cut-offs" link opens. It pointed at
     #ranks/pwd while the view defaulted to "all", so the menu, the URL and
     the page disagreed about what the section was. */
  const ranks = NAV_ITEMS.find((i) => i.key === "ranks");
  assert.equal(ranks.hash, "#ranks/all");
  assert.equal(parseRoute(ranks.hash).arg, "all");
});

test("the tab bar renders the same hashes as the header nav", () => {
  /* Both used to keep their own copy of the list, which is how one of them
     kept pointing at #ranks/pwd after the other was updated. */
  const tabs = tabItems();
  assert.equal(tabs.length, NAV_ITEMS.length);
  for (let i = 0; i < tabs.length; i++) {
    assert.equal(tabs[i].hash, NAV_ITEMS[i].hash, tabs[i].key + " hash drifted");
    assert.equal(tabs[i].key, NAV_ITEMS[i].key);
    assert.ok(tabs[i].tabLabel && tabs[i].tabLabel.length > 0, tabs[i].key + " has no tab label");
  }
});
