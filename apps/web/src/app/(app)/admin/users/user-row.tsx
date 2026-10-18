"use client";

import type { Role } from "@elearner/core";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { ParentChildren, type ChildLink } from "./parent-children";

const ROLE_OPTIONS = ["STUDENT", "TEACHER", "PARENT", "ADMIN"] as const satisfies readonly Role[];

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
  const t = useTranslations("AdminUsers");
  const roles = useTranslations("Roles");
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
        text: err instanceof ApiError ? err.message : t("failed"),
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
      t("roleChanged", { name: user.name, role: next }),
      () => setRole(prev),
    );
  };
  const toggleActive = () =>
    void run(
      async () => {
        await api(`/api/v1/admin/users/${user.id}`, { method: "PATCH", json: { isActive: !active } });
        setActive(!active);
      },
      active ? t("switchedOffNote", { name: user.name }) : t("switchedOnNote", { name: user.name }),
    );
  const cancelDeletion = () =>
    void run(
      () => api(`/api/v1/admin/users/${user.id}/restore`, { method: "POST" }),
      t("deletionCancelled", { name: user.name }),
    );
  const resend = () =>
    void run(
      () => api(`/api/v1/admin/users/${user.id}/invite`, { method: "POST" }),
      t("inviteSent", { email: user.email }),
    );

  return (
    <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
            active ? "bg-primary-soft text-primary-fg-strong" : "bg-canvas text-muted"
          }`}
          aria-hidden="true"
        >
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            {user.name}
            {user.isSelf && <span className="ml-2 text-sm font-normal text-muted">{t("you")}</span>}
            {user.deletesOn && (
              <span className="ml-2 rounded-full bg-live-soft px-2 py-0.5 text-xs font-semibold text-live-fg">
                {t("deletingOn", { date: user.deletesOn })}
              </span>
            )}
            {!active && (
              <span className="ml-2 rounded-full bg-live-soft px-2 py-0.5 text-xs font-semibold text-live-fg">
                {t("switchedOff")}
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
      </div>
      {user.deletesOn ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={cancelDeletion}
          aria-label={t("cancelDeletionLabel", { name: user.name })}
        >
          {t("cancelDeletion")}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`role-${user.id}`}>
            {t("roleFor", { name: user.name })}
          </label>
          <select
            id={`role-${user.id}`}
            value={role}
            disabled={busy || user.isSelf}
            onChange={(e) => changeRole(e.target.value as Role)}
            className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] disabled:opacity-60"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {roles(r)}
              </option>
            ))}
          </select>
          {user.needsInvite && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={resend}
              aria-label={t("resendLabel", { name: user.name })}
            >
              {t("resend")}
            </Button>
          )}
          {!user.isSelf && (
            <Button
              variant={active ? "danger" : "secondary"}
              disabled={busy}
              onClick={toggleActive}
              aria-label={t(active ? "switchOffLabel" : "switchOnLabel", { name: user.name })}
            >
              {active ? t("switchOff") : t("switchOn")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** "Asha Admin" → "AA"; one letter for a single name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}
