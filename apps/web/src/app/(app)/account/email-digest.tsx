"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { api } from "@/lib/api-client";

/** The daily email of unread notifications. Saves as soon as it changes. */
export function EmailDigestToggle({ initial }: { initial: boolean }) {
  const t = useTranslations("Account");
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"saved" | "failed" | null>(null);

  async function change(next: boolean) {
    setEnabled(next);
    setBusy(true);
    setStatus(null);
    try {
      await api("/api/v1/me/email-digest", { method: "PUT", json: { enabled: next } });
      setStatus("saved");
    } catch {
      setEnabled(!next);
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => void change(e.target.checked)}
          className="mt-1 size-5 shrink-0"
        />
        <span>
          <span className="block font-semibold">{t("digestLabel")}</span>
          <span className="block text-sm text-muted">{t("digestHelp")}</span>
        </span>
      </label>
      <p role="status" className="text-sm text-muted">
        {status === "saved" ? (enabled ? t("digestOn") : t("digestOff")) : null}
      </p>
      {status === "failed" && <FormAlert>{t("failed")}</FormAlert>}
    </div>
  );
}
