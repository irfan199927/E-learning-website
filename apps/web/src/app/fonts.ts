import localFont from "next/font/local";

/*
 * Fonts are self-hosted from npm (@fontsource-variable/*), not fetched from Google at build
 * time: builds are reproducible offline, and no font request leaves our domain (privacy + CSP).
 * Devanagari (Hindi/Marathi) comes from Noto Sans Devanagari, limited to the Devanagari block by unicode-range:
 * browsers only download it on pages that show Devanagari text.
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

export const devanagari = localFont({
  src: "../../node_modules/@fontsource-variable/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-wght-normal.woff2",
  variable: "--font-devanagari",
  weight: "100 900",
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FF",
    },
  ],
});
