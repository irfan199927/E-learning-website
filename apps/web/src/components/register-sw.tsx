"use client";

import { useEffect } from "react";

/** Registers public/sw.js (offline page + cached static assets) in production builds. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not fatal: the app works the same without it, only without the offline page.
    });
  }, []);
  return null;
}
