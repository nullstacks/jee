import { useMemo, useState, type ReactNode } from "react";
import {
  PRIO_LABEL,
  REPORT_BY_ID,
  RECENT_YEARS,
  SUBJECT_LABEL,
  askedEveryYear,
  chapterHref,
  dominantTopic,
  lastAsked,
  neighbours,
  numericalShare,
  peakYear,
  priorityOf,
  recentQuestions,
  recentRate,
  recentShare,
  topThreeShare,
  yearSeries,
  type ChapterReport,
  type TopicDetail,
} from "../lib/reports";
import { navigate, useElementWidth } from "../lib/hooks";
import { ChapterSpark, TopicBars, TopicMatrix, YearBars } from "../components/ReportCharts";
import {
  AlertIcon,
  ArrowRightIcon,
  BookIcon,
  ChartIcon,
  ChevronLeftIcon,
  LayersIcon,
  SparkIcon,
  TrendIcon,
} from "../components/icons";
import {
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  Notice,
  Segmented,
  useAnnounce,
} from "../components/ui";
import type { ViewProps } from "../App";

export function ReportView({ arg, progress }: ViewProps) {
  const report = useMemo(() => findReport(arg), [arg]);

  if (!report) {
    return (
      <div className="shell view">
        <EmptyState
          icon={<BookIcon size={22} />}
          title="That chapter is not in the archive"
          action={<Button onClick={() => navigate("#syllabus")}>Back to every chapter</Button>}
        >
          The link points at a report this build does not carry — the chapter may have been renamed.
        </EmptyState>
      </div>
    );
  }

  return <ReportBody report={report} progress={progress} />;
}

function findReport(arg: string): ChapterReport | null {
  const clean = arg.replace(/\/+$/, "").trim();
  if (!clean) return null;
  return REPORT_BY_ID.get(clean.toLowerCase()) ?? null;
}

