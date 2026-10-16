/**
 * Circular progress. The ring is decorative; the accessible value comes from `label`
 * (role="img"), so screen readers hear e.g. "3 of 9 lessons completed".
 */
export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  label,
  color = "var(--color-success)",
  children,
}: {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  return (
    <span role="img" aria-label={label} className="relative inline-grid shrink-0 place-items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v / 100)}
          />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}
