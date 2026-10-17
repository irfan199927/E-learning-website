import type { Metadata, Viewport } from "next";
import type { Theme } from "@/lib/theme";
import { bricolage, devanagari, figtree, mono } from "./fonts";
import "./globals.css";

/** Shared by the app root layout (layout.tsx) and the static-export root layout (layout.site.tsx). */
export const rootMetadata: Metadata = {
  title: { default: "E-learner", template: "%s · E-learner" },
  description: "Live classes, recorded lessons and schedules for your school.",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const rootViewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2340D9" };

export function RootHtml({
  theme,
  lang = "en",
  children,
}: {
  theme: Theme | null;
  /** The interface language (src/i18n); the static landing page is English only. */
  lang?: string;
  children: React.ReactNode;
}) {
  return (
    <html
      lang={lang}
      data-theme={theme ?? undefined}
      className={`${figtree.variable} ${bricolage.variable} ${mono.variable} ${devanagari.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
