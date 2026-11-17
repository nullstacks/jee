import { navigate } from "../lib/hooks";
import { sectionForView, tabItems, type Section } from "../lib/nav";
import { BookIcon, BuildingIcon, TargetIcon, RanksIcon } from "./icons";
import type { NavState } from "./Header";

/* Labels and hashes come from NAV_ITEMS; the tab bar only supplies the wider
   phone icons and the shorter labels. */
const ICONS: Record<Section, typeof TargetIcon> = {
  predict: TargetIcon,
  institutes: BuildingIcon,
  ranks: RanksIcon,
  syllabus: BookIcon,
};

const ITEMS = tabItems().map((item) => ({ ...item, Icon: ICONS[item.key] }));

const activeKey = sectionForView;

/* Below 760px the four sections move to a thumb-reachable bar at the bottom
   of the viewport, where a phone user's thumb already is. The desktop
   header nav is hidden at that breakpoint, so the two never compete. */
export function TabBar({ nav, pinnedCount }: { nav: NavState; pinnedCount: number }) {
  const active = activeKey(nav.view);

  return (
    <nav className="tabbar" aria-label="Sections">
      {ITEMS.map(({ key, tabLabel, hash, Icon }) => {
        const isActive = key === active;
        return (
          <a
            key={key}
            href={hash}
            className="tabbar-item"
            aria-current={isActive ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              navigate(hash);
            }}
          >
            <span className="tabbar-glyph">
              <Icon size={22} strokeWidth={1.9} />
              {key === "institutes" && pinnedCount > 0 ? (
                <span className="tabbar-dot" aria-hidden="true" />
              ) : null}
            </span>
            <span className="tabbar-label">{tabLabel}</span>
          </a>
        );
      })}
    </nav>
  );
}