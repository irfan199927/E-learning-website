/**
 * Re-mounts on every navigation (unlike layout.tsx), so each signed-in page arrives with the shared `enter`
 * motion. Opacity/transform only, so it never shifts layout; off under prefers-reduced-motion (globals.css).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="enter">{children}</div>;
}
