"use client";

import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** Type DELETE, then delete. The server signs the person out, so we leave for the sign-in page. */
export function DeleteAccount() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/me/deletion-request", { method: "POST", json: { confirm } });
      window.location.assign("/sign-in?deleted=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} aria-label="Delete my account" className="flex flex-col gap-4">
      <Field
        label="Type DELETE to confirm"
        id="confirm-delete"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
      />
      {error && <FormAlert>{error}</FormAlert>}
      <Button variant="live" type="submit" disabled={busy || confirm !== "DELETE"} className="w-fit">
        {busy ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}
