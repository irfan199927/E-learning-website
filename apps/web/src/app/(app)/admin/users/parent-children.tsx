"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export interface ChildLink {
  id: string;
  name: string;
  email: string;
}

/** On a parent's row: the students they can see, with Unlink, and a box to link another by email. */
export function ParentChildren({
  parentId,
  parentName,
  links,
}: {
  parentId: string;
  parentName: string;
  links: ChildLink[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setNote({ tone: "success", text: ok });
      router.refresh();
      return true;
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "That didn't work. Try again.",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function link(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const studentEmail = String(new FormData(form).get("studentEmail") ?? "").trim();
    const ok = await run(
      () => api(`/api/v1/admin/users/${parentId}/children`, { method: "POST", json: { studentEmail } }),
      `Linked ${studentEmail}. ${parentName} can now see their progress.`,
    );
    if (ok) {
      form.reset();
      setAdding(false);
    }
  }

  const inputId = `child-email-${parentId}`;
  return (
    <div className="mt-2 flex flex-col gap-2 text-sm">
      <p className="text-muted">{links.length === 0 ? "Not linked to a student." : "Can see:"}</p>
      {links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {links.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-1 rounded-full border border-line-strong py-0.5 pl-3 pr-1"
            >
              <span title={l.email}>{l.name}</span>
              <Button
                variant="ghost"
                className="h-9 px-2 text-sm"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => api(`/api/v1/admin/parent-links/${l.id}`, { method: "DELETE" }),
                    `${parentName} no longer sees ${l.name}.`,
                  )
                }
                aria-label={`Unlink ${l.name} from ${parentName}`}
              >
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form onSubmit={link} className="flex flex-wrap items-end gap-2" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor={inputId} className="font-semibold">
              Student&apos;s email
            </label>
            <input
              id={inputId}
              name="studentEmail"
              type="email"
              required
              autoFocus
              className="h-11 min-w-60 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
            />
          </div>
          <Button type="submit" disabled={busy}>
            Link
          </Button>
          <Button variant="secondary" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          className="w-fit px-2"
          onClick={() => setAdding(true)}
          aria-label={`Link a student to ${parentName}`}
        >
          Link a student
        </Button>
      )}
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
    </div>
  );
}
