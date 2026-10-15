"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname()?.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 items-center rounded-[var(--radius-control)] px-3 text-[15px] ${
        active
          ? "bg-primary-soft font-semibold text-primary-strong"
          : "font-medium text-muted hover:bg-canvas"
      }`}
    >
      {children}
    </Link>
  );
}
