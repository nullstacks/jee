import { useCallback, useEffect, useState } from "react";

/* Installing the app.

   Chromium fires beforeinstallprompt and we can trigger a real prompt. Safari,
   Firefox and anything already running standalone do not, so the control has
   to stay useful by explaining the browser's own menu instead of vanishing.
   Vanishing is why the previous button was effectively invisible: it returned
   null unless the event had fired. */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState =
  | { kind: "installed" }
  | { kind: "promptable"; prompt: () => Promise<"accepted" | "dismissed"> }
  | { kind: "manual"; browser: "ios" | "firefox" | "desktop" };

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)");
  if (mql?.matches) return true;
  /* iOS Safari predates display-mode and exposes it here instead. */
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function detectBrowser(): "ios" | "firefox" | "desktop" {
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Firefox\//.test(ua)) return "firefox";
  return "desktop";
}

export function useInstall(): {
  state: InstallState;
  install: () => Promise<void>;
  justInstalled: boolean;
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
      setJustInstalled(true);
      window.setTimeout(() => setJustInstalled(false), 4000);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    /* A page opened in a browser window after being installed still reports
       the display mode, so re-check on the first paint. */
    const mql = window.matchMedia?.("(display-mode: standalone)");
    if (mql?.matches) setInstalled(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      /* the reader dismissed it; leave the control in place */
    }
    setDeferred(null);
  }, [deferred]);

  const state: InstallState = installed
    ? { kind: "installed" }
    : deferred
      ? { kind: "promptable", prompt: async () => {
          await deferred.prompt();
          const choice = await deferred.userChoice;
          setDeferred(null);
          if (choice.outcome === "accepted") setInstalled(true);
          return choice.outcome;
        } }
      : { kind: "manual", browser: detectBrowser() };

  return { state, install, justInstalled };
}
