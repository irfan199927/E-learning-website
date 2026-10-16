"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function DateOfBirthForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const state = await api<{ kind: string }>("/api/v1/me/date-of-birth", {
        method: "POST",
        json: { dateOfBirth: String(new FormData(e.currentTarget).get("dateOfBirth") ?? "") },
      });
      router.replace(state.kind === "needs-consent" ? "/courses#parent-consent" : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fieldErrors[0]?.message ?? err.message)
          : "That didn't save. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <FormAlert>{error}</FormAlert>}
      <Field
        id="dateOfBirth"
        name="dateOfBirth"
        type="date"
        label="Date of birth"
        max={today}
        required
        hint="You can't change this later yourself; ask your school if it's wrong."
      />
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
