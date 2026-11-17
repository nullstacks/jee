import { useEffect, useMemo, useRef, useState } from "react";

import { parseRoute } from "./core";
import { useHash, useScrolled } from "./lib/hooks";
import { useTheme } from "./lib/theme";
import { useFavourites } from "./lib/favourites";
import { useProgress } from "./lib/progress";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { AnnounceProvider } from "./components/ui";
import { ScrollTop } from "./components/ScrollTop";

import { PredictView } from "./views/PredictView";
import { InstitutesView } from "./views/InstitutesView";
import { InstituteView } from "./views/InstituteView";
import { RanksView } from "./views/RanksView";
import { ChaptersView } from "./views/ChaptersView";
import { ReportView } from "./views/ReportView";

export type ViewProps = {
  /** Everything after the view name in the hash, including any query string. */
  arg: string;
  favourites: ReturnType<typeof useFavourites>;
  progress: ReturnType<typeof useProgress>;
};

/* The Cut-offs view owns its own section list, so the router must not
   second-guess it. It used to coerce the arg against a hard-coded list here
   and default to "pwd", which meant #ranks/all silently rendered the PwD
   section with the PwD tab highlighted while the URL said otherwise. The
   view already validates its own arg, so pass it through untouched. */
export function App() {
  const hash = useHash();
  const route = useMemo(() => parseRoute(hash), [hash]);
  /* parseRoute normalises the view name; the query string rides along in arg. */
  const rawArg = useMemo(() => hash.replace(/^#/, ""), [hash]);
  const scrolled = useScrolled();
  const { theme, toggle } = useTheme();
  const favourites = useFavourites();
  const progress = useProgress();
  const [announcement, setAnnouncement] = useState("");

  const announceTimer = useRef<number | undefined>(undefined);
  const announce = useMemo(
    () => (message: string) => {
      setAnnouncement(message);
      window.clearTimeout(announceTimer.current);
      announceTimer.current = window.setTimeout(() => setAnnouncement(""), 1800);
    },
    [],
  );

  /* Every hash change is a new page as far as the reader is concerned, so
     the scroll position resets with it. */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [route.view, route.arg]);

  const nav = { view: route.view, arg: route.arg };

  let body: React.ReactNode;
  switch (route.view) {
    case "predict":
      body = <PredictView arg={rawArg} favourites={favourites} progress={progress} />;
      break;
    case "institutes":
      body = <InstitutesView arg={route.arg} favourites={favourites} progress={progress} />;
      break;
    case "institute":
      body = <InstituteView arg={route.arg} favourites={favourites} progress={progress} />;
      break;
    case "ranks":
      body = <RanksView arg={route.arg} favourites={favourites} progress={progress} />;
      break;
    case "syllabus":
      body = <ChaptersView arg={route.arg} favourites={favourites} progress={progress} />;
      break;
    case "report":
      body = <ReportView arg={route.arg} favourites={favourites} progress={progress} />;
      break;
    /* parseRoute already folds unknown hashes into "syllabus", so this arm
       only runs for a view named here but not yet built. Falling back to the
       syllabus keeps a stale link useful instead of landing on a dead end. */
    default:
      body = <ChaptersView arg={route.arg} favourites={favourites} progress={progress} />;
  }

  return (
    <AnnounceProvider value={announce}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header
        nav={nav}
        scrolled={scrolled}
        theme={theme}
        onToggleTheme={toggle}
        pinnedCount={favourites.list.length}
        chapterCount={progress.total}
      />
      <main id="main" tabIndex={-1}>
        {body}
      </main>
      <TabBar nav={nav} pinnedCount={favourites.list.length} />
      <ScrollTop />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </AnnounceProvider>
  );
}