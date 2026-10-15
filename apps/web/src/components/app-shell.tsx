import type { Role } from "@elearner/core";
import Link from "next/link";
import { NavLink } from "./nav-link";
import { SignOutButton } from "./sign-out-button";

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
  { href: "/calendar", label: "Calendar", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
  { href: "/library/upload", label: "Upload video", roles: ["ADMIN", "TEACHER"] },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: Role };
  children: React.ReactNode;
}) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex min-h-dvh flex-wrap">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2"
      >
        Skip to content
      </a>
      <nav
        aria-label="Main"
        className="flex w-full flex-col gap-6 border-line bg-surface px-4 py-5 md:min-h-dvh md:w-60 md:border-r"
      >
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
        <ul className="flex flex-wrap gap-1 md:flex-col">
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
            <li key={n.href}>
              <NavLink href={n.href}>{n.label}</NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center gap-3 px-2">
          <span
            className="grid size-10 place-items-center rounded-full bg-warning-soft text-sm font-bold text-[#7A4500]"
            aria-hidden="true"
          >
            {initials}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{user.name}</span>
            <span className="text-xs capitalize text-muted">{user.role.toLowerCase()}</span>
          </span>
          <SignOutButton />
        </div>
      </nav>
      <main id="main" className="min-w-0 flex-[999_1_560px] px-4 py-8 md:px-10">
        {children}
      </main>
    </div>
  );
}
