import { useMemo, useState } from "react";
import {
  ALL_YEARS,
  CHAPTER_COUNT,
  FIRST_YEAR,
  LAST_YEAR,
  PRIO_LABEL,
  RECENT_YEARS,
  SUBJECT_KEYS,
  SUBJECT_LABEL,
  TOTAL_ANALYSED,
  chapterHref,
  matchesQuery,
  priorityOf,
  recentRate,
  recentShare,
  rowsForSubject,
  yearSeries,
  type ChapterReport,
  type Prio,
  type SubjectKey,
} from "../lib/reports";
import { groupByUnit, readingOrder, scopeLine, sortChapters } from "../lib/syllabus";
import { navigate } from "../lib/hooks";
import { ChapterSpark } from "../components/ReportCharts";
import {
  ArrowRightIcon,
  BookIcon,
  CheckIcon,
  ChevronRightIcon,
  ResetIcon,
  SearchIcon,
  SortIcon,
} from "../components/icons";
import { Button, Card, Chip, EmptyState, PageHead, Segmented, SearchInput } from "../components/ui";
import type { ViewProps } from "../App";

type Filter = "A" | Prio;

const ORDER_LABEL: Record<Order, string> = {
  sequence: "Read in order",
  weight: "By weight",
  unit: "By unit",
  name: "A–Z",
};
type Order = "sequence" | "weight" | "unit" | "name";

