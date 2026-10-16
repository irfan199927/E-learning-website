/**
 * Colour theme. "system" (no cookie) follows the OS; an explicit choice is kept in a cookie so the
 * server renders <html data-theme> and the page never flashes the wrong theme before hydration
 * (an inline pre-hydration script would also need the CSP nonce).
 */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";

export function parseTheme(value: string | undefined): Theme | null {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : null;
}
