/**
 * Line icons (24px grid, 2px stroke, currentColor). Decorative by default: give the
 * surrounding control an accessible name instead of labelling the icon.
 */
const PATHS = {
  overview: "M3 3h18v18H3zM3 9h18M9 21V9",
  courses: "M4 4h16v16H4zM8 8h3v8H8zM14 8h2M14 12h2M14 16h2",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  menu: "M4 6h16M4 12h16M4 18h10",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  play: "M8 5v14l11-7z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  users:
    "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  video: "M3 6h12v12H3zM15 10l6-3v10l-6-3",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  text: "M4 6h16M4 10h16M4 14h10M4 18h12",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  rupee: "M6 4h12M6 9h12M6 4h3a5 5 0 0 1 0 10H6l8 6",
  settings: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  eyeOff:
    "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-2.6 3.2M6.3 7.6C4.2 9.2 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
} as const;

export type IconName = keyof typeof PATHS | "flame";

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  if (name === "flame") {
    // Filled, two-tone: the streak badge is the one icon that carries colour.
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path
          fill="var(--color-marigold)"
          d="M12 2c.6 3.2 2.4 5 4 6.8 1.6 1.8 3 3.6 3 6.2a7 7 0 1 1-14 0c0-2.6 1.3-4.4 2.8-5.6.2 1.8 1 3 2.2 3.6C9.4 9.6 10 5.4 12 2z"
        />
        <path
          fill="var(--color-live)"
          d="M12 21a3.5 3.5 0 0 1-3.5-3.5c0-2 1.6-3.1 2.4-4.6.9 1.6 4.6 2.3 4.6 4.6A3.5 3.5 0 0 1 12 21z"
        />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "play" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
