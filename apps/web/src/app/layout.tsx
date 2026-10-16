import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { bricolage, figtree, mono } from "./fonts";
import "./globals.css";

// Pages render per request: the CSP nonce (src/middleware.ts) can only be applied to
// dynamically rendered HTML. Static prerendering would ship scripts the CSP then blocks.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "E-learner", template: "%s · E-learner" },
  description: "Live classes, recorded lessons and schedules for your school.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2340D9" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // No cookie → no attribute → the OS preference applies (see globals.css).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-theme={theme ?? undefined}
      className={`${figtree.variable} ${bricolage.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