export function ChaptersView({ progress }: ViewProps) {
  const [subject, setSubject] = useState<SubjectKey>("physics");
  const [filter, setFilter] = useState<Filter>("A");
  const [order, setOrder] = useState<Order>("sequence");
  const [query, setQuery] = useState("");
  const [armed, setArmed] = useState(false);

  const all = useMemo(() => rowsForSubject(subject), [subject]);

  /* One shared y-scale per subject, so the sparklines in a column compare. */
  const sparkScale = useMemo(() => Math.max(1, ...all.flatMap((r) => r.series.map((y) => y.q))), [all]);

  /* Sequence is the default because the list is a revision plan, not a
     ranking: it walks the syllabus in teaching order and only then sorts a
     unit by weight. The other modes are for looking something up. */
  const sequence = useMemo(
    () => readingOrder(subject, all.map((row) => row.report)),
    [subject, all],
  );

  const shown = useMemo(() => {
    const kept = sequence
      .filter((report) => filter === "A" || priorityOf(report) === filter)
      .filter((report) => matchesQuery(report, query));
    if (order === "sequence") return kept;
    return sortChapters(kept, order, recentRate, priorityOf);
  }, [sequence, filter, order, query]);

  /* Position within the whole sequence, so a filtered list still says where
     each chapter sits in the plan. */
  const positions = useMemo(() => {
    const map = new Map<string, number>();
    sequence.forEach((report, i) => map.set(report.id, i + 1));
    return map;
  }, [sequence]);

  const done = progress.doneIn(subject);
  const total = progress.totalIn(subject);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const queried = query.trim().length > 0;

  /* Sequence and unit order both read as headed blocks — that is the whole
     point of them. Weight and A–Z stay one flat list.

     Bucket by unit rather than cutting the list wherever the unit changes.
     Running the sequence straight through puts Functions (Calculus) between
     Logarithm and Matrices (Algebra), which used to split Algebra into two
     headings that also shared one React key — and a duplicate key is what
     made a subject switch leave the previous subject's rows on screen. */
  const grouped = useMemo(() => {
    if (order !== "unit" && order !== "sequence") return null;
    return groupByUnit(subject, shown).map((unit) => ({ title: unit.title, rows: unit.chapters }));
  }, [shown, order, subject]);

  return (
    <div className="shell view view-chapters">
      <PageHead
        eyebrow={
          <>
            <BookIcon size={13} /> {CHAPTER_COUNT} chapters · {TOTAL_ANALYSED.toLocaleString("en-IN")} question
            {TOTAL_ANALYSED === 1 ? "" : "s"} from {FIRST_YEAR}–{LAST_YEAR}
          </>
        }
        title="Every chapter, ranked by what actually gets asked"
        lede="Each chapter is a report built from every JEE Main and AIEEE question in it — read one by one, tagged by topic, then counted. Open a chapter to see how its weight moved, which topics carry it, and what a question from it looks like."
      />

      <Card flush className="lib">
        <div className="lib-bar">
          <Segmented
            label="Subject"
            value={subject}
            onChange={setSubject}
            options={SUBJECT_KEYS.map((s) => ({
              value: s,
              label: SUBJECT_LABEL[s],
              count: progress.bySubject[s] + "/" + progress.totalIn(s),
            }))}
          />
          <div className="lib-actions">
            <Button
              variant="quiet"
              size="sm"
              pressed={order !== "sequence"}
              icon={<SortIcon size={14} />}
              onClick={() =>
                setOrder(
                  order === "sequence"
                    ? "weight"
                    : order === "weight"
                      ? "unit"
                      : order === "unit"
                        ? "name"
                        : "sequence",
                )
              }
              title="Change the order this list reads in"
            >
              {ORDER_LABEL[order]}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              icon={<ResetIcon size={14} />}
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  window.setTimeout(() => setArmed(false), 2600);
                  return;
                }
                setArmed(false);
                progress.reset(subject);
              }}
            >
              {armed ? "Tap again to clear" : "Reset"}
            </Button>
          </div>
        </div>

        <div className="lib-sub">
          <div className="filter-chips" role="group" aria-label="Filter by priority">
            {(
              [
                ["A", "All " + all.length],
                ["H", "High"],
                ["M", "Medium"],
                ["L", "Low"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <Chip key={value} pressed={filter === value} onClick={() => setFilter(value)}>
                {label}
              </Chip>
            ))}
          </div>

          <div className="lib-search">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              label={"Search " + SUBJECT_LABEL[subject] + " chapters"}
              placeholder="Chapter or topic…"
            />
          </div>

          <div className="lib-progress">
            <span className="num lib-progress-text" aria-live="polite">
              {done} of {total} closed
            </span>
            <span className="meter" aria-hidden="true">
              <i style={{ width: percent + "%" }} />
            </span>
          </div>
        </div>

        {order === "sequence" ? (
          <p className="lib-hint">
            <b>Read in order.</b> The number is where the chapter sits in a study plan: each unit is
            walked in the order it is taught, foundations before the chapters that reuse them. That
            is not the same list as the weight ranking —{" "}
            <button type="button" className="lib-hint-link" onClick={() => setOrder("weight")}>
              switch to by weight
            </button>{" "}
            to see them purely as they score.
          </p>
        ) : order === "unit" ? (
          <p className="lib-hint">
            <b>By unit.</b> Chapters sit under the unit the report files them in, in syllabus order.
          </p>
        ) : null}

        {shown.length ? (
          grouped ? (
            grouped.map((group) => (
              <section key={group.title} className="chapter-group">
                {/* h2, not h3: the page's only h1 is the PageHead title, so an
                    h3 here skipped a level. The unit headings are the last
                    heading on the page, one rank under the page title. */}
                <h2 className="chapter-group-title">
                  {group.title}
                  <span className="num">{group.rows.length}</span>
                </h2>
                {/* The rows are <li>s, so they need a list of their own. A bare
                    <li> under <section> is invalid markup and drops the list
                    semantics a screen reader announces the count from. */}
                <ol className="chapter-list">
                  {group.rows.map((report) => (
                    <ChapterRow
                      key={report.id}
                      report={report}
                      progress={progress}
                      sparkScale={sparkScale}
                      position={order === "sequence" ? positions.get(report.id) : undefined}
                    />
                  ))}
                </ol>
              </section>
            ))
          ) : (
            <ol className="chapter-list">
              {shown.map((report) => (
                <ChapterRow
                  key={report.id}
                  report={report}
                  progress={progress}
                  sparkScale={sparkScale}
                  position={order === "sequence" ? positions.get(report.id) : undefined}
                />
              ))}
            </ol>
          )
        ) : (
          <EmptyState
            icon={<SearchIcon size={20} />}
            title={queried ? "No chapter matches “" + query + "”" : "No " + PRIO_LABEL[filter as Prio] + " chapters in " + SUBJECT_LABEL[subject]}
            action={
              <Button
                onClick={() => {
                  setQuery("");
                  setFilter("A");
                }}
              >
                {queried ? "Clear the search" : "Show every chapter"}
              </Button>
            }
          >
            {queried
              ? "Search looks at chapter names, units and every topic inside them — try a topic like “dipole” or “isomerism”."
              : "Every chapter of this subject sits in another priority band; widen the filter to see them."}
          </EmptyState>
        )}
      </Card>

      <div className="syl-key">
        {(Object.keys(PRIO_LABEL) as Prio[]).map((p) => (
          <p key={p}>
            <span className="prio" data-prio={p}>
              {PRIO_LABEL[p]}
            </span>
            <span>
              {p === "H"
                ? "4.5 % or more of this subject's last three papers. Start here."
                : p === "M"
                  ? "1.5–4.5 % of recent papers. Cover once the high set is done."
                  : "Under 1.5 % — occasional, shrinking, or dropped from the syllabus."}
            </span>
          </p>
        ))}
      </div>

      <div className="syl-next">
        <p>
          Ticks are saved in this browser only. Priorities are counted from {ALL_YEARS[0]}–
          {ALL_YEARS[ALL_YEARS.length - 1]} past papers, not published by NTA.
        </p>
        <Button
          variant="secondary"
          size="sm"
          trailing={<ArrowRightIcon size={14} />}
          onClick={() => navigate("#predict")}
        >
          Have a rank? Try the predictor
        </Button>
      </div>
    </div>
  );
}

