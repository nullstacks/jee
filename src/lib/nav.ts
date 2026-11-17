/* Which top-level section owns a route.

   This lived as a duplicated helper in both the header nav and the mobile tab
   bar, and both copies checked only the singular "institute" — so the
   institutes *list* (#institutes) highlighted Syllabus while the detail page
   (#institute/<slug>) was correct. Duplicating the rule is what let the two
   drift, so it now has one home and the fallback is a test failure rather
   than a silent wrong answer. */

export type Section = "predict" | "institutes" | "ranks" | "syllabus";

/* Every route name parseRoute can produce, mapped to its owning section. */
const SECTION_BY_VIEW: Record<string, Section> = {
  predict: "predict",
  institutes: "institutes",
  /* The detail page is a child of the institutes section, not a peer. */
  institute: "institutes",
  ranks: "ranks",
  syllabus: "syllabus",
  /* A chapter report is a child of the chapter list, not a peer section. */
  report: "syllabus",
  /* parseRoute normalises the hash to this canonical name. */
  "": "syllabus",
};

export const CANONICAL_VIEWS: string[] = Object.keys(SECTION_BY_VIEW).filter(Boolean);

export function sectionForView(view: string): Section {
  const hit = SECTION_BY_VIEW[view];
  if (hit) return hit;
  /* Unknown view: the router falls back to the syllabus, so the nav does too. */
  return "syllabus";
}

/* The one place a section's landing hash is written.

   Header and TabBar both render this list; they only differ in which icon
   component they attach and what they call the labels. Keeping the hashes
   here is what stops the desktop nav and the phone tab bar from pointing at
   different places — Cut-offs used to land on #ranks/pwd in two files and on
   #ranks/all in the view's own section list, so "Cut-offs" opened the PwD
   tab while the URL bar and every link disagreed about what the section was. */
export const NAV_ITEMS: { key: Section; label: string; hash: string }[] = [
  { key: "predict", label: "Predictor", hash: "#predict" },
  { key: "institutes", label: "Institutes", hash: "#institutes" },
  { key: "ranks", label: "Cut-offs", hash: "#ranks/all" },
  { key: "syllabus", label: "Chapters", hash: "#syllabus" },
];

/* The label each section wears in the phone tab bar, where there is no room
   for the desktop wording. Falls back to the nav label. */
const TAB_LABEL: Record<Section, string> = {
  predict: "Predict",
  institutes: "Institutes",
  ranks: "Cut-offs",
  syllabus: "Chapters",
};

export function tabItems() {
  return NAV_ITEMS.map((item) => ({ ...item, tabLabel: TAB_LABEL[item.key] }));
}