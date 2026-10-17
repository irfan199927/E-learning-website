import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { RegisterServiceWorker } from "@/components/register-sw";
import { RootHtml, rootMetadata, rootViewport } from "./root-html";

// Pages render per request: the CSP nonce (src/middleware.ts) can only be applied to
// dynamically rendered HTML. Static prerendering would ship scripts the CSP then blocks.
export const dynamic = "force-dynamic";

// The installable-app manifest (app/manifest.ts) exists only in the full app, not the static landing export.
export const metadata: Metadata = {
  ...rootMetadata,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "E-learner", statusBarStyle: "default" },
};
export const viewport: Viewport = rootViewport;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // No cookie → no attribute → the OS preference applies (see globals.css).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <RootHtml theme={theme}>
      {children}
      <RegisterServiceWorker />
    </RootHtml>
  );
}
