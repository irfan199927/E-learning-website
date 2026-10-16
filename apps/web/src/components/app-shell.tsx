import type { Role } from "@elearner/core";
import { Icon } from "./icons";
import { ShellFrame } from "./shell-frame";
import { SignOutButton } from "./sign-out-button";

export function AppShell({
  user,
  streak,
  children,
}: {
  user: { name: string; role: Role };
  /** Learning streak in days (students only). */
  streak: number | null;
  children: React.ReactNode;
}) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <ShellFrame
      role={user.role}
      topbar={
        <>
          {streak !== null && (
            <p className="flex items-center gap-2" title="Days in a row with lesson time">
              <Icon name="flame" size={28} />
              <span className="flex flex-col leading-tight">
                <b className="text-lg">{streak}</b>
                <span className="text-xs text-muted">{streak === 1 ? "Day streak" : "Days streak"}</span>
              </span>
            </p>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden min-w-0 flex-col text-right sm:flex">
              <span className="truncate text-sm font-semibold">{user.name}</span>
              <span className="text-xs capitalize text-muted">{user.role.toLowerCase()}</span>
            </span>
            <span
              className="grid size-10 place-items-center rounded-full bg-success-soft text-sm font-bold text-success"
              aria-hidden="true"
            >
              {initials}
            </span>
            <SignOutButton />
          </div>
        </>
      }
    >
      {children}
    </ShellFrame>
  );
}
