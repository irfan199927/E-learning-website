"use client";

import type { Role } from "@elearner/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { ParentChildren, type ChildLink } from "./parent-children";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "STUDENT", label: "Student" },
  { value: "TEACHER", label: "Teacher" },
  { value: "PARENT", label: "Parent" },
  { value: "ADMIN", label: "Admin" },
];

export interface UserRowData {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  needsInvite: boolean;
  isSelf: boolean;
  /** Parents only. */
  children: ChildLink[] | null;
  /** They asked to delete their account: the date it's purged. Only "Cancel deletion" is offered until then. */
  deletesOn: string | null;
  meta: string;
}

/** One account: role picker (saved on change), switch off/on, and resend the invite for people who never set a password. */
export function UserRow({ user }: { user: UserRowData }) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.isActive);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function run(action: () => Promise<unknown>, ok: string, undo?: () => void) {
    setBusy(true);
    setNote(null);
    try {
      await action();
      setNote({ tone: "success", text: ok });
      router.refresh();
    } catch (err) {
      undo?.();
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "That didn't work. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  const changeRole = (next: Role) => {
    const prev = role;
    setRole(next);
    void run(
      () => api(`/api/v1/admin/users/${user.id}`, { method: "PATCH", json: { role: next } }),
      `${user.name} is now ${ROLE_OPTIONS.find((r) => r.value === next)!.label.toLowerCase()}.`,
      () => setRole(prev),
    );
  };
  const toggleActive = () =>
    void run(
      async () => {
        await api(`/api/v1/admin/users/${user.id}`, { method: "PATCH", json: { isActive: !active } });
        setActive(!active);
      },
      active ? `${user.name} can't sign in now.` : `${user.name} can sign in again.`,
    );
  const cancelDeletion = () =>
    void run(
      () => api(`/api/v1/admin/users/${user.id}/restore`, { method: "POST" }),
      `Cancelled. ${user.name} can sign in again.`,
    );
  const resend = () =>
    void run(
      () => api(`/api/v1/admin/users/${user.id}/invite`, { method: "POST" }),
      `Sent ${user.email} a new link to choose a password.`,
    );

  return (
    <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">
          {user.name}
          {user.isSelf && <span className="ml-2 text-sm font-normal text-muted">(you)</span>}
          {user.deletesOn && (
            <span className="ml-2 rounded-full bg-live-soft px-2 py-0.5 text-xs font-semibold text-[#A11C14]">
              Deleting on {user.deletesOn}
            </span>
          )}
          {!active && (
            <span className="ml-2 rounded-full bg-live-soft px-2 py-0.5 text-xs font-semibold text-[#A11C14]">
              Switched off
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted">{user.email}</p>
        <p className="text-sm text-muted">{user.meta}</p>
        {user.children && role === "PARENT" && (
          <ParentChildren parentId={user.id} parentName={user.name} links={user.children} />
        )}
        {note && (
          <div className="mt-2">
            <FormAlert tone={note.tone}>{note.text}</FormAlert>
          </div>
        )}
      </div>
      {user.deletesOn ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={cancelDeletion}
          aria-label={`Cancel deletion of ${user.name}`}
        >
          Cancel deletion
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`role-${user.id}`}>
            Role for {user.name}
          </label>
          <select
            id={`role-${user.id}`}
            value={role}
            disabled={busy || user.isSelf}
            onChange={(e) => changeRole(e.target.value as Role)}
            className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] disabled:opacity-60"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {user.needsInvite && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={resend}
              aria-label={`Resend invite to ${user.name}`}
            >
              Resend invite
            </Button>
          )}
          {!user.isSelf && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={toggleActive}
              aria-label={`${active ? "Switch off" : "Switch on"} ${user.name}`}
            >
              {active ? "Switch off" : "Switch on"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
