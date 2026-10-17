"use client";

import type { Role } from "@elearner/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";

interface NavItem {
  href: string;
  label: string | (Partial<Record<Role, string>> & { default: string });
  icon: IconName;
  roles: Role[];
  /** Extra paths that highlight this item (e.g. a lesson page belongs to "My courses"). */
  match?: RegExp;
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: "overview",
    roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"],
  },
  {
    href: "/courses",
    label: { default: "Courses", STUDENT: "My courses" },
    icon: "courses",
    roles: ["ADMIN", "TEACHER", "STUDENT"],
    match: /^\/library\/(?!upload)/,
  },
  { href: "/children", label: "My children", icon: "users", roles: ["PARENT"] },
  {
    href: "/calendar",
    label: "Calendar",
    icon: "calendar",
    roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"],
  },
  { href: "/library/upload", label: "Upload video", icon: "upload", roles: ["ADMIN", "TEACHER"] },
  { href: "/admin/users", label: "Users", icon: "users", roles: ["ADMIN"] },
  { href: "/admin/payments", label: "Payments", icon: "rupee", roles: ["ADMIN"] },
];

function labelFor(item: NavItem, role: Role): string {
  return typeof item.label === "string" ? item.label : (item.label[role] ?? item.label.default);
}

/**
 * Sidebar + top bar. Desktop: fixed sidebar. Mobile: the same <nav> slides in as a drawer
 * from the menu button (closes on navigation, Escape, or tapping the backdrop).
 */
export function ShellFrame({
  role,
  topbar,
  children,
}: {
  role: Role;
  /** Right-hand side of the top bar (streak, user menu) — rendered on the server. */
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[256px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2"
      >
        Skip to content
      </a>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}
      <nav
        id="main-nav"
        aria-label="Main"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-8 border-r border-line bg-surface px-4 py-6 transition-transform md:sticky md:top-0 md:z-auto md:h-dvh md:w-auto md:translate-x-0 ${
          open ? "translate-x-0 shadow-xl" : "-translate-x-full max-md:invisible"
        }`}
      >
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
            <span className="grid size-[34px] place-items-center rounded-[9px] bg-primary" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 9l10-5 10 5-10 5z" />
                <path d="M6 11v5c3 2 9 2 12 0v-5" />
              </svg>
            </span>
            <span className="font-display text-[22px] font-bold">E-learner</span>
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-[var(--radius-control)] text-muted hover:bg-canvas md:hidden"
            aria-label="Close menu"
            onClick={() => {
              setOpen(false);
              menuButton.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <ul className="flex flex-col gap-1.5">
          {items.map((n, i) => {
            const active = pathname.startsWith(n.href) || !!n.match?.test(pathname);
            return (
              <li key={n.href}>
                <Link
                  ref={i === 0 ? firstLink : undefined}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 items-center gap-3 rounded-xl px-3.5 text-[15px] transition-colors ${
                    active
                      ? "bg-primary-soft font-semibold text-primary-fg-strong"
                      : "font-medium text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <Icon name={n.icon} size={22} />
                  {labelFor(n, role)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-10">
          <button
            ref={menuButton}
            type="button"
            className="-ml-2 grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-canvas md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" size={24} />
          </button>
          {topbar}
        </header>
        <main id="main" className="min-w-0 flex-1 px-4 py-8 md:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
