import { resolveInitialTheme, applyTheme } from "./theme";

/* Runs before React mounts so the first painted frame already carries the
   right theme. Without this the page flashes light before the store hydrates. */
export function boot(): void {
  applyTheme(resolveInitialTheme());
}
