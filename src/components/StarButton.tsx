import { useCallback } from "react";
import { StarIcon } from "./icons";
import { useAnnounce } from "./ui";

/* One star component for every surface that can pin an institute. The two
   glyph states are both painted from one path — outline is the default and
   fill marks the pinned state, so a theme flip never needs a new asset. */
export function StarButton({
  name,
  label,
  pinned,
  onToggle,
  size = "md",
  className = "",
}: {
  name: string;
  label?: string;
  pinned: boolean;
  onToggle: (name: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const announce = useAnnounce();
  const readable = label ?? name;

  const handle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggle(name);
      announce((pinned ? "Unpinned " : "Pinned ") + readable);
    },
    [announce, name, onToggle, pinned, readable],
  );

  return (
    <button
      type="button"
      className={"star " + className}
      data-size={size}
      aria-pressed={pinned}
      aria-label={(pinned ? "Unpin " : "Pin ") + readable}
      title={(pinned ? "Unpin " : "Pin ") + readable}
      onClick={handle}
    >
      <StarIcon size={size === "sm" ? 14 : size === "lg" ? 19 : 16} filled={pinned} />
    </button>
  );
}
