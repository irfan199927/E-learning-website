"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export interface ListItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  when: string;
}

/** The list, with "Mark all as read". Opening one marks it read, then follows its link. */
export function NotificationList({ items, unread }: { items: ListItem[]; unread: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  // Unread on this page that were opened here since it loaded come off the server's total.
  const unreadNow = unread - items.filter((i) => !i.read && readIds.has(i.id)).length;

  async function open(n: ListItem) {
    setError(null);
    try {
      const { link } = await api<{ link: string | null }>(`/api/v1/notifications/${n.id}`, {
        method: "PATCH",
      });
      setReadIds((s) => new Set(s).add(n.id));
      if (link) router.push(link);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  }

  async function readAll() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/notifications/read-all", { method: "POST" });
      setReadIds(new Set(items.map((i) => i.id)));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {unreadNow > 0 ? `${unreadNow} unread` : "All caught up"}
        </p>
        {unreadNow > 0 && (
          <Button variant="secondary" disabled={busy} onClick={() => void readAll()}>
            Mark all as read
          </Button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {items.map((n) => {
          const read = n.read || readIds.has(n.id);
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void open(n)}
                className={`flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-canvas ${read ? "" : "bg-primary-soft/40"}`}
              >
                <span
                  className={`mt-2 size-2.5 shrink-0 rounded-full ${read ? "bg-transparent" : "bg-primary"}`}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={read ? "" : "font-semibold"}>
                    {n.title}
                    {!read && <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className="text-sm text-muted">{n.body}</span>
                  <span className="mt-0.5 text-xs text-muted">{n.when}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
