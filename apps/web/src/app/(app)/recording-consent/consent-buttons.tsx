"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** Agree to the recording notice, or withdraw an agreement. */
export function ConsentButtons({ agreed, version }: { agreed: boolean; version: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function send(agree: boolean) {
    setBusy(true);
    setNote(null);
    try {
      await api(
        "/api/v1/me/recording-consent",
        agree ? { method: "POST", json: { version } } : { method: "DELETE" },
      );
      setNote({
        tone: "success",
        text: agree
          ? "Thanks. You can join live classes now."
          : "Withdrawn. You can't join live classes from E-learner until you agree again.",
      });
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "That didn't work. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite">{note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}</div>
      {agreed ? (
        <Button variant="secondary" disabled={busy} onClick={() => void send(false)} className="w-fit">
          {busy ? "Withdrawing…" : "Withdraw my agreement"}
        </Button>
      ) : (
        <Button disabled={busy} onClick={() => void send(true)} className="w-fit">
          {busy ? "Saving…" : "I agree"}
        </Button>
      )}
    </div>
  );
}
