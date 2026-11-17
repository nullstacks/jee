import { navigate } from "../lib/hooks";
import { NAV_ITEMS, sectionForView, type Section } from "../lib/nav";
import type { Theme } from "../lib/theme";
import {
  BookIcon,
  BrandMark,
  BuildingIcon,
  MoonIcon,
  RanksIcon,
  SunIcon,
  TargetIcon,
} from "./icons";
import { InstallControl } from "./InstallPrompt";
import { Button } from "./ui";

export interface NavState {
  view: string;
  arg: string;
}

/* Only the icons live here. The label and the hash come from NAV_ITEMS, so
   this nav and the phone tab bar cannot point at different sections. */
const ICONS: Record<Section, typeof TargetIcon> = {
  predict: TargetIcon,
  institutes: BuildingIcon,
  ranks: RanksIcon,
  syllabus: BookIcon,
};

const PRIMARY = NAV_ITEMS.map((item) => ({ ...item, Icon: ICONS[item.key] }));

/* Section resolution is shared with the mobile tab bar so the two can never
   disagree about which tab is current. */
const activeKey = sectionForView;

export function Header({
  nav,
  scrolled,
  theme,
  onToggleTheme,
  pinnedCount,
  chapterCount,
}: {
  nav: NavState;
  scrolled: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  pinnedCount: number;
  chapterCount: number;
}) {
  const active = activeKey(nav.view);

  return (
    <header className="apphead" data-elevated={scrolled || undefined}>
      <div className="apphead-inner shell">
        <a
          className="brand"
          href="#syllabus"
          onClick={(e) => {
            e.preventDefault();
            navigate("#syllabus");
          }}
        >
          <BrandMark size={30} className="brand-mark" />
          <span className="brand-text">
            <span className="brand-title">JEE 2027</span>
            <span className="brand-sub">Chapters · ranks · cut-offs</span>
          </span>
        </a>

        <nav className="primarynav" aria-label="Sections">
          {PRIMARY.map(({ key, label, hash, Icon }) => {
            const isActive = key === active;
            const count =
              key === "institutes" && pinnedCount > 0
                ? pinnedCount
                : key === "syllabus"
                  ? chapterCount
                  : null;
            return (
              <a
                key={key}
                href={hash}
                className="primarynav-item"
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  navigate(hash);
                }}
              >
                <Icon size={16} strokeWidth={1.9} className="primarynav-icon" />
                <span>{label}</span>
                {count != null && count > 0 ? (
                  <span className="primarynav-count num">{count}</span>
                ) : null}
              </a>
            );
          })}
        </nav>

        <div className="apphead-actions">
          <InstallControl />
          <Button
            variant="quiet"
            size="sm"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            icon={
              theme === "dark" ? (
                <SunIcon size={15} className="icon-swap" />
              ) : (
                <MoonIcon size={15} className="icon-swap" />
              )
            }
          />
        </div>
      </div>
    </header>
  );
}