"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** Agree to the recording notice, or withdraw an agreement. */
export function ConsentButtons({ agreed, version }: { agreed: boolean; version: string }) {
  const t = useTranslations("RecordingConsent");
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
        text: agree ? t("thanks") : t("withdrawnNote"),
      });
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : t("failed"),
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
          {busy ? t("withdrawing") : t("withdraw")}
        </Button>
      ) : (
        <Button disabled={busy} onClick={() => void send(true)} className="w-fit">
          {busy ? t("saving") : t("agree")}
        </Button>
      )}
    </div>
  );
}
