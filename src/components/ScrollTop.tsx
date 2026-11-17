import { useEffect, useState } from "react";
import { ArrowRightIcon } from "./icons";

/* A long result table can be 30 screens tall. The affordance only appears
   once the reader is genuinely far down the page. */
export function ScrollTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setVisible(window.scrollY > 1400);
        frame = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <button
      type="button"
      className="scrolltop"
      data-visible={visible || undefined}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowRightIcon size={16} className="scrolltop-glyph" />
    </button>
  );
}
