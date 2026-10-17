"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

const POLL_MS = 60_000;

/**
 * The top bar's bell. Starts from the server's count, then re-checks every minute while the tab is visible, when
 * the tab comes back, and on navigation, so new notifications show up without a reload.
 */
export function NotificationBell({ initial }: { initial: number }) {
  const [unread, setUnread] = useState(initial);
  const pathname = usePathname();
  const firstPath = useRef(pathname);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/v1/notifications/unread-count", { credentials: "same-origin" });
        if (res.status === 401) stopped = true; // signed out: stop asking
        if (!res.ok) return;
        const { data } = (await res.json()) as { data: { unread: number } };
        if (!stopped) setUnread(data.unread);
      } catch {
        // Offline or a blip: keep the last count and try again on the next tick.
      }
    };
    // The layout (and so `initial`) isn't re-rendered on client navigation: re-check on every page change.
    if (pathname !== firstPath.current) void check();
    const timer = setInterval(() => void check(), POLL_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      className="relative grid size-11 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Icon name="bell" size={22} />
      {unread > 0 && (
        <span
          className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-live px-1 text-[11px] font-bold text-white"
          aria-hidden="true"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
