import { useCallback, useEffect, useState } from "react";
import { readString, writeString } from "./storage";

export type Theme = "light" | "dark";

const KEY = "jee.theme";

/* The page paints before React mounts, so main.tsx seeds data-theme from the
   same resolver this hook uses. One function, two callers, no flash. */
export function resolveInitialTheme(): Theme {
  const stored = readString(KEY);
  if (stored === "dark" || stored === "light") return stored;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  document
    .getElementById("themeColor")
    ?.setAttribute("content", theme === "dark" ? "#0b0c0f" : "#f7f6f1");
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());
  const [followsSystem, setFollowsSystem] = useState(() => readString(KEY) == null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  /* If the reader never picked a theme, keep following the OS. Once they
     pick one, that choice owns the theme from then on. */
  useEffect(() => {
    if (!followsSystem || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [followsSystem]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      writeString(KEY, next);
      return next;
    });
    setFollowsSystem(false);
  }, []);

  return { theme, toggle };
}
