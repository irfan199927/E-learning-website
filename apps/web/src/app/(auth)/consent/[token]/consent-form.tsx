"use client";

import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function ConsentForm({ token, studentName }: { token: string; studentName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/consent/${token}`, {
        method: "POST",
        json: { parentName: String(f.get("parentName") ?? ""), declaration: f.get("declaration") === "on" },
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fieldErrors[0]?.message ?? err.message)
          : "That didn't save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <FormAlert tone="success">
        Thank you. {studentName} can now join their courses. You can close this page.
      </FormAlert>
    );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <FormAlert>{error}</FormAlert>}
      <Field
        id="parentName"
        name="parentName"
        label="Your full name"
        autoComplete="name"
        required
        maxLength={120}
      />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="declaration" className="mt-0.5 size-5 shrink-0" required />
        <span>
          I am {studentName}&apos;s parent or legal guardian, and I consent to the school using their
          information as described above.
        </span>
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Give consent"}
      </Button>
    </form>
  );
}