function ChapterRow({
  report,
  progress,
  sparkScale,
  position,
}: {
  report: ChapterReport;
  progress: ViewProps["progress"];
  sparkScale: number;
  /** 1-based slot in the reading order; absent in the lookup orders. */
  position?: number;
}) {
  const isDone = progress.isDone(report.id);
  const prio = priorityOf(report);
  const rate = recentRate(report);

  return (
    <li className="chapter" data-done={isDone || undefined}>
      <label className="chapter-main">
        {position != null ? (
          <span className="chapter-step num" aria-hidden="true">
            {position}
          </span>
        ) : null}
        <span className="checkbox">
          <input
            type="checkbox"
            checked={isDone}
            aria-label={report.chapter + " done"}
            onChange={() => progress.toggle(report.id)}
          />
          <span className="checkbox-box" aria-hidden="true">
            <CheckIcon size={11} />
          </span>
        </span>
        <span className="chapter-text">
          <a
            className="chapter-name"
            href={chapterHref(report.id)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              navigate(chapterHref(report.id));
            }}
          >
            {report.chapter}
          </a>
          <span className="chapter-topics">{scopeLine(report)}</span>
        </span>
      </label>

      <span className="chapter-figures">
        <span className="chapter-spark" title={report.chapter + " questions per year"}>
          <ChapterSpark series={yearSeries(report)} scale={sparkScale} />
        </span>
        <span className="chapter-rate num" title={"Average in " + RECENT_YEARS[0] + "–" + RECENT_YEARS[RECENT_YEARS.length - 1]}>
          {rate.toFixed(1)}
          <span className="chapter-rate-unit">/yr</span>
        </span>
        <span className="chapter-share num" title={recentShare(report).toFixed(1) + "% of this subject's recent papers"}>
          {recentShare(report).toFixed(1)}%
        </span>
      </span>

      <span className="prio" data-prio={prio}>
        {PRIO_LABEL[prio]}
      </span>

      <a
        className="chapter-open"
        href={chapterHref(report.id)}
        aria-label={"Open the report for " + report.chapter}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          navigate(chapterHref(report.id));
        }}
      >
        <ChevronRightIcon size={15} />
      </a>
    </li>
  );
}