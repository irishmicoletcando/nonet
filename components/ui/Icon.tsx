import type { ReactNode } from "react";

export type IconName =
  | "grid" | "calendar" | "play" | "review" | "train" | "courses" | "solver" | "scan"
  | "pricing" | "bolt" | "search" | "arrow" | "undo" | "erase" | "notes" | "hint"
  | "menu" | "close" | "check" | "dash" | "flame";

export type Tint = "yellow" | "mint" | "pink" | "lavender" | "blue" | "none";

const PATHS: Record<IconName, ReactNode> = {
  grid: <path d="M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" />,
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="1" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  play: <path d="M7 5l12 7-12 7z" />,
  review: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  train: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  courses: <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11" />,
  solver: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  scan: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  pricing: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v10M14.5 9.5h-3.5a1.75 1.75 0 000 3.5h2a1.75 1.75 0 010 3.5H9.5" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  erase: <path d="M20 20H9L4 15l10-10 6 6-7 7M10 9l6 6" />,
  notes: <path d="M5 19l1-4L16 5l3 3L9 18zM14 7l3 3" />,
  hint: <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  dash: <path d="M6 12h12" />,
  flame: <path d="M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
};

interface SvgProps {
  name: IconName;
  size?: number;
  label?: string;
  strokeWidth?: number;
}

/** Bare 2px-stroke icon drawn in currentColor. Decorative unless `label` is given. */
export function Glyph({ name, size = 20, label, strokeWidth = 2 }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

const TINT_VAR: Record<Tint, string> = {
  yellow: "var(--tint-yellow)",
  mint: "var(--tint-mint)",
  pink: "var(--tint-pink)",
  lavender: "var(--tint-lavender)",
  blue: "var(--tint-blue)",
  none: "transparent",
};

/** Icon inside a 30px flat square with a 2px ink border and a pale tint. */
export function Icon({ name, tint = "yellow", size = 30 }: { name: IconName; tint?: Tint; size?: number }) {
  return (
    <span
      className="icon-box"
      style={{ background: TINT_VAR[tint], width: size, height: size }}
      aria-hidden="true"
    >
      <Glyph name={name} size={Math.round(size * 0.53)} strokeWidth={2} />
    </span>
  );
}
