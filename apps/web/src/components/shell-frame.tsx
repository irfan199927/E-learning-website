"use client";

import type { Role } from "@elearner/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/i18n/messages";
import { Icon, type IconName } from "./icons";

type NavLabel = keyof Messages["Nav"];

interface NavItem {
  href: string;
  /** Message key in the "Nav" namespace, or one per role. */
  label: NavLabel | (Partial<Record<Role, NavLabel>> & { default: NavLabel });
  icon: IconName;
  roles: Role[];
  /** Extra paths that highlight this item (e.g. a lesson page belongs to "My courses"). */
  match?: RegExp;
  /** School administration: listed under its own heading. */
  admin?: true;
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "overview",
    icon: "overview",
    roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"],
  },
  {
    href: "/courses",
    label: { default: "courses", STUDENT: "myCourses" },
    icon: "courses",
    roles: ["ADMIN", "TEACHER", "STUDENT"],
    match: /^\/library\/(?!upload)/,
  },
  { href: "/children", label: "children", icon: "users", roles: ["PARENT"] },
  {
    href: "/calendar",
    label: "calendar",
    icon: "calendar",
    roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"],
  },
  { href: "/library/upload", label: "upload", icon: "upload", roles: ["ADMIN", "TEACHER"] },
  { href: "/admin/users", label: "users", icon: "users", roles: ["ADMIN"], admin: true },
  { href: "/admin/payments", label: "payments", icon: "rupee", roles: ["ADMIN"], admin: true },
  { href: "/admin/settings", label: "settings", icon: "settings", roles: ["ADMIN"], admin: true },
];

function labelFor(item: NavItem, role: Role): NavLabel {
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
  const t = useTranslations("Nav");
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
        {t("skip")}
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
        aria-label={t("main")}
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
            aria-label={t("closeMenu")}
            onClick={() => {
              setOpen(false);
              menuButton.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="flex flex-col gap-6 overflow-y-auto">
          <NavList
            items={items.filter((n) => !n.admin)}
            role={role}
            pathname={pathname}
            firstLink={firstLink}
          />
          {items.some((n) => n.admin) && (
            <div className="flex flex-col gap-2">
              <h2 id="nav-admin" className="px-3.5 text-xs font-bold uppercase tracking-wider text-muted">
                {t("adminSection")}
              </h2>
              <NavList
                items={items.filter((n) => n.admin)}
                role={role}
                pathname={pathname}
                labelledBy="nav-admin"
              />
            </div>
          )}
        </div>
      </nav>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-10">
          <button
            ref={menuButton}
            type="button"
            className="-ml-2 grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-canvas md:hidden"
            aria-label={t("openMenu")}
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

function NavList({
  items,
  role,
  pathname,
  firstLink,
  labelledBy,
}: {
  items: NavItem[];
  role: Role;
  pathname: string;
  firstLink?: React.RefObject<HTMLAnchorElement | null>;
  labelledBy?: string;
}) {
  const t = useTranslations("Nav");
  return (
    <ul className="flex flex-col gap-1.5" aria-labelledby={labelledBy}>
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
              {t(labelFor(n, role))}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
