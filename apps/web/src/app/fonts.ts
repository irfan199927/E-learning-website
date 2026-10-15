import localFont from "next/font/local";

/*
 * Fonts are self-hosted from npm (@fontsource-variable/*), not fetched from Google at build
 * time: builds are reproducible offline, and no font request leaves our domain (privacy + CSP).
 * Devanagari (Hindi/Marathi) falls back to the system's Noto Sans Devanagari via the CSS stack.
 */
export const figtree = localFont({
  src: "../../node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2",
  variable: "--font-figtree",
  weight: "300 900",
  display: "swap",
});

export const bricolage = localFont({
  src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

export const mono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
});
