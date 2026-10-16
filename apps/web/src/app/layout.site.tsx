import type { Metadata, Viewport } from "next";
import { RootHtml, rootMetadata, rootViewport } from "./root-html";

/**
 * Root layout for the static export (STATIC_SITE=1). There is no request, so no theme cookie:
 * the page starts on the OS theme and ThemeToggle re-applies a saved choice after load.
 */
export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = rootViewport;

export default function StaticRootLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml theme={null}>{children}</RootHtml>;
}
