"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** For under-18s without consent: send (or re-send) the approval link to a parent. */
export function ParentConsentPanel({ pendingEmail }: { pendingEmail: string | null }) {
  const router = useRouter();
  const [sentTo, setSentTo] = useState(pendingEmail);
  const [editing, setEditing] = useState(!pendingEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ sentTo: string }>("/api/v1/me/parent-consent", {
        method: "POST",
        json: { parentEmail: String(new FormData(e.currentTarget).get("parentEmail") ?? "") },
      });
      setSentTo(res.sentTo);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fieldErrors[0]?.message ?? err.message)
          : "That didn't send. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="parent-consent"
      aria-labelledby="consent-h"
      className="scroll-mt-24 rounded-[var(--radius-card)] border-2 border-primary bg-primary-soft p-5"
    >
      <h2 id="consent-h" className="font-display text-xl font-bold">
        A parent needs to approve your account
      </h2>
      <p className="mt-1">
        You&apos;re under 18, so a parent or guardian has to agree before you can join courses. You can look
        around until then.
      </p>
      {sentTo && !editing ? (
        <div className="mt-4 flex flex-col gap-3" role="status">
          <p>
            We emailed <b>{sentTo}</b> a link to approve. Ask them to check their inbox (and spam folder). The
            link works for 7 days.
          </p>
          <Button variant="secondary" className="w-fit" onClick={() => setEditing(true)}>
            Send again or use another email
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
          <div className="flex-1">
            <Field
              id="parentEmail"
              name="parentEmail"
              type="email"
              label="Parent's or guardian's email"
              defaultValue={sentTo ?? ""}
              autoComplete="off"
              required
              error={error ?? undefined}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send approval link"}
          </Button>
        </form>
      )}
      {error && !editing && <FormAlert>{error}</FormAlert>}
    </section>
  );
}
