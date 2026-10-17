"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

interface Settings {
  upiId: string | null;
  payeeName: string | null;
  phone: string | null;
  instructions: string | null;
}

/** The UPI ID / number students pay to. Saved as a whole. */
export function PaymentSettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations("AdminPayments");
  const router = useRouter();
  const [form, setForm] = useState({
    upiId: settings.upiId ?? "",
    payeeName: settings.payeeName ?? "",
    phone: settings.phone ?? "",
    instructions: settings.instructions ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    setFieldErrors({});
    try {
      await api("/api/v1/admin/payment-settings", { method: "PUT", json: form });
      setNote({ tone: "success", text: t("upiSaved") });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
        setNote({ tone: "error", text: err.message });
      } else setNote({ tone: "error", text: t("failed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} aria-label={t("upiFormLabel")} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("upiId")}
          id="upi-id"
          value={form.upiId}
          onChange={set("upiId")}
          placeholder="school@okaxis"
          autoComplete="off"
          error={fieldErrors.upiId}
        />
        <Field
          label={t("upiPhone")}
          id="upi-phone"
          value={form.phone}
          onChange={set("phone")}
          inputMode="tel"
          placeholder="98765 43210"
          error={fieldErrors.phone}
        />
        <Field
          label={t("payeeName")}
          id="upi-name"
          value={form.payeeName}
          onChange={set("payeeName")}
          placeholder="Sunrise School"
          error={fieldErrors.payeeName}
        />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("instructions")}
        <textarea
          value={form.instructions}
          onChange={set("instructions")}
          rows={3}
          maxLength={1000}
          placeholder={t("instructionsPlaceholder")}
          className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px] font-normal"
        />
      </label>
      <div aria-live="polite">{note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}</div>
      <Button type="submit" disabled={busy} className="w-fit">
        {busy ? t("saving") : t("saveUpi")}
      </Button>
    </form>
  );
}
