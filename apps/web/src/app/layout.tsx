import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${bricolage.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
