import { useEffect, useRef, useState } from "react";
import { useInstall } from "../lib/install";
import { CheckIcon, DownloadIcon, XIcon } from "./icons";
import { Button } from "./ui";

/* Two pieces:
   - InstallControl: the always-present header button.
   - InstallSheet: the dialog that explains the browser-specific steps when
     there is no programmatic prompt to fire. */

const INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  ios: {
    title: "Add to Home Screen",
    steps: [
      "Open this page in Safari.",
      "Tap the Share button (the square with an arrow).",
      "Scroll down and tap “Add to Home Screen”.",
      "Tap “Add”. It opens full screen, without browser chrome.",
    ],
  },
  firefox: {
    title: "Install from the menu",
    steps: [
      "Open the browser menu (the three dots, top right).",
      "Choose “Install” or “Add to Home screen”.",
      "Confirm. It opens in its own window.",
    ],
  },
  desktop: {
    title: "Install from the address bar",
    steps: [
      "Look for the install icon at the right end of the address bar.",
      "On Chrome or Edge it looks like a small monitor with an arrow.",
      "Choose “Install”. It opens in its own window and works offline.",
    ],
  },
};

export function InstallControl() {
  const { state, justInstalled } = useInstall();
  const [open, setOpen] = useState(false);

  if (state.kind === "installed") {
    return (
      <span className="install-done" role="status">
        <CheckIcon size={13} />
        {justInstalled ? "Installed" : null}
      </span>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="install-btn"
        icon={<DownloadIcon size={14} />}
        onClick={async () => {
          if (state.kind === "promptable") {
            await state.prompt();
          } else {
            setOpen(true);
          }
        }}
      >
        Install
      </Button>
      {open && state.kind === "manual" ? (
        <InstallSheet browser={state.browser} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function InstallSheet({
  browser,
  onClose,
}: {
  browser: "ios" | "firefox" | "desktop";
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement | null>(null);
  const info = INSTRUCTIONS[browser];

  /* Escape closes; focus lands on the panel so a keyboard reader is not left
     behind the overlay. */
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const items = panel.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id="install-title">{info.title}</h2>
          <button
            type="button"
            className="sheet-close"
            onClick={onClose}
            aria-label="Close"
            ref={closeBtn}
          >
            <XIcon size={16} />
          </button>
        </div>
        <p className="sheet-lede">
          Add this to your device and it opens like an app: full screen, and the
          whole reference works with no connection.
        </p>
        <ol className="sheet-steps">
          {info.steps.map((s, i) => (
            <li key={i}>
              <span className="sheet-step-num num">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="sheet-foot">
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
