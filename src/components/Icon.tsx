/**
 * Small drawn icons (no emoji): 24×24 line drawings in the current text colour, so they follow the theme and never
 * render as colourful emoji on phones. Decorative by default; pass `label` when the icon is the only content.
 */
const PATHS = {
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  back: "M19 12H5M11 6l-6 6 6 6",
  swap: "M7 8h12M15 4l4 4-4 4M17 16H5M9 12l-4 4 4 4",
  skip: "M5 17a7 7 0 0112.5-4.3M18 7v6h-6",
  note: "M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h5",
  info: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 11v6M12 7.5v.5",
  warn: "M12 3L2 21h20zM12 10v5M12 18v.5",
  ok: "M12 22a10 10 0 100-20 10 10 0 000 20zM7.5 12.5l3 3 6-6.5",
  trophy: "M8 4h8v5a4 4 0 01-8 0zM8 6H4.5v1.5A3.5 3.5 0 008 11M16 6h3.5v1.5A3.5 3.5 0 0116 11M12 13v4M8.5 20h7M10 17h4",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z",
  more: "M12 5.5v.5M12 11.75v.5M12 18v.5",
  copy: "M9 9h11v11H9zM15 9V4H4v11h5",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  undo: "M4 9h11a5 5 0 010 10H9M4 9l4-4M4 9l4 4",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
} as const;

/** Filled shapes (drawn with fill instead of stroke). */
const FILLED = {
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  play: "M8 5v14l11-7z",
  triUp: "M12 6l7 11H5z",
  triDown: "M12 18L5 7h14z",
  dot: "M12 16a4 4 0 100-8 4 4 0 000 8z",
  starFill: PATHS.star,
  circle: "M12 20a8 8 0 100-16 8 8 0 000 16z",
} as const;

export type IconName = keyof typeof PATHS | keyof typeof FILLED | "ring";

export default function Icon({ name, size = "1.15em", label, className, style }: { name: IconName; size?: number | string; label?: string; className?: string; style?: React.CSSProperties }) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  const common = { width: size, height: size, viewBox: "0 0 24 24", className, style: { display: "inline-block", verticalAlign: "-0.18em", flex: "none", ...style }, ...a11y };
  if (name === "ring")
    return <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="7.5" /></svg>;
  if (name in FILLED) return <svg {...common} fill="currentColor"><path d={FILLED[name as keyof typeof FILLED]} /></svg>;
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name as keyof typeof PATHS]} />
    </svg>
  );
}