function ReportBody({ report, progress }: { report: ChapterReport; progress: ViewProps["progress"] }) {
  const [metric, setMetric] = useState<"count" | "share">("count");
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>(560);
  const announce = useAnnounce();

  const prio = priorityOf(report);
  const rate = recentRate(report);
  const recent = recentQuestions(report);
  const peak = peakYear(report);
  const last = lastAsked(report);
  const everyYear = askedEveryYear(report);
  const dominant = dominantTopic(report);
  const top3 = topThreeShare(report);
  const numerical = numericalShare(report);
  const { prev, next } = neighbours(report);

  const years = report.years.map((y) => y.year);
  const done = progress.isDone(report.id);

  const trend = useMemo(() => {
    if (report.years.length < 4) return null;
    const half = Math.floor(report.years.length / 2);
    const early = report.years.slice(0, half);
    const late = report.years.slice(-half);
    const avg = (list: { q: number }[]) => list.reduce((n, y) => n + y.q, 0) / Math.max(1, list.length);
    const a = avg(early);
    const b = avg(late);
    return { early: a, late: b, delta: b - a };
  }, [report.years]);

  return (
    <div className="shell view view-report">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a
          href="#syllabus"
          onClick={(e) => {
            e.preventDefault();
            navigate("#syllabus");
          }}
        >
          <ChevronLeftIcon size={13} /> All chapters
        </a>
        <span aria-hidden="true">/</span>
        <span>{SUBJECT_LABEL[report.subject]}</span>
        <span aria-hidden="true">/</span>
        <span>{report.unit}</span>
      </nav>

      <header className="report-head">
        <div className="report-head-text">
          <h1>{report.chapter}</h1>
          <p className="lede">{lede(report, rate, last)}</p>
          <p className="page-meta">
            <ChartIcon size={13} /> PYQ topic analysis · {report.span}
          </p>
          <div className="report-tags">
            <span className="prio" data-prio={prio}>
              {PRIO_LABEL[prio]} priority
            </span>
            <Badge tone="neutral" mono>
              {recentRate(report).toFixed(1)} / year
            </Badge>
            <Badge tone="neutral" mono>
              {recentShare(report).toFixed(1)}% of subject
            </Badge>
            <Badge tone="neutral">{report.unit}</Badge>
            {report.unlabelled ? <Badge tone="mod">Not hand-labelled</Badge> : null}
          </div>
        </div>
        <div className="report-head-actions">
          <Button
            variant={done ? "primary" : "secondary"}
            size="sm"
            pressed={done}
            icon={done ? <TrendIcon up /> : undefined}
            onClick={() => {
              const now = progress.toggle(report.id);
              announce(now ? report.chapter + " marked as closed" : report.chapter + " reopened");
            }}
          >
            {done ? "Closed out" : "Mark as closed"}
          </Button>
        </div>
      </header>

      {report.unlabelled ? (
        <Notice tone="caution" icon={<AlertIcon size={15} />} title="This chapter is not labelled yet.">
          Every topic table below comes from automatic clustering, not from reading the questions. The
          report itself says not to use these numbers — the year totals are real, the topic split is not.
        </Notice>
      ) : null}

      <div className="stat-row report-stats">
        <Stat label="Questions since 2019" value={report.analysed.toLocaleString("en-IN")} hint={"of " + report.questionsInFile + " in the file"} />
        <Stat
          label={"Per year, " + RECENT_YEARS[0] + "–" + RECENT_YEARS[RECENT_YEARS.length - 1]}
          value={rate.toFixed(1)}
          hint={recent + " in the last three papers"}
        />
        <Stat label="Numerical share" value={numerical.toFixed(0) + "%"} hint={numerical >= 25 ? "numerical-heavy" : "mostly MCQ"} />
        <Stat label="Peak year" value={peak ? peak.year : "—"} hint={peak ? peak.q + " questions" : "no questions"} />
      </div>

      <Card>
        <CardHead
          level={2}
          title="Questions per year"
          note="Every season since 2019. The trend line under the chart compares the first half of the record with the second."
          trailing={
            <span className="chart-note num">
              {report.years.length} season{report.years.length === 1 ? "" : "s"}
            </span>
          }
        />
        <div className="chart-host" ref={chartRef}>
          <YearBars years={report.years} width={Math.max(320, chartWidth)} label={report.chapter + " questions per year"} />
        </div>
        <div className="report-insights">
          {everyYear ? (
            <p>
              <SparkIcon size={14} /> Asked in every season of the recent window
              {" (" + RECENT_YEARS[0] + "–" + RECENT_YEARS[RECENT_YEARS.length - 1] + ")"}.
            </p>
          ) : last ? (
            <p>
              <SparkIcon size={14} /> Last asked in <b>{last}</b>
              {last < RECENT_YEARS[RECENT_YEARS.length - 1]
                ? " — a gap of " + (RECENT_YEARS[RECENT_YEARS.length - 1] - last) + " season(s)."
                : "."}
            </p>
          ) : (
            <p>
              <SparkIcon size={14} /> No questions from 2019 onwards in this file.
            </p>
          )}
          {trend ? (
            <p>
              <TrendIcon up={trend.delta >= 0} size={14} /> Averaged <b>{trend.early.toFixed(1)}</b> per year
              early in the record and <b>{trend.late.toFixed(1)}</b> late —{" "}
              {Math.abs(trend.delta) < 0.6
                ? "flat."
                : (trend.delta > 0 ? "up by " : "down by ") + Math.abs(trend.delta).toFixed(1) + " per year."}
            </p>
          ) : null}
          <p>
            <LayersIcon size={14} /> {report.topics.length} topics, {report.detail.reduce((n, d) => n + d.subtopics.length, 0)} sub-topics.
          </p>
        </div>
      </Card>

      <Card>
        <CardHead
          level={2}
          title="Where the questions come from"
          note={
            dominant
              ? "“" + dominant.name + "” alone is " + dominant.share.toFixed(1) + "% of this chapter; the top three are " + top3.toFixed(1) + "%."
              : "No topic split published for this chapter."
          }
        />
        <div className="report-split">
          <TopicBars topics={report.topics} total={report.analysed} />
          <div className="report-split-side">
            <div className="mini-card">
              <p className="mini-label">Share of the chapter</p>
              <ChapterBarsDonut topics={report.topics} />
            </div>
            <div className="mini-card">
              <p className="mini-label">Year by year</p>
              <div className="mini-spark">
                <ChapterSpark
                  series={yearSeries(report)}
                  scale={Math.max(1, ...yearSeries(report).map((y) => y.q))}
                  height={52}
                />
              </div>
              <p className="mini-note">
                {report.years.length} season{report.years.length === 1 ? "" : "s"}, peak{" "}
                {peak ? peak.q + " in " + peak.year : "—"}.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          level={2}
          title="Year × topic"
          note="One row per topic, one column per season. Reads down a column to see a paper, across a row to see whether a topic is growing or fading."
          trailing={
            <Segmented
              label="Cell value"
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[
                { value: "count", label: "Count" },
                { value: "share", label: "Share" },
              ]}
            />
          }
        />
        <TopicMatrix years={years} topics={report.topics} matrix={report.matrix} metric={metric} />
      </Card>

      <div className="topic-detail-head">
        <h2>Topic by topic</h2>
        <p>
          Each topic with its own sub-topics and a real question from the archive, trimmed to the point
          where it stops being useful.
        </p>
      </div>

      <div className="topic-detail">
        {report.detail.map((topic, i) => (
          <TopicBlock key={topic.name + i} topic={topic} rank={i + 1} total={report.analysed} />
        ))}
      </div>

      {report.pattern.length ? (
        <Card className="pattern-card">
          <CardHead level={2} title="What the pattern shows" note="Straight from the report, unedited." />
          <ul className="pattern-list">
            {report.pattern.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHead level={2} title="How this report was built" note="So you can judge what the numbers mean." />
        <dl className="meta-grid">
          <Meta term="Chapter" value={report.chapter} />
          <Meta term="Unit" value={report.unit} />
          <Meta term="Exams covered" value={report.exams} />
          <Meta term="Questions in file" value={String(report.questionsInFile)} />
          <Meta term="Analysed (2019+)" value={String(report.analysed)} />
          <Meta term="Excluded (pre-2019)" value={String(report.excluded)} />
          <Meta term="Grouping" value={report.grouping} />
          <Meta term="Source" value={report.file} />
        </dl>
      </Card>

      <nav className="report-nav" aria-label="Other chapters">
        {prev ? (
          <a
            className="report-nav-item"
            href={chapterHref(prev.id)}
            onClick={(e) => {
              e.preventDefault();
              navigate(chapterHref(prev.id));
            }}
          >
            <span className="report-nav-label">
              <ChevronLeftIcon size={13} /> Heavier
            </span>
            <span className="report-nav-name">{prev.chapter}</span>
            <span className="report-nav-meta num">{recentRate(prev).toFixed(1)} / year</span>
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a
            className="report-nav-item report-nav-item-next"
            href={chapterHref(next.id)}
            onClick={(e) => {
              e.preventDefault();
              navigate(chapterHref(next.id));
            }}
          >
            <span className="report-nav-label">
              Lighter <ArrowRightIcon size={13} />
            </span>
            <span className="report-nav-name">{next.chapter}</span>
            <span className="report-nav-meta num">{recentRate(next).toFixed(1)} / year</span>
          </a>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

function TopicBlock({ topic, rank, total }: { topic: TopicDetail; rank: number; total: number }) {
  const [open, setOpen] = useState(rank <= 2);
  const share = total ? (topic.q / total) * 100 : 0;

  return (
    <section className="topic-block" data-open={open || undefined}>
      <button
        type="button"
        className="topic-block-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="topic-block-rank num">{rank}</span>
        <span className="topic-block-title">{topic.name}</span>
        <span className="topic-block-figs num">
          {topic.q}
          <span className="topic-block-pct">{share.toFixed(1)}%</span>
        </span>
        <span className="topic-block-meter" aria-hidden="true">
          <i style={{ width: Math.max(2, (share / 100) * 100) + "%" }} />
        </span>
        <span className="topic-block-toggle" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <div className="topic-block-body">
          <p className="topic-block-meta num">
            MCQ {topic.mcq} · Numerical {topic.num} ·{" "}
            {topic.years.map((y) => y.year + " (" + y.q + ")").join(", ")}
          </p>

          {topic.subtopics.length ? (
            <ul className="subtopics">
              {topic.subtopics.map((sub) => (
                <li key={sub.name}>
                  <span className="subtopic-name">{sub.name}</span>
                  <span className="subtopic-bar" aria-hidden="true">
                    <i style={{ width: Math.max(2, sub.share) + "%" }} />
                  </span>
                  <span className="subtopic-value num">
                    {sub.q}
                    <span className="subtopic-pct">{sub.share.toFixed(1)}%</span>
                  </span>
                  <span className="subtopic-years">{sub.span}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {topic.examples.length ? (
            <div className="examples">
              <p className="examples-title">
                <SparkIcon size={13} /> Straight from a paper
              </p>
              {topic.examples.map((example, i) => (
                <blockquote key={i} className="example">
                  <span className="example-tag num">
                    {example.year} · {example.type}
                  </span>
                  <p>{renderQuestion(example.text)}</p>
                </blockquote>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* Questions were stripped of their math and figures when the archive was
   built, so the text sometimes reads as "Two point charges and are placed".
   Wide gaps left by a dropped formula are collapsed to a single marker rather
   than pretending the sentence is intact. */
function renderQuestion(text: string) {
  const cleaned = text.replace(/\s{2,}/g, " ⟦·⟧ ").replace(/⟦·⟧ (?=[,.])/g, "");
  return cleaned;
}

function ChapterBarsDonut({ topics }: { topics: { name: string; share: number }[] }) {
  const top = topics.slice(0, 5);
  const rest = topics.slice(5).reduce((n, t) => n + t.share, 0);
  const rows = rest > 0.05 ? [...top, { name: "Everything else", share: rest }] : top;

  return (
    <ul className="donut-legend">
      {rows.map((row, i) => (
        <li key={row.name}>
          <i data-i={i % 6} aria-hidden="true" />
          <span className="donut-name" title={row.name}>
            {row.name}
          </span>
          <span className="donut-value num">{row.share.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

/* The report's own summary paragraph lists every topic with its count, which
   is exactly what the topic bars say two screens down. The page leads with
   the one sentence a reader needs instead: how big it is and how alive it is. */
function lede(report: ChapterReport, rate: number, last: number | null): string {
  if (!report.analysed) {
    return "No question from 2019 onwards sits in this chapter's file" +
      (report.excluded ? " — all " + report.excluded + " of them predate the archive window." : ".");
  }
  const span = report.years.length;
  const peak = peakYear(report);
  const alive =
    last === null
      ? ""
      : last >= RECENT_YEARS[RECENT_YEARS.length - 1]
        ? " It appeared in " + last + "."
        : " Its last appearance was " + last + ".";
  return (
    report.analysed + " questions across " + span + " season" + (span === 1 ? "" : "s") +
    " — about " + rate.toFixed(1) + " a year lately, peaking at " +
    (peak ? peak.q + " in " + peak.year : "—") + "." + alive
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">
        {label}
        {hint ? <span className="stat-hint">{hint}</span> : null}
      </span>
      <span className="stat-value num">{value}</span>
    </div>
  );
}

function Meta({ term, value }: { term: string; value: string }) {
  return (
    <div className="meta-cell">
      <dt>{term}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}