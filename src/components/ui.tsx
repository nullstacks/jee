import {
  createContext,
  useContext,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDownIcon, SearchIcon, XIcon } from "./icons";

/* ═══════════════ Button ═══════════════ */

type Variant = "primary" | "secondary" | "ghost" | "quiet";
type Size = "sm" | "md";

export function Button({
  variant = "secondary",
  size = "md",
  pressed,
  icon,
  trailing,
  block,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  pressed?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      data-variant={variant}
      data-size={size}
      data-pressed={pressed}
      data-block={block || undefined}
      className={"btn " + className}
    >
      {icon ? <span className="btn-icon">{icon}</span> : null}
      {children ? <span className="btn-label">{children}</span> : null}
      {trailing ? <span className="btn-icon">{trailing}</span> : null}
    </button>
  );
}

/* ═══════════════ Segmented control ═══════════════ */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  layout = "fit",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  size?: Size;
  layout?: "fit" | "equal";
}) {
  /* A radio group, not a tab list. This control swaps the data in place and
     owns no tabpanel, so role="tab" + aria-controls pointed at elements that
     never existed — a dangling reference axe flags as critical. Arrow keys
     move and select here, which is exactly the radiogroup pattern. */
  const groupRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      className="seg"
      role="radiogroup"
      aria-label={label}
      data-size={size}
      data-layout={layout}
      ref={groupRef}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className="seg-item"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const i = options.findIndex((x) => x.value === value);
            const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            const next = options[(i + step + options.length) % options.length];
            onChange(next.value);
            /* Roving tabindex: the checked radio is the group's only tab stop,
               so focus has to move with the selection or the keyboard user is
               left focused on a button that no longer exists in the tab order. */
            groupRef.current
              ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
              [options.indexOf(next)]?.focus();
          }}
        >
          <span className="seg-text">{o.label}</span>
          {o.count != null ? <span className="seg-count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════ Chip ═══════════════ */

export function Chip({
  pressed,
  onClick,
  children,
  disabled,
  title,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

/* ═══════════════ Badge ═══════════════ */

export function Badge({
  tone,
  children,
  mono,
}: {
  tone: "safe" | "mod" | "reach" | "neutral" | "accent";
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <span className="badge" data-tone={tone} data-mono={mono || undefined}>
      {children}
    </span>
  );
}

/* ═══════════════ Card ═══════════════ */

export function Card({
  children,
  className = "",
  as: Tag = "section",
  flush,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
  flush?: boolean;
}) {
  return (
    <Tag className={"card " + (flush ? "card-flush " : "") + className}>{children}</Tag>
  );
}

export function CardHead({
  title,
  note,
  trailing,
  /* Defaults to h2: a card head directly under the page's h1 is the normal
     case, and jumping h1 -> h3 skipped a level on the predictor and institute
     pages. A card head nested inside an explicit <h2> section passes 3. */
  level = 2,
}: {
  title: ReactNode;
  note?: ReactNode;
  trailing?: ReactNode;
  level?: 2 | 3;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <header className="card-head">
      <div className="card-head-text">
        <H>{title}</H>
        {note ? <p>{note}</p> : null}
      </div>
      {trailing ? <div className="card-head-trailing">{trailing}</div> : null}
    </header>
  );
}

/* ═══════════════ Fields ═══════════════ */

export function Field({
  label,
  hint,
  children,
  wide,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className="field" data-wide={wide || undefined}>
      <label className="field-label" htmlFor={htmlFor}>
        <span>{label}</span>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onValueChange,
  placeholder,
  label,
  id,
}: {
  value: string;
  onValueChange: (next: string) => void;
  placeholder?: string;
  label: string;
  id?: string;
}) {
  return (
    <div className="search">
      <SearchIcon size={15} className="search-glyph" />
      <input
        id={id}
        type="search"
        className="search-input"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onValueChange(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {value ? (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => onValueChange("")}
        >
          <XIcon size={13} />
        </button>
      ) : null}
    </div>
  );
}

export function Select({
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="select">
      <select {...rest} className={"select-input " + className} />
      <ChevronDownIcon size={14} className="select-glyph" />
    </span>
  );
}

/* A horizontally scrollable table wrapper.
   `.table-scroll` sets overflow-x AND a max-height with overflow-y, so the box
   scrolls but a keyboard user could not reach it: a scrollable region needs to
   be focusable or nobody without a pointer can get past the first few rows.
   tabIndex makes it a real tab stop; the role and label tell a screen reader
   what the box does, and :focus-visible draws the ring. */
export function TableScroll({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={"table-scroll " + className}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}

/* ═══════════════ Notice ═══════════════ */

export function Notice({
  tone = "accent",
  icon,
  title,
  children,
}: {
  tone?: "accent" | "caution" | "neutral";
  icon?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="notice" data-tone={tone}>
      {icon ? <span className="notice-icon">{icon}</span> : null}
      <div className="notice-text">
        {title ? <strong>{title} </strong> : null}
        {children}
      </div>
    </div>
  );
}

/* ═══════════════ Empty state ═══════════════ */

export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <p className="empty-title">{title}</p>
      {children ? <p className="empty-body">{children}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

/* ═══════════════ Page header ═══════════════ */

export function PageHead({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
        {eyebrow ? <p className="page-meta">{eyebrow}</p> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </header>
  );
}

/* ═══════════════ Stat ═══════════════ */

export function Stat({
  label,
  hint,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  value: ReactNode;
  tone?: "safe" | "mod" | "reach" | "neutral";
  active?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="stat-label">
        {label}
        {hint ? <span className="stat-hint">{hint}</span> : null}
      </span>
      <span className="stat-value num">{value}</span>
    </>
  );

  if (!onClick) return <div className="stat" data-tone={tone}>{inner}</div>;

  return (
    <button
      type="button"
      className="stat stat-button"
      data-tone={tone}
      data-active={active || undefined}
      aria-pressed={active}
      onClick={onClick}
    >
      {inner}
    </button>
  );
}

/* ═══════════════ Toast-free status line ═══════════════ */

const AnnounceContext = createContext<(message: string) => void>(() => {});
export const useAnnounce = () => useContext(AnnounceContext);
export const AnnounceProvider = AnnounceContext.Provider;

